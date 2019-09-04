The NewsSourceAgent class is the functional frame of any url-gathering agent. It regroups a a source (e.g RSSFeedPlug or TwitterStream), a parser and a server.

Parameters:
source: A data gathering class returning a dictionary of pulled data (e.g RSS feed)

parser [Default=None]: Any parser inheriting from the Parser class. It will default to Parser() if left to None.

sender [Default=None]: The sender class, providing a 'send()' method to upload gathered data through the provided queue. It will default to NewsSender() if left to None.

How it works:
The class provides a 'gatherUrls' function, an infinite loop which gets the keys to be parsed from the parser, the data from the source (single iteration), parses the data and clears any doubles from previous iterations using a temporary cache.
The class gets local time and appends the info to the parsed data.
It then sends the recovered data using the provided sender's 'send' method and sleeps for the source's provided timer (default: 60s)


Dependencies:
newssourceaggregator.newssender => NewsSender
newssourceaggregator.rssFeedPlug => RssFeedPlug
newssourceaggregator.rssparser => RequiredDataStruct
systemtools.basics => getDictSubElement
newssourceaggregator.rssparser => RssParser
time => sleep
threading (tests)
time
datetime
json
