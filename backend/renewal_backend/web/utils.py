"""Utilities specifically for the HTTP API."""

from datetime import datetime

from bson.errors import InvalidId
from bson.objectid import ObjectId
from flask import abort
from flask.json import JSONEncoder as _JSONEncoder
from werkzeug.routing import BaseConverter


class ObjectIdConverter(BaseConverter):
    """Convert route components to/from BSON ObjectIds."""

    def to_python(self, value):
        try:
            return ObjectId(value)
        except InvalidId:
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
