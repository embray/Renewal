import json

from copy import copy

from .parser import Parser, RequiredDataStruct


class RssParser(Parser):

    def __init__(self, keywords):
        super().__init__(keywords)
        self.parsedDataList = []

    # Returns a list of fully parsed json data from read text containing keys in keywordlist
    def parse(self, filepath=None, fileobject=None, text=None):
        data = []
        if not text and not filepath and not fileobject:
            raise AttributeError("No source provided for parsing")
        if text:
            data.append(json.loads(text))
        elif filepath:
            with open(filepath, 'r') as fd:
                data.append(json.loads(fd.read()))
        else:
            data.append(json.loads(fileobject.read()))
        return data

    # Returns a generator for json-parsed data, either filepath or fileobject must be valid or an exception will be raised
    def process(self, filepath=None, fileobject=None, text = None):


        raise NotImplemented("This feature is not yet available.")


        if not text and not filepath and not fileobject:
            raise AttributeError("No source provided for parsing")
        if text:
            yield(json.loads(text))
        elif filepath:
            with open(filepath, 'r') as fd:
                yield(fd.read())
        else:
            yield(json.loads(fileobject.read()))
        return data

    def parseKeys(self, klist, arr, parsedDataList=None):
        resultstruct = RequiredDataStruct(klist)
        for items in arr:
            if not hasattr(items, '__iter__'):
                continue
            for item in items: # = les catégories du .json
                if hasattr(item, '__iter__'):
                    for key in klist:
                        if key in item:
                            resultstruct.setItem(key, items[key])

                if isinstance(items[item], list):
                    if len(resultstruct.datadict) > 0:
                        self.parsedDataList.append(copy(resultstruct))
                    self.parseKeys(klist, items[item])
        return
