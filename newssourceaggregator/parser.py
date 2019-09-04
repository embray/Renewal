from systemtools.basics import *
import json
import abc

import os

class RequiredDataStruct:
    cnt = 0
    args = None
    datadict = None
    agent = ''
    crawling_timestamp = None


    def __init__(self, *args):
        self.args = args
        self.datadict = dict.fromkeys(tuple(*args))

    def feedValue(self, key, value):
        self.datadict[key] = value

    def setItem(self, key, value):
        self.datadict[key] = value

    def print(self):
        for key in self.datadict:
            if dictContains(self.datadict, key):
                if key == "published_parsed":
                    print(key + ": " + str(time.mktime(self.datadict[key])))
                else:
                    print(key + ": " + self.datadict[key])

    def __iter__(self):
        return self

    def __next__(self):
        self.cnt += 1
        if self.cnt >= len(self.datadict):
            raise StopIteration
        return self.datadict[self.cnt - 1]

    def __radd__(self, other):
        self.datadict.update(other)
        return self

    def __add__(self, other):
        self.datadict.update(other)
        return self

    def __copy__(self):
        copy = RequiredDataStruct(*self.args)
        copy.datadict.update(self.datadict)
        return copy

    def __lt__(self, other):
        return len(self.datadict) < len(other.datadict)


class Parser(abc.ABC):
    keywordlist = None  # List of all keywords to search for in .json file
    cfg = None        # Instance of configparser.ConfigParser
    section = None

    def __init__(self, configfile=None):
        if configfile is None:
            self.configfile = "./parserconfig.json"
        else:
            self.configfile = configfile
        print(self.configfile)
        print(os.getcwd() + '/' +  self.configfile)
        try:
            self.cfg = open(os.getcwd() + '/' +  self.configfile, 'r')
            self.keywordlist = json.loads(self.cfg.read())
            self.cfg.close()
        except FileNotFoundError:
            print("[WARNING]: Base file parserconfig.json not found and no file specified in Parser.__init__")

    # Returns a dict from read text containing keys in keywordlist
    @abc.abstractmethod
    def parse(self, text):
        pass

    # Returns a dict from a file, either filepath or fileobject must be valid or an exception will be raised
    @abc.abstractmethod
    def process(self, filepath=None, fileobject=None):
        pass

    def getKeywordList(self):
        if self.keywordlist is None:
            raise FileNotFoundError("No .json file found or configured")
        if not self.configfile:
            raise FileNotFoundError("No .json file found or configured")
        if len(self.keywordlist) > 0:
            return self.keywordlist

        try:
            self.cfg = open(self.configfile, 'r')
            self.keywordlist = json.loads(self.cfg.read())
            self.cfg.close()
        except FileNotFoundError as e:
            print(e)
            raise FileNotFoundError("No .json file found or configured")

        return self.keywordlist
