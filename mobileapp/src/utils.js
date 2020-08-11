/* Miscellaneous utilities */
import * as FirebaseCore from 'expo-firebase-core';
import * as firebase from 'firebase/app';


// Ensures firebase has been initialized, and returns whether or
// not firebase could be initialized successfully
export function initializeFirebase() {
  // Prevent reinitialization of the app when hot-reloading
  if (!firebase.apps.length) {
    // Read from app.config.js:
    // https://docs.expo.io/versions/latest/sdk/firebase-core/#constants
    if (FirebaseCore.DEFAULT_WEB_APP_OPTIONS === undefined) {
      let extra = Constants.manifest.extra;
      if (extra.environment == "dev") {
        console.warn(
          `web.config.firebase not configured in ${extra.environmentConfig}; ` +
          `features depending on firebase (authentication, user database) ` +
          `will be disabled`);
        return false;
      } else {
        console.error(
          `web.config.firebase must be defined in ${extra.environmentConfig} ` +
          `when in ${extra.environment} mode`);
        return false;
      }
    } else {
      firebase.initializeApp(FirebaseCore.DEFAULT_WEB_APP_OPTIONS);
      return true;
    }
  }

  return (firebase.apps.length > 0);
}


export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
        if (article.site && article.site.icon) {
          article.site.icon = '...';
        }
      }
    }
  }
  return state;
}


export function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}


// Return a deeply nested property from a nested object
// If any of the levels are undefined returns undefined
export function getNested(obj, ...props) {
  return props.reduce((obj, prop) => (obj !== undefined && obj[prop]), obj);
}


export function objectPrefix(obj, prefix) {
  // Return a copy of object with all keys prefixed with prefix
  return Object.entries(obj).reduce(
    (obj, e) => (obj[prefix + e[0]] = e[1], obj), {});
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


// Returns a copy of an object with all null/undefined values filtered out
export function objectNonNull(obj) {
  let newObj = {};
  for (let e of Object.entries(obj)) {
    if (e[1] !== null && e[1] !== undefined) {
      newObj[e[0]] = e[1];
    }
  }
  return newObj;
}


// Convert a Map to a plain Object
export function mapToObject(map) {
  return [...map.entries()].reduce(
    (obj, [key, value]) => (obj[key] = value, obj),
    {}
  );
}
