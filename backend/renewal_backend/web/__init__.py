"""Implements the HTTP API used by the app and by recommendation systems."""

import argparse

from flask import Flask, g

from .api import v1
from .utils import ObjectIdConverter, JSONEncoder
from ..mongodb import MongoMixin
from ..utils import load_config, DEFAULT_CONFIG_FILE, DefaultFileType


class App(MongoMixin):
    app = Flask(__name__)

    def __init__(self, config):
        self.config = config
        self.app.register_blueprint(v1, url_prefix='/api/v1')
        self.app.before_request(self.before_request)
        self.app.url_map.converters['ObjectId'] = ObjectIdConverter
        self.app.json_encoder = JSONEncoder
        super().__init__()

    def before_request(self):
        # Make the Monogo DB available to the request globals
        g.db = self.db
        g.config = self.config.web

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
        self = cls(load_config(config_file=args.config))
        self.app.run(host=args.host, port=args.port, debug=args.debug)
