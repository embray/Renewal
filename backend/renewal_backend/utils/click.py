"""Some utilities for extending the functionality of `click`."""


import copy
import inspect
from functools import partial, update_wrapper

import click


def with_context(func=None, obj_type=None, context_arg='ctx'):
    """
    More flexible alternative to `click.pass_context` and `click.pass_obj`.

    Combines the functionality of both those decorators, but the difference
    is instead of passing the context/context.obj to the first argument of
    the wrapped function, it passes it to specified ``context_arg`` keyword
    argument, where by default ``context_arg='ctx'`` so it can work
    equivalently to `click.pass_context`.

    Examples
    --------

    >>> import click
    >>> from renewal_backend.utils.click import with_context
    >>> @click.group(no_args_is_help=False, invoke_without_command=True)
    ... @with_context
    ... def main(ctx):
    ...     print(ctx)
    ...     ctx.obj = 1
    ...
    >>> try:
    ...     main([])
    ... except SystemExit:
    ...     pass
    ...
    <click.core.Context object at 0x...>

    Sub-commands can use `with_context` similarly to `click.pass_obj`:

    >>> @main.command()
    ... @with_context(obj_type=int, context_arg='obj')
    ... def subcommand(obj):
    ...     print('subcommand', obj)
    ...
    >>> try:
    ...     main(['subcommand'])
    ... except SystemExit:
    ...     pass
    <click.core.Context object at 0x...>
    subcommand 1
    """

    if func is None:
        return partial(with_context, obj_type=obj_type, context_arg=context_arg)

    def context_wrapper(*args, **kwargs):
        ctx = obj = click.get_current_context()
        if isinstance(obj_type, type):
            obj = ctx.find_object(obj_type)

        kwargs[context_arg] = obj
        return ctx.invoke(func, *args, **kwargs)

    update_wrapper(context_wrapper, func)
    return context_wrapper


