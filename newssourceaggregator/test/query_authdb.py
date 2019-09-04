import sys, os
sys.path.append("/".join(os.path.abspath(__file__).split("/")[0:-2]))
from sqlalchemy_declarative import User, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///sqlalchemy_example_auth.db')
Base.metadata.bind = engine

DBSession = sessionmaker(bind=engine)
DBSession.bind = engine
session = DBSession()

usr = User(email="test_user", password="test_user", token="test_token")
session.add(usr)
session.commit()

print(session.query(User).all())
#usr = session.query(User).first()
#print(usr.email)
#print(usr.password)
usr = session.query(User).filter(User.email == "ajodar@test.fr").first()
print(usr)
print(usr.email)
print(usr.password)
print(usr.token)

