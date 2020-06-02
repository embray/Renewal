import string
import random
from datetime import datetime as dt
from datetime import timedelta

import pymongo
from bson.json_util import dumps
from bson.objectid import ObjectId
from flask import Flask, request
from flask_restful import Resource, Api
from passlib.context import CryptContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import scoped_session

from .databasetools.mongo import MongoCollection
from .sqlalchemy_declarative import Base, User, Team, System

__version__ = '0.0.6' # Includes timestamp range request
MAX_PACKAGE_SIZE = 1000

# We define a default time range to pull news from at 24h from current UTC time
DEFAULT_DATE_FORMAT = "%Y-%m-%d_%H:%M"
DEFAULT_TIME_RANGE = timedelta(days=1)
DEFAULT_TIME_OLDEST = dt.strftime(dt.utcnow() - DEFAULT_TIME_RANGE, DEFAULT_DATE_FORMAT)
DEFAULT_TIME_RECENT = dt.utcnow().strftime(DEFAULT_DATE_FORMAT)

TOKENS = []


def generateToken():
    """
        Generates the authentication token to be returned to a user for easy connection.
    """
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(16))


def generateResponse(status_code, *args):
    pass
# Start of the Authentication part of the API


class AuthenticationError(Exception):
    def __init__(self, message):
        super().__init__(message)


class PasswordHasher:
    def __init__(self):
        self.password_hash = None
        # We use sha256 for a deterministic, secure encryption method
        self.myctx = CryptContext(schemes=["sha256_crypt"])

    def hash_password(self, password):
        self.password_hash = self.myctx.hash(password)
        return self.password_hash

    def verify_password(self, password, user):
        """
            :param:
                password: the user's unencrypted password
                user: an instance of a "Base" class from the database. Returned from session.query

            :return:
                True/False by comparing password with ciphered password from the database
        """
        return self.myctx.verify(password, user.password)


