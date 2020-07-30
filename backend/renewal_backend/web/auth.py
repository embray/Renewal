"""Authentication handling functions."""


import functools
from http import HTTPStatus

import cachecontrol
import google.auth.transport.requests
import google.oauth2.id_token
import requests
from flask import g, abort, request


# See the example at
# https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html#module-google.oauth2.id_token
SESSION = requests.session()
CACHED_SESSION = cachecontrol.CacheControl(SESSION)
REQUEST = google.auth.transport.requests.Request(session=CACHED_SESSION)


def check_auth(func):
    """
    Decorate request handlers to check that the request is authenticated with
    a Firebase JWT token (currently the only authentication method supported).

    The authentication settings are found in ``g.config.auth``.
    """

    # TODO: Add an option to check additional claims (e.g. if user or rec
    # system)

    @functools.wraps(func)
    def auth_wrapper(*args, **kwargs):
        claims = None
        id_token = None
        bearer = request.headers.get('Authorization', None)
        if bearer is not None and bearer.startswith('Bearer '):
            id_token = bearer.split(' ')[1]

        if id_token is not None:
            claims = google.oauth2.id_token.verify_firebase_token(
                id_token, REQUEST, g.config.firebase.project_id)

        if not claims:
            abort(HTTPStatus.UNAUTHORIZED)

        g.auth = claims

        return func(*args, **kwargs)

    return auth_wrapper
