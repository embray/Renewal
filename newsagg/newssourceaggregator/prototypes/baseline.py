import json
import random


from ..api import MAX_PACKAGE_SIZE
from ..databasetools.mongo import MongoCollection
from ..newssender import NewsSender
from ..newsreceiver import NewsReceiver


# LA BASELINE N'A PAS ACCES A LA DB ELLE FAIT DES CALLS API ET ENVOIE LA REPONSE VIA DES QUEUES RABBITMQ
# CES QUEUES SONT TENUES PAR UN SYSTEMINTERFACE QUI A UNE FONCTION/QUEUE
# EN ENVOI LINTERFACE PUSH DANS UNE QUEUE SPECIFIQUE PAR SYSTEM, EN RECEPTION LINTERFACE TRANSMET AU REQDISPATCHER
# LE REQDISPATCHER TRANSMET A L'APPLICATION VIA

# Résumé fonctionnement de départ:
# Inscription du user par API ==> OK
# API transmet le token user au ReqDispatcher
# RD inscrit le user à un system random (garder chiffres du nombre de users/systemes)
# tronche : rd.systems[5].subUser(userid)
# user pushé par systeminterface sur la queue users du system
# rd.systems[5].getNews() (ou content ou whatever)
# demande pushée sur la queue du system
# Début fonctionnement régulier
# Itérer sur queue.method.message_count != 0 sur toutes les queues de manière intelligente (eh lol)
#



# Résumé fonctionnement régulier APP <=> API <=> RQ <=> SYSTEMINTERFACE <=> SYSTEM:
# APP_API_CALL arrive sur l'API.
# Call transmis au reqdispatcher
# reqdispatcher match usertoken et system responsable ==> OK
# reqdispatcher.systemsinscrits est une liste d'interfaces systems
# reqdispatcher.

class Baseline:
    def __init__(self):
        # sender parameters : def __init__(self, host='localhost', queue_name='news_data_queue'):
        self.name = "Baseline"
        self.queues = []
        self.queues.append(NewsSender(queue_name="rec_request_" + self.name))
        self.queues.append(NewsSender(queue_name="user_assign_" + self.name))
        self.queues.append(NewsSender(queue_name="news_rec_" + self.name))
        self.queues.append(NewsSender(queue_name="user_data_" + self.name))
        self.queues.append(NewsSender(queue_name="news_request_" + self.name))
        self.sender = NewsSender()
        self.receiver = NewsReceiver()
        self.articles = []

    def getRandomArticles(self, amount=50):
        # make an API call to api.Bulk
        pass

if __name__ == '__main__':
    bs = Baseline()
    print(bs.getRandomArticles())

# Connecter automatiquement la baseline à toutes les queues qui doivent envoyer/recevoir ordres et données, ces queues
# seront connectées de l'autre côté par l'interface system qui va envoyer via sys.sendContent(content)
# ou sys.sendUsers(listofusers)(example). 1 FONCTION = 1 queue dans SystemInterface
