import argparse
import csv
import datetime
import json
import logging
import os.path as pth
import threading
import time
from time import sleep

from . import DATA_DIR
from .rssparser import RequiredDataStruct
from .rssFeedPlug import RssFeedPlug
from .newssender import NewsSender
from .rssparser import RssParser
from .utils import traverse_dict


log = logging.getLogger(__name__)


class NewsSourceAgent:

    def __init__(self, source, parser=None, sender=None):
        self.source = source
        self.fullData = []
        self.parser = parser
        self.sender = sender
        if sender is None:
            self.sender = NewsSender()

    def gatherUrls(self):
        cache = set()
        while 42:
            try:
                # TODO: Why is this even a staticmethod?
                unparsedData = self.source.getPunctualFeed(self.source.source)
            except Exception as exc:
                # TODO: There should probably be some configuration for how
                # many times a feed source should fail before giving up on it
                # altogether (and maybe even removing it from the feed list).
                log.warning(
                    f'{self.__class__.__name__} for {self.source} failed to '
                    f'read the feed and will abort: {exc}')
                return

            for section in unparsedData.entries:
                self.fullData.append(RequiredDataStruct())
                timeID = time.time()
                date = datetime.datetime.fromtimestamp(timeID)
                self.fullData[-1].crawling_timestamp = date
                self.fullData[-1].agent = self.source.type
                for key, keywords in self.parser.keywords.items():
                    # The "parserconfig.json" file a.k.a. "keyword list" is
                    # currently just a mapping from a handful of words, to a
                    # single-element containing the same word.  I have no idea
                    # actually what this is supposed to be used for at this
                    # point...
                    if key in section:
                        element = traverse_dict(section, keywords)
                        self.fullData[-1].setItem(key, element)

            indexlist = []
            for struct in self.fullData:
                if struct.datadict['link'] in cache:
                    indexlist.append(self.fullData.index(struct))
            indexlist.reverse()
            for index in indexlist:
                del self.fullData[index]
            indexlist.clear()

            for struct in self.fullData:
                if struct.datadict is not None:
                    if self.source.source == "https://www.judgehype.com/nouvelles.xml":
                        f = open("./judge.txt", "a")
                        f.write(struct.datadict['link'] + '\n')
                    log.debug(
                        f'sending entry {struct.datadict} from {self.source}')
                    self.sender.send(json.dumps(struct.datadict))
                cache.add(struct.datadict['link'])

            self.sender.connection.sleep(self.source.waitTimer)


# TODO: Handle incorrect RSS links and dying threads intelligently
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--log-level', type=str.upper, default='INFO',
                        choices=['FATAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'])
    args = parser.parse_args()
    # TODO: Centralized logging configuration
    logging.basicConfig()
    log.setLevel(args.log_level)
    # TODO: Completely rework this--maybe RSS feeds could live in a database
    # instead?
    with open(pth.join(DATA_DIR, 'rss_urls.csv')) as fobj:
        data = fobj.read()

    with open(pth.join(DATA_DIR, 'parserconfig.json')) as fobj:
        parser_config = json.load(fobj)

    threadnumber = 0
    threadHandles = []
    NSAhandles = []
    for line in data.splitlines():
        url = line.split()[1]
        tmp = NewsSourceAgent(source=RssFeedPlug(url),
                              parser=RssParser(parser_config))
        NSAhandles.append(tmp)
        threadHandles.append(threading.Thread(target=tmp.gatherUrls))
        threadnumber += 1
        threadHandles[-1].start()

    """ Those two agents are single tests and can be removed at anytime"""
    nsa = NewsSourceAgent(
            source=RssFeedPlug("https://www.judgehype.com/nouvelles.xml"),
            parser=RssParser(parser_config))
    nnsa = NewsSourceAgent(
            source=RssFeedPlug(
                "http://www.lefigaro.fr/rss/figaro_actualites.xml",
                timer=90),
            parser=RssParser(parser_config))
    threading.Thread(target=nsa.gatherUrls).start()
    threading.Thread(target=nnsa.gatherUrls).start()

    print(threadnumber)

    while 1:
        threadnumber = 0
        time.sleep(5)
        for thread in threadHandles:
            if thread.is_alive():
                threadnumber += 1
            else:
                threadHandles.remove(thread)
        print(threadnumber)
        continue
