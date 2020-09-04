import asyncio
import random
from http import HTTPStatus

import pymongo
from quart import Blueprint, g, request, websocket, abort, jsonify, json

from .recsystems import RecsystemsManager
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


def get_articles(filter={}, limit=None):
    """Return all articles from the database matching the given filter."""

    icon_base_url = request.base_url.rsplit('/', 1)[0] + '/images/icons/'

    cursor = g.db.articles.aggregate([
        # Select all articles with an article_id (i.e. articles that have been
        # scraped)
        {'$match': filter},
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
            'metrics': {
                '$mergeObjects': [
                    {'likes': 0, 'dislikes': 0, 'bookmarks': 0, 'clicks': 0},
                    '$metrics'
                ]
            },
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

    return jsonify(list(cursor))


@v1.route('/articles')
@check_auth(['admin', 'recsystem'])
def articles():
    limit = g.config.api.v1.articles.default_limit
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

    return get_articles(filter=match, limit=limit)


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
async def recommendations():
    limit = g.config.api.v1.recommendations.default_limit
    limit = int(request.args.get('limit', limit))

    if limit < 1:
        # TODO: Or return an error code?
        limit = 1

    since_id = request.args.get('since_id')
    since_id = int(since_id) if since_id and int(since_id) >= 0 else None

    # TODO: Raise a request error if max_id < since_id which doesn't make sense
    max_id = request.args.get('max_id')
    max_id = int(max_id) if max_id and int(max_id) >= 0 else None

    # Request the recsystems
    # TODO: User assignment is not implemented yet so just selecting a
    # recsystem at random
    if (recsystems_manager is None or
            not recsystems_manager.recsystem_rpc_clients):
        return (json.dumps({'error': 'no recsystems are available'}),
                HTTPStatus.SERVICE_UNAVAILABLE)

    recsystem_id = random.choice(
            list(recsystems_manager.recsystem_rpc_clients))
    response = await recsystems_manager.rpc(recsystem_id,
            'recommend', user_id=g.auth['user_id'],
            limit=limit, since_id=since_id, max_id=max_id)

    return get_articles({'article_id': {'$in': response.data.result}},
                        limit=limit)


recsystems_manager = None

class RecsystemsManagerAPIv1(RecsystemsManager):
    async def handle_new_article_event(self, event_type, payload, rpc_client):
        """NEW_ARTICLE events are sent without expecting a response."""
        await rpc_client.notify('new_article', article=payload)


@v1.websocket('/event_stream')
@check_auth(['recsystem', 'admin'], request_obj=websocket)
def event_stream():
    global recsystems_manager
    if recsystems_manager is None:
        recsystems_manager = RecsystemsManagerAPIv1.install(
                g.event_stream_queue)

    return recsystems_manager.connect_client()
