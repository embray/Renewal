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


class Controller(Agent, MongoMixin):
    def get_exchanges(self):
        return ['feeds', 'articles']

    async def queue_feeds(self, producer, since=None):
        # TODO: MonogoDB queries are blocking for now; we could try replacing
        # this with the async MonogoDB backend if this appears to be a
        # bottleneck.
        filt = {}
        if since is not None:
            filt = {'$or': [{'last_crawled': {'$exists': False}},
                            {'last_crawled': {'$lte': since}}]}

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
                await article_producer.proxy.crawl_article(article=article)

    def update_resource(self, *, collection, resource, type, values={}):
        """
        Update the given resource, which should be specified by its URL.

        The collection which the resource is found must be specified (e.g.
        'feeds' or 'articles').

        The update ``type`` is currently either ``'accessed'`` or
        ``'crawled'``.
        """

        self.log.info(f'updating {collection} resource {resource["url"]}: '
                      f'with {values}')
        updates = {}
        if values:
            updates['$set'] = values

        if type in ['accessed', 'crawled']:
            updates['$inc'] = {f'times_{type}': 1}
        else:
            # TODO: Ignore this, or raise an error?
            pass

        self.db[collection].update_one(resource, updates)

    async def start_feed_producer(self, connection):
        # This channel is dedicated to queuing sources onto
        # sources exchange
        producer = await self.create_producer(connection, 'feeds')

        # When starting up, we could be resuming from a restart, so still only
        # take sources that haven't been updated since the longest possible
        # refresh interval
        delta = timedelta(seconds=self.config.controller.feeds_refresh_rate)
        while True:
            since = datetime.now() - delta
            await self.queue_feeds(producer, since=since)
            await asyncio.sleep(self.config.controller.feeds_refresh_rate)

    async def start_save_article_worker(self, connection):
        producer = await self.create_producer(connection, 'articles')
        worker = partial(self.save_article, article_producer=producer)
        await producer.create_worker('save_article', worker, auto_delete=True)

    async def start_update_resource_worker(self, connection, exchange,
                                           collection):
        """
        Handles messages on a queue bound to the "feeds" exchange with
        routing key "update_resource".

        Currently this is used by source crawler agents to signify when they
        have successfully crawled a source by setting the last_crawled field
        on the source.

        TODO: This can also be used to signal error conditions on sources.
        NOTE: This has been generalized for handling article updates as well;
        the docstring should be rewritten.
        """

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
        await self.start_update_resource_worker(connection, 'feeds', 'feeds')
        await self.start_update_resource_worker(connection, 'articles',
                'articles')
        await self.start_save_article_worker(connection)
        # Should run forever
        await self.start_feed_producer(connection)


if __name__ == '__main__':
    Controller.main()
