"""
Global backend configuration.

Includes configuration items that can be shared between all services.

This is just the default configuration; all of this can be overridden by a
config file.
"""

import os

import pymongo

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
            'indices': [
                ('url', {'unique': True}),
                [('last_seen', pymongo.DESCENDING)],
                [('article_id', pymongo.DESCENDING)]
            ],
            'schema': schemas.ARTICLE
        },
        'articles.interactions': {
            'indices': [
                # I think a hashed index would be more useful here since
                # we'd usually be looking these up by both user_id and
                # article_id, but currently hashed multi-indices are
                # not supported
                ([('user_id', pymongo.DESCENDING),
                  ('article_id', pymongo.DESCENDING)
                 ], {'unique': True})
            ],
            'schema': schemas.ARTICLE_INTERACTION
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
    'crawl_feeds_rate': 300,  # seconds
    'crawl_articles_rate': 300,
    'scrape_articles_rate': 300
}


# Crawler configuration
crawler = {
    'retrieve_timeout': 10,  # seconds
    'canonical_url': {
        'query_exclude': ['utm_*']
    }
}


web = {
    'api': {
        'v1': {
            'recommendations': {
                'default_limit': 100
            }
        }
    },
    'auth': {
        # This should be provided by an external config file
        'firebase_project_id': None
    }
}
