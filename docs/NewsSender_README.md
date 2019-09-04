The NewsSender class is the default sender used by the NewsSourceAgent class. It connects to a RabbitMQ queue using the provided credentials and provides a simple "send" method to transfer data as bytes strings.

Parameters:
host [Default='localhost']: The host IP for the RabbitMQ connection

queue_name [Default='news_data_queue']: The queue used for data transfer. If not exis\
ting, the queue WILL be created and WILL be durable

[NOT YET IMPLEMENTED]
credentials [default=('guest', 'guest')]= The credentials expected by the RabbitMQ se\
rver

How it works:
The NewsSender initializes and keeps track of all parameters and connection data at creation. It provides the 'send' method which will send the provided 'message' parameter (string) through the exchange stream. The 'delivery_mode' option in the sending function expects an acknowledgement of consumation (set in NewsReceiver) before removing any data sent through the queue from the queue.

Dependencies:
pika
