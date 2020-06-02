import pika

from ..newssender import NewsSender
from ..newsreceiver import NewsReceiver

REC_REQUEST = 0
USER_ASSIGN = 1
NEWS_REC = 2
USER_DATA = 3
NEWS_REQUEST = 4


class SystemInterface:
    def __init__(self, systemname):
        self.name = systemname
        self.queues = []
        self.queues.append(NewsSender(queue_name="rec_request_" + self.name))
        self.queues.append(NewsSender(queue_name="user_assign_" + self.name))
        self.queues.append(NewsSender(queue_name="news_rec_" + self.name))
        self.queues.append(NewsSender(queue_name="user_data_" + self.name))
        self.queues.append(NewsSender(queue_name="news_request_" + self.name))

        self.receiver = NewsReceiver()
        # we also need news receivers but it requires a callback. The callback SHOULD be different for each
        # queue since it does not get returned to the requestdispatcher in the same way
        # it COULD be a unique callback with some "method" parameter specifying if we received
        # an acknowledgement, news ids or news request
        # at this point the RD should either send the news to the APP,
        # ask for news to the DB and send it back to the system or simply let it go

    def rec_request(self, usertoken):
        self.queues[REC_REQUEST].send(str(usertoken))

    def user_assign(self, usertoken):
        # will also need to send user data smh
        self.queues[USER_ASSIGN].send(str(usertoken))

    def news_rec(self, usertoken):
        self.queues[NEWS_REC].send(str(usertoken))

    def user_data(self, usertoken):
        self.queues[USER_DATA].send(str(usertoken))

    def news_request(self, usertoken):
        self.queues[NEWS_REQUEST].send(str(usertoken))

