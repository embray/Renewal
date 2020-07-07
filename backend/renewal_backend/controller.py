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
from aio_pika.patterns import NackMessage
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

    async def queue_crawl_feeds(self, producer, since=None):
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
            self.log.debug(
                f'len(queues.crawled_feeds) = '
                f'{len(self.queues["crawled_feeds"])}')
            await producer.proxy.crawl_feed(resource=feed)

    async def queue_crawl_articles(self, producer, since=None):
        """
        Queue articles to be crawled; normally articles will be crawled
        immediately, but this also works through any backlog of uncrawled
        articles (e.g. if they were missed while the article crawlers were
        down).

        The ``since`` argument is currently unused and is only for
        signature compatibility with `Controller.queue_feeds`.
        """

        # Queue any articles that haven't already been crawled
        await self._queue_article_updates(producer, 'crawl_article',
                'crawled_articles', {'last_crawled': {'$exists': False}})

    async def queue_scrape_articles(self, producer, since=None):
        """
        Queue articles to be scraped; normally articles will be scraped
        as soon as they've been successfully crawled for this first time,
        but this also works through any backlog of unscraped articles (e.g.
        if they were missed while the article scrapers were down).

        The ``since`` argument is currently unused and is only for
        signature compatibility with `Controller.queue_feeds`.
        """

        await self._queue_article_updates(producer, 'scrape_article',
                'scraped_articles',
                {'$and': [
                    {'contents': {'$exists': True}},
                    {'last_scraped': {'$exists': False}}
                ]})

    async def _queue_article_updates(self, producer, method_name, queue_key,
                                     filt):
        filt = {
            '$and': [
                {'$or': [
                    {'is_redirect': False},
                    {'is_redirect': {'$exists': False}}
                ]},
                filt
            ]
        }

        # sort by last_seen descending so that articles that were most recently
        # seen in the feeds are given priority here; later we might also
        # consider adding message priorities to give these articles lower
        # priority than recently found articles
        sort = [('last_seen', pymongo.DESCENDING)]
        articles = self.db['articles'].find(filt, sort=sort)
        method = getattr(producer.proxy, method_name)

        for article in articles:
            if article['_id'] in self.queues[queue_key]:
                continue
            else:
                self.queues[queue_key].add(article['_id'])

            self.log.info(f'adding article to {queue_key}: {article["url"]}')
            queue_size = len(self.queues[queue_key])
            self.log.debug(f'len(queues.{queue_key}) = {queue_size}')
            await method(resource=article)

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

    async def update_resource(self, *, connection, collection, resource, type,
                              status={'ok': True}, updates={}):
        """
        Update the given resource, which should be specified by its URL.

        The collection which the resource is found must be specified (e.g.
        'feeds' or 'articles').

        The update ``type`` is currently either ``'crawled'`` or ``'scraped'``.
        """

        self.log.info(f'updating {collection} resource {resource["url"]}; '
                      f'status: {status}, updates: {truncate_dict(updates)}')
        _updates = {'$set': {f'status_{type}': status}}
        is_redirect = False
        canonical_url = updates.get('canonical_url')
        if canonical_url and canonical_url != resource['url']:
            is_redirect = True
            # In the case of receiving the canonical URL of a resource,
            # we just update the old resource with the canonical_url
            # and the last accessed/crawled time; then we will create
            # or update the resource for the canonical URL
            partial_update = dict_slice(updates, 'canonical_url',
                                        f'last_{type}', allow_missing=True)
            _updates['$set'].update(partial_update)
            # This is equivalent to saying 'url' != 'canonical_url' so is
            # technically superfluous, but also faster to query on
            _updates['$set']['is_redirect'] = True
            new_resource = copy.deepcopy(resource)
            new_resource['url'] = canonical_url

            # Create an update for the new resource at the canonical URL
            await self.update_resource(connection=connection,
                                       collection=collection,
                                       resource=new_resource, type=type,
                                       status=status, updates=updates)
        elif updates:
            update_method_name = f'_update_{type}_{collection}_hook'
            if hasattr(self, update_method_name):
                update_method = getattr(self, update_method_name)
                updates = await update_method(connection, resource, status,
                                              updates)
            _updates['$set'].update(updates)

        _updates['$inc'] = {f'times_{type}': 1}

        filt = {'url': resource['url']}
        try:
            doc = self.db[collection].find_one_and_update(filt, _updates)
        except Exception as exc:
            self.log.error(
                f'could not make {type} update on {collection} '
                f'{resource["url"]}; reason: {exc}')
            raise NackMessage()

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
            self.log.debug(
                f'len(queues.{queue_key}) = {len(self.queues[queue_key])}')

        # Create a new resource for the canonical_url
        if is_redirect and doc is not None:
            doc = copy.deepcopy(doc)
            del doc['_id']
            doc['url'] = canonical_url
            doc['is_redirect'] = False
            # Add any additional properties that were sent by the crawler
            # for this resource
            doc.update(updates)
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
                self.log.debug(
                    f'len(queues.{queue_key}) = {len(self.queues[queue_key])}')

    async def _update_scraped_articles_hook(self, connection, article, status,
                                            updates):
        """
        When an article is scraped the results of the article scrape are
        returned, along with metadata about the article's site.

        This hook handles saving the article site in the sites collection and
        replacing the 'site' key with the ID of the document for that site.

        If the site also includes a logo image we create a document for the
        image resource, save the image resource's ID with the site, and send
        the image to be downloaded.
        """

        if not status.get('ok', False):
            # If the status is not OK or otherwise invalid, don't perform
            # any additional updates
            return updates

        # Set the article's article_id once it has been successfully scraped
        # (only if it has been scraped for the first time)
        doc = self.db['articles'].find_one({
            'url': article['url'], 'last_scraped': {'$exists': True}
        })
        already_scraped = doc is not None
        if not already_scraped:
            # Normally an article should not be scraped more than once, but it
            # could happen in case of some race conditions
            updates['article_id'] = self._get_next_sequence_id('article_id')

        site = updates.pop('site', None)
        if site is not None:
            icon_url = site.get('icon_url')
            if icon_url:
                icon_doc = await self._maybe_crawl_image(connection, icon_url)
                if icon_doc:
                    site['icon_resource_id'] = icon_doc['_id']

            site_doc = self.db['sites'].find_one_and_update(
                    {'url': site['url']}, {'$set': site}, upsert=True,
                    return_document=pymongo.ReturnDocument.AFTER)
            updates['site'] = site_doc['_id']

        return updates

    def _get_next_sequence_id(self, sequence):
        """
        Manage monotonically incrementing sequences.

        Returns the next ID in the sequence, or zero if the sequence is created
        for the first time.
        """

        seq = self.db['sequences'].find_one_and_update(
                {'_id': sequence}, {'$inc': {'seq': 1}},
                projection={'seq': True, '_id': False}, upsert=True)

        if seq is None:
            return 0
        else:
            return seq['seq']

    async def _maybe_crawl_image(self, connection, image_url):
        """
        Create a resource document for the given image URL, and if the image
        has not already been saved, send it to be downloaded.
        """

        img_doc = self.db['images'].find_one_and_update(
                {'url': image_url}, {'$set': {'url': image_url}},
                upsert=True, return_document=pymongo.ReturnDocument.AFTER)
        if img_doc and not img_doc.get('contents'):
            # Send the icon to be downloaded
            producer = await self.create_producer(connection, 'images')
            await producer.proxy.crawl_image(resource=img_doc)

        return img_doc

    async def start_resource_queue(self, connection, resource, action='crawl'):
        """
        Queue feed and articles from the database to be crawled or
        re-crawled.

        See `Controller.queue_feeds` and `Controller.queue_articles`.

        Resource can be either 'feeds' or 'articles'.
        """
        # This channel is dedicated to queuing sources onto
        # sources exchange
        # E.g. access_feeds_rate
        refresh_rate = getattr(self.config.controller,
                               f'{action}_{resource}_rate')
        self.log.info(
            f'starting {action} {resource} producer; checking {resource} every '
            f'{refresh_rate} seconds')
        producer = await self.create_producer(connection, resource)

        # When starting up, we could be resuming from a restart, so still only
        # take sources that haven't been updated since the longest possible
        # refresh interval
        delta = timedelta(seconds=refresh_rate)
        queue_method = getattr(self, f'queue_{action}_{resource}')
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
        worker = partial(self.update_resource, connection=connection,
                         collection=collection)
        # TODO: I think it might be confusing to have a single
        # "update_resource" method used for all types of resources (feeds and
        # articles).  Currently there is no need for separate methods to
        # update feeds vs. articles, but it will likely make sense to have that
        # soon.
        await producer.create_worker(
                f'update_{resource_type}', worker, auto_delete=True)

    async def start_loop(self, connection):
        for resource_type in ['feed', 'article', 'image']:
            await self.start_update_resource_worker(connection, resource_type)

        await self.start_save_article_worker(connection)
        # Should run forever
        await asyncio.gather(
            self.start_resource_queue(connection, 'feeds'),
            self.start_resource_queue(connection, 'articles'),
            self.start_resource_queue(connection, 'articles', 'scrape')
        )


if __name__ == '__main__':
    Controller.main()
