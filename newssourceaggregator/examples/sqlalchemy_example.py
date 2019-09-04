import sys, os
sys.path.append("/".join(os.path.abspath(__file__).split("/")[0:-2]))
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_declarative import Base, User

engine = create_engine('sqlite:///sqlalchemy_example_auth.db')
# Bind the engine to the metadata of the Base class so that the
# declaratives can be accessed through a DBSession instance
Base.metadata.bind = engine

DBSession = sessionmaker(bind=engine)
# A DBSession() instance establishes all conversations with the database
# and represents a "staging zone" for all the objects loaded into the
# database session object. Any change made against the objects in the
# session won't be persisted into the database until you call
# session.commit(). If you're not happy about the changes, you can
# revert all of them back to the last commit by calling
# session.rollback()
session = DBSession()

# Insert a User in the user table
new_user = User(email='test@lol.com', password="ajodar", token='test')
session.add(new_user)
session.commit()
