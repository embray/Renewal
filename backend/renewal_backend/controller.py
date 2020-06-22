"""
Pumps news sources into the system.

Continuously reads the sources collection on an interval, and places new
sources on the source exchange if they have not been successfully crawled since
the last refresh interval.
"""

import asyncio
import copy
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from functools import partial

import pymongo
from bson import ObjectId

from .agent import Agent
from .mongodb import MongoMixin
from .utils import dict_slice, truncate_dict


class Controller(Agent, MongoMixin):
    def __init__(self, config, log=None):
        super().__init__(config, log=log)
        # These queues are meant to ensure the crawl/scrape pumps aren't
        # requeing articles/feeds that have already been queued to the messge
        # queue
        # This values in this dict are not themeselves queues; rather they are
        # just sets tracking which actions have been sent to the message queue.
        # These are removed when the action is resolved (e.g. an article that
        # was queued to be crawled has been crawled).
        self.queues = defaultdict(set)

    def get_exchanges(self):
        return ['feeds', 'articles', 'images']

    async def queue_feeds(self, producer, since=None):
        # TODO: MonogoDB queries are blocking for now; we could try replacing
        # this with the async MonogoDB backend if this appears to be a
        # bottleneck.
        filt = {}
        if since is not None:
            filt = {
                '$and': [
                    {'$or': [
                        {'is_redirect': False},
                        {'is_redirect': {'$exists': False}}
                    ]},
                    {'$or': [
                        {'last_crawled': {'$exists': False}},
                        {'last_crawled': {'$lte': since}}
                    ]}
                ]
            }

        feeds = self.db['feeds'].find(filt)
        for feed in feeds:
            if feed['_id'] in self.queues['crawled_feeds']:
                continue
            else:
                self.queues['crawled_feeds'].add(feed['_id'])

            self.log.info(f'producing {feed["type"]} feed at {feed["url"]}')
            await producer.proxy.crawl_feed(resource=feed)

    async def queue_articles(self, producer, since=None):
        """
        Queue articles to be crawled; normally articles will be crawled
        immediately, but this also works through any backlog of uncrawled
        articles (e.g. if they were missed while the article crawlers were
        down).

        The ``since`` argument is currently unused and is only for
        signature compatibility with `Controller.queue_feeds`.
        """

        filt = {
            '$and': [
                {'$or': [
                    {'is_redirect': False},
                    {'is_redirect': {'$exists': False}}
                ]},
                {'last_crawled': {'$exists': False}}
            ]
        }

        # sort by last_seen descending so that articles that were most recently
        # seen in the feeds are given priority here; later we might also
        # consider adding message priorities to give these articles lower
        # priority than recently found articles
        sort = [('last_seen', pymongo.DESCENDING)]
        articles = self.db['articles'].find(filt, sort=sort)
        for article in articles:
            if article['_id'] in self.queues['crawled_articles']:
                continue
            else:
                self.queues['crawled_articles'].add(article['_id'])

            self.log.info(f'producing article {article["url"]}')
            await producer.proxy.crawl_article(resource=article)

    async def save_article(self, *, article, article_producer=None):
        self.log.info(f'inserting article into the articles collection: '
                      f'{article}')
        # TODO: Do we want to check if the URL already exists?  And if so do
        # we allow new item crawlers to crawl a URL before checking if we've
        # already seen it before?
        # Right now if the URL does not exist we upsert it, and if so we
        # increase the number of times it's been seen.
        r = self.db['articles'].update_one(
                {'url': article['url']},
                {
                    '$set': {'url': article['url'], 'lang': article['lang']},
                    '$inc': {'times_seen': 1},
                    '$currentDate': {'last_seen': True}
                },
                upsert=True)

        if r.modified_count != 0:
            self.log.info('updated existing article')
        else:
            self.log.info('inserted new article')
            # Send new article to the crawlers
            if article_producer is not None:
                await article_producer.proxy.crawl_article(resource=article)

    async def update_resource(self, *, collection, resource, type, values={}):
        """
        Update the given resource, which should be specified by its URL.

        The collection which the resource is found must be specified (e.g.
        'feeds' or 'articles').

        The update ``type`` is currently either ``'accessed'`` or
        ``'crawled'``.
        """

        self.log.info(f'updating {collection} resource {resource["url"]}: '
                      f'with {truncate_dict(values)}')
        updates = {}
        is_redirect = False
        canonical_url = values.get('canonical_url')
        if canonical_url and canonical_url != resource['url']:
            is_redirect = True
            # In the case of receiving the canonical URL of a resource,
            # we just update the old resource with the canonical_url
            # and the last accessed/crawled time; then we will create
            # or update the resource for the canonical URL
            updates['$set'] = dict_slice(values, 'canonical_url',
                                         f'last_{type}', allow_missing=True)
            # This is equivalent to saying 'url' != 'canonical_url' so is
            # technically superfluous, but also faster to query on
            updates['$set']['is_redirect'] = True
        elif values:
            updates['$set'] = values

        updates['$inc'] = {f'times_{type}': 1}

        filt = {'url': resource['url']}
        doc = self.db[collection].find_one_and_update(filt, updates)
        if doc is None:
            self.log.warn(f'{resource["url"]} not found in {collection}')

        # Key for the local queue tracking resource updates of the given type
        # (e.g. crawled_articles)
        queue_key = f'{type}_{collection}'
        if doc is not None and queue_key in self.queues:
            try:
                self.queues[queue_key].remove(doc['_id'])
            except KeyError:
                pass

        # Create a new resource for the canonical_url
        if is_redirect and doc is not None:
            doc = copy.deepcopy(doc)
            del doc['_id']
            doc['url'] = canonical_url
            doc['is_redirect'] = False
            # Add any additional properties that were sent by the crawler
            # for this resource
            doc.update(values)
            # Insert/upsert the resource at the canonical_url
            res = self.db[collection].find_one_and_update(
                    {'url': doc['url']}, {'$set': doc},
                    upsert=True, return_document=pymongo.ReturnDocument.AFTER)
            # Also remove the canonical resource from the local queues if
            # applicable
            if res is not None and queue_key in self.queues:
                try:
                    self.queues[queue_key].remove(res['_id'])
                except KeyError:
                    pass

    async def start_resource_producer(self, connection, resource):
        """
        Queue feed and articles from the database to be crawled or
        re-crawled.

        See `Controller.queue_feeds` and `Controller.queue_articles`.

        Resource can be either 'feeds' or 'articles'.
        """
        # This channel is dedicated to queuing sources onto
        # sources exchange
        refresh_rate = getattr(self.config.controller,
                               resource + '_refresh_rate')
        self.log.info(
            f'starting {resource} producer; checking {resource} every '
            f'{refresh_rate} seconds')
        producer = await self.create_producer(connection, resource)

        # When starting up, we could be resuming from a restart, so still only
        # take sources that haven't been updated since the longest possible
        # refresh interval
        delta = timedelta(seconds=refresh_rate)
        queue_method = getattr(self, 'queue_' + resource)
        while True:
            since = datetime.now() - delta
            await queue_method(producer, since=since)
            await asyncio.sleep(refresh_rate)

    async def start_save_article_worker(self, connection):
        producer = await self.create_producer(connection, 'articles')
        worker = partial(self.save_article, article_producer=producer)
        await producer.create_worker('save_article', worker, auto_delete=True)

    async def start_update_resource_worker(self, connection, resource_type):
        """
        Handles messages on a queue bound to the "feeds" exchange with
        routing key "update_resource".

        Currently this is used by source crawler agents to signify when they
        have successfully crawled a source by setting the last_crawled field
        on the source.

        If ``collection is None`` then the collection has the same name as
        the exchange.

        TODO: This can also be used to signal error conditions on sources.
        NOTE: This has been generalized for handling article updates as well;
        the docstring should be rewritten.
        """

        # The DB collection and associated exchange names are always the
        # resource type in plural; e.g. feed -> feeds
        collection = exchange = resource_type + 's'
        producer = await self.create_producer(connection, exchange)
        worker = partial(self.update_resource, collection=collection)
        # TODO: I think it might be confusing to have a single
        # "update_resource" method used for all types of resources (feeds and
        # articles).  Currently there is no need for separate methods to
        # update feeds vs. articles, but it will likely make sense to have that
        # soon.
        await producer.create_worker(
                f'update_{resource_type}', worker, auto_delete=True)

    async def start_loop(self, connection):
        for resource_type in ['feed', 'article']:
            await self.start_update_resource_worker(connection, resource_type)

        await self.start_save_article_worker(connection)
        # Should run forever
        await asyncio.gather(
            self.start_resource_producer(connection, 'feeds'),
            self.start_resource_producer(connection, 'articles')
        )


if __name__ == '__main__':
    Controller.main()
