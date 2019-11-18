"""
Global backend configuration.

Includes configuration items that can be shared between all services.

This is just the default configuration; all of this can be overridden by a
config file.
"""


from . import schemas

# TODO: For now this is just a static configuration / defaults, but it will
# later be modifiable via a config file.

# MongoDB configuration
mongodb = {
    'renewal_db': 'renewal',
    'collections': {
        'feeds': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.FEED,
         },
        'articles': {
            'indices': [('url', {'unique': True})],
            'schema': schemas.ARTICLE
        }
    }
}


# RabbitMQ configuration
broker = {
    'uri': 'amqp://guest:guest@localhost',
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
        }
    }
}


# Controller configuration
controller = {
    # TODO: Update to something more sane like 5 minutes
    'feeds_refresh_rate': 60  # seconds
}


# Feed crawler configuration
feed_crawler = {
    'retrieve_timeout': 10  # seconds
}
