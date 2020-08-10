"""
Implements the command-line interface for running commands on the backend.
"""

import asyncio

import click

from .agent import Agent


class RenewalCLI(Agent):
    run_forever = False
    rpc = None

    main = Agent.main.copy(no_args_is_help=True)

    def get_exchanges(self):
        return ['controller_rpc']

    async def start_loop(self, connection):
        rpc = await self.create_rpc(connection, 'controller_rpc')
        self.rpc = _RpcProxy(rpc)


main = RenewalCLI.main


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
