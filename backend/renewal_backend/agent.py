import abc
import asyncio
import logging

from aio_pika import connect_robust

from .utils import Producer, load_config


class Agent(metaclass=abc.ABCMeta):
    def __init__(self, config, log=None):
        self.config = config
        if log is None:
            log = logging.getLogger()
        self.log = log
        super().__init__()

    @abc.abstractmethod
    async def start_loop(self):
        """
        Defines the coroutine that will be run in the agent's event loop.
        """

    @classmethod
    def main(cls):
        # TODO: Add logging settings to config
        logging.basicConfig(
                level=logging.INFO,
                style='{',
                format='[{levelname}][{name}][{asctime}] {message}')

        agent = cls(load_config(), log=logging.getLogger(cls.__name__))
        loop = asyncio.get_event_loop()
        connection = loop.run_until_complete(agent.connect_broker())
        try:
            loop.run_until_complete(agent.start_loop(connection))
            loop.run_forever()
        except KeyboardInterrupt:
            return
        finally:
            loop.run_until_complete(connection.close())
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.stop()

    async def connect_broker(self):
        return await connect_robust(self.config.broker.uri)

    async def declare_exchange(self, channel, exchange_name):
        exchange = self.config.broker.exchanges[exchange_name]
        return await channel.declare_exchange(
                exchange.name, exchange.type)

    async def create_producer(self, connection, exchange_name):
        # TODO: I think new URLs should go on a different exchange than
        # SOURCES_EXCHANGE
        channel = await connection.channel()
        exchange = await self.declare_exchange(channel, exchange_name)
        return Producer(channel, exchange)