class Auth(Resource):
    class Team(Resource):
        def get(self, name, password):
            """
            This function authentifies a team
            :param name: The team's name/nickname
            :param password: the team's plain password
            :return: the team's token
            """
            usr = session.query(Team).filter(Team.name == name).first()
            if usr is None:
                return {"error_type": "AuthenticationError(ERROR: Team not found",
                        "status_code": 400}
            if psswdhash.verify_password(password, usr) is False:
                return {"error_type": "AuthenticationError(ERROR: Incorrect Password)",
                        "status_code": 400}
            return {"team_token": usr.token, "status_code": 200}

        def put(self, name, password):
            """
            This function registers a team
            :param name: The team's name/nickname
            :param password: the team's plain password
            :return: the team's token
            """
            usr = session.query(Team).filter(Team.name == name).first()
            if usr is not None:
                return {"error_type": "AuthenticationError(ERROR: Team name taken",
                        "status_code": 400}
            new_team = User(name=name, password=psswdhash.hash_password(password), token=generateToken())
            session.add(new_team)
            session.commit()
            return session.query(Team).filter(Team.name == name).first().token

        class System(Resource):
            def put(self, teamname, password, sysname, desc="Empty System Description"):
                """
                This function registers a system under a team's token in the database. It will be identified by name
                :param teamname: The team owning the system
                :param password: the team's plain password
                :param sysname: the system's name
                :param desc: a brief description of the system is appreciated
                :return: no return
                """
                team = session.query(Team).filter(Team.name == teamname)
                if team is None:
                    return {} # error no team
                if psswdhash.verify_password(password, team) is False:
                    return {} # error wrong password
                sys = session.query(System).filter(System.name == sysname)
                if sys is not None:
                    return {} # error already in use
                new_sys = System(name=sysname, team=teamname, desc=desc)
                session.add(new_sys)
                session.commit()

    def get(self, email, sn, id):
        """
        This function is used to log an already registered user in.
        :param email: The user's email address
        :param sn: The method used for authentifying. Currently supports "email", "fb" and "google"
        :param id: In case of facebook and google method, the fb or google ID. Else, the user password
        :return: on success, the user's token
        """

        # Check if everything is present and viable before checking if it matches the Database
        if not email:
            return {"error_type": "AuthenticationError(ERROR: User not found)", "status_code": 400}
        if not sn:
            return {"error_type": "AuthenticationError(ERROR: No auth method defined)", "status_code": 400}
        if not id:
            return {"error_type": "AuthenticationError(ERROR: No password/id given)", "status_code": 400}
        usr = session.query(User).filter(User.email == email).first()
        if usr is None:
            return {"error_type": "AuthenticationError(ERROR: User not found)",
                    "status_code": 400}

        # Checks with the database according to authentication method
        if sn == "email":
            if psswdhash.verify_password(id, usr) is False:
                return {"error_type": "AuthenticationError(ERROR: Incorrect Password)",
                        "status_code": 400}
        elif sn == "fb":
            if usr.fb_id is None or usr.fb_id != id:
                return {"error_type": "AuthenticationError(ERROR: Incorrect Facebook id)",
                        "status_code": 400}

            elif usr.fb is False:
                return {"error_type": "AuthenticationError(Error: User did not subscribe using Facebook)",
                        "status_code": 400}

        elif sn == "google":
            if usr.google_id is None or usr.google_id != id:
                return {"error_type": "AuthenticationError(ERROR: Incorrect Google id)",
                        "status_code": 400}

            elif usr.google is False:
                return {"error_type": "AuthenticationError(Error: User did not subscribe using Google)",
                        "status_code": 400}

        TOKENS.append(usr.token)
        return {"user_token": usr.token, "status_code": 200}

    def put(self, email, sn, id):
        """
        This function is used to register a user via email, facebook or google
        :param email: The user's email address
        :param sn: The method used for authentifying. Currently supports "email", "fb" and "google"
        :param id: In case of facebook and google method, the fb or google ID. Else, the user password
        :return: on success, the user's token
        """
        if not email:
            return {"error_type": "AuthenticationError(ERROR: User not found)", "status_code": 404}
        if not sn:
            return {"error_type": "AuthenticationError(ERROR: No auth method defined)", "status_code": 404}
        if not id:
            return {"error_type": "AuthenticationError(ERROR: No password/id given)", "status_code": 404}

        print("Got args : email = " + email + " sn = " + sn + " id = " + id)
        if session.query(User).filter(User.email == email).first() is not None:
            return {"error_type": "AuthenticationError(ERROR: Email already in use)",
                    "status_code": 400}

        if sn == "email":
            new_user = User(email=email, password=psswdhash.hash_password(id), token=generateToken())
            session.add(new_user)
            session.commit()

        elif sn == "fb":
            new_user = User(email=email, password=None, token=generateToken(), fb=True, fb_id=id)
            session.add(new_user)
            session.commit()

        elif sn == "google":
            new_user = User(email=email, password=None, token=generateToken(), google=True, google_id=id)
            session.add(new_user)
            session.commit()
        else:
            return {"error_type": "AuthenticationError(ERROR: Invalid query)",
                    "status_code": 400}

        TOKENS.append(session.query(User).filter(User.email == email).first().token)
        return {"user_token": session.query(User).filter(User.email == email).first().token,
                "status_code": 200}

    class Test(Resource):
        """
            Basic ping test
        """
        def get(self):
            return {"body": "OK",
                    "status_code": 203}

    class Register(Resource):
        def put(self, email, password):
            """
            Endpoint for registering a new user
            :param email: The user's email address
            :param password: The user's unciphered password
            :return: User token from database, which can be subsequently sent to auth/token for next authentications
            """
            if email and password:
                if session.query(User).filter(User.email == email).first() is not None:
                    return {"error_type": "AuthenticationError(ERROR: Email already in use)",
                            "status_code": 400}
                new_user = User(email=email, password=psswdhash.hash_password(password), token=generateToken())
                session.add(new_user)
                session.commit()
                return {"user_token": session.query(User).filter(User.email == email).first().token,
                        "status_code": 200}


class AppUser(Resource):
    def get(self, user_id):
        pass

    class Events(Resource):
        def post(self, token, data):
            """
            Allows the mobile APP to add events to a user's history
            :param token: The user's offical token
            :param data: A JSON formatted blob of user data (WILL CHANGE TO SPECIFIC EVENT CATEGORIES)
            :return: Nothing or an error code if wrong token
            """
            usr = session.query(User).filter(User.token == token).first()
            if usr is not None and usr.token == token:
                # replace email with _id
                # put index on timestamp
                eventcollection.insert({'user_email': usr.email,
                                        'event_data': data})
            else:
                return {"error_type": "CommunicationError(ERROR: User not found or invalid token)",
                        "status_code": 400}


# END Authentication API
# Start of news data API


def updateTime():
    global DEFAULT_TIME_OLDEST
    DEFAULT_TIME_OLDEST = dt.strftime(dt.utcnow() - DEFAULT_TIME_RANGE, DEFAULT_DATE_FORMAT)
    global DEFAULT_TIME_RECENT
    DEFAULT_TIME_RECENT = dt.utcnow().strftime(DEFAULT_DATE_FORMAT)


