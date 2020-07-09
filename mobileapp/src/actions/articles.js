import { createAction, createReducer } from '@reduxjs/toolkit';

// TODO: Originally this data include the user's saved articles and rejected
// articles in the same data structure; this excludes them for now because
// the dummy data is not user-specific.  We might later include this
// either via a separate API request, or part of the same request with some
// kind of graphql query; for debugging we can load these randomly or according
// to some pattern.


/* Action constants */
const NEW_ARTICLES = 'articles/new_articles';
const OLD_ARTICLES = 'articles/old_articles';
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
    (listName, articles, sources) => {
      return {
        payload: { listName, articles, sources }
      };
    }
  ),

  oldArticles: createAction(OLD_ARTICLES,
    // Same as newArticles, but in the reducer we append to the end of the
    // list rather than to the beginning
    (listName, articles, sources) => {
      return {
        payload: { listName, articles, sources }
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


// Reducer for NEW_ARTICLES and OLD_ARTICLES; the only difference
// is how the state is updated (articles prepended or appended to the
// list)
function updateArticles(state, action, old = false) {
  // TODO: Right now this is stupid and just appends to the list; in practice
  // this will want to do something more complicated--it may want to either
  // append or prepend, or as discussed at
  // https://github.com/RenewalResearch/Renewal/issues/3 it may even want to
  // maintain a heap invariant
  // TODO: We may want to impose a limit (perhaps a user-configurable setting?)
  // of how many older articles to keep cached
  const { listName, articles, sources } = action.payload;
  let list = state.articleLists[listName];
  if (list === undefined) {
    list = state.articleLists[listName] = articleListInitialState;
  }

  // Update articleInteractions, and sources
  Object.assign(state.sources, sources);

  const articlesSet = new Set(list.list);
  const newArticles = [];

  // Now update the appropriate articles array and update the articles
  // object for each article passed to the action
  articles.forEach((article) => {
    state.articles[article.article_id] = article;
    if (state.articleInteractions[article.article_id] === undefined) {
      state.articleInteractions[article.article_id] = articleInteractionsInitialState;
    }
    if (!articlesSet.has(article.article_id)) {
      newArticles.push(article.article_id);
    }
  });

  if (old) {
    list.list = list.list.concat(newArticles);
  } else {
    list.list = newArticles.concat(list.list);
  }
}


/* Reducers for article actions */
// NOTE: Per the Redux Toolkit docs
// <https://redux-toolkit.js.org/api/createReducer>, createReducer uses
// immer <https://immerjs.github.io/immer/>, so although it appears we
// are mutating the state rather than returning a new one, this is just
// an illusion.
export const reducer = createReducer(initialState, {
  [actions.newArticles]: (state, action) => {
    updateArticles(state, action);
  },

  [actions.oldArticles]: (state, action) => {
    updateArticles(state, action, true);
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
      bookmarks.splice(bookmarks.findIndex(i => ( i == articleId )), 1);
    } else {
      // Insert bookmark
      bookmarks.splice(0, 0, articleId);
    }
    articleInteractions.bookmarked = !articleInteractions.bookmarked;
  }
});


export default actions;
