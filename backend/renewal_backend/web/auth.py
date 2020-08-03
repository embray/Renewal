"""Authentication handling functions."""


import functools
from http import HTTPStatus

import cachecontrol
import google.auth.transport.requests
import google.oauth2.id_token
import requests
from quart import g, abort, request


# See the example at
# https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html#module-google.oauth2.id_token
SESSION = requests.session()
CACHED_SESSION = cachecontrol.CacheControl(SESSION)
REQUEST = google.auth.transport.requests.Request(session=CACHED_SESSION)

ROLES = frozenset(['user', 'admin', 'recsys'])


def check_auth(role_or_func):
    """
    Decorate request handlers to check that the request is authenticated with
    a Firebase JWT token (currently the only authentication method supported).

    Takes an optional 'role' parameter which can be a string or list of strings
    of required roles to access the endpoint.  By default all authenticated
    clients regardless of role have access.

    The authentication settings are found in ``g.config.auth``.
    """

    # TODO: Add an the ability to check additional claims (e.g. if user or rec
    # system)
    if isinstance(role_or_func, (str, list, tuple, set)):
        if isinstance(role_or_func, str):
            roles = frozenset([role_or_func])
        else:
            roles = frozenset(role_or_func)

        return functools.partial(_check_auth, roles=roles)
    else:
        return _check_auth(role_or_func)


def _check_auth(func, roles=ROLES):
    """
    Internal implementation of the `check_auth` decorator.

    This supports use of `check_auth` both without an argument like
    ``@check_auth`` or with a role argument like ``@check_auth(role)``.
    """

    @functools.wraps(func)
    def auth_wrapper(*args, **kwargs):
        if g.debug and 'X-Renewal-Debug-User-Id' in request.headers:
            return _debug_check_auth(func, args, kwargs, roles)

        claims = None
        id_token = None
        role = None
        bearer = request.headers.get('Authorization', None)
        if bearer is not None and bearer.startswith('Bearer '):
            id_token = bearer.split(' ')[1]

        # NOTE: Currently the system only authenticates user tokens sent from
        # the app; must add support for additional tokens generated for
        # admin/recsystem users
        if id_token is not None:
            claims = google.oauth2.id_token.verify_firebase_token(
                id_token, REQUEST, g.config.firebase.project_id)
            role = 'user'

        if not (claims and role in roles):
            abort(HTTPStatus.UNAUTHORIZED)

        g.auth = claims

        return func(*args, **kwargs)

    return auth_wrapper


def _debug_check_auth(func, args, kwargs, roles):
    user_id = request.headers['X-Renewal-Debug-User-Id']
    role = request.headers.get('X-Renewal-Debug-Role')

    if role is not None and role not in roles:
        # Check role, for debugging authorization, otherwise allow all
        # roles
        abort(HTTPStatus.UNAUTHORIZED)

    g.auth = {'user_id': user_id}
    return func(*args, **kwargs)
