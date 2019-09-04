The Controller class allows the user to connect to a RabbitMQ queue and to store received data from said queue to a MongoDB database.

# Parameters

host [Default='localhost']: The host IP for the MongoDB database connection

receiver [Default=NewsReceiver()]: The receiving end of the queue. This could technically be switched to any other messaging tool using the 'callback system'

__version__: The controller version


# How it works

The Controller initializes the MongoCollection on creation, stores a pointer to the version and receiver, then triggers the receiver's 'startListening' method by providing it self.callback.

The callback method is implemented in the Controller to allow for a separate parsing and storing method from the receiver, allowing for an easier switch to another messaging protocol.


# Dependencies

json
databasetools.mongo => MongoCollection
newssourceaggregator.newsreceiver => NewsReceiver
