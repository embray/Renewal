import sys, os
sys.path.append("/".join(os.path.abspath(__file__).split("/")[0:-2]))
from rssparser import RequiredDataStruct
from rssFeedPlug import RssFeedPlug
from newssender import NewsSender
from rssparser import RssParser
from systemtools.basics import *
from time import sleep
import threading
import datetime
import time
import json
import csv

CFG_FILE_PATH="./parserconfig.json"


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
            unparsedData = self.source.getPunctualFeed(self.source.source)
            klist = self.parser.getKeywordList()
            for section in unparsedData.entries:
                self.fullData.append(RequiredDataStruct())
                timeID = time.time()
                date = datetime.datetime.   fromtimestamp(timeID)
                self.fullData[-1].crawling_timestamp = date
                self.fullData[-1].agent = self.source.type
                for key in klist:
                    if key in section:
                        self.fullData[-1].setItem(key, getDictSubElement(section, klist[key]))

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
                    self.sender.send(json.dumps(struct.datadict))
                cache.add(struct.datadict['link'])

            self.sender.connection.sleep(self.source.waitTimer)


# TODO: Handle incorrect RSS links and dying threads intelligently
if __name__ == '__main__':
    handle = open('rss_urls.csv')
    data = handle.read()
    threadnumber = 0
    threadHandles = []
    NSAhandles = []
    for line in data.splitlines():
        url = line.split()[1]
        tmp = NewsSourceAgent(source=RssFeedPlug(url), parser=RssParser(CFG_FILE_PATH))
        NSAhandles.append(tmp)
        threadHandles.append(threading.Thread(target=tmp.gatherUrls))
        threadnumber += 1
        threadHandles[-1].start()

    """ Those two agents are single tests and can be removed at anytime"""
    nsa = NewsSourceAgent(source=RssFeedPlug("https://www.judgehype.com/nouvelles.xml"), parser=RssParser(CFG_FILE_PATH))
    nnsa = NewsSourceAgent(source=RssFeedPlug("http://www.lefigaro.fr/rss/figaro_actualites.xml", timer=90),
                           parser=RssParser(CFG_FILE_PATH))
    threading.Thread(target=nsa.gatherUrls).start()
    threading.Thread(target=nnsa.gatherUrls).start()

    print(threadnumber)

    handle.close()
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
