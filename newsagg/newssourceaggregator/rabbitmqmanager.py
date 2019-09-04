import pika
from rabbitmq_admin import AdminAPI


# This should allow for an easy and controllable interface to add/delete queues and register teams to rabbit MQ
# Also, maybe we should generate passwords. Or unique ID. Or whatever.
# todo: Make it all API-able ==> Fixed using PyRabbit

__version__ = "0.0.1"
__verbose__ = False


class RecSystemsManager:
    def __init__(self, host='localhost', username='guest', password='guest', queuename='testqueue'):
        self.api = AdminAPI(url='http://' + host + ':15672', auth=('guest', 'guest'))
        self.host = host
        self.cr = pika.PlainCredentials(username=username, password=password)
        self.conn = pika.BlockingConnection(pika.ConnectionParameters(self.host, credentials=self.cr))
        self.chann = self.conn.channel()
        self.queue = self.chann.queue_declare(queuename, durable=True)
        self.routing_key = queuename

    def subscribeSystem(self, teamname, system, passwd):
        self.api.create_vhost('second_vhost', tracing=True)
        self.api.create_user(teamname, passwd)
        self.api.create_user_permission(teamname, 'second_vhost')
        # Include SQL Database authentication here
        self.chann.queue_declare(teamname + '_' + system + '_' + 'rec_requests', durable=True)
        self.chann.queue_declare(teamname + '_' + system + '_' + 'user_assign', durable=True)
        self.chann.queue_declare(teamname + '_' + system + '_' + 'news_recs', durable=True)
        self.chann.queue_declare(teamname + '_' + system + '_' + 'user_data', durable=True)
        self.chann.queue_declare(teamname + '_' + system + '_' + 'news_request', durable=True)

    def createQueue(self, name, durable):
        self.chann.queue_declare(name, durable)


if __name__ == '__main__':
    rm = RecSystemsManager()
