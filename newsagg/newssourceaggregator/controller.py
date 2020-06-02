import json

from .databasetools.mongo import MongoCollection
from .newsreceiver import NewsReceiver

# TODO: 1. Listen on queue, receive data, store them in mongodb
# TODO: 2. purge doubles in db


class Controller:
    def __init__(self, host='localhost', receiver=NewsReceiver(), __version__="0.0.1"):
        self.collection = MongoCollection("news_db", "news", indexOn=['url'],
                                          host=host, #user='Ajod', password='8kp^U_R3',
                                          version=__version__)
        self.version = __version__
        self.receiver = receiver

        self.receiver.startListening(self.callback)

    def callback(self, channel, method, properties, body):
        data = json.loads(body.decode('utf-8'))
        print(data)
        if data['link'] is not None and data['link'] not in self.collection:
            self.collection.insert({'version': self.version, 'url': data['link'], 'source': data})
        else:
            print("An error has occured while attempting to write to db")
            print("Link already in colleciton ? : ", data['link'] in self.collection)
        channel.basic_ack(delivery_tag=method.delivery_tag)


if __name__ == "__main__":
    c = Controller()
    print(c.collection.count())
    print(c.collection.show(c.collection.count()))
