import argparse
import contextlib
import importlib
import json
import secrets
import time
from typing import Optional, Any

import firebase_admin
import yaml
from aio_pika.channel import Channel
from aio_pika.exchange import Exchange
from aio_pika.patterns import Master
from aio_pika.queue import Queue
from google.auth import jwt


class Producer(Master):
    """
    Based on the `aio_pika.patterns.Master` class, but with a nicer name.

    Unlike its base class, it also accepts an optional `aio_pika.Exchange`
    rather than always using the default exchange.
    """

    def __init__(self, channel: Channel,
                 exchange: Optional[Exchange] = None,
                 requeue: bool = True,
                 reject_on_redelivered: bool = False,
                 json: bool = False):
        super().__init__(channel, requeue=requeue,
                         reject_on_redelivered=reject_on_redelivered)
        self._exchange = exchange
        if json:
            self.SERIALIZER = json
            self.CONTENT_TYPE = 'application/json'

    @property
    def exchange(self):
        if self._exchange is None:
            return self.channel.default_exchange
        else:
            return self._exchange

    async def create_queue(self, channel_name, **kwargs) -> Queue:
        queue = await super().create_queue(channel_name, **kwargs)
        await queue.bind(self.exchange, channel_name)
        return queue

    def serialize(self, data: Any) -> bytes:
        if self.SERIALIZER is json:
            return self.SERIALIZER.dumps(data, ensure_ascii=True)
        else:
            return super().serialize(data)


def normalize_language(feed_info, default='en'):
    for key in ['lang', 'language']:
        if key not in feed_info:
            continue

        lang = feed_info[key].split('-')[0]
        if len(lang) == 2:
            return lang.lower()
        else:
            log.warning(f'feed {feed_info["link"]} contains an invalid '
                        f'language code: "{lang}"')

    # The default
    return default


def dict_slice(d, *keys, allow_missing=False):
    """
    Given a dict, return a copy of that dict with only the selected keys.

    If any of the given keys are not in the dictionary a `KeyError` will be
    raised for the first key not found, unless ``allow_missing=True``.

    Examples
    --------

    >>> from renewal_backend.utils import dict_slice
    >>> dict_slice({})
    {}
    >>> d = {'a': 1, 'b': 2, 'c': 3}
    >>> dict_slice(d)
    {}
    >>> dict_slice(d, 'a', 'c')
    {'a': 1, 'c': 3}
    >>> dict_slice(d, 'a', 'd')
    Traceback (most recent call last):
    ...
    KeyError: 'd'
    >>> dict_slice(d, 'a', 'd', allow_missing=True)
    {'a': 1}
    """

    s = {}
    for k in keys:
        try:
            s[k] = d[k]
        except KeyError:
            if not allow_missing:
                raise

    return s


def dict_merge(d, *f):
    """
    Return a copy of `dict` ``d``, with updates applied to it from zero or more
    dicts in ``f``.

    If ``d2`` is a nested `dict` then updates are applied partially, so that
    rather than completely replacing the value of the same key in ``d1``, it
    just applies a `dict.update` to value of that key in ``d1``.  If there is
    a conflict (e.g. the same key in each `dict` does not correspond to the
    same type) then that value is replaced entirely.

    Examples
    --------

    >>> from renewal_backend.utils import dict_merge
    >>> d1 = {}
    >>> d2 = dict_merge(d1); d2
    {}
    >>> d1 is d2
    False
    >>> dict_merge({}, {'a': 1})
    {'a': 1}
    >>> dict_merge({'a': 1, 'b': 2}, {'a': 2, 'c': 3})
    {'a': 2, 'b': 2, 'c': 3}
    >>> dict_merge({'a': 1, 'b': 2}, {'a': 2}, {'a': 3, 'c': 4})
    {'a': 3, 'b': 2, 'c': 4}
    >>> dict_merge({'a': {'b': {'c': 1, 'd': 2}}}, {'a': {'b': {'c': 2}}})
    {'a': {'b': {'c': 2, 'd': 2}}}
    >>> dict_merge({'a': {'b': 1}}, {'a': 2})
    {'a': 2}
    """

    d = d.copy()
    for d2 in f:
        for k, v in d2.items():
            u = d.get(k)
            if isinstance(u, dict) and isinstance(v, dict):
                d[k] = dict_merge(u, v)
            else:
                d[k] = v

    return d


class AttrDict(dict):
    """
    `dict` subclass allowing lookup by attribute.

    Any keyword that is not a valid Python identifier or that is superseded by
    class methods and attributes must be retrieved via normal item getter
    syntax.

    Examples
    --------

    >>> from renewal_backend.utils import AttrDict
    >>> d = AttrDict({'a': 1, 'b': 2, 'get': 3})
    >>> d.a
    1
    >>> d.b
    2
    >>> d.get
    <built-in method get of AttrDict object at 0x...>
    >>> d['get']
    3
    """

    def __getattr__(self, attr):
        try:
            return self[attr]
        except KeyError:
            raise AttributeError(attr)


