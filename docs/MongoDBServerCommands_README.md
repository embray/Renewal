# What For ?

These commands will allow the MongoDB admin to grant user permissions on the news_db.
Starting from scratch:

## Create an admin
sudo service mongod start
mongo	     # Start mongo

use admin    # The admin db will hold all user informations (passwords will not be visible)

db.createUser(user:"MyUserName", pwd:"MySecurePassword", roles: [{role:"userAdminAnyDatabase", db: "admin"}]})
# The "db" argument states that the infos of the superuser will be stored in the "admin" database.
# This user will be able to set rights for any user on any database but is NOT considered an authorized user for those databases
# You will have to add the admin user to the databases same as any other user with the following commands

exit

# modify /etc/mongo.conf