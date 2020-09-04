"""
Pumps news sources into the system.

Continuously reads the sources collection on an interval, and places new
sources on the source exchange if they have not been successfully crawled since
the last refresh interval.
"""

import asyncio
import copy
import csv
import io
import json
import logging
import secrets
import types
from collections import defaultdict
from datetime import datetime, timedelta
from functools import partial, wraps

import bson
import firebase_admin
import prettytable
import pymongo
from aio_pika.patterns import NackMessage
from bson.objectid import InvalidId, ObjectId

from .agent import Agent
from .mongodb import MongoMixin
from .user import User
from .utils import create_custom_token, dict_slice, truncate_dict


def rpc(func):
    """
    Decorator for marking `Controller` methods as RPC callable and logging
    their calls.
    """

    @wraps(func)
    def wrapper(self, *args, **kwargs):
        argstr = ', '.join(repr(a) for a in args)
        kwargstr = ', '.join(f'{k}={v!r}' for k, v in kwargs.items())
        paramstr = ', '.join(filter(None, [argstr, kwargstr]))
        self.log.info(f'RPC method called: {func.__name__}({paramstr})')
        return func(self, *args, **kwargs)

    wrapper.is_rpc = True
    return wrapper


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
        self.producers = {}

        # Initialize firebase
        try:
            firebase_admin.get_app()
        except ValueError:
            # Initialize firebase admin with the credentials from the config file
            cred = firebase_admin.credentials.Certificate(
                    config.web.firebase.service_account_key_file)
            firebase_admin.initialize_app(cred, config.web.firebase.app_options)

    def get_exchanges(self):
        return ['feeds', 'articles', 'images', 'event_stream', 'controller_rpc']

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
                        {'crawl_status.when': {'$exists': False}},
                        {'crawl_status.when': {'$lte': since}}
                    ]}
                ]
            }

        feeds = self.db['feeds'].find(filt)
        for feed in feeds:
            if feed['_id'] in self.queues['crawl_feeds']:
                continue
            else:
                self.queues['crawl_feeds'].add(feed['_id'])

            self.log.info(f'producing {feed["type"]} feed at {feed["url"]}')
            self.log.debug(
                f'len(queues.crawl_feeds) = '
                f'{len(self.queues["crawl_feeds"])}')
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
        filt = {'crawl_status.when': {'$exists': False}}
        await self._queue_article_updates(producer, 'crawl_article', filt)

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
                {'$and': [
                    {'contents': {'$exists': True}},
                    {'scrape_status.when': {'$exists': False}}
                ]})

    async def _queue_article_updates(self, producer, method_name, filt):
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

        # This is the queue for articles pending the specified method
        # (crawl_article, scrape_article, etc.)
        queue = self.queues[method_name]

        for article in articles:
            if article['_id'] in queue:
                continue
            else:
                queue.add(article['_id'])

            self.log.info(f'adding article to {method_name}: {article["url"]}')
            queue_size = len(queue)
            self.log.debug(f'len(queues.{method_name}) = {queue_size}')
            await method(resource=article)

    async def save_article(self, *, article):
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
            producer = self.producers['articles']
            await producer.proxy.crawl_article(resource=article)

    async def update_resource(self, *, collection, resource, type, status,
                              updates={}):
        """
        Update the given resource, which should be specified by its URL.

        The collection which the resource is found must be specified (e.g.
        'feeds' or 'articles').

        The update ``type`` is currently either ``'crawl'`` or ``'scrape'``.
        """

        self.log.info(f'updating {collection} resource {resource["url"]}; '
                      f'status: {status}, updates: {truncate_dict(updates)}')
        _updates = {'$set': {f'{type}_status': status}}
        is_redirect = False
        canonical_url = updates.get('canonical_url')
        if canonical_url and canonical_url != resource['url']:
            is_redirect = True
            # In the case of receiving the canonical URL of a resource, we just
            # update the old resource with the canonical_url, then we will
            # create or update the resource for the canonical URL
            _updates['$set']['canonical_url'] = canonical_url
            # This is equivalent to saying 'url' != 'canonical_url' so is
            # technically superfluous, but also faster to query on
            _updates['$set']['is_redirect'] = True
            new_resource = copy.deepcopy(resource)
            new_resource['url'] = canonical_url

            # Create an update for the new resource at the canonical URL
            await self.update_resource(collection=collection,
                                       resource=new_resource, type=type,
                                       status=status, updates=updates)
        elif updates:
            hook_method_name = f'_pre_{type}_{collection}_hook'
            if hasattr(self, hook_method_name):
                hook_method = getattr(self, hook_method_name)
                updates = await hook_method(resource, status, updates)
            _updates['$set'].update(updates)

        # Update the stats; e.g. set crawl_stats.last_success and increment
        # crawl_stats.success_count for a successful crawl
        result = 'success' if status['ok'] else 'error'
        _updates['$set'][f'{type}_stats.last_{result}'] = status['when']
        _updates['$inc'] = {f'{type}_stats.{result}_count': 1}

        filt = {'url': resource['url']}
        try:
            doc = self.db[collection].find_one_and_update(filt, _updates,
                    return_document=pymongo.ReturnDocument.AFTER)
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
        else:
            # Run post-update hook for the resource type
            hook_method_name = f'_post_{type}_{collection}_hook'
            if hasattr(self, hook_method_name):
                hook_method = getattr(self, hook_method_name)
                await hook_method(doc, status)

    async def _pre_scrape_articles_hook(self, article, status, updates):
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
        doc = self.db['articles'].find_one(
                {'url': article['url'], 'article_id': {'$exists': True}})
        already_scraped = doc is not None
        if not already_scraped:
            # Normally an article should not be scraped more than once, but it
            # could happen in case of some race conditions
            updates['article_id'] = self._get_next_sequence_id('article_id')

        site = updates.pop('site', None)
        site_doc = {}
        if site is not None:
            icon_url = site.get('icon_url')
            if icon_url:
                icon_doc = await self._maybe_crawl_image(icon_url)
                if icon_doc:
                    site['icon_resource_id'] = icon_doc['_id']
                    site['icon_url'] = icon_doc['url']

            site_doc = self.db['sites'].find_one_and_update(
                    {'url': site['url']}, {'$set': site}, upsert=True,
                    return_document=pymongo.ReturnDocument.AFTER)
            updates['site'] = site_doc['_id']

        return updates

    async def _post_scrape_articles_hook(self, article, status):
        if not status.get('ok', False) or not article:
            return

        # Prepare a NEW_ARTICLE event for the event stream and send it
        if 'site' in article:
            site = self.db.sites.find_one({'_id': article['site']}) or {}
        else:
            site = {}

        # Don't send the article contents
        article = article.copy()
        del article['_id']
        del article['contents']
        article['site'] = site

        event = {'type': 'NEW_ARTICLE', 'payload': article}
        producer = self.producers['event_stream']
        await producer.proxy.send_event(event=event)

    def _get_next_sequence_id(self, sequence):
        """
        Manage monotonically incrementing sequences.

        Returns the next ID in the sequence, or zero if the sequence is created
        for the first time.
        """

        seq = self.db['sequences'].find_one_and_update(
                {'_id': sequence}, {'$inc': {'seq': bson.Int64(1)}},
                projection={'seq': True, '_id': False}, upsert=True)

        if seq is None:
            return 0
        else:
            return seq['seq']

    async def _maybe_crawl_image(self, image_url):
        """
        Create a resource document for the given image URL, and if the image
        has not already been saved, send it to be downloaded.
        """

        img_doc = self.db['images'].find_one_and_update(
                {'url': image_url}, {'$set': {'url': image_url}},
                upsert=True, return_document=pymongo.ReturnDocument.AFTER)

        if img_doc and img_doc.get('is_redirect', False):
            # The site original icon URL was a redirect; find the doc for the
            # image's canonical URL and return it instead
            img_doc = self.db['images'].find_one(
                    {'url': img_doc['canonical_url']})

        if img_doc and not img_doc.get('contents'):
            # Send the icon to be downloaded
            await self.producers['images'].proxy.crawl_image(resource=img_doc)

        return img_doc

    async def start_resource_queue(self, resource, action='crawl'):
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

        producer = self.producers[resource]

        # When starting up, we could be resuming from a restart, so still only
        # take sources that haven't been updated since the longest possible
        # refresh interval
        delta = timedelta(seconds=refresh_rate)
        queue_method = getattr(self, f'queue_{action}_{resource}')
        while True:
            since = datetime.now() - delta
            await queue_method(producer, since=since)
            await asyncio.sleep(refresh_rate)

    async def start_save_article_worker(self):
        producer = self.producers['articles']
        await producer.create_worker('save_article', self.save_article,
                auto_delete=True)

    async def start_update_resource_worker(self, resource_type):
        """
        Handles messages on a queue bound to the "feeds" exchange with
        routing key "update_resource".

        If ``collection is None`` then the collection has the same name as
        the exchange.

        TODO: This can also be used to signal error conditions on sources.
        NOTE: This has been generalized for handling article updates as well;
        the docstring should be rewritten.
        """

        # The DB collection and associated exchange names are always the
        # resource type in plural; e.g. feed -> feeds
        collection = exchange = resource_type + 's'
        producer = self.producers[exchange]
        worker = partial(self.update_resource, collection=collection)
        # TODO: I think it might be confusing to have a single
        # "update_resource" method used for all types of resources (feeds and
        # articles).  Currently there is no need for separate methods to
        # update feeds vs. articles, but it will likely make sense to have that
        # soon.
        await producer.create_worker(
                f'update_{resource_type}', worker, auto_delete=True)

    async def start_producers(self, connection):
        """Start up message producers for each exchange."""

        for exchange_name in self.get_exchanges():
            self.producers[exchange_name] = await self.create_producer(
                    connection, exchange_name)

    @rpc
    async def feeds_list(self, *, format='table', header=True):
        """List all feeds registered in the backend."""

        # TODO: Enable a detailed output mode showing statistics for each feed
        columns = ['url', 'type', 'lang']
        proj = {'_id': False}
        for column in columns:
            proj[column] = True

        feeds = self.db.feeds.find({}, proj)

        if format == 'json':
            return json.dumps(list(feeds), indent=2)
        elif format == 'csv':
            out = io.StringIO()
            writer = csv.writer(out)
            if header:
                writer.writerow(columns)
            for feed in feeds:
                writer.writerow([feed[c] for c in columns])
            return out.getvalue().rstrip()
        elif format == 'table':
            table = prettytable.PrettyTable(
                    field_names=columns, header=header)
            table.align['url'] = 'l'
            for feed in feeds:
                table.add_row([feed[c] for c in columns])
            return table.get_string()
        else:
            raise ValueError(
                    "format must be one of 'table', 'json', 'csv'")

    @rpc
    async def feeds_load(self, *, feeds):
        """
        Register feeds from a list of dicts.

        Returns a list of warning/error messages for feeds that cannot be
        loaded.
        """
        messages = []
        for feed in feeds:
            try:
                self.db.feeds.insert_one(feed)
            except pymongo.errors.DuplicateKeyError:
                messages.append(
                    f'WARNING: feed {feed["url"]} is already registered; '
                    f'ignoring')
            except Exception as exc:
                messages.append(
                    f'ERROR: could not load feed {feed}: {exc}')
        return messages

    @rpc
    async def recsystem_register(self, *, name, is_baseline=False,
                                 owners=None):
        """
        Register a new recsystem in the backend.

        Returns a tuple of the new recsystem's ID and its auth token.
        """

        exists = self.db.recsystems.find_one({'name': name})
        if exists:
            raise ValueError(
                f'a recsystem named "{name}" already exists; recsystem names '
                f'must be unique')

        token_id = secrets.token_hex(20)

        if not is_baseline and not owners:
            raise ValueError(
                'user-provided recsystems must have at least one registered '
                'owner')

        owner_uids = []

        for owner in owners:
            try:
                user = User.get(owner)
            except Exception:
                raise ValueError(
                    f'UID or e-mail {owner} not found; each owner must be a '
                    f'user registered in the system')

            owner_uids.append(user.uid)

        res = self.db.recsystems.insert_one({
            'name': name,
            'is_baseline': is_baseline,
            'owners': owner_uids,
            'token_id': token_id
        })

        recsystem_id = str(res.inserted_id)

        try:
            token = create_custom_token(recsystem_id, 'recsystem',
                                        token_id=token_id)
        except Exception as exc:
            # Rollback the inserted recsystem
            self.db.recsystems.delete_one({'_id': ObjectId(recsystem_id)})
            raise

        return (recsystem_id, token)

    @rpc
    async def recsystem_refresh_token(self, *, id_or_name):
        """
        Generate a new auth token for the specified recsystem.

        In the remote chance that an ID is given that is also the name of a
        difference recsystem, the ID takes precedence.
        """

        filt = {'name': id_or_name}
        try:
            _id = ObjectId(id_or_name)
        except InvalidId:
            pass
        else:
            filt = {'$or': [{'_id': _id}, filt]}

        recsystem = self.db.recsystems.find_one(filt)
        if not recsystem:
            raise ValueError(
                f'unknown recsystem ID or name {id_or_name}')

        token_id = secrets.token_hex(20)
        token = create_custom_token(str(recsystem['_id']), 'recsystem',
                                    token_id=token_id)
        self.db.recsystems.update_one({'_id': recsystem['_id']},
                                      {'$set': {'token_id': token_id}})
        return token

    async def register_rpcs(self, connection):
        rpc = await self.create_rpc(connection, 'controller_rpc')

        async def register(method):
            name = method.__name__.split('.')[-1]
            await rpc.register(name, method, auto_delete=True)

        for name, value in vars(type(self)).items():
            if (isinstance(value, types.FunctionType) and
                    getattr(value, 'is_rpc', False)):
                method = getattr(self, name)
                await register(method)

    async def start_loop(self, connection):
        await self.register_rpcs(connection)
        await self.start_producers(connection)

        for resource_type in ['feed', 'article', 'image']:
            await self.start_update_resource_worker(resource_type)

        await self.start_save_article_worker()
        # Should run forever
        await asyncio.gather(
            self.start_resource_queue('feeds'),
            self.start_resource_queue('articles'),
            self.start_resource_queue('articles', 'scrape')
        )


if __name__ == '__main__':
    Controller.main()
