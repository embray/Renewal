import pika


class NewsSender:
    connection = None
    channel = None
    message = ''
    queue = None
    routing_key = ''

    def __init__(self, host='localhost', queue_name='news_data_queue'):
        cr = pika.PlainCredentials(username='guest', password='guest', erase_on_connect=True)
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(host, credentials=cr))
        self.channel = self.connection.channel()
        self.queue = self.channel.queue_declare(queue_name, durable=True, passive=True)
        self.routing_key = queue_name

    def send(self, message):
        if message is not None:
            self.channel.basic_publish(exchange='',
                                       routing_key=self.routing_key,
                                       properties=pika.BasicProperties(
                                           delivery_mode=2
                                       ),
                                       body=message)

#    def __del__(self):
#         self.connection.close()


# About this file:
# This is the sending end of the queue
# the queue is named, and may not be duplicated
# the routing key is the queue we want to publish through IF EXCHANGE IS DEFAULT ''
# the body is the message
# the exchange parameter is in charge of sorting and pushing the messages to appropriate queues.
# note : we do NOT send messages directly through queues, but to the exchange actor which will redirect them
# There are a few exchange types available: direct, topic, headers and fanout.
# fanout broadcasts messages to all queues it knows
