"""
Pumps news sources into the system.

Continuously reads the sources collection on an interval, and places new
sources on the source exchange if they have not been successfully crawled since
the last refresh interval.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from bson import ObjectId

from .agent import Agent
from .mongodb import MongoMixin


log = logging.getLogger('controller')


class Controller(Agent, MongoMixin):
    # TODO: We need a centralized configuration for all exchanges, so that
    # every agent that needs to call declare_exchange does so with the same
    # settings for each exchange.
    async def queue_feeds(self, producer, since=None):
        # TODO: MonogoDB queries are blocking for now; we could try replacing
        # this with the async MonogoDB backend if this appears to be a
        # bottleneck.
        filt = {}
        if since is not None:
            filt = {'$or': [{'last_scraped': {'$exists': False}},
                            {'last_scraped': {'$lte': since}}]}

        feeds = self.db['feeds'].find(filt)
        for feed in feeds:
            log.info(f'producing {feed["type"]} feed at {feed["url"]}')
            await producer.proxy.crawl_feed(feed=feed)

    async def insert_resource(self, *, resource):
        log.info(f'inserting new resource into the resources collection: '
                 f'{resource}')
        # TODO: Do we want to check if the URL already exists?  And if so do
        # we allow new item crawlers to crawl a URL before checking if we've
        # already seen it before?
        # Right now if the URL does not exist we upsert it, and if so we
        # increase the number of times it's been seen.
        self.db['resources'].update_one(
                {'url': resource['url']},
                {'$set': {'url': resource['url'], 'lang': resource['lang']},
                 '$inc': {'times_seen': 1}},
                upsert=True)

    def update_resource(self, *, collection, resource, updates):
        """
        Update the given resource, which should be specified by its URL.

        The collection which the resource is found must be specified (e.g.
        'feeds' or 'articles').
        """

        log.info(f'updating {collection} resource {resource["url"]}: '
                 f'{updates}')
        self.db[collection].update_one(resource, updates)

    async def update_feed(self, *, feed, updates):
        return self.update_resource(
                collection='feeds', resource=feed, updates=updates)

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

    async def start_new_resource_worker(self, connection):
        producer = await self.create_producer(connection, 'resources')

        # Create a worker to handle new URLs produced from source workers
        # TODO: For now this is inserting into a collection called 'resources'
        # but in practice this should probably be changed to
        # 'articles'--although I intend to define a generic "resource" type
        # which can be a feed or an article, the code here is specifically for
        # handling new *article* resources (a subclass of "resource", in a
        # manner of speaking).
        await producer.create_worker(
                'new_resource', self.insert_resource, auto_delete=True)

    async def start_update_feed_worker(self, connection):
        """
        Handles messages on a queue bound to the "sources" exchange with
        routing key "update_source".

        Currently this is used by source crawler agents to signify when they
        have successfully crawled a source by setting the last_scraped field
        on the source.

        TODO: This can also be used to signal error conditions on sources.
        """

        producer = await self.create_producer(connection, 'feeds')

        await producer.create_worker(
                'update_feed', self.update_feed, auto_delete=True)

    async def start_loop(self, connection):
        await self.start_update_feed_worker(connection)
        await self.start_new_resource_worker(connection)
        # Should run forever
        await self.start_feed_producer(connection)


if __name__ == '__main__':
    Controller.main()
