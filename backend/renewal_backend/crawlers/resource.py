"""Provides a generic crawler for URI resources."""


import abc
import base64
import fnmatch
import hashlib
# For parsing/formatting HTTP-date format
from email.utils import parsedate_to_datetime, format_datetime
from functools import partial
from http.client import OK, NOT_MODIFIED

from aiohttp import ClientSession

from ..agent import Agent
from ..utils import dict_slice, try_resource_update


class ResourceCrawler(Agent):
    RESOURCE_TYPE = abc.abstractproperty()
    SOURCE_EXCHANGE = abc.abstractproperty()
    SOURCE_KEY = abc.abstractproperty()
    RESULT_EXCHANGE = None
    CONTENT_TYPE = 'text'  # can be text or binary

    def get_exchanges(self):
        exchanges = [self.SOURCE_EXCHANGE]
        if self.RESULT_EXCHANGE is not None:
            exchanges.append(self.RESULT_EXCHANGE)

        return exchanges

    @abc.abstractmethod
    async def crawl(self, resource, contents, headers=None,
                    result_producer=None):
        """
        Subclasses should implement this method to crawl the resource given its
        raw contents, and optionally produce results on the given
        ``result_producer``.
        """

    async def crawl_resource(self, *, resource, source_producer,
                             result_producer=None):
        # Following a successful crawl, update the source's crawl_stats
        # NOTE: Previously we let MongoDB set the timestamp, but actually we
        # want the crawler to set it, since by the time it reaches MongoDB it
        # could be different from the time the crawler actually did its work.
        contents = None

        with try_resource_update(log=self.log) as status:
            resource, contents, headers = await self.retrieve_resource(
                    resource, only_if_modified=True,
                    timeout=self.config.crawler.retrieve_timeout)

        updates = dict_slice(resource, 'canonical_url', 'cache_control',
                             allow_missing=True)

        if contents is not None:
            # Either status was OK but the resource was not modified, or an
            # error occurred
            with try_resource_update(log=self.log) as status:
                result = await self.crawl(resource, contents, headers=headers,
                                          result_producer=result_producer)
                if isinstance(result, dict):
                    updates.update(result)
        elif status['ok']:
            # No contents were returned but there were no errors so the
            # resource was accessed successfully but was unmodified
            self.log.info(f'ignoring unmodified resource at {resource["url"]}')

        update_meth = getattr(source_producer.proxy,
                              f'update_{self.RESOURCE_TYPE}')
        await update_meth(resource=dict_slice(resource, 'url'), type='crawl',
                          status=status, updates=updates)

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
        cache_control = resource.get('cache_control', {})
        etag = cache_control.get('etag')
        last_modified = cache_control.get('last_modified')

        headers = {}

        if only_if_modified:
            if etag:
                headers['If-None-Match'] = etag

            if last_modified:
                headers['If-Modified-Since'] = format_datetime(last_modified)

        # Special case: Sometimes (especially with images) we will get 'data:'
        # URLs, so implement special handling for those.
        if url.startswith('data:'):
            return self._process_data_resource(resource)

        try:
            async with ClientSession() as session:
                req = session.get(url, headers=headers, timeout=timeout)
                async with req as resp:
                    return await self._process_response(
                            resource, resp, only_if_modified)
        except Exception as exc:
            # Most likely a connection failure of some sort
            self.log.error(f'error retrieving {url}: {exc}')
            raise

    async def _process_response(self, resource, resp, only_if_modified):
        """
        Implements handling of response from
        `ResourceCralwer.retrieve_resource`.

        In a separate method because it was pretty deeply nested in ``with``
        and ``try`` blocks.
        """

        url = resource['url']
        cache_control = resource.setdefault('cache_control', {})
        etag = cache_control.get('etag')
        last_modified = cache_control.get('last_modified')
        headers = resp.headers

        if only_if_modified and resp.status == NOT_MODIFIED:
            return (resource, None, headers)

        elif resp.status != OK:
            resp.raise_for_status()

        try:
            for header, xform in [
                    ('ETag', None),
                    ('Last-Modified', parsedate_to_datetime)]:
                if header in headers:
                    key = header.lower().replace('-', '_')
                    value = resp.headers[header]
                    value = (value if xform is None else xform(value))
                    cache_control[key] = value

            if self.CONTENT_TYPE == 'text':
                contents = await resp.text()
                sha1 = hashlib.sha1(contents.encode('utf-8')).hexdigest()
            else:
                contents = await resp.read()
                sha1 = hashlib.sha1(contents).hexdigest()

            if only_if_modified and cache_control.get('sha1') == sha1:
                # HTTP-based methods failed us, but we can still
                # fall back on hash of the full text of the
                # resource
                return (resource, None, headers)

            cache_control['sha1'] = sha1

            canonical_url = self._canonical_url(resp.url)
            # If we followed a redirect the canonical URL may be different from
            # the resource's original URL
            resource['canonical_url'] = canonical_url

            return (resource, contents, headers)
        except Exception as exc:
            self.log.warning(
                f'error decoding response text from '
                f'{url}; sending nack: {exc}')
            raise

    def _process_data_resource(self, resource):
        """
        Generate a 'response' from a ``data:`` URL.

        This involves parsing the URL to retrieve the raw contents and
        content-type.  Right now this is primarily intended to handle
        base64-encoded images.  It doesn't care about other data types.
        """

        data = resource['url'][len('data:'):]
        content_type, data = data.split(',', 1)
        try:
            content_type, param = content_type.split(';', 1)
            assert param == 'base64'
        except (ValueError, AssertionError):
            raise ValueError("a 'base64' content-type parameter was expected")

        contents = base64.b64decode(data.encode('ascii'))
        headers = {'Content-Type': content_type}
        cache_control = resource.setdefault('cache_control', {})
        cache_control['sha1'] = hashlib.sha1(contents).hexdigest()
        return resource, contents, headers

    def _canonical_url(self, url):
        """
        Converts the response URL to a canonical URL for the resource.

        This supports excluding various query arguments from the URL,
        particularly for known URL tracking services.
        """

        # resp.url is a yarl.URL object; its human_repr()
        # method gives a nice decoded string version of the URL
        # first filter the query string
        qs = {}
        for k, v in url.query.items():
            for pat in self.config.crawler.canonical_url.query_exclude:
                if not fnmatch.fnmatch(k, pat):
                    qs[k] = v

        url = url.with_query(qs)
        return url.human_repr()
