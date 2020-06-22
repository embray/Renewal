"""
Global backend configuration.

Includes configuration items that can be shared between all services.

This is just the default configuration; all of this can be overridden by a
config file.
"""

import os

from . import schemas

# TODO: For now this is just a static configuration / defaults, but it will
# later be modifiable via a config file.

# MongoDB configuration
MONGODB_HOST = os.environ.get('MONGODB_HOST')
MONGODB_PORT = os.environ.get('MONGODB_PORT')
mongodb = {
    'client': {
        'host': MONGODB_HOST,
        'port': int(MONGODB_PORT) if MONGODB_PORT else None
    },
    'renewal_db': 'renewal',
    'collections': {
        'feeds': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.FEED,
         },
        'articles': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.ARTICLE
        },
        'images': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.IMAGE
        },
        'sites': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.SITE
        }
    }
}


# RabbitMQ configuration
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = os.environ.get('RABBITMQ_PORT', 5672)
broker = {
    'uri': f'amqp://guest:guest@{RABBITMQ_HOST}:{RABBITMQ_PORT}',
    'connection_timeout': 60,
    'exchanges': {
        'feeds': {
            'name': 'feeds',
            'type': 'direct'
        },
        # generic resources which may become articles
        # when sucessfully scraped
        'articles': {
            'name': 'articles',
            'type': 'direct'
        },
        'images': {
            'name': 'images',
            'type': 'direct'
        }
    }
}


# Controller configuration
controller = {
    # TODO: Update to something more sane like 5 minutes
    'feeds_refresh_rate': 300,  # seconds
    'articles_refresh_rate': 300
}


# Crawler configuration
crawler = {
    'retrieve_timeout': 10,  # seconds
    'canonical_url': {
        'query_exclude': ['utm_*']
    }
}
