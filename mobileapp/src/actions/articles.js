import { createAction, createReducer } from '@reduxjs/toolkit';

// TODO: Originally this data include the user's saved articles and rejected
// articles in the same data structure; this excludes them for now because
// the dummy data is not user-specific.  We might later include this
// either via a separate API request, or part of the same request with some
// kind of graphql query; for debugging we can load these randomly or according
// to some pattern.


/* Action constants */
const NEW_ARTICLES = 'articles/new_articles';
const SET_CURRENT_ARTICLE = 'articles/set_current_article';
const SET_INTERACTION = 'articles/set_interaction';
const TOGGLE_BOOKMARKED = 'articles/toggle_bookmarked';


/* Initial state for articles */
const articleListInitialState = {
  list: [],
  current: 0
}

export const initialState = {
  sources: {},
  articles: {},
  articleInteractions: {},
  articleLists: {
    recommendations: { ...articleListInitialState },
    bookmarks: { ...articleListInitialState },
  }
};


const articleInteractionsInitialState = {
  rating: 0,
  bookmarked: false
}


/* Action creators for articles */

const actions = {
  newArticles: createAction(NEW_ARTICLES,
    (listName, articles, articleInteractions, sources) => {
      return {
        payload: { listName, articles, articleInteractions, sources }
      };
    }
  ),

  setCurrentArticle: createAction(SET_CURRENT_ARTICLE,
    (listName, current) => ({
      payload: { listName, current }
    })
  ),

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
export const reducer = createReducer(initialState, {
  [actions.newArticles]: (state, action) => {
    // TODO: Right now this is stupid and just appends to the list; in practice
    // this will want to do something more complicated--it may want to either
    // append or prepend, or as discussed at
    // https://github.com/RenewalResearch/Renewal/issues/3 it may even want to
    // maintain a heap invariant
    const { listName, articles, articleInteractions, sources } = action.payload;
    let list = state.articleLists[listName];
    if (list === undefined) {
      list = state.articleLists[listName] = articleListInitialState;
    }

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
      list.list.push(article.url);
    });
  },

  [actions.setCurrentArticle]: (state, action) => {
    const { listName, current } = action.payload;
    state.articleLists[listName].current = current;
  },

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
    const bookmarks = state.articleLists.bookmarks.list;
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
