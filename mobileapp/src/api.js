/* Implements a simple wrapper for the Renewal API
 *
 * Currently only works with API v1 since that is the only API version.
 */


import axios from 'axios';
import Constants from 'expo-constants';

import { sleep } from './utils';


const DEBUG_ARTICLES = [];
const DEBUG_SOURCES = {};
const DEBUG_DATA_SOURCE = {};

if (__DEV__) {
  DEBUG_ARTICLES.push(...require('./data/debug_articles.json'));
  Object.assign(DEBUG_SOURCES, require('./data/debug_sources.json'));
  Object.assign(DEBUG_DATA_SOURCE, {
    articles: Object.fromEntries(DEBUG_ARTICLES.map((a) => [a.article_id, a])),
    articleLists: {
      recommendations: DEBUG_ARTICLES.map((a) => a.article_id).sort((x, y) => (y - x)),
      bookmarks : []
    },
    articleInteractions: [],
    sources: DEBUG_SOURCES
  });
}


export default class RenewalAPI {
  constructor(baseURL = Constants.manifest.extra.renewalApi, idToken = null) {
    this.baseURL = baseURL
    if (!baseURL) {
      if (__DEV__) {
        console.warn(
          'extra.renewalApi not configured in app.config.js; api will use ' +
          'dummy data only');
      } else {
        console.error(
          'extra.renewalApi not configured in app.config.js; it is ' +
          'mandatory for non-development builds');
      }
      this.client = null;
    } else {
      const headers = { Accept: 'application/json' };
      if (idToken !== null) {
        // Without the ID token most requests will fail
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      this.client = axios.create({ baseURL, headers });
    }
  }

  async recommendations(params) {
    console.log(`RenewalAPI.recommendations(${JSON.stringify(params)})`);
    if (this.client === null && __DEV__) {
      return this._dummyRecommendations(params);
    }
    return this.client.get('/recommendations', { params }).then((response) =>
      response.data
    ).catch((error) => {
      console.log(`error fetching recommendations: ${JSON.stringify(error)}`);
      return { articles: [], sources: {} };
    });
  }

  async bookmarks(params) {
    console.log(`RenewalAPI.bookmarks(${JSON.stringify(params)})`);
    // NOTE: In production this would fetch the user's existing bookmarked
    // articles if they aren't already cached in the app.  That isn't
    // implemented yet though (first we need to actually save the user's
    // bookmarks on the backend =)
    if (__DEV__) {
      return this._dummyBookmarks(params);
    }
  }


  // Dummy interfaces for development/test builds; might be nice to move these
  // to a separate class entirely...
  async _dummyRecommendations(params) {
    let { since_id, max_id, limit } = params;
    let articles = DEBUG_DATA_SOURCE.articleLists.recommendations;

    // NOTE: In DEBUG_DATA_SOURCE the articles list is already sorted
    // by article_id descending
    let start = (max_id !== undefined ?
      articles.findIndex(id => id == max_id) + 1 : 0);
    let end = (since_id !== undefined ?
      articles.findIndex(id => id == since_id) - 1 : articles.length);

    if (end < 0) {
      // This can happen if the since_id is the most recent article.
      end = 0;
    }

    if ((end - start) > limit) {
      end = start + limit;
    }

    articles = articles.slice(start, end);
    articles = articles.map((id) => DEBUG_DATA_SOURCE.articles[id])

    const sources = {}

    // Article fetches include their associated sources and interactions
    articles.forEach((article) => {
      sources[article.source] = DEBUG_DATA_SOURCE.sources[article.source];
    });

    // Simulate loading time;
    await sleep(500);

    return { articles, sources };
  }

  async _dummyBookmarks(params) {
    // no-op, any articles that would be bookmarked during development
    // testing would already by loaded by _dummyRecommendations
    return { articles: [], sources: {} };
  }
}
