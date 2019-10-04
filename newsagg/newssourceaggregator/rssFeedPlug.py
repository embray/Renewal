import feedparser
import time
import json


class RssFeedPlug:
    waitTimer = 60
    source = None
    type = 'RSS-agent | Source : '

    def __init__(self, source, timer=60):
        if timer >= 5:
            self.waitTimer = timer
        if source:
            self.source = source
        else:
            raise RuntimeError("No source provided for RSS feed")
        self.type += source

    def __str__(self):
        return f'RSS feed {self.source}'

    def getConstantFeed(self):
        while 1:
            data = feedparser.parse(self.source)
            time.sleep(self.waitTimer)
            if self.source == "http://www.lefigaro.fr/rss/figaro_actualites.xml":
                with open("./judge.txt", 'w+').write(data):
                    pass
            else:
                print(data)

    @staticmethod
    def getPunctualFeed(rss):
        data =  feedparser.parse(rss)
        if data.bozo == 1:
            raise data.bozo_exception
        return data