def truncate_dict(d, value_length=100):
    """
    Returns a string representation of `dict` ``d`` but with all values
    trucated to at most ``value_length``.
    """

    def truncate(value):
        if isinstance(value, dict):
            return truncate_dict(value, value_length=100)

        r = repr(value)
        if len(r) > value_length:
            r = r[:100] + '...'

            # Special case for strings to close their quotes
            if isinstance(value, str):
                r += r[0]
        return r


    items = [f'{k!r}: {truncate(v)}' for k, v in d.items()]
    return f'{{{", ".join(items)}}}'


def load_default_config():
    """
    Loads the config dict from the default configuration in the ``.config``
    module of this package.

    All dicts defined at module level which do not begin with underscore are
    considered part of the configuration.

    Examples
    --------

    >>> from renewal_backend.utils import load_default_config
    >>> config = load_default_config()
    >>> config
    {...'mongodb': ...}
    """

    modname = __package__.split('.')[0] + '.config'
    mod = importlib.import_module(modname)
    config_vars = [k for k, v in vars(mod).items()
                   if not k.startswith('_') and isinstance(v, dict)]
    return dict_slice(vars(mod), *config_vars)


DEFAULT_CONFIG_FILE = 'renewal.yaml'


def load_config(config_file=None):
    """
    Load the full app configuration including the default config and
    configuration provided by a config file.

    The contents of the config file are merged recursively into the default
    config.

    All dictionaries are in the configuration are recursively replaced with an
    `AttrDict` for convenience.
    """

    config = load_default_config()

    if config_file is not None:
        if isinstance(config_file, str):
            ctx = open(config_file)
        else:
            # Assumed to be a file-like object
            ctx = config_file

        with ctx as fobj:
            config = dict_merge(config, yaml.safe_load(fobj))

    def replace_dicts(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                obj[k] = replace_dicts(v)

            return AttrDict(obj)
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                obj[idx] = replace_dicts(item)

            return obj
        else:
            # For anything else, including tuples, don't make any replacements
            return obj

    return replace_dicts(config)


@contextlib.contextmanager
def try_resource_update(log=None):
    """
    Context manager used in crawlers/scrapers that need to provide a status
    dict to an ``update_resource`` call.

    The format of the status dict is given in `renewal_backend.schemas.STATUS`;
    for a successful update it returns ``{'ok': True}``, but if an exception
    occurs it returns ``{'ok': False, ...}`` along with information about the
    exception.

    Note that the ``status`` dict returned by the context manager's
    ``__enter__`` is modified in-place if the context manager exits with an
    error.

    It can also optionally log error tracebacks to the given log.
    """

    status = {'ok': True}
    try:
        yield status
    except Exception as exc:
        status.update({
            'ok': False,
            'error_type': type(exc).__name__,
            'error': str(exc)
        })
        if log is not None:
            log.exception('an unexpected error occurred; traceback follows')


class DefaultFileType(argparse.FileType):
    """
    Like `argparse.FileType` but if provided a default value, and the default
    file does not exist, just return `None` and do not raise an error.
    """

    def __init__(self, mode='r', bufsize=-1, encoding=None, errors=None,
                 default=None):
        super().__init__(mode=mode, bufsize=bufsize, encoding=encoding,
                         errors=errors)
        self._default = default

    def __call__(self, string):
        try:
            return super().__call__(string)
        except argparse.ArgumentTypeError:
            if string != self._default:
                raise

            return None


FIREBASE_AUDIENCE = ('https://identitytoolkit.googleapis.com/google.'
                     'identity.identitytoolkit.v1.IdentityToolkit')


def create_custom_token(user_id, role, token_id=None, exp=None):
    """
    Generate a custom JWT token signed with the Google service account's
    private key.

    Before this function can be used, `firebase_admin.initialize_app` must have
    been called.

    This implements the process described here:
    https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library

    We do this manually, because the interface provided by
    `firebase_admin.auth.create_custom_token` does not allow creating tokens
    that don't expire.  This is because firebase custom tokens are intended for
    use by apps to authenticate against firebase to retrieve an identity token,
    and are really not intended to be long-lived.

    However, we are using the same process to create long-lived tokens for
    authenticating recsystems.  There's no particular harm in doing this since
    it's just our own JWT for use internally, but signed using our existing
    private key provided by the Google service account, rather than maintaining
    a separate key just for signing custom tokens.

    The other difference is we use the claim ``user_id`` instead of ``uid`` for
    the user ID, to be consistent with identity tokens generated by firebase.
    I don't know why the two token formats are inconsistent in this; it seems
    like a slight oversight on Google's part.
    """

    app = firebase_admin.get_app()
    payload = {
        'iss': app.credential.service_account_email,
        'sub': app.credential.service_account_email,
        'iat': int(time.time()),
        # google.auth's token verify requires an expiration time and always
        # validates it, so we create an exp that effectively never expires
        # before the heat death of the universe
        'exp': exp or 2**64 - 1,
        'user_id': user_id,
        # Prefix our custom claims to avoid potential future clashes
        'renewal_role': role,
        'renewal_token_id': token_id or secrets.token_hex(20)
    }

    return jwt.encode(app.credential.signer, payload).decode('ascii')
