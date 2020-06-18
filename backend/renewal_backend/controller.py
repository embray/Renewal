"""
Pumps news sources into the system.

Continuously reads the sources collection on an interval, and places new
sources on the source exchange if they have not been successfully crawled since
the last refresh interval.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from functools import partial

from bson import ObjectId

from .agent import Agent
from .mongodb import MongoMixin
from .utils import dict_slice, truncate_dict


class Controller(Agent, MongoMixin):
    def get_exchanges(self):
        return ['feeds', 'articles']

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
            self.log.info(f'producing {feed["type"]} feed at {feed["url"]}')
            await producer.proxy.crawl_feed(resource=feed)

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

    def update_resource(self, *, collection, resource, type, values={}):
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
        doc = self.db[collection].find_one_and_update(filt, updates,
                projection={'_id': False})

        # Create a new resource for the canonical_url
        if is_redirect and doc is not None:
            doc['url'] = canonical_url
            doc['is_redirect'] = False
            # Add any additional properties that were sent by the crawler
            # for this resource
            doc.update(values)
            # Insert/upsert the resource at the canonical_url
            self.db[collection].update({'url': doc['url']}, {'$set': doc},
                                       upsert=True)

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

    async def start_update_resource_worker(self, connection, exchange,
                                           collection=None):
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

        if collection is None:
            collection = exchange

        producer = await self.create_producer(connection, exchange)
        worker = partial(self.update_resource, collection=collection)
        # TODO: I think it might be confusing to have a single
        # "update_resource" method used for all types of resources (feeds and
        # articles).  Currently there is no need for separate methods to
        # update feeds vs. articles, but it will likely make sense to have that
        # soon.
        await producer.create_worker(
                'update_resource', worker, auto_delete=True)

    async def start_loop(self, connection):
        await self.start_update_resource_worker(connection, 'feeds')
        await self.start_update_resource_worker(connection, 'articles')
        await self.start_save_article_worker(connection)
        # Should run forever
        await self.start_feed_producer(connection)


if __name__ == '__main__':
    Controller.main()
