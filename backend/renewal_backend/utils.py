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

    modname = __package__ + '.config'
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
