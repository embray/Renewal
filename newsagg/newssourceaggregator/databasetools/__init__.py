"""
Wrapper for the databasetools package.

In particular, ``databasetools.mongo`` contains a bug that it imports from a
submodule of ``systemtools`` which no longer exists in the current version of
that package (and from which nothing is actually used in
``databasetools.mongo``.  So import ``databasetools.mongo`` from this wrapper
instead as it provides a workaround for the missing dependency.
"""

import sys
import types


sys.modules.setdefault('systemtools.hayj',
                       types.ModuleType('systemtools.hayj'))
