import sys, os
sys.path.append("/".join(os.path.abspath(__file__).split("/")[0:-2]))
from sqlalchemy import Column, ForeignKey, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

Base = declarative_base()


# If you add any data to the User SQLite blueprint, run this program in order to recreate the database.
# Note: It is possible in some cases that the database would need to be deleted

class User(Base):
    __tablename__ = 'user'
    id = Column(Integer, primary_key=True)
    email = Column(String(250), nullable=False)
    password = Column(String(250), nullable=True)
    token = Column(String(250), nullable=False)
    fb = Column(Boolean(), nullable=False, default=False)
    fb_id = Column(String(250), nullable=True, default=None)
    google = Column(Boolean(), nullable=False, default=False)
    google_id = Column(String(250), nullable=True, default=None)


class Team(Base):
    __tablename__ = 'teams'
    id = Column(Integer, primary_key=True)
    token = Column(String(250), nullable = False)
    name = Column(String(250), nullable=False)

class System(Base):
    __tablename__ = 'systems'
    id = Column(Integer, primary_key=True)
    name = Column(String(250), nullable=False)
    team = Column(Integer, nullable=False)
    desc = Column(String(1024), nullable=True)


engine = create_engine('sqlite:///sqlalchemy_example_auth.db')
Base.metadata.create_all(engine)
