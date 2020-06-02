import threading
from collections import namedtuple
from time import sleep

import pika

from .systeminterface import SystemInterface
from ..api import Auth, AppUser, News
from ..api import AppUser
from ..api import News


Pair = namedtuple("Pair", ["SystemInterface", "RegisteredUsers"])
# use :     print("First = {}, second = {}".format(pair.first, pair.second))
# This simulates the "Pair" class, allowing for a "System Interface" + "Number of users it handles" pair


class RequestDispatcher:
    def __init__(self):
        self.auth = Auth()
        self.appuser = AppUser()
        self.news = News()
        self.systems = []  # currently active systems for quick access
        self.queues = [] # We are going to need queues to communicate with the systems
        self.connectedUsers = []
        # List ? ???

    def messageSystems(self, content, systems):
        """
        Message systems with json content
        :param content: a dictionary of content to be sent as raw data then retrieved as json
        :param systems: a list of systems to be messaged with the content || one system's name
        :return: boolean ? Throw exception ?
        """
        for systemname in systems:
            for systeminterface in self.systems:
                if "{}".format(systeminterface.first.name) == systemname:
                    # SEND content to system interface
                    pass
        pass

    def dispatchUser(self, user_token, user_data):
        # dispatch a user to a system
        # will need to send its user_data as well
        pass

    def registerSystem(self, systemname):
        self.systems.append(Pair(SystemInterface(systemname), 0))

    def registerUser(self, user_token):
        self.connectedUsers.append(user_token)
        # send the user to a system
        # how to choose ?
        # not sure if we should keep the user token or not since the APP always sends it when asking
        # but we need to know which system has which user
        pass


if __name__ == "__main__":
    rd = RequestDispatcher()

# The request dispatcher must :
# Get a list of registered recommendation systems
# Send a list of users to be managed by each system
# Request a list of recs for a user to its RS and pull the response
# Send the response to the application
# Get the events from each user and send them to the RS
