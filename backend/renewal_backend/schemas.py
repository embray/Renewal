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
        'lang': {
            'description':
                "Two letter language code for the contents of the resource.",
            'type': 'string',
            'pattern': '^[a-z]{2}$',
            # NOTE: Not supported by MongoDB
            #'default': 'en'
        },
        'last_accessed': {
            'description':
                "Last time the resource was successfully accessed.",
            'bsonType': 'date'
        },
        'times_accessed': {
            'description':
                "Number of times the resource was successfully accessed.",
            'bsonType': 'int',
            'minimum': 0,
            # NOTE: Not supported by MongoDB
            #'default': 0
        },
        'last_crawled': {
            'description':
                "Last time the contents of the resource were crawled for "
                "links.",
            'bsonType': 'date'
        },
        'times_crawled': {
            'description':
                "Number of times the resource was successfully crawled for "
                "links.",
            'bsonType': 'int',
            'minimum': 0,
            # NOTE: Not supported by MongoDB
            #'default': 0
        },
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
        }
    }
})
