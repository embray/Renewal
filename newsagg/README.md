# Renewal NewsAgg

## A functional solution to gather data from json streams

### What it contains

This solution contains base and variants for the following components:

* A data sourcer, pulling blocks of data from various streams (e.g RSS feeds)
* A parser interface to extract specific data from the sourcer's results using a configuration file
* A sender-receiver solution using RabbitMQ to send data through named, durable queues