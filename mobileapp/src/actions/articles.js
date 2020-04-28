import { createAction, createReducer } from '@reduxjs/toolkit';

// TODO: Originally this data include the user's saved articles and rejected
// articles in the same data structure; this excludes them for now because
// the dummy data is not user-specific.  We might later include this
// either via a separate API request, or part of the same request with some
// kind of graphql query; for debugging we can load these randomly or according
// to some pattern.


/* Action constants */
const NEW_RECOMMENDATIONS = 'articles/new_recommendations';
const NEW_BOOKMARKS = 'articles/new_bookmarks';
const SET_INTERACTION = 'articles/set_interaction';
const TOGGLE_BOOKMARKED = 'articles/toggle_bookmarked';


/* Initial state for articles */
export const initialState = {
  sources: {},
  articles: {},
  articleInteractions: {},
  recommendationsList: [],
  bookmarksList: []
};

const articleInteractionsInitialState = {
  rating: 0,
  bookmarked: false
}


/* Action creators for articles */

// Creates a payload for actions that update an article list from a list of new
// articles
// For use with the newRecommendations and newBookmarks actions.
function articleListAction(articles, articleInteractions, sources) {
  return {
    payload: { articles, articleInteractions, sources }
  };
}

const actions = {
  newRecommendations: createAction(NEW_RECOMMENDATIONS, articleListAction),
  newBookmarks: createAction(NEW_BOOKMARKS, articleListAction),
  setInteraction: createAction(SET_INTERACTION, (articleId, interaction) => ({
    payload: { articleId, interaction }
  })),
  toggleBookmarked: createAction(TOGGLE_BOOKMARKED)
};


/* Reducers for article actions */
// NOTE: Per the Redux Toolkit docs
// <https://redux-toolkit.js.org/api/createReducer>, createReducer uses
// immer <https://immerjs.github.io/immer/>, so although it appears we
// are mutating the state rather than returning a new one, this is just
// an illusion.

// Creates a reducer for updating an articles list, for use with
// newRecommendations and newBookmarks; this higher-order function just
// specifies which list to update.
function articleListReducer(listProperty) {
  // TODO: Right now this is stupid and just appends to the list;
  // in practice this will want to do something more complicated--it may
  // want to either append or prepend, or as discussed at
  // https://github.com/RenewalResearch/Renewal/issues/3 it may even want to
  // maintain a heap invariant
  return function(state, action) {
    const { articles, articleInteractions, sources } = action.payload;
    // Update articleInteractions, and sources
    Object.assign(state.articleInteractions, articleInteractions);
    Object.assign(state.sources, sources);

    // Now update the appropriate articles array and update the articles
    // object for each article passed to the action
    articles.forEach((article) => {
      state.articles[article.url] = article;
      if (state.articleInteractions[article.url] === undefined) {
        state.articleInteractions[article.url] = articleInteractionsInitialState;
      }
      state[listProperty].push(article.url);
    });
  }
}

export const reducer = createReducer(initialState, {
  [actions.newRecommendations]: articleListReducer('recommendationsList'),
  [actions.newBookmarks]: articleListReducer('bookmarksList'),
  [actions.setInteraction]: (state, action) => {
    const { articleId, interaction } = action.payload;
    let articleInteractions = state.articleInteractions[articleId];
    if (articleInteractions === undefined) {
      state.articleInteractions = articleInteractionsInitialState;
    }
    Object.assign(state.articleInteractions[articleId], interaction);
  },
  [actions.toggleBookmarked]: (state, action) => {
    const articleId = action.payload;
    const bookmarks = state.bookmarksList;
    let articleInteractions = state.articleInteractions[articleId];
    if (articleInteractions === undefined) {
      articleInteractions = articleInteractionsInitialState;
      state.articleInteractions = articleInteractions;
    }
    if (articleInteractions.bookmarked) {
      // Remove bookmark
      bookmarks.splice(bookmarks.findIndex(i => { i == articleId }), 1);
    } else {
      // Insert bookmark
      bookmarks.splice(0, 0, articleId);
    }
    articleInteractions.bookmarked = !articleInteractions.bookmarked;
  }
});


export default actions;
