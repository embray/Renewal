import os
import json
import time
import glob
from pathlib import Path

from systemtools.file import *
from systemtools.basics import *
from systemtools.logger import *

class DataEncryptor:
    def __init__(self, dataDir=None, filename=None, logger=None, verbose=False):
        """
            Note: if verbose = True, data contained in filename WILL be displayed
        """
        self.key = 'f5j7z15j69e94xcn1glo78'
        idRsaPubPath = homeDir() + "/.ssh/id_rsa.pub"
        if isFile(idRsaPubPath):
            idRsa = fileToStr(idRsaPubPath)
            self.key = idRsa + self.key
        self.key = md5(self.key)
        self.logger = logger
        self.verbose = verbose
        self.dataDir = dataDir
        if filename:
            self.jsonFilename = filename
        if self.dataDir is None:
            self.dataDir = str(Path.home()) + "/.ssh/encrypted-data"
        mkdir(self.dataDir)
        self.cache = dict()

    def __encryptData(self, text, outputFilename):
        myMode = "encrypt"
        log('%sing...' % (myMode.title()), self)
        startTime = time.time()
        translated = encryptFile(outputFilename, self.key, text,
                                 logger=self.logger, verbose=self.verbose)
        totalTime = round(time.time() - startTime, 2)
        log('%sion time: %s secondes' % (myMode.title(), totalTime), self)

    def __getitem__(self, key):
        if key not in self.cache:
            self.cache[key] = self.getDict(key)
        return self.cache[key]

    def getDict(self, filename=None):
        """
            :param:
                filename = The file in which the json data is contained. If no filename, uses the name given in Ctor.
            If no filename given in Ctor, throws exception

            If file has extension '.encrypted.zip', will be decrypted. If not, an encrypted copy will be made.

            :return:
                Dictionary containing data from .json file

            :example:
            >>>
            accessgetter = DataEncryptor("notEncryptedFile.json")
            dict = accessgetter.getDict() # Creates notEncryptedFile.encrypted.zip

            dict = accessgetter.getDict(".twitter.encrypted.zip")

            Note: DataEncryptor.filename is replaced when calling getDict with a filename
        """
        if filename:
            self.jsonFilename = filename
            self.jsonDataDict = None
            filename = filename.lower()
        elif not filename and not self.jsonDataDict and not self.jsonFilename:
            raise RuntimeError("DataEncryptor.getDict: failed to provide valid .json file to get Dict from")
        if self.jsonDataDict:
            return self.jsonDataDict
        else:
            return self.__getDictFromJson()

    def __getDictFromJson(self):
        filePath = self.dataDir + '/' + self.jsonFilename + ".json"
        encryptedFilePath = filePath + ".encrypted.zip"
        if not os.path.exists(filePath) and not os.path.exists(encryptedFilePath):
            raise RuntimeError("DataEncryptor.getDict: failed to provide valid .json file to get Dict from")
        isEncrypted = False
        if os.path.exists(filePath):
            jsonfile = open(filePath)
            isEncrypted = False
        else:
            jsonfile = open(encryptedFilePath)
            isEncrypted = True

        if not isEncrypted:
            readString = jsonfile.read()
        else:
            log("Unciphering", self)
            readString = decryptFile(encryptedFilePath, self.key,
                                     logger=self.logger, verbose=self.verbose)

        log("File " + str(self.jsonFilename) + " contains: \n" + str(readString), self)
        jsonfile.close()
        self.jsonDataDict = json.loads(readString)

        log("Final output file name", self)
        self.__encryptData(readString, encryptedFilePath)
        return self.jsonDataDict

    def setPath(self, path):
        self.dataDir = path

    def seekJson(self):
        files = sorted(glob.glob(self.dataDir + "/*"))
        log(files, self)
        cnt = 0
        for filename in files:
            if filename.endswith(".encrypted.zip"):
                pass
            elif filename.endswith(".json"):
                cnt -= 1000
                handle = open(filename, 'r')
                text = handle.read()
                handle.close()
                self.__encryptData(text, filename)

        if cnt == 0:
            for filename in files:
                if filename.endswith(".encrypted.zip"):
                    log("Modifying " + filename, self)
                    handle = open(filename, "r")
                    text = decryptFile(handle.name, self.key,
                                       logger=self.logger, verbose=self.verbose)
                    log("Text found : " + text, self)
                    handle.close()
                    outputname = filename[:-len(".encrypted.zip")]
                    log("Outputfile : " + outputname, self)
                    outputhandle = open(outputname, "w+")
                    outputhandle.write(text)
                    outputhandle.close()

def test1():
    de = DataEncryptor()
    printLTS(de["mongoauth"])
    for user in ["hayj", "student"]:
        printLTS(de["mongoauth"]["datascience01"][user])
    exit()


if __name__ == "__main__":
    de = DataEncryptor(verbose=False)
    de.seekJson()







# def encrypt(message, key):
#     index = 0
#     count = 0
#     cipher = []
#
#     for letter in message:
#         cipher.append(message[index])
#         index += int(key)
#
#         if index > len(message) - 1:
#             count += 1
#             index = count
#     return ''.join(cipher)
#
#
# def decrypt(cipher, key):
#     message = [''] * len(cipher)
#     index = 0
#     count = 0
#
#     for letter in cipher:
#         message[index] = letter
#         index += int(key)
#         if index > len(cipher) - 1:
#             count += 1
#             index = count
#
#     return ''.join(message)

