"""Utilities for MongoDB access."""

import pymongo


class MongoMixin:
    """Mix-in class for agents that access the Renewal MongoDB database."""

    def __init__(self):
        # TODO: Eventually most of this will be configured via a
        # config file; I am still deciding how to organize things
        # though.
        self.mongo_client = pymongo.MongoClient()
        self.db = self.mongo_client[self.config.mongodb.renewal_db]
        self._init_collections()
        super().__init__()

    def _init_collections(self):
        """
        Initialize options for each configured collection in the database.

        For now this is only used to ensure any indices on each known
        collection.  Each index can either be a string (for the name of a field
        on which to create a simple index) or a pair consisting of a list of
        index keys, and a dict of index options.

        In other words this matches the interface to
        `pymongo.Collection.create_index`.
        """

        for collection_name, options in self.config.mongodb.collections.items():
            if 'indices' in options:
                for index in options['indices']:
                    if isinstance(index, str):
                        keys = index
                        kwargs = {}
                    else:
                        keys, kwargs = index

                    self.db[collection_name].create_index(keys, **kwargs)

            # Install the collection schema, if any, as well as validation
            # level (default: moderate)
            if 'schema' in options:
                self.db.command({
                    'collMod': collection_name,
                    'validator': {'$jsonSchema': options['schema']},
                    'validationLevel': options.get('validation_level',
                                                   'moderate')
                })
