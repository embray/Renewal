"""Provides a generic crawler for URI resources."""


import abc
import hashlib
from datetime import datetime
# For parsing/formatting HTTP-date format
from email.utils import parsedate_to_datetime, format_datetime
from functools import partial
from http.client import OK, NOT_MODIFIED

from aio_pika.patterns import NackMessage
from aiohttp import ClientSession

from ..agent import Agent
from ..utils import dict_slice


class ResourceCrawler(Agent):
    SOURCE_EXCHANGE = abc.abstractproperty()
    SOURCE_KEY = abc.abstractproperty()
    RESULT_EXCHANGE = None

    def get_exchanges(self):
        exchanges = [self.SOURCE_EXCHANGE]
        if self.RESULT_EXCHANGE is not None:
            exchanges.append(self.RESULT_EXCHANGE)

        return exchanges

    @abc.abstractmethod
    async def crawl(self, resource, contents, result_producer=None):
        """
        Subclasses should implement this method to crawl the resource given its
        raw contents, and optionally produce results on the given
        ``result_producer``.
        """

    async def crawl_resource(self, *, resource, source_producer,
                             result_producer=None):
        # Following a successful crawl, update the source's last_crawled
        # timestamp, along with a few other stats
        # NOTE: Previously we let MongoDB set the timestamp, but actually we
        # want the crawler to set it, since by the time it reaches MongoDB it
        # could be different from the time the crawler actually did its work.
        contents = None
        try:
            resource, contents = await self.retrieve_resource(
                    resource, only_if_modified=True)
        finally:
            if contents is None:
                # If contents was None then the resource was not updated since
                # last accessed, or some other error occurred
                values = {}
            else:
                values = dict_slice(resource, 'etag', 'last_modified', 'sha1',
                                    allow_missing=True)
            await self._update_resource(resource, 'accessed', source_producer,
                                        values=values)

        # If resource is None, in this case this means the feed was unmodified
        # based on stored etags/last-modified date
        if resource is None:
            self.log.info(f'ignoring unmodified resource at {resource["url"]}')
            return

        await self.crawl(resource, contents, result_producer=result_producer)
        await self._update_resource(resource, 'crawled', source_producer)

    async def start_crawl_resource_worker(self, connection):
        source_producer = await self.create_producer(connection,
                                                     self.SOURCE_EXCHANGE)
        await source_producer.channel.set_qos(prefetch_count=1)

        # Create a worker to handle new sources produced by the controller
        if self.RESULT_EXCHANGE is None:
            result_producer = None
        else:
            result_producer = await self.create_producer(connection,
                                                         self.RESULT_EXCHANGE)

        worker = partial(self.crawl_resource,
                         source_producer=source_producer,
                         result_producer=result_producer)
        await source_producer.create_worker(
                self.SOURCE_KEY, worker, auto_delete=True)

    async def start_loop(self, connection):
        await self.start_crawl_resource_worker(connection)

    async def retrieve_resource(self, resource, only_if_modified=False,
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

        if only_if_modified:
            if etag:
                headers['If-None-Match'] = etag

            if last_modified:
                headers['If-Modified-Since'] = format_datetime(last_modified)

        try:
            async with ClientSession() as session:
                async with session.get(url, timeout=timeout) as resp:
                    if only_if_modified and resp.status == NOT_MODIFIED:
                        return (resource, None)

                    elif resp.status != OK:
                        # TODO: Just ignoring non-200 status codes for now
                        raise NackMessage()

                    try:
                        for header, xform in [
                                ('ETag', None),
                                ('Last-Modified', parsedate_to_datetime)]:
                            if header in resp.headers:
                                key = header.lower().replace('-', '_')
                                value = resp.headers[header]
                                value = (value if xform is None
                                               else xform(value))
                                resource[key] = value

                        text = await resp.text()
                        sha1 = hashlib.sha1(text.encode('utf-8')).hexdigest()

                        if only_if_modified and resource.get('sha1') == sha1:
                            # HTTP-based methods failed us, but we can still
                            # fall back on hash of the full text of the
                            # resource
                            return (resource, None)

                        resource['sha1'] = sha1

                        return (resource, text)
                    except Exception as exc:
                        self.log.warning(
                            f'error decoding response text from '
                            f'{url}; sending nack: {exc}')
                        raise NackMessage()
        except NackMessage:
            raise
        except Exception as exc:
            # Most likely a connection failure of some sort
            self.log.error(f'error retrieving {url}: {exc}')
            raise NackMessage()

    @staticmethod
    async def _update_resource(resource, type, source_producer, values={}):
        assert type in ('accessed', 'crawled')
        values.update({f'last_{type}': datetime.utcnow()})
        await source_producer.proxy.update_resource(
                resource=dict_slice(resource, 'url'), type=type, values=values)
