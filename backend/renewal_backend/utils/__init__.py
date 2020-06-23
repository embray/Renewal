import importlib
import json
from typing import Optional, Any

from aio_pika.channel import Channel
from aio_pika.exchange import Exchange
from aio_pika.patterns import Master
from aio_pika.queue import Queue


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


def load_config():
    """
    Load the full app configuration including the default config and
    configuration provided by a config file.

    All dictionaries are in the configuration are recursively replaced with an
    `AttrDict` for convenience.
    """

    # TODO: Does not actually load configuration from a file yet.
    config = load_default_config()

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
