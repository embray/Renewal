/* Miscellaneous utilities */
// Simplifies the global redux state in order to cut down on some noise
// in redux-logger.  AFAIK this should *not* mutate the original state.
// (update: in fact it can't because it gets wrapped in immutable objects).
export function loggerStateTransformer(state) {
  // Convert to a mutable copy we can edit.
  state = JSON.parse(JSON.stringify(state));
  let articles = state.articles;
  if (articles) {
    if (articles.articles) {
      for (let article of Object.values(articles.articles)) {
        article['summary'] = '...';
      }
    }
    if (articles.sources) {
      for (let source of Object.values(articles.sources)) {
        source['icon'] = '...';
      }
    }
  }
  return state;
}


export function objectSlice(obj, ...keys) {
  return keys.reduce((out, key) => {
    let val = obj[key];
    if (val !== undefined) {
      out[key] = val;
    }
    return out
  }, {});
}


// Returns a copy of an object with all null/undefined values filter out
export function objectNonNull(obj) {
  let newObj = {};
  for (let e of Object.entries(obj)) {
    if (e[1] !== null && e[1] !== undefined) {
      newObj[e[0]] = e[1];
    }
  }
  return newObj;
}
