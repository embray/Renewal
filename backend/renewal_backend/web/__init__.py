"""Implements the HTTP API used by the app and by recommendation systems."""

import argparse
import asyncio

from quart import Quart, g

from .api import v1
from .utils import ObjectIdConverter, JSONEncoder
from ..mongodb import MongoMixin
from ..agent import AgentMixin
from ..utils import load_config, DEFAULT_CONFIG_FILE, DefaultFileType


class App(AgentMixin, MongoMixin):
    app = Quart(__name__)

    def __init__(self, config, debug=False):
        super().__init__(config)
        self.debug = debug
        self.app.register_blueprint(v1, url_prefix='/api/v1')
        self.app.before_first_request(self.before_first_request)
        self.app.before_request(self.before_request)
        self.app.before_websocket(self.before_websocket)
        self.app.url_map.converters['ObjectId'] = ObjectIdConverter
        self.app.json_encoder = JSONEncoder

        # Event stream management
        self.event_stream_producer = None
        # Currently just one queue for all event stream events, and we later
        # decide which websocket clients to send individual events to when
        # reading from the queue
        self.event_stream_queue = asyncio.Queue()

    async def before_first_request(self):
        connection = await self.connect_broker()
        self.event_stream_producer = await self.create_producer(
                connection, 'event_stream')
        await self.event_stream_producer.create_worker(
                'send_event', self.handle_event_stream)

    def before_request(self):
        # Make the Monogo DB available to the request globals
        g.db = self.db
        g.debug = self.debug
        g.config = self.config.web
        g.event_stream_producer = self.event_stream_producer

    def before_websocket(self):
        self.before_request()
        g.event_stream_queue = self.event_stream_queue

    def get_exchanges(self):
        return ['event_stream']

    async def handle_event_stream(self, *, event):
        # TODO: Maybe don't queue the event, or at least limit the backlog
        # size, if there are no connected recsystem clients to receive the
        # events
        await self.event_stream_queue.put(event)

    @classmethod
    def main(cls, argv=None):
        parser = argparse.ArgumentParser()
        parser.add_argument('--host', default='0.0.0.0')
        parser.add_argument('--port', type=int, default=8080)
        parser.add_argument('--debug', action='store_true')
        parser.add_argument('--config', default=DEFAULT_CONFIG_FILE,
                type=DefaultFileType(default=DEFAULT_CONFIG_FILE),
                help='load additional configuration for the backend service; '
                     'by default reads from "renewal.yaml" in the current '
                     'directory')
        args = parser.parse_args(argv)
        self = cls(load_config(config_file=args.config), debug=args.debug)
        self.app.run(host=args.host, port=args.port, debug=args.debug,
                use_reloader=args.debug)
