import abc
import asyncio
import logging

from aio_pika import connect_robust

from .utils import Producer, load_config


class Agent(metaclass=abc.ABCMeta):
    def __init__(self, config, log=None):
        self.config = config
        self.exchanges = None
        if log is None:
            log = logging.getLogger()
        self.log = log
        super().__init__()

    @abc.abstractmethod
    async def start_loop(self, connection):
        """
        Defines the coroutine that will be run in the agent's event loop.
        """

    def get_exchanges(self):
        """Returns a list of exchange names used by this agent."""
        return []

    def run(self):
        """Creates a connection to the AMQP broker and runs the event loop."""

        loop = asyncio.get_event_loop()
        connection = loop.run_until_complete(self.connect_broker())
        try:
                loop.run_until_complete(self.start_loop(connection))
                loop.run_forever()
        except KeyboardInterrupt:
            return
        finally:
            loop.run_until_complete(connection.close())
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.stop()

    @classmethod
    def main(cls):
        # TODO: Add logging settings to config
        logging.basicConfig(
                level=logging.INFO,
                style='{',
                format='[{levelname}][{name}][{asctime}] {message}')

        agent = cls(load_config(), log=logging.getLogger(cls.__name__))
        agent.run()

    async def connect_broker(self):
        return await connect_robust(self.config.broker.uri)

    async def ensure_exchanges(self, channel):
        """
        Lazily ensure all exchanges used by the agent have been declared.

        This should be called from any method that must ensure an exchange
        exists.
        """

        # TODO: Perhaps instead make self.exchanges a property to better guard
        # against its use before ensure_exchanges has been called
        if self.exchanges is not None:
            return

        self.exchanges = {}

        for exchange_name in self.get_exchanges():
            exchange = self.config.broker.exchanges[exchange_name]
            self.exchanges[exchange_name] = \
                await channel.declare_exchange(exchange.name, exchange.type)

    async def create_producer(self, connection, exchange_name):
        # TODO: I think new URLs should go on a different exchange than
        # SOURCES_EXCHANGE
        # We create a channel for each Producer instance allowing individual
        # QoS control per Producer
        channel = await connection.channel()
        await self.ensure_exchanges(channel)
        return Producer(channel, self.exchanges[exchange_name])