class News(Resource):
    class ID(Resource):
        def get(self, id):
            if collection.find({"_id": ObjectId(id)}):
                return {"news_object": collection.find({"_id": ObjectId(id)})}
            else:
                return {"error_type": "ObjectNotFoundError(Unknown ID)",
                        "status_code": "404"}

    class RangeTimestamp(Resource):
        def get(self, recent, oldest):
            """
            Allows to get a range of news objects between two timestamps. Limit=1000
            :param recent: The most recent timestamp for news
            :param oldest: The oldest timestamp for news
            :return: A bulk of news objects in JSON format
            """

            updateTime()
            try:
                dt.strptime(recent, DEFAULT_DATE_FORMAT)
            except ValueError:
                recent = DEFAULT_TIME_RECENT
            try:
                dt.strptime(oldest, DEFAULT_DATE_FORMAT)
            except ValueError:
                oldest = DEFAULT_TIME_OLDEST

            package = []
            limit = 0
            for item in collection.find().sort('timestamp', pymongo.DESCENDING):
                itemtimestamp = dt.strftime(dt.utcfromtimestamp(item['timestamp']),
                                            DEFAULT_DATE_FORMAT)

                # Dirty but necessary
                if dt.strptime(itemtimestamp, DEFAULT_DATE_FORMAT) <= dt.strptime(recent, DEFAULT_DATE_FORMAT)\
                        and dt.strptime(itemtimestamp, DEFAULT_DATE_FORMAT) > dt.strptime(oldest, DEFAULT_DATE_FORMAT):
                    package.append(item)
                    limit += 1
                    if limit >= MAX_PACKAGE_SIZE:
                        break
            return {'data': package,
                    'status_code': 200}

    class URL(Resource):
        def get(self, url):
            data = collection.find({'url': url})
            if data:
                return dumps(data)

        class Bulk(Resource):
            def get(self, amount):
                """
                We request a bulk of urls from the news database.
                :param amount: The number of urls. Maximum is 1000
                :return: A json containing a list of urls under "data"
                """
                if amount is not None:
                    amount = int(amount)
                if amount > MAX_PACKAGE_SIZE:
                    amount = MAX_PACKAGE_SIZE
                package = []
                i = 0
                # Using this, we find a random range of urls to send. This function needs to be able to sort
                # the urls by category, date, language etc.
                current = random.randint(0, MAX_PACKAGE_SIZE - amount)
                idx = 0
                for news in collection.find():
                    if i == current:
                        package.append(news['source']['link'])
                        current += 1
                        idx += 1
                        if idx == amount:
                            break
                    i += 1
                return {'data': package,
                        'status_code': 200}

    class LastUrl(Resource):
        def get(self, lasturl):
            data = collection.find(lasturl)
            if data:
                return dumps(data)


if __name__ == '__main__':
    host = '129.175.22.71'

    # Initializing the SQLAlchemy database connection. The scoped_session ensures we use one connection/thread
    # to avoid crashing (SQLite objects can only be used in the thread they were created)
    engine = create_engine('sqlite:///sqlalchemy_example_auth.db')
    Base.metadata.create_all(engine)
    Base.metadata.bind = engine
    DBSession = sessionmaker(bind=engine)
    # scoped_session allows several requests to be handled in different threads by recreating the session
    session = scoped_session(DBSession)



    # Passwords should not be stored in plain text and are hashed into the database
    psswdhash = PasswordHasher()

    # This collection stores news articles and their data
    # /!\ WARNING : find a way to get the admin username and password out of the code /!\
    collection = MongoCollection("news_db", "news", indexOn=['url'],
                                 host='localhost', #user="hayj", password="renewal42", version=__version__)
                                 version=__version__)

    # This collection stores all browsing user browsing habits and actions
    eventcollection = MongoCollection("news_db", "events", indexOn=['user_id'],
                                      host='localhost', #user='hayj', password="renewal42", version=__version__)
                                      version=__version__)

    app = Flask(__name__)
    api = Api(app)

    # To add a parameter, it is good practice and necessary (for any other than "string") to mention the data type
    # Default is "string"

    api.add_resource(News.ID, '/news/id/<id>')
    api.add_resource(News.URL, '/news/url/<path:url>')
    api.add_resource(News.LastUrl, '/news/lasturl/<path:lasturl>')
    api.add_resource(News.RangeTimestamp, '/news/range_timestamp/<recent>/<oldest>')
    api.add_resource(News.URL.Bulk, '/news/url/bulk/<amount>')

    # Provides PUT & GET Methods for registration and connection respectively
    api.add_resource(Auth, "/auth/<string:email>/<string:sn>/<string:id>")
    api.add_resource(Auth.Team, "/auth/<string:name>/<string:password>")
    api.add_resource(Auth.Team.System,
                     "/auth/system/<string:teamname>/<string:password>/<string:sysname>/<string:desc>")

    api.add_resource(Auth.Register, '/auth/register/<string:email>/<string:password>') # Legacy NOT RECOMMENDED
    api.add_resource(Auth.Test, '/auth/test')

    api.add_resource(AppUser.Events, '/user/events/<string:token>/<string:data>')
    #app.run(port=4243, debug=False, host=host)
    app.run(port=5000, debug=True)
