"""Utilities specifically for the HTTP API."""

from datetime import datetime

import bson
from bson.errors import InvalidId
from bson.objectid import ObjectId
from quart import abort
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
