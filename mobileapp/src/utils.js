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
