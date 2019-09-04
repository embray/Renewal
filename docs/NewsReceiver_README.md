The NewsReceiver class is the default news receiver used by the Controller class. It connects to a RabbitMQ queue using provided credentials and consumes every data through a provided callback.

Parameters:
host [Default='localhost']: The host IP for the RabbitMQ connection

queue_name [Default='news_data_queue']: The queue used for data transfer. If not existing, the queue WILL be created and WILL be durable

[NOT YET IMPLEMENTED]
credentials [default=('guest', 'guest')]= The credentials expected by the RabbitMQ server

How it works:

The NewsReceiver initializes and keeps track of all parameters and connection data at creation. It provides the 'startListening' method which will loop synchronously on the queue, pull any data it receives and send them to be processed to the provided 'callback' function object.


Dependencies:
pika
