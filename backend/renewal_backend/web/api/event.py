import asyncio
import json

from quart import g, websocket

from ..utils import JSONEncoder
from ..websocket import QuartWebSocketsMultiClient as RPCClient


class EventStreamHandler:
    """
    This class handles all websocket connections.

    Individual API versions implement a subclass of this to handle different
    event protocols.
    """

    def __init__(self, event_stream_queue):
        self.event_stream_queue = event_stream_queue
        self.connected_recsystems = {}
        """Maps recsystem IDs to their individual message queues."""

    @classmethod
    def install(cls, event_stream_queue, loop=None):
        """
        Instantiates the `EventStreamHandler` and schedules a coroutine to
        process incoming event stream events on the given loop (or current
        running loop).
        """

        handler = cls(event_stream_queue)
        asyncio.ensure_future(handler.process_event_stream(), loop=loop)
        return handler

    async def connect_client(self):
        assert (isinstance(getattr(g, 'auth', None), dict) and
                g.auth.get('user_id') and
                g.auth.get('renewal_role') == 'recsystem')

        recsystem_id = g.auth['user_id']
        g.log.info(
            f'received websocket connection from recsystem {recsystem_id}')

        if recsystem_id in self.connected_recsystems:
            g.log.warning(
                f'duplicate connection from recsystem {recsystem_id}; '
                f'disconnecting')
            resp = json.dumps(
                {'error': 'multiple simultaneous connections from the same '
                          'recsystem are not currently allowed'})
            return resp, 403
        else:
            await websocket.accept()

        queue = asyncio.Queue()
        self.connected_recsystems[recsystem_id] = queue
        rpc_client = RPCClient(
                websocket, fallback_handler=self.bad_message_fallback)
        with rpc_client:
            try:
                # Send a greeting ping just to ensure the connection is
                # established (empty payload for now, maybe later it can
                # contain something more interesting like user assignments)
                response = await rpc_client.ping()
                if response.data.result != 'pong':
                    g.log.warning(
                        f'initial ping to recsystem {recsystem_id} failed; '
                        f'disconnecting client')
                    return
                while True:
                    event = await queue.get()
                    await self.handle_event(event, rpc_client)
            finally:
                del self.connected_recsystems[recsystem_id]

    async def bad_message_fallback(self, message):
        """
        Fallback for handling buggy clients that send malformed messages or are
        otherwise not expected JSON-RPC responses.
        """

        g.log.warning(
            f'received a malformed or unexpected message from recsystem '
            f'{g.auth["user_id"]}; ignoring')

    async def handle_event(self, event, rpc_client):
        """
        Handle a single event stream event.

        Subclasses must implement ``handle_<event_type>_event`` methods for
        each event type (with the event type converter to lower-case in the
        name).  Otherwise the event is not sent.
        """

        event_type, payload, _ = self.decode_event(event)
        g.log.debug(f'handling event stream {event_type} event: {payload}')
        handler_name = f'handle_{event_type.lower()}_event'
        handler = getattr(self, handler_name, None)
        if handler is None:
            g.log.warning(
                f'no {self.__class__.__name__}.{handler_name} method; this '
                f'event will be ignored')
            return

        await handler(event_type, payload, rpc_client)

    async def process_event_stream(self):
        """
        Take events off the event stream and broadcast them to recsystems.

        By default events are broadcast to all recsytems unless they have a
        'targets' property, listing the ID(s) of recsystem(s) the event is
        targeted to.
        """

        while True:
            event = await self.event_stream_queue.get()
            event_type, payload, targets = self.decode_event(event)
            if targets is None:
                # Broadcast the event to all connected systems
                for queue in self.connected_recsystems.values():
                    await queue.put(event)
            else:
                for recsystem_id in targets:
                    # If one of the targets is not connected to us we just
                    # ignore it; that recsystem may be connected to a different
                    # API instance, or not connected at all
                    # TODO: Perhaps we would like the controller to know about
                    # what recsystems are connected; this may be important for
                    # making user assignments.
                    queue = self.connected_recsystems.get(resystem_id)
                    if queue:
                        await queue.put(event)

    @staticmethod
    def decode_event(event):
        try:
            if not isinstance(event, dict):
                event = json.loads(event)

            event_type = event['type']
            payload = event['payload']
            targets = event.get('targets')
        except (json.JSONDecodeError, KeyError):
            return (None, None, None)

        # JSONinfy payload: convert the event_stream payload (which may contain
        # non-JSON-compatible objects) to a pure JSON object by using our
        # default encoder
        payload = json.loads(json.dumps(payload, cls=JSONEncoder))

        return event_type, payload, targets
