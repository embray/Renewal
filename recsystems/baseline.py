# Python standard library modules
import asyncio
import bisect
import io
import json
import logging
import random
import sys
import time
from urllib.parse import splittype, urljoin

# Third-party modules
import aiohttp
import click
import coloredlogs
import jwt
import websockets
from jsonrpcserver import method, async_dispatch as dispatch
from jsonrpcserver.response import DictResponse


RECSYS_NAME = 'baseline'

ENVVAR_PREFIX = 'RENEWAL'

RENEWAL_API_BASE_URI = 'https://api.renewal-research.com/v1'

INITIAL_ARTICLES = 1000
"""Number of articles to initialize the in-memory article cache with."""

MAX_ARTICLES = 10000
"""Maximum number of articles to keep cached in memory."""

RECOMMEND_DEFAULT_LIMIT = 30
"""Max number of recommendations to return by default."""


log = logging.getLogger(RECSYS_NAME)
# Log all uncaught exceptions
sys.excepthook = lambda *exc_info: log.exception(
        'an uncaught exception occurred', exc_info=exc_info)

articles = None
"""Articles cache; initialized in `initialize`."""


async def initialize(api_base_uri, token):
    """Start-up tasks to perform before starting the main client loop."""

    global articles

    log.info(f'initializing articles cache with {INITIAL_ARTICLES} articles')
    headers = {'Authorization': 'Bearer ' + token}
    async with aiohttp.ClientSession(
            headers=headers, raise_for_status=True) as session:
        async with session.get(urljoin(api_base_uri, 'articles'),
                params={'limit': INITIAL_ARTICLES}) as resp:
            articles = ArticleCollection(await resp.json())
            log.debug(f'cached {len(articles)} articles')


# RPC methods
# WARNING: Don't forget to make these functions async even if they
# don't use await, otherwise the async_dispatch gets confused.

@method
async def ping():
    return 'pong'


@method
async def new_article(article):
    articles.push(article)


@method
async def recommend(user_id, limit=RECOMMEND_DEFAULT_LIMIT, since_id=None,
                    max_id=None):
    """Return recommendations for the specified user and article ID range."""

    # Currently just supports the 'random' strategy: Take a random selection
    # of up to limit articles from the given range.
    if since_id is None:
        # If no since_id is given (i.e. we are being asked for the most recent
        # articles, just take the top `limit * 2` articles and then take a
        # random selection from them
        start = -2 * limit
    else:
        start = since_id + 1
    end = max_id
    selection = articles[start:end]
    limit = min(limit, len(selection))
    sample = sorted(random.sample(range(len(selection)), limit), reverse=True)
    return [selection[idx]['article_id'] for idx in sample]


# websocket server loops

async def request_loop(api_base_uri, token):
    """
    Main loop of the recsystem application.

    Connects to the event stream websocket and starts a loop to receive and
    handle events from the backend.
    """

    log.info(f'initializing websocket connection to event stream')
    uri = urljoin('ws:' + splittype(api_base_uri)[1], 'event_stream')
    headers = {'Authorization': 'Bearer ' + token}
    async with websockets.connect(uri, extra_headers=headers) as websocket:
        log.info(f'listening to websocket for events...')
        # Incoming RPC requests are added to this queue, and their results are
        # popped off the queue and sent; the queue is used as a means of
        # serializing responses, otherwise we could have multiple coroutines
        # concurrently trying to write to the same websocket
        queue = asyncio.Queue()

        # Start the incoming and outgoing message handlers; a slight variant of
        # this pattern:
        # https://websockets.readthedocs.io/en/stable/intro.html#both
        await multiplex_tasks(handle_incoming(websocket, queue),
                              handle_outgoing(websocket, queue))


async def multiplex_tasks(*tasks):
    """
    Run multiple coroutines simultaneously as tasks, exiting as soon as any one
    of them raises an exception.

    The exception from the coroutine is then re-raised.
    """

    done, pending = await asyncio.wait(tasks,
            return_when=asyncio.FIRST_EXCEPTION)

    try:
        for task in done:
            # If one of the tasks exited with an exception
            # Calling .result() re-raises that exception
            task.result()
    finally:
        for task in pending:
            task.cancel()


async def dispatch_incoming(queue, request):
    """
    Dispatch incoming messages to the JSON-RPC method dispatcher.

    When the result is ready it is placed on the outgoing queue.
    """

    response = await dispatch(request)
    log.info(format_rpc_call(request, response))
    await queue.put(response)


async def handle_incoming(websocket, queue):
    """
    This coroutine checks the websocket for incoming JSON-RPC requests and
    passes them to `dispatch_incoming`.
    """

    while True:
        request = await websocket.recv()
        asyncio.ensure_future(dispatch_incoming(queue, request))


async def handle_outgoing(websocket, queue):
    """
    This coroutine checks the outgoing response queue for results from
    dispatched RPC methods, and sends them on the websocket.
    """

    while True:
        response = await queue.get()
        if response.wanted:
            await websocket.send(str(response))


