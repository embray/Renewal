"""
JSON Schemas for various data models.

These are for use with validating MongoDB collections, and so is subject to
Mongo's extensions/omissions from the standard JSON Schema spec as documented
at
https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/#json-schema
(this unfortunately omits useful features such as ``definitions`` and
``$ref`` but we can implement the equivalence directly in Python instead).
"""


# Schema for URL resources; feeds and articles are treated as "subclasses" of
# resource
RESOURCE = {
    'properties': {
        'url': {
            # TODO: Expand this; although writing a full regular expression for
            # a valid URI is quite complicated, some minimal validation would
            # be good
            'type': 'string'
        }
    }
}
