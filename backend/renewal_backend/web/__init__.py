"""Implements the HTTP API used by the app and by recommendation systems."""

import asyncio
import json

import click
import firebase_admin
from quart import Quart, g

from .api import v1
from .utils import ObjectIdConverter, JSONEncoder
from ..mongodb import MongoMixin
from ..agent import AgentMixin
from ..utils import load_config, DEFAULT_CONFIG_FILE
from ..utils.click import classgroup, with_context, DefaultFile


class RenewalAPI(AgentMixin, MongoMixin):
    app = Quart(__name__)

    def __init__(self, config, debug=False):
        super().__init__(config)
        self.debug = debug

        # Initialize firebase admin with the credentials from the config file
        with open(config.web.firebase.service_account_key_file) as fobj:
            self.firebase_service_account = json.load(fobj)

        cred = firebase_admin.credentials.Certificate(
                self.firebase_service_account)
        firebase_admin.initialize_app(cred, config.web.firebase.app_options)

        # Set up Quart app
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
        g.log = self.app.logger
        g.db = self.db
        g.debug = self.debug
        g.config = self.config.web
        g.event_stream_producer = self.event_stream_producer

        # This is required by check_auth for authenticating custom tokens
        g.client_x509_cert_url = \
                self.firebase_service_account['client_x509_cert_url']

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

    @classgroup(no_args_is_help=False, invoke_without_command=True)
    @click.option('--config', default=DEFAULT_CONFIG_FILE, type=DefaultFile(),
            help='load additional configuration for the backend service; '
                 'by default reads from "renewal.yaml" in the current '
                 'directory')
    @click.option('--host', default='0.0.0.0')
    @click.option('--port', type=int, default=8080)
    @click.option('--debug', is_flag=True)
    @with_context
    def main(cls, ctx, config, host, port, debug):
        self = ctx.obj = cls(load_config(config_file=config), debug=debug)
        # A bug in older versions of Quart requires manually setting the
        # debug attribute
        if debug:
            self.app.debug = debug
        self.app.run(host=host, port=port, debug=debug, use_reloader=debug)
