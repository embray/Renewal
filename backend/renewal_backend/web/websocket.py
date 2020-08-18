"""
Utilities related to websockets.

Includes an adaptor to `jsonrpcclient` for Quart's websockets interface, which
includes support for handling out-of-order JSON-RPC responses.

See https://github.com/bcb/jsonrpcclient/issues/154 for a more detailed
explanation.
"""

import asyncio
import json

from jsonrpcclient.clients.websockets_client import WebSocketsClient
from jsonrpcclient.response import Response
from quart import copy_current_websocket_context


class QuartWebSocketsMultiClient(WebSocketsClient):
    def __init__(self, socket, *args, fallback_handler=None, **kwargs):
        super().__init__(socket, *args, **kwargs)
        self.pending_responses = {}
        self.fallback_handler = fallback_handler
        self.receiving = None

    def __enter__(self):
        # copy_current_websocket_context is needed for Quart < 0.7; see
        # https://gitlab.com/pgjones/quart/-/issues/177
        wrapped = copy_current_websocket_context(self.receive_responses)
        self.receiving = asyncio.ensure_future(wrapped())
        return self

    def __exit__(self, *args):
        self.receiving.cancel()

    async def receive_responses(self):
        async def receiver():
            while True:
                response_text = await self.socket.receive()
                try:
                    # Not a proper JSON-RPC response so we just ignore it since
                    # during this mode all messages received from the socket
                    # should be RPC responses
                    response = json.loads(response_text)
                    # Identify responses to batch requests by the first ID in
                    # the batch
                    if response and isinstance(response, list):
                        response_id = response[0]['id']
                    else:
                        response_id = response['id']
                except (json.JSONDecodeError, KeyError):
                    if self.fallback_handler is not None:
                        await self.fallback_handler(response_text)
                    continue

                await self.pending_responses[response_id].put(response_text)

        return await receiver()

    async def send(self, request, **kwargs):
        if self.receiving is None:
            raise RuntimeError(
                f'{self} must be used in a with statement context before '
                f'it can be used to make RPC calls')
        kwargs['request_id'] = request.get('id', None)
        return await super().send(request, **kwargs)

    async def send_message(self, request, response_expected, request_id=None,
                           **kwargs):
        if response_expected:
            queue = self.pending_responses[request_id] = asyncio.Queue()

        await self.socket.send(request)

        if response_expected:
            # As a sanity measure, wait for both the receive_responses task and
            # the queue.  If the receive_responses task returns first that
            # typically means an error occurred (e.g. the websocket was closed)
            # If the completed task was receive_responses, when we call
            # result() it will raise any exception that occurred.
            done, pending = await asyncio.wait([queue.get(), self.receiving],
                    return_when=asyncio.FIRST_COMPLETED)
            response = done.pop().result()
            del self.pending_responses[request_id]
            return Response(response)
        else:
            return Response('')
