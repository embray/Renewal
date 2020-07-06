"""
JSON Schemas for various data models.

These are for use with validating MongoDB collections, and so is subject to
Mongo's extensions/omissions from the standard JSON Schema spec as documented
at
https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/#json-schema
(this unfortunately omits useful features such as ``definitions`` and
``$ref`` but we can implement the equivalence directly in Python instead).
"""


from .utils import dict_merge


# Used for status_crawled, status_scraped, etc...
STATUS = {
    'oneOf': [{
        'properties': {
            'ok': {
                'type': 'boolean',
                #'const': True
                'enum': [True]
            }
        },
        'additionalProperties': False
    }, {
        'properties': {
            'ok': {
                'type': 'boolean',
                #'const': False
                'enum': [False]
            },
            'error_type': {'type': 'string'},
            'error': {'type': 'string'}
        }
    }]
}


# Schema for URL resources; feeds and articles are treated as "subclasses" of
# resource
RESOURCE = {
    'properties': {
        'url': {
            # TODO: Expand this; although writing a full regular expression for
            # a valid URI is quite complicated, some minimal validation would
            # be good
            'type': 'string',
            # TODO: The 'format' keyword is not supported by MongoDB's JSON
            # Schema variant; it might be nice to somehow support two versions
            # of the schema: One for standard JSON Schema and one for MongoDB
            #'format': 'uri'
        },
        'canonical_url': {
            'description':
                'The canonical URL of this resource (e.g. if the original URL '
                'was a redirect).  In this case a new resource is created '
                'with the canonical URL and this resource only serves as a '
                'pointer to the original, and should no longer be crawled.',
            'type': 'string'
        },
        'lang': {
            'description':
                "Two letter language code for the contents of the resource.",
            'type': 'string',
            'pattern': '^[a-z]{2}$',
            # NOTE: Not supported by MongoDB
            #'default': 'en'
        },
        'last_crawled': {
            'description':
                "Last time the contents of the resource were crawled.",
            'bsonType': 'date'
        },
        'times_crawled': {
            'description':
                "Number of times the resource was successfully crawled.",
            'bsonType': 'int',
            'minimum': 0,
            # NOTE: Not supported by MongoDB
            #'default': 0
        },
        'status_crawled': STATUS,
        'sha1': {
            'description':
                "SHA1 hash of the resource contents the last time they were "
                "accessed.",
            'type': 'string',
            'pattern': '^[0-9a-f]{40}$'
        },
        'last_modified': {
            'description':
                "Last-Modified header of the resource from the last time it "
                "accessed, if any.",
            'bsonType': 'date'
        },
        'etag': {
            'description':
                "ETag header of the resource from the last time it was "
                "accessed, if any.",
            'type': 'string'
        }
    },
    'required': ['url']
}


FEED = dict_merge(RESOURCE, {
    'properties': {
        'type': {
            'description':
                "Feed type; used to determine how to crawl it.",
            'type': 'string',
            'enum': ['rss']
        }
    },
    'required': RESOURCE['required'] + ['type']
})


ARTICLE = dict_merge(RESOURCE, {
    'properties': {
        'times_seen': {
            'description':
                "Number of times this article's URL has been seen by the "
                "controller (i.e. sent to it by a feed crawler).",
            'bsonType': 'int',
            'minimum': 0
        },
        'last_seen': {
            'description':
                "Last time this article was seen by the controller.",
            'bsonType': 'date'
        },
        'last_scraped': {
            'description':
                "Last time the resource was successfully scraped.",
            'bsonType': 'date'
        },
        'times_scraped': {
            'description':
                "Number of times the resource was successfully scraped.",
            'bsonType': 'int',
            'minimum': 0
        },
        'status_scraped': STATUS,
        'contents': {
            'description': 'The raw article contents to be scraped',
            'type': 'string'
        },
        'site': {
            'description':
                'Id of the site this article was retrieved from; this is '
                'determined by the scraper and gives the ObjectId of a '
                'document in the sites collection.',
            'bsonType': ['objectId', 'null']
        },
        'scrape': {
            'description': 'Article metadata returned by the scraper',
            'type': 'object',
            'properties': {
                'publish_date': {'bsonType': 'date'},
                'title': {'type': 'string'},
                'authors': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'summary': {'type': 'string'},
                'text': {'type': 'string'},
                'image_url': {
                    'type': 'string'  # note: should be a url
                },
                'keywords': {
                    'type': 'array',
                    'items': {'type': 'string'}
                }
            }
        }
    }
})


IMAGE = dict_merge(RESOURCE, {
    'properties': {
        'contents': {
            'description':
                "Binary blob containing the image data.",
            'bsonType': 'binData'
        }
    }
})


# Collection of news sites, metadata one which are currently extracted
# by the scraper.
SITE = {
    'properties': {
        'url': {'type': 'string'},
        'name': {'type': 'string'},
        'icon_resource_id': {
            'description':
                'when the icon image is downloaded it will be saved as an '
                'image resource with this ID',
            'bsonType': 'objectId'
        },
        'icon_url': {
            'description':
                "URL of the site's logo, if found.",
            'type': 'string'
        }
    }
}
