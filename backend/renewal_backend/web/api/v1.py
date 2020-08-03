import asyncio
from http import HTTPStatus

import pymongo
from quart import Blueprint, g, request, websocket, abort, json, jsonify

from ..auth import check_auth
from ..utils import ObjectIdConverter, Int64Converter

v1 = Blueprint('api.v1', __name__)

# Ensure the blueprint knows about our URL converters
def register_converters():
    for converter in [ObjectIdConverter, Int64Converter]:
        def register_converter(s, converter=converter):
            s.app.url_map.converters.setdefault(converter.name, converter)
        v1.record_once(register_converter)

register_converters()


@v1.route('/')
def index():
    return jsonify({'version': 1})


@v1.route('/articles/interactions/<Int64:article_id>', methods=['GET', 'POST'])
@check_auth
async def articles_interactions(article_id):
    interaction = None
    if request.method == 'POST':
        interaction = await request.get_json()

    user_id = g.auth['user_id']
    filt = {'user_id': user_id, 'article_id': article_id}
    proj = {'_id': False}

    # TODO: It would be better if all various database updates were hidden
    # behind an API abstraction rather than implemented directly in the web
    # API.  However, it will be easier to know what interfaces that API needs
    # once we've fully implemented the prototype.
    if interaction is None:
        interactions = g.db.articles.interactions.find_one(filt, proj)
        if interactions is None:
            abort(HTTPStatus.NOT_FOUND)
    else:
        try:
            # We return the user's previous interactions with this article
            # (if any) so we can make a diff with the new interaction in order
            # to update article metrics
            prev_interactions = g.db.articles.interactions.find_one_and_update(
                    filt, {'$set': interaction}, projection=proj, upsert=True)

            if prev_interactions is None:
                prev_interactions = filt.copy()

        except pymongo.errors.OperationFailure:
            abort(HTTPStatus.UNPROCESSABLE_ENTITY)

        # Deconstruct the interaction object into metrics updates for the
        # article
        metrics_inc = {}
        if 'rating' in interaction:
            rating = interaction['rating']
            if 'rating' in prev_interactions:
                # A previous rating was possibly unset
                if prev_interactions['rating'] == -1:
                    metrics_inc['metrics.dislikes'] = -1
                elif prev_interactions['rating'] == 1:
                    metrics_inc['metrics.likes'] = -1
            if rating == -1:
                metrics_inc['metrics.dislikes'] = 1
            elif rating == 1:
                metrics_inc['metrics.likes'] = 1

        for bool_metric in [('bookmarked', 'bookmarks'),
                            ('clicked', 'clicks')]:
            # Update counts of clicks, bookmarks, etc.
            action, metric = bool_metric
            if action in interaction:
                metric = 'metrics.' + metric
                metrics_inc[metric] = 1 if interaction[action] else -1

        if metrics_inc:
            try:
                g.db.articles.find_one_and_update({'article_id': article_id},
                        {'$inc': metrics_inc})
            except pymongo.errors.OperationFailure:
                # This could happen if due to a bug or race condition of some
                # kind, one of the metrics is decreased below zero
                pass

        interactions = prev_interactions.copy()
        interactions.update(interaction)

        # Schedule a task to send an ARTICLE_INTERACTION event to the event
        # stream.  We could just put this event directly on g.event_queue but
        # we send it over the RabbitMQ fanout exchange for the event_stream
        # instead so that any and all queues connected to that exchange can
        # receive the event (e.g. if we have multiple web server instances
        # handling websocket connections for different clients).
        # TODO: Interaction events don't have a timestamp attached, but they
        # should.
        interaction['user_id'] = user_id
        interaction['article_id'] = article_id
        asyncio.ensure_future(g.event_stream_producer.proxy.send_event(
            event={'type': 'ARTICLE_INTERACTIONS', 'payload': interaction}))

    return jsonify(interactions)


@v1.route('/images/icons/<ObjectId:icon_id>')
def images_icons(icon_id):
    # TODO: We should set the proper content-type metadata in the headers, but
    # unfortunately we don't store the MIME-types for downloaded images; we
    # should see if we can fix that...
    filt = {
        '_id': icon_id,
        'contents': {'$exists': True},
        'content_type': {'$exists': True}
    }
    proj = {'contents': True, 'content_type': True}

    icon = g.db.images.find_one(filt, projection=proj)

    if icon is None:
        abort(404)

    return icon['contents'], 200, {'content-type': icon['content_type']}


@v1.route('/recommendations')
@check_auth('user')
def recommendations():
    limit = g.config.api.v1.recommendations.default_limit
    limit = int(request.args.get('limit', limit))

    if limit < 1:
        # TODO: Or return an error code?
        limit = 1

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
            'title': True,
            'summary': True,
            'date': '$publish_date',
            'image_url': True,
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
    return jsonify({'articles': articles, 'sources': sites})


class EventStreamHandler:
    """
    This class handles all websocket connections.

    It's a singleton in that this class is never instantiated; it just exists
    to group all websocket-related functionality together.
    """

    @classmethod
    async def event_stream(cls):
        while True:
            event = await g.event_stream_queue.get()
            await websocket.send(json.dumps(event))


@v1.websocket('/event_stream')
@check_auth(['recsystem', 'admin'], request_obj=websocket)
def event_stream():
    return EventStreamHandler.event_stream()
