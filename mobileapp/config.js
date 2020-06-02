import {
  DEBUG,
  API_RENEWAL_URI,
  FIREBASE_CONFIG,
  AUTH_GOOGLE_ANDROID_CLIENT_ID,
  CONTACT_EMAIL
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


// TODO: After skimming the docs at https://docs.expo.io/workflow/configuration/
// it looks like we should do away with this custom .env-based config scheme
// and move towards using Expo's app.json config format.  This can be made dynamic
// using an app.config.js, allowing us to provide different settings for different
// environments.

const Config = {
  debug: DEBUG == "1",
  contact_email: CONTACT_EMAIL || 'hay.julien1@gmail.com',
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
