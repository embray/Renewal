"""Utilities specifically for the HTTP API."""

from datetime import datetime

import bson
from bson.errors import InvalidId
from bson.objectid import ObjectId
from quart import abort
from quart.json import JSONDecoder as _JSONDecoder
from quart.json import JSONEncoder as _JSONEncoder
from quart.routing import BaseConverter


class ObjectIdConverter(BaseConverter):
    """Convert route components to/from BSON ObjectIds."""

    name = 'ObjectId'

    def to_python(self, value):
        try:
            return ObjectId(value)
        except InvalidId:
            abort(404)

    def to_url(self, value):
        return str(value)


class Int64Converter(BaseConverter):
    """Convert route components to/from BSON Int64s."""

    name = 'Int64'

    def to_python(self, value):
        try:
            return bson.Int64(value)
        except (TypeError, ValueError):
            abort(404)

    def to_url(self, value):
        return str(value)


class JSONEncoder(_JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()

        return super().default(obj)


class JSONDecoder(_JSONDecoder):
    """
    `json.JSONDecoder` which converts ISO 8601 datetime strings found in any
    `dict` in the keys listed in ``datetime_keys`` to a `datetime.datetime`
    instance.
    """

    datetime_keys = ['timestamp']
    datetime_format = '%Y-%m-%dT%H:%M:%S.%f'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, object_hook=self.object_hook, **kwargs)

    def object_hook(self, d):
        for key in self.datetime_keys:
            if key in d and isinstance(d[key], str):
                try:
                    # timestamps from Date.toISOString() in JavaScript append
                    # Z for Zulu time; we'll just omit it.
                    # All datetimes should be UTC+00:00, but there hasn't been
                    # a chance yet to perform a systematic review that that's
                    # the case...
                    d[key] = datetime.strptime(d[key].rstrip('Z'),
                                               self.datetime_format)
                except ValueError:
                    pass
        return d