class classgroup:
    """
    Alternative to `click.group` which allows a command group to be declared
    on a class-bound method, similarly to a composition of `click.group` and
    `classmethod`.

    Examples
    --------

    >>> from renewal_backend.utils.click import classgroup, with_context
    >>> class Foo:
    ...     @classgroup(no_args_is_help=False, invoke_without_command=True)
    ...     @with_context
    ...     def main(cls, ctx):
    ...         print(cls)
    ...         print(ctx)
    ...         ctx.obj = cls()
    ...         print(ctx.obj)
    ...
    >>> try:
    ...     Foo.main([])
    ... except SystemExit:
    ...     pass
    ...
    <class 'renewal_backend.utils.click.Foo'>
    <click.core.Context object at 0x...>
    <renewal_backend.utils.click.Foo object at 0x...>

    You can still attach sub-commands to the group ``Foo.main`` as usual:

    >>> @Foo.main.command()
    ... @with_context(obj_type=Foo, context_arg='foo')
    ... def subcommand(foo):
    ...     print('subcommand', foo)
    ...
    >>> try:
    ...     Foo.main(['subcommand'])
    ... except SystemExit:
    ...     pass
    ...
    <class 'renewal_backend.utils.click.Foo'>
    <click.core.Context object at 0x...>
    <renewal_backend.utils.click.Foo object at 0x...>
    subcommand <renewal_backend.utils.click.Foo object at 0x...>

    The `click.Group` object, and by extension any sub-commands added to it,
    are bound to each class on which it's accessed, so subclasses do not
    inherit the sub-commands of their parent class:

    >>> Foo.main.commands
    {'subcommand': <Command subcommand>}
    >>> class Bar(Foo): pass
    >>> Bar.main.commands
    {}
    """

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.callback = None
        self.recursion_depth = 0
        self.commands = []

    def __call__(self, callback):
        self.callback = callback
        return self

    def __get__(self, obj, owner=None):
        # The recursion_depth stuff is to work around an oddity where
        # click.group() uses inspect.getdoc on the callback to get the
        # help text for the command if none was provided via help=
        # However, inspect.getdoc winds up calling the equivalent
        # of getattr(owner, callback.__name__), causing a recursion
        # back into this descriptior; in this case we just return the
        # wrapped callback itself
        self.recursion_depth += 1

        if self.recursion_depth > 1:
            self.recursion_depth -= 1
            return self.callback

        if self.callback is None:
            return self

        if owner is None:
            owner = type(obj)

        key = '_' + self.callback.__name__
        # The Group instance is cached in the class dict
        group = owner.__dict__.get(key)

        if group is None:
            def callback(*args, **kwargs):
                return self.callback(owner, *args, **kwargs)

            update_wrapper(callback, self.callback)
            group = click.group(*self.args, cls=_ClassGroup, owner=owner,
                                **self.kwargs)(callback)
            # Add commands to the group
            for command in self.commands:
                if isinstance(command, classgroup):
                    command = command.__get__(None, owner)
                group.add_command(command)

            setattr(owner, key, group)

        self.recursion_depth -= 1

        return group

    def command(self, *args, **kwargs):
        """
        Registers a sub-command on this group in a way intended to be used on
        instance methods of the class this `classgroup` is defined on.

        In this case the ``self`` argument of the method is passed ``ctx.obj``,
        which is assumed to be an instance of the class that the `classgroup`
        is defined on.

        Examples
        --------

        >>> import click
        >>> from renewal_backend.utils.click import classgroup, with_context
        >>> class Foo:
        ...     @classgroup(no_args_is_help=False, invoke_without_command=True)
        ...     @with_context
        ...     def main(cls, ctx):
        ...         print(cls)
        ...         print(ctx)
        ...         ctx.obj = cls()
        ...         print(ctx.obj)
        ...
        ...     @main.command()
        ...     @click.option('--bar')
        ...     def subcommand(self, bar):
        ...         print('subcommand self', self)
        ...         print('subcommand bar', bar)
        ...
        >>> try:
        ...     Foo.main(['subcommand', '--bar', 'qux'])
        ... except SystemExit:
        ...     pass
        ...
        <class 'renewal_backend.utils.click.Foo'>
        <click.core.Context object at 0x...>
        <renewal_backend.utils.click.Foo object at 0x...>
        subcommand self <renewal_backend.utils.click.Foo object at 0x...>
        subcommand bar qux
        """

        return self._command_wrapper(args, kwargs)

    def group(self, *args, **kwargs):
        """Like `classgroup.command` but adds a sub-group."""

        decorator = partial(click.group, cls=_ClassSubgroup)
        return self._command_wrapper(args, kwargs, decorator=decorator)

    def _command_wrapper(self, args, kwargs, decorator=click.command):
        def wrapper(callback):
            callback = with_context(callback, obj_type=object,
                                    context_arg='self')
            command = decorator(*args, **kwargs)(callback)
            self.commands.append(command)
            return command

        return wrapper


class _ClassGroup(click.Group):
    """Helper for `classgroup.group`."""

    def __init__(self, *args, owner=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.owner = owner

    def copy(self, **kwargs):
        """
        Return a new `classgroup` with a copy of this `Group` instance.

        This can be useful for using `classgroup.command` on a subclass without
        adding those commands to the base class.
        """

        name = self.name or self.callback.__name__

        if self.owner is None or name not in self.owner.__dict__:
            return None

        clsgrp = copy.copy(self.owner.__dict__[name])
        clsgrp.kwargs.update(kwargs)
        return clsgrp

    def command(self, *args, **kwargs):
        super_decorator = super().command(*args, *kwargs)

        def decorator(callback):
            if 'self' in inspect.signature(callback).parameters:
                callback = with_context(callback, obj_type=object,
                                        context_arg='self')
            return super_decorator(callback)

        return decorator

    def group(self, *args, **kwargs):
        super_decorator = super().group(*args, cls=self.__class__, **kwargs)

        def decorator(callback):
            if 'self' in inspect.signature(callback).parameters:
                callback = with_context(callback, obj_type=object,
                                        context_arg='self')
            return super_decorator(callback)

        return decorator


class DefaultFile(click.File):
    """
    Like `click.File` but if provided a default value, and the default
    file does not exist, just return `None` and do not raise an error.
    """

    def convert(self, value, param, ctx):
        try:
            return super().convert(value, param, ctx)
        except ValueError:
            if value != param.default:
                raise

            return None
