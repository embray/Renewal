"""Miscellaneous utility functions."""


def traverse_dict(d, keys):
    """
    Traverse a structure of nested dicts using the given key sequence.

    The value associated with the last key is returned, or `None` if the full
    key sequence cannot be traversed.

    Examples
    --------

    >>> from newssourceaggregator.utils import traverse_dict
    >>> traverse_dict({}, []) is None
    True
    >>> d = {'a': {'b': {'c': 1}, 'd': 2}}
    >>> traverse_dict(d, []) is None
    True
    >>> traverse_dict({}, ['a', 'b', 'c']) is None
    True
    >>> traverse_dict(d, ['a', 'b', 'e']) is None
    True
    >>> traverse_dict(d, ['a', 'b', 'c'])
    1
    >>> traverse_dict(d, ['a', 'b', 'c', 'd']) is None
    True
    >>> traverse_dict(d, ['a', 'b'])
    {'c': 1}
    """

    # NOTE: This used to come from systemtools.basic, in a function called
    # getDictSubElement but the version of systemtools that actually works with
    # database tools does not have this function yet.  In any case this is a
    # simpler implementation.
    if not keys:
        return None

    for key in keys:
        if not isinstance(d, dict):
            return None

        d = d.get(key)

    return d
