"""
Implements the command-line interface for running commands on the backend.
"""

import asyncio
import json
import sys

import click

from .agent import Agent


class RenewalCLI(Agent):
    run_forever = False
    rpc = None

    main = Agent.main.copy(no_args_is_help=True)

    def get_exchanges(self):
        return ['controller_rpc']

    @main.command(help='returns a zero exit code if the renewal controller '
                       'can be contacted; and 1 otherwise')
    def status(self):
        try:
            ok = self.rpc.status()
        except Exception as exc:
            print('could not contact the controller: ${exc}', file=sys.stderr)
            sys.exit(1)

        sys.exit(int(not ok))

    async def start_loop(self, connection):
        rpc = await self.create_rpc(connection, 'controller_rpc')
        self.rpc = _RpcProxy(rpc)


main = RenewalCLI.main


class feeds:
    @main.group()
    def feeds(self):
        pass

    @feeds.command(help='list registered feeds')
    @click.option('--format', type=click.Choice(['table', 'json', 'csv']),
                  default='table',
                  help='format in which to list the registered feeds')
    @click.option('--no-header', is_flag=True,
                  help='for table and csv formats, omit the header')
    def list(self, format, no_header):
        output = self.rpc.feeds_list(format=format, header=not no_header)
        if output:
            # Prevent printing a newline if there is nothing to output
            print(output)

    @feeds.command(help='register list of feeds from a JSON document')
    @click.argument('filename', type=click.File())
    def load(self, filename):
        feeds = json.load(filename)

        # Currently all messages are errors, might change that to allow
        # non-error status messages as well
        messages = self.rpc.feeds_load(feeds=feeds)
        for message in messages:
            print(message, file=sys.stderr)


# Group individual sub-commands into their own namespaces
# To be clear, these classes are never instantiated, and each
# method is treated as a method of RenewalCLI
# TODO: This namespacing wouldn't be necessary if we put each sub-group
# in its own module, which we might well do if the CLI grows larger.

# TODO: It might be cool if there were a way to convert a class into a click
# group.
class recsys:
    @main.group()
    def recsys(self):
        pass

    @recsys.command()
    @click.option('--baseline', 'is_baseline', is_flag=True)
    @click.option('--owner', 'owners', multiple=True)
    @click.argument('name')
    def register(self, name, owners, is_baseline):
        try:
            recsystem_id, token = self.rpc.recsystem_register(
                    name=name, owners=owners, is_baseline=is_baseline)
        except Exception as exc:
            # TODO: this boilerplate is repetitive; maybe bake it into the
            # command wrapper automatically
            msg = str(exc)
            if not msg:
                msg = str(type(exc))
            raise click.ClickException(msg)

        print(recsystem_id, token)

    @recsys.command()
    @click.argument('id_or_name')
    def refresh_token(self, id_or_name):
        try:
            token = self.rpc.recsystem_refresh_token(id_or_name=id_or_name)
        except Exception as exc:
            # TODO: this boilerplate is repetitive; maybe bake it into the
            # command wrapper automatically
            msg = str(exc)
            if not msg:
                msg = str(type(exc))
            raise click.ClickException(msg)

        print(token)

    @recsys.command()
    @click.option('--format', type=click.Choice(['table', 'json', 'csv']),
                  default='table',
                  help='format in which to list the registered feeds')
    @click.option('--no-header', is_flag=True,
                  help='for table and csv formats, omit the header')
    def list(self, format, no_header):
        output = self.rpc.recsystem_list(format=format, header=not no_header)
        if output:
            # Prevent printing a newline if there is nothing to output
            print(output)


class _RpcProxy:
    """
    Wrapper for `aio_pika.patterns.RPC.proxy` which blocks while executing a
    single RPC call on the event loop.
    """

    def __init__(self, rpc):
        self.rpc = rpc

    def __getattr__(self, attr):
        def proxy(**kwargs):
            loop = asyncio.get_event_loop()
            method = getattr(self.rpc.proxy, attr)
            return loop.run_until_complete(method(**kwargs))

        return proxy


if __name__ == '__main__':
    main()
