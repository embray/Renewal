import asyncio
import logging
import hashlib
import time
from functools import partial
from http.client import OK, NOT_MODIFIED

from aio_pika.patterns import NackMessage
from aiohttp import ClientSession
import feedparser

from ..agent import Agent
from ..utils import dict_slice, normalize_language

log = logging.getLogger('feed_crawler')


class FeedCrawler(Agent):
    async def crawl_feed(self, *, feed, article_producer=None,
                         feed_producer=None):
        log.info(f'crawling {feed["type"]} feed {feed["url"]}')

        text = await self.retrieve_feed_text(
                feed, feed_producer=feed_producer)

        # If text is None, in this case this means the feed was unmodified
        # based on stored etags/last-modified date
        if text is None:
            log.info(f'ignoring unmodified {feed["type"]} feed '
                     f'{feed["url"]}')
            return

        try:
            parsed = feedparser.parse(text)
        except Exception as exc:
            log.warning(
                f'error parsing feed {feed["url"]}; sending '
                f'nack: {exc}')
            raise NackMessage()

        if not parsed or not parsed.get('feed'):
            # TODO: Again, also ignoring empty feeds for now
            raise NackMessage()

        # Initial best guess at the post language.  An unfortunate
        # misfeature of RSS is that language is a feed-global
        # attribute; it does not support feeds with multiple language
        # entries.  Atom does support this in principle though not sure
        # if it's actually used.  In practice most feeds are
        # monolingual.
        lang = normalize_language(
                parsed['feed'], default=feed.get('lang', 'en'))

        for entry in parsed.get('entries', []):
            link = entry.get('link')
            if not link:
                continue

            if article_producer is not None:
                await article_producer.proxy.save_article(
                        article={'url': link, 'lang': lang})

        # Following a successful crawl, update the source's last_crawled
        # timestamp, along with a few other stats
        if feed_producer is not None:
            await feed_producer.proxy.update_feed(
                    feed=dict_slice(feed, 'url', 'type'),
                    updates={'$currentDate': {'last_crawled': True},
                             '$inc': {'times_crawled': 1}})

    async def start_crawl_feed_worker(self, connection):
        feed_producer = await self.create_producer(connection, 'feeds')
        await feed_producer.channel.set_qos(prefetch_count=1)

        # Create a worker to handle new sources produced by the controller
        # TODO: This is similar-enough to code in the Controller that we
        # could probably generalize this.
        article_producer = await self.create_producer(connection, 'articles')
        worker = partial(self.crawl_feed,
                         article_producer=article_producer,
                         feed_producer=feed_producer)
        await feed_producer.create_worker(
                'crawl_feed', worker, auto_delete=True)

    async def start_loop(self, connection):
        await self.start_crawl_feed_worker(connection)

    @staticmethod
    async def retrieve_resource(resource, only_if_modified=False,
                                timeout=None):
        """
        Download and return the raw contents of a URL resource.

        If ``only_if_modified=True`` some rudimentary conditional headers are
        sent in the request for the remote server to determine whether or not
        there is new content to return (specifically ``If-None-Match`` with the
        last known ``ETag`` for the resource, if any, as well as
        ``If-Modified-Since`` with the resource's last modified time).

        If no new contents are returned then `None` is returned.

        This also computes and stores a SHA1 hash of the resource contents.  If
        even HTTP-based conditional request methods fail, but the SHA1 of the
        contents matches the existing SHA (and ``only_if_modified=True``) then
        `None` is still returned, as the contents have not been modified since
        the last request.
        """

        url = resource['url']
        etag = resource.get('etag')
        last_modified = resource.get('last_modified')

        headers = {}
        new_resource = {'url': url}

        if only_if_modified:
            if etag:
                headers['If-None-Match'] = etag

            if last_modified:
                headers['If-Modified-Since'] = last_modified

        try:
            async with ClientSession() as session:
                async with session.get(url, timeout=timeout) as resp:
                    if only_if_modified and resp.status == NOT_MODIFIED:
                        return None

                    elif resp.status != OK:
                        # TODO: Just ignoring non-200 status codes for now
                        raise NackMessage()

                    try:
                        for header in ['ETag', 'Last-Modified']:
                            if header in resp.headers:
                                key = header.lower().replace('-', '_')
                                new_resource[key] = resp.headers[header]

                        text = await resp.text()
                        sha1 = hashlib.sha1(text.encode('utf-8')).hexdigest()

                        if only_if_modified and resource.get('sha1') == sha1:
                            # HTTP-based methods failed us, but we can still
                            # fall back on hash of the full text of the
                            # resource
                            return None

                        new_resource['text'] = text
                        new_resource['sha1'] = sha1

                        return new_resource
                    except Exception as exc:
                        log.warning(
                            f'error decoding response text from '
                            f'{url}; sending nack: {exc}')
                        raise NackMessage()
        except NackMessage:
            raise
        except Exception as exc:
            # Most likely a connection failure of some sort
            log.error(f'error retrieving {url}: {exc}')
            raise NackMessage()

    async def retrieve_feed_text(self, feed, feed_producer=None):
        # We create a new session for each request since we will usually be
        # handling arbitrary URLs
        # TODO: We obviously need robust error handling here, both for making
        # the requests and parsing them: right now on all errors we simply send
        # a nack and drop it, but what we would really like would be to send an
        # error message back to be handled by the controller, to track
        # regularly erroring sources

        # If given, update the last time the source was successfully
        # *retrieved* (as opposed to last_crawled)
        resource = await self.retrieve_resource(
                feed, only_if_modified=True,
                timeout=self.config.feed_crawler.retrieve_timeout)

        if resource is None:
            return None

        if feed_producer is not None:
            # NOTE: Currently last_accessed implies successfully retrieved;
            # perhaps this should be split into successful vs. error?
            # TODO: This code pertains to retrieving *any* type of resource
            # and should be moved into retrieve_resource, but after we make
            # further updates to make a generic update_resource task...
            # TODO: I don't think we should be sending MongoDB commands as
            # messages; it should be something more generic--probably a
            # specific message indicating that a resource was accessed (as
            # opposed to crawled which is the case in crawl_feed).
            updates = {'$currentDate': {'last_accessed': True},
                       '$inc': {'times_accessed': 1}}
            set_fields = dict_slice(resource, 'etag', 'last_modified', 'sha1',
                                    allow_missing=True)
            if set_fields:
                updates['$set'] = set_fields

            await feed_producer.proxy.update_feed(
                    feed=dict_slice(feed, 'url', 'type'),
                    updates=updates)

        return resource['text']


if __name__ == '__main__':
    FeedCrawler.main()
