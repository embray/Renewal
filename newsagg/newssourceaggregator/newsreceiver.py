import pika


class NewsReceiver:
    def __init__(self, host='localhost', queue_name='news_data_queue'):

        #self.cr = pika.PlainCredentials(username='Ajod', password='hello')
        self.cr = pika.PlainCredentials(username='guest', password='guest')
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(host, credentials=self.cr))
        self.channel = self.connection.channel()
        self.host = host
        self.queue = self.channel.queue_declare(queue_name, durable=True)
        print("Messages in queue %d" % self.queue.method.message_count)
        self.routing_key = queue_name

    def startListening(self, callback):
        if not callable(callback):
            raise AttributeError("callback object must be a callable function")
        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(self.routing_key, callback, auto_ack=False)
        self.channel.start_consuming()

    def createQueue(self, teamname):
        self.channel.queue_declare(queue=teamname + "_rec_queue", durable=True)
