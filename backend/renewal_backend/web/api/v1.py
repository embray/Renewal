import pymongo
from flask import Blueprint, g, request

from ..utils import ObjectIdConverter

v1 = Blueprint('api.v1', __name__)

# Ensure the blueprint knows about our URL converters
v1.record_once(
    lambda s: s.app.url_map.converters.setdefault('ObjectId', ObjectIdConverter)
)

@v1.route('/')
def index():
    return {'version': 1}


@v1.route('/recommendations')
def recommendations():
    limit = g.config.api.v1.recommendations.default_limit
    limit = int(request.args.get('limit', limit))

    match = [{'article_id': {'$exists': True}}]

    since_id = int(request.args.get('since_id', -1))
    if since_id >= 0:
        match.append({'article_id': {'$gt': since_id}})

    # TODO: Raise a request error if max_id < since_id which doesn't make sense
    max_id = int(request.args.get('max_id', -1))
    if max_id >= 0:
        match.append({'article_id': {'$lt': max_id}})

    if len(match) == 1:
        match = match[0]
    else:
        match = {'$and': match}

    # TODO: This is where we would make a request to the recommendation system
    # to return article IDs, and then we would return an aggregation based on
    # only those article IDs.  However, absent a real recommendation system
    # right now we just use a "dummy" response drawn from the entire articles
    # collection.  This might also be useful in some cases for a cold start
    icon_base_url = request.base_url.rsplit('/', 1)[0] + '/images/icons/'

    cursor = g.db.articles.aggregate([
        # Select all articles with an article_id (i.e. articles that have been
        # scraped)
        {'$match': match},
        # Replace the 'site' property with the contents of the 'sites' document
        # with the corresponding _id
        {'$lookup': {
            'from': 'sites',
            'localField': 'site',
            'foreignField': '_id',
            'as': 'site'
        }},
        # Replace the single-element array returned by the previous operation
        # with an object
        {'$unwind': '$site'},
        # Rebuild the document with just the properties that need to be
        # returned to the app
        {'$project': {
            '_id': False,
            'article_id': True,
            'url': True,
            'title': '$scrape.title',
            'summary': '$scrape.summary',
            'date': '$scrape.publish_date',
            'image_url': '$scrape.image_url',
            'site.url': True,
            'site.name': True,
            'site.icon_url': {
                '$concat': [
                    icon_base_url,
                    {'$toString': '$site.icon_resource_id'}
                ]
            }
        }},
        {'$sort': {'article_id': pymongo.DESCENDING}},
        {'$limit': limit}
    ])

    articles = []
    sites = {}

    for article in cursor:
        site = article.pop('site', None)
        # TODO: Actually we probably shouldn't allow any articles without an
        # associated site: This shouldn't happen.
        if site:
            if site['url'] not in sites:
                sites[site['url']] = site
            article['source'] = site['url']

        articles.append(article)

    # TODO: The app currently expects the sites to be in a dict called
    # 'sources' (as in, the article sources); perhaps we should try to
    # make this nomenclature more consistent in favor of one or the other
    return {'articles': articles, 'sources': sites}


@v1.route('/images/icons/<ObjectId:icon_id>')
def images_icons(icon_id):
    # TODO: We should set the proper content-type metadata in the headers, but
    # unfortunately we don't store the MIME-types for downloaded images; we
    # should see if we can fix that...
    contents = g.db.images.find_one(
            {'_id': icon_id},
            projection={'contents': True})

    if contents is None:
        abort(404)

    return contents['contents'], 200, {'content-type': 'image/png'}
