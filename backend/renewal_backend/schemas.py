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


# Used for crawl_status, scrape_status, etc...
STATUS = {
    'description': 'Status of a resource update.',
    'type': 'object',
    'oneOf': [{
        'properties': {
            'ok': {
                'type': 'boolean',
                #'const': True
                'enum': [True]
            }
        }
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
    }],
    'properties': {
        'when': {
            'description': 'When the update completed.',
            'bsonType': 'date'
        }
    }
}


# Used for crawl_stats, scrape_stats, etc...
STATS = {
    'description':
        "Additional running statistics for an operation on a resource "
        "(crawl stats, scrape stats, etc.)",
    'type': 'object',
    'properties': {
        'last_success': {
            'description':
                "Last time the operation was performed successfully.",
            'bsonType': 'date'
        },
        'last_error': {
            'description': "Last time the operation resulted in an error.",
            'bsonType': 'date'
        },
        'success_count': {
            'description':
                "Number of times the resource was successfully "
                "crawled.",
            'bsonType': 'int',
            'minimum': 0,
            # NOTE: Not supported by MongoDB
            #'default': 0
        },
        'error_count': {
            'description':
                "Number of times an error occurred crawling the "
                "resource.",
            'bsonType': 'int',
            'minimum': 0,
            # NOTE: Not supported by MongoDB
            #'default': 0
        }
    }
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
        'crawl_status': STATUS,
        'crawl_stats': STATS,
        'cache_control': {
            'description':
                "properties for tracking if/when a resource has been modified",
            'type': 'object',
            'properties': {
                'sha1': {
                    'description':
                        "SHA1 hash of the resource contents the last time "
                        "they were accessed.",
                    'type': 'string',
                    'pattern': '^[0-9a-f]{40}$'
                },
                'last_modified': {
                    'description':
                        "Last-Modified header of the resource from the last "
                        "time it accessed, if any.",
                    'bsonType': 'date'
                },
                'etag': {
                    'description':
                        "ETag header of the resource from the last time it was "
                        "accessed, if any.",
                    'type': 'string'
                }
            }
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
        'article_id': {
            'description': "Monotonically incremented ID of scraped articles",
            'bsonType': 'long',
            'minimum': 0
        },
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
        'scrape_status': STATUS,
        'scrape_stats': STATS,
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
        },
        'metrics': {
            'description':
                'Total user interaction metrics for this article',
            'type': 'object',
            'properties': {
                'likes': {
                    'bsonType': 'int',
                    'minimum': 0
                },
                'dislikes': {
                    'bsonType': 'int',
                    'minimum': 0
                },
                'bookmarks': {
                    'bsonType': 'int',
                    'minimum': 0
                },
                'clicks': {
                    'bsonType': 'int',
                    'minimum': 0
                }
            }
        }
    }
})


ARTICLE_INTERACTION = {
    'description':
        'user interactions with articles (ratings, bookmarks)',
    'properties': {
        'user_id': {'type': 'string'},
        'article_id': {'bsonType': 'long'},
        'rating': {
            'type': 'number',
            'enum': [-1, 0, 1]
        },
        'bookmarked': {'type': 'boolean'},
        'clicked': {'type': 'boolean'}
        # TODO: Additional interactions (clicked, read, etc.)
    },
    'required': ['user_id', 'article_id']
}


IMAGE = dict_merge(RESOURCE, {
    'properties': {
        'contents': {
            'description':
                "Binary blob containing the image data.",
            'bsonType': 'binData'
        },
        'content_type': {
            'description':
                "The image MIME type",
            'type': 'string',
            'pattern': '^image/[a-z0-9.+]+'
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


# Registry of recommendation systems
RECSYSTEM = {
    'properties': {
        'name': {
            'description': 'optional human-readable name for the recsystem',
            'type': 'string'
        },
        # A baseline recsystem is owned by "the system" in a sense and is not
        # required to have any owners (though it may); non-baseline systems
        # must have at least one owner (the UIDs of one or more users who
        # administer the recsystem)
        'token_id': {
            'description':
                "a unique ID associated with the recsystem's current "
                "authentication token; the token_id in the token must "
                "match this ID to validate the recsystem; a recsystem's "
                "existing authentication token is revoked by changing the "
                "token_id and generating a new token with a new token_id",
            'type': 'string',
            'minLength': 40,
            'maxLength': 40
        }
    },
    'oneOf': [{
        'properties': {
            'is_baseline': {
                'type': 'boolean',
                'enum': [True]
            },
            'owners': {
                'type': 'array',
                'items': {'type': 'string'},
                'minItems': 0
            }
        },
    }, {
        'properties': {
            'is_baseline': {
                'type': 'boolean',
                'enum': [False]
            },
            'owners': {
                'type': 'array',
                'items': {'type': 'string'},
                'minItems': 1
            }
        }
    }]
}
