import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import renewalAPI from '../api';
// TODO: Originally this data include the user's saved articles and rejected
// articles in the same data structure; this excludes them for now because
// the dummy data is not user-specific.  We might later include this
// either via a separate API request, or part of the same request with some
// kind of graphql query; for debugging we can load these randomly or according
// to some pattern.


/* Action constants */
const SET_RATING = 'articles/set_rating';
const TOGGLE_BOOKMARKED = 'articles/toggle_bookmarked';
const ARTICLE_INTERACTION = 'articles/article_interaction';


/* Initial state for articles */
// Most details about articles come from the API, but we also
// set a default rating/bookmarked here
const articleInitialState = {
  rating: 0,
  bookmarked: false
}

const articleListInitialState = {
  list: [],
  current: 0
}

export const initialState = {
  articles: {},
  articleLists: {
    recommendations: { ...articleListInitialState },
    bookmarks: { ...articleListInitialState },
  }
};


/* Action creators for articles */
const actions = {
  setRating: createAsyncThunk(SET_RATING, async (arg, { rejectWithValue }) => {
    const { articleId, rating } = arg;
    return await articleInteraction(articleId, { rating }, rejectWithValue);
  }),

  toggleBookmarked: createAsyncThunk(TOGGLE_BOOKMARKED, async (arg, { getState, rejectWithValue }) => {
    const articleId = arg;
    const articles = getState().articles.articles;
    const article = articles[articleId];
    return await articleInteraction(articleId,
      { bookmarked: article.bookmarked }, rejectWithValue);
  }),

  // Generic article interaction (e.g. clicked / read, but not rating/bookmark)
  // which does not affect the app state, but which should still be sent as an
  // event to the backend.  We might later decide other article interactions
  // should still be stored in the state to prevent repeats of the same event,
  // but I'm not sure.
  articleInteraction: createAsyncThunk(ARTICLE_INTERACTION, async (arg, { rejectWithValue }) => {
    const { articleId, interaction } = arg;
    return await articleInteraction(articleId, interaction, rejectWithValue);
  })
};


async function articleInteraction(articleId, interaction, rejectWithValue) {
  console.log(`article interaction: ${JSON.stringify(interaction)}`);
  try {
    const response = await renewalAPI.articles.interact(articleId, interaction);
    return response;
  } catch (err) {
    let error = err.error;
    return rejectWithValue({ error });
  }
}


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
  const { listName, articles } = action.payload;
  let list = state.articleLists[listName];
  if (list === undefined) {
    list = state.articleLists[listName] = articleListInitialState;
  }

  const articlesSet = new Set(list.list);
  const newArticles = [];

  // Now update the appropriate articles array and update the articles
  // object for each article passed to the action
  articles.forEach((article) => {
    state.articles[article.article_id] = { ...articleInitialState };
    Object.assign(state.articles[article.article_id], article);
    if (!articlesSet.has(article.article_id)) {
      articlesSet.add(article.article_id);
      newArticles.push(article.article_id);
    }
  });

  if (old) {
    list.list = list.list.concat(newArticles);
  } else {
    list.list = newArticles.concat(list.list);
  }
}


// Common function for toggling an article's bookmarked state
// used in both toggleBookmarked.pending and toggleBookrmarked.rejected
// actions
function toggleBookmarked(articleId, state) {
  const article = state.articles[articleId];
  const bookmarks = state.articleLists.bookmarks.list;
  if (article.bookmarked) {
    // Remove bookmark
    bookmarks.splice(bookmarks.findIndex(i => ( i == articleId )), 1);
  } else {
    // Insert bookmark
    bookmarks.splice(0, 0, articleId);
  }
  article.bookmarked = !article.bookmarked;
}


/* Reducers for article actions */
// NOTE: Per the Redux Toolkit docs
// <https://redux-toolkit.js.org/api/createReducer>, createReducer uses
// immer <https://immerjs.github.io/immer/>, so although it appears we
// are mutating the state rather than returning a new one, this is just
// an illusion.
export const articles = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    newArticles: (state, action) => {
      updateArticles(state, action);
    },

    oldArticles: (state, action) => {
      updateArticles(state, action, true);
    },

    setCurrentArticle: (state, action) => {
      const { listName, current } = action.payload;
      state.articleLists[listName].current = current;
    }
  },
  extraReducers: {
    [actions.setRating.pending]: (state, action) => {
      const { articleId, rating } = action.meta.arg;
      const article = state.articles[articleId];
      // Store the previous rating so we can restore it in case the action fails
      article.prevRating = article.rating;
      article.rating = rating;
    },
    [actions.setRating.fulfilled]: (state, action) => {
      const { articleId, rating } = action.meta.arg;
      const article = state.articles[articleId];
      console.log(`successfully set rating ${rating} on article ${articleId}`);
      delete article.prevRating;
    },
    [actions.setRating.rejected]: (state, action) => {
      const { articleId, rating } = action.meta.arg;
      const article = state.articles[articleId];
      if (action.payload) {
        var error = JSON.stringify(action.payload.error);
      } else {
        var error = action.error.message;
      }
      console.log(`failed to set rating on article ${articleId}: ${error}`);
      article.rating = article.prevRating;
      delete article.prevRating;
    },

    [actions.toggleBookmarked.pending]: (state, action) => {
      const articleId = action.meta.arg;
      toggleBookmarked(articleId, state);
    },
    [actions.toggleBookmarked.fulfilled]: (state, action) => {
      const articleId = action.meta.arg;
      console.log(`successfully toggled bookmarked on article ${articleId}`);
    },
    [actions.toggleBookmarked.rejected]: (state, action) => {
      const articleId = action.meta.arg;
      if (action.payload) {
        var error = JSON.stringify(action.payload.error);
      } else {
        var error = action.error.message;
      }
      console.log(`failed to toggle bookmarked on article ${articleId}: ${error}`);

      // Set it back to its previous value
      toggleBookmarked(articleId, state);
    },
  }
});


Object.assign(actions, articles.actions);
export const reducer = articles.reducer;
export default actions;