class ArticleCollection:
    """Maintain a list of articles sorted by article_id (ascending)."""

    def __init__(self, initial=None, max_size=MAX_ARTICLES):
        self.article_ids = []
        self.articles = {}
        self.max_size = max_size
        if initial:
            for item in initial:
                id_ = item['article_id']
                if id_ not in self.articles:
                    self.article_ids.append(id_)
                    self.articles[id_] = item

            self.article_ids = sorted(self.article_ids)
            # Limit to the max_size highest article IDs
            self.article_ids = self.article_ids[-max_size:]

    def __len__(self):
        return len(self.article_ids)

    def __getitem__(self, article_id):
        """
        Retrieve items from the collection by article_id or a range of
        article_ids.
        """

        if not isinstance(article_id, slice):
            # The single article case is simple.
            try:
                return self.article_ids[article_id]
            except KeyError:
                raise IndexError(article_id)

        # Select ranges of article IDs--this can be tricky because although
        # self.article_ids is assumed to be sorted, it have missing items in
        # the range
        slc = article_id
        start = slc.start
        stop = slc.stop

        if start is not None:
            idx = bisect.bisect_left(self.article_ids, start)
            if idx == len(self.article_ids):
                start = None
            else:
                start = idx

        if stop is not None:
            # reverse enumerate
            stop = bisect.bisect_left(self.article_ids, stop)

        ids = self.article_ids[start:stop:slc.step]

        return [self.articles[id_] for id_ in ids]

    def push(self, item):
        """
        Push a new article to the collection while maintaining the sort
        invariant.

        If the new article is already than the lowest article ID and the
        collection is already at capacity, it is discarded.
        """

        id_ = item['article_id']
        if (id_ in self.articles or
                (len(self.article_ids) == self.max_size and
                    id_ < self.article_ids[0])):
            return

        bisect.insort_left(self.article_ids, id_)
        self.articles[id_] = item

        if len(self.article_ids) > self.max_size:
            old_id = self.article_ids.pop(0)
            del self.articles[old_id]

        self.articles[id_] = item

        log.debug(f'new article added to the collection: {item}')
        log.debug(f'article collection size: {len(self)}')


def format_rpc_call(request, response=None):
    """
    For debugging purposes, print parsed JSON-RPC requests/responses.
    """

    if isinstance(request, str):
        request = json.loads(request)

    if isinstance(response, DictResponse):
        response = response.deserialized()
    else:
        response = None

    method = request['method']
    params = request.get('params', {})
    if isinstance(params, list):
        params = ', '.join(repr(v) for v in params)
    else:
        params = ', '.join(f'{k}={v!r}' for k, v in params.items())
    call = f'{method}({params})'

    if response is None:
        return call

    if 'error' in response:
        return f'{call} !! {response["error"]!r}'
    else:
        return f'{call} -> {response["result"]!r}'


class FileOrToken(click.File):
    """
    Extends `click.File` to also accept a JWT token.

    If the input value resembles a properly formatted JWT token its value will
    be taken as-is wrapped in an `io.StringIO`.  Otherwise the input is assumed
    to be a filename and the file is returned as an open file object.
    """

    def convert(self, value, param, ctx):
        try:
            jwt.decode(value, verify=False)
        except jwt.DecodeError:
            return super().convert(value, param, ctx)

        return io.StringIO(value)


@click.command()
@click.option('-a', '--api-base-uri', default=RENEWAL_API_BASE_URI,
              help='URI for the Renewal HTTP API')
@click.option('-t', '--token', required=True, type=FileOrToken(),
              help='authentication token for the recsystem; if a valid '
                   'filename is given the token is read from a file instead')
@click.option('--log-level', default='INFO',
              type=click.Choice(['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                                case_sensitive=False),
              help='minimum log level to output')
def main(api_base_uri, token, log_level):
    logging.basicConfig(level=log_level)
    log.setLevel(log_level)
    coloredlogs.install(level=log_level, logger=log)

    if api_base_uri[-1] != '/':
        # Add trailing slash to make it easier to join URL fragments with
        # urljoin()
        api_base_uri += '/'

    log.info(f'starting up {RECSYS_NAME} recsystem on {api_base_uri}')
    token = token.read().strip()
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(initialize(api_base_uri, token))
        while True:
            try:
                loop.run_until_complete(request_loop(api_base_uri, token))
            except (websockets.WebSocketException, ConnectionRefusedError):
                log.warning(
                    'lost connection to the backend; trying to re-establish...')
                time.sleep(5)
    except KeyboardInterrupt:
        return
    finally:
        # Cancel all pending tasks
        for task in asyncio.Task.all_tasks(loop=loop):
            task.cancel()
            try:
                # Give the task a chance to finish up
                loop.run_until_complete(task)
            except Exception:
                # This may result in a CancelledError or other miscellaneous
                # exceptions as connections are shut down, but we are exiting
                # anyways so ignore them.
                pass

        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()


if __name__ == '__main__':
    main(auto_envvar_prefix=ENVVAR_PREFIX)
