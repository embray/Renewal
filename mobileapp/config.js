import {
  DEBUG,
  API_RENEWAL_URI,
  FIREBASE_CONFIG,
  AUTH_GOOGLE_ANDROID_CLIENT_ID
} from 'dotenv';


const firebase = {};

// NOTE: I wanted to make FIREBASE_CONFIG a file path instead, but then the
// trick would be figuring out a way to make the bundler actually load a
// file given its name from a variable.  I believe a custom resolver for
// the bundler could export a utility to do this but the documentation on
// how to do this is so poor it's not worth the effort to figure out right now
if (FIREBASE_CONFIG) {
  // This variable should be a JSON blob
  Object.assign(firebase, JSON.parse(FIREBASE_CONFIG))
}


const Config = {
  debug: DEBUG == "1",
  api: {
    uri: API_RENEWAL_URI
  },
  firebase,
  auth: {
    google: {
      android: {
        clientId: AUTH_GOOGLE_ANDROID_CLIENT_ID
      }
    }
  }
};

export default Config;
