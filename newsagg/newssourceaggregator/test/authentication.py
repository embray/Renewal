## All passwords are temporary

import json

from flask import Flask, request
from sqlalchemy import create_engine
from flask_restful import Resource, Api

from ..databasetools.mongo import MongoCollection


class AuthenticationError(Exception):
    def __init__(self, message):
        super().__init__(message)


class Authentication:
    def __init__(self):
        self.authDB = MongoCollection('auth_db', "auth", indexOn=['login'],
                                      host='localhost', user="Ajod", password="8kp^U_R3", version='0.0.1')

    def authentify(self, login, password):
        if not login or not password:
            raise AuthenticationError("Authentication failed: login and/or password not provided")
        if login in self.authDB:
            if self.authDB[login]['password'] == password:
                return self.authDB[login]['password']
            raise AuthenticationError("Authentication failed: incorrect password")
        raise AuthenticationError('Authentication failed: incorrect login')

    def register(self, login, password):
        if login and password:
            if login in self.authDB:
                return
            self.authDB.insert({'login': login, 'password': password})


if __name__ == '__main__':
    au = Authentication()
    au.authentify('Ajod', 'Renewal42')
    print("Authentified properly")
