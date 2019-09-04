import sys, os
sys.path.append("/".join(os.path.abspath(__file__).split("/")[0:-2]))
import string
import random
from flask import Flask
from flask_restful import Resource, Api
from databasetools.mongo import MongoCollection
from passlib.context import CryptContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_declarative import Base, User

__version__ = "0.0.3" # Added proper status code
__verbose__ = False


def generateToken():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(16))


class AuthenticationError(Exception):
    def __init__(self, message):
        super().__init__(message)


class PasswordHasher:
    def __init__(self):
        self.password_hash = None
        self.myctx = CryptContext(schemes=["sha256_crypt"])

    def hash_password(self, password):
        self.password_hash = self.myctx.hash(password)
        return self.password_hash

    def verify_password(self, password, user):
        return self.myctx.verify(password, user.password)


class Auth(Resource):
    def get(self, email, password):
        if not email:
            return "ERROR: User not found", 404
        usr = session.query(User).filter(User.email == email).first()
        if not usr or psswdhash.verify_password(password, usr) is False:
            return "ERROR: Incorrect password", 403

        return session.query(User).filter(User.email == email).first().token, 201

    class Test(Resource):
        def get(self):
            return "OK", 203

    class Register(Resource):
        def put(self, email, password):
            if email and password:
                if session.query(User).filter(User.email == email).first() is not None:
                    return "Error: email already in use", 400
                new_user = User(email=email, password=psswdhash.hash_password(password), token=generateToken())
                session.add(new_user)
                session.commit()
                return session.query(User).filter(User.email == email).first().token

        def get(self, email, password):
            return self.put(email, password)


if __name__ == "__main__":
    engine = create_engine('sqlite:///sqlalchemy_example_auth.db')
    Base.metadata.create_all(engine)
    Base.metadata.bind = engine
    DBSession = sessionmaker(bind=engine)
    session = DBSession()

    psswdhash = PasswordHasher()

    host = '129.175.22.71'

    app = Flask(__name__)
    api = Api(app)

    api.add_resource(Auth, '/auth/<string:email>/<string:password>')
    api.add_resource(Auth.Register, '/auth/register/<string:email>/<string:password>')
    api.add_resource(Auth.Test, '/auth/test')

    app.run(port=4243, debug=False, host=host)
    pass
    authDB = MongoCollection('auth_db', "auth", indexOn=['email'],
                             host='localhost', user="Ajod", password="8kp^U_R3", version='0.0.1')
