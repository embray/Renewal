"""Authentication handling functions."""


import asyncio
import functools
from http import HTTPStatus

import cachecontrol
import firebase_admin
import google.auth.transport.requests
import google.oauth2.id_token
import requests
from bson.objectid import ObjectId
from google.auth import jwt
from quart import g, abort, request


# See the example at
# https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html#module-google.oauth2.id_token
SESSION = requests.session()
CACHED_SESSION = cachecontrol.CacheControl(SESSION)
REQUEST = google.auth.transport.requests.Request(session=CACHED_SESSION)

ROLES = frozenset(['user', 'admin', 'recsys'])


def check_auth(role_or_func, request_obj=None):
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

        return functools.partial(_check_auth, roles=roles,
                request_obj=request_obj)
    else:
        return _check_auth(role_or_func)


def _check_auth(func, roles=ROLES, request_obj=None):
    """
    Internal implementation of the `check_auth` decorator.

    This supports use of `check_auth` both without an argument like
    ``@check_auth`` or with a role argument like ``@check_auth(role)``.
    """

    if request_obj is None:
        # Use the 'request' global, though this may be overridden with
        # something else (e.g. websocket)
        request_obj = request

    @functools.wraps(func)
    async def auth_wrapper(*args, **kwargs):
        if g.debug and 'X-Renewal-Debug-User-Id' in request_obj.headers:
            return _debug_check_auth(func, args, kwargs, roles, request_obj)

        claims = None
        id_token = None
        role = None
        bearer = request_obj.headers.get('Authorization', None)
        try:
            if bearer is not None and bearer.startswith('Bearer '):
                id_token = bearer.split(' ')[1]

            if id_token is not None:
                claims = _verify_token(id_token)
                # Only custom tokens have a renewal_role claim, all other
                # tokens are standard user ID tokens generated by firebase, and
                # are presumed to come from users of the app.
                role = claims.get('renewal_role', 'user')
        except Exception:
            # claims = None so we will return HTTP UNAUTHORIZED below
            pass

        if not (claims and role in roles):
            abort(HTTPStatus.UNAUTHORIZED)

        g.auth = claims

        if asyncio.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        else:
            return func(*args, **kwargs)

    return auth_wrapper


def _verify_token(id_token):
    # First check the key ID from the token's header
    header = jwt.decode_header(id_token)
    # Get the firebase app initialized in RenewalAPI.__init__
    app = firebase_admin.get_app()
    service_acct_key_id = app.credential.signer.key_id
    if header['kid'] == service_acct_key_id:
        # This is a token signed using our Google service account's
        # private key.  It is used primarily for custom tokens
        # generated for recsystems and must be verified
        # differently; see
        # renewal_backend.utils.create_custom_token
        claims = google.oauth2.id_token.verify_token(
            id_token, REQUEST, certs_url=g.client_x509_cert_url)

    else:
        claims = google.oauth2.id_token.verify_firebase_token(
            id_token, REQUEST, g.config.firebase.project_id)

    if claims.get('renewal_role') == 'recsystem':
        # recsystem tokens have an associated token_id used to verify whether
        # the token has been revoked
        user_id = claims.get('user_id')
        token_id = claims.get('renewal_token_id')
        if not (user_id and token_id):
            return None  # implies unverified

        # Look up the recsystem _id / token_id
        try:
            filt = {'_id': ObjectId(user_id), 'token_id': token_id}
            found = g.db.recsystems.find_one(filt)
        except Exception:
            found = None

        if not found:
            return None

    return claims


def _debug_check_auth(func, args, kwargs, roles, request_obj):
    user_id = request_obj.headers['X-Renewal-Debug-User-Id']
    role = request_obj.headers.get('X-Renewal-Debug-Role')

    if role is not None and role not in roles:
        # Check role, for debugging authorization, otherwise allow all
        # roles
        abort(HTTPStatus.UNAUTHORIZED)

    g.auth = {'user_id': user_id}
    return func(*args, **kwargs)
