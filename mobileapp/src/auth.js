import Constants from 'expo-constants';
import * as FirebaseCore from 'expo-firebase-core';
import * as Google from 'expo-google-app-auth';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Platform } from 'react-native';

import { objectSlice, objectNonNull, getNested } from './utils';


let FIREBASE_ENABLED = (firebase.app.length > 0);
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
    } else {
      console.error(
        `web.config.firebase must be defined in ${extra.environmentConfig} ` +
        `when in ${extra.environment} mode`);
    }
  } else {
    firebase.initializeApp(FirebaseCore.DEFAULT_WEB_APP_OPTIONS);
    FIREBASE_ENABLED = true;
  }
}


function userToObj(user) {
  const obj = {};
  const keys = [ 'uid', 'isAnonymous', 'displayName', 'photoURL', 'email',
                 'phoneNumber' ];
  for (let providerData of user.providerData.reverse()) {
    Object.assign(obj, objectNonNull(objectSlice(providerData, ...keys)));
  }

  Object.assign(obj, objectNonNull(objectSlice(user, ...keys)));
  return obj;
}


function getAuthConfig(provider) {
  // Additional provider-specific authentication options
  // After much suffering I am reminded that the clientId used by the
  // web-based non-native Google authentication module is *NOT* the
  // same as the one included in google-services.json.  The native
  // auth module (which we have not enabled yet) is the only one that
  // uses google-services.json, and it has a different clientId.
  // Unfortunately app.json does not have a fixed placed to put this
  // web client ID so we include it in extra.auth.
  const extra = Constants.manifest.extra;
  return getNested(extra, 'auth', provider, Platform.OS);
}


// TODO: Clean up handling of different auth providers; each one needs
// to implement slightly different workflows for providing credentials, etc.
export function getAvailableProviders() {
  if (!FIREBASE_ENABLED) {
    return ['anonymous'];
  }

  const providers = ['anonymous', 'email'];
  const googleAuthConfig = getAuthConfig('google');

  if (!(googleAuthConfig && googleAuthConfig.clientId)) {
    let extra = Constants.manifest.extra;
    if (extra.environment == "dev") {
      console.warn(
        `extra.auth.google.${Platform.OS}.clientId not configured in ` +
        `${extra.environmentConfig}; Google authentication services ` +
        `will be disabled`);
    } else {
      // TODO: Perhaps we could add a section in the manifest extras
      // to specify which authentication providers are enabled, in which
      // case this will not be an error if google auth is not enabled
      // for some build...
      // But for now we require it...
      console.error(
        `extra.auth.google.${PlatformOS}.clientId must be defined in `
        `${extra.environmentConfig} or else Google authentication services ` +
        `will not be available`);
    }
  } else {
    providers.push('google');
  }
  return providers;
}


export function checkAuth(callback) {
  if (!FIREBASE_ENABLED) {
    callback({});
  }
  // Register an onAuthStateChanged handler to check the
  // user's current logged-in status.
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      callback(userToObj(user));
    } else {
      callback(null);
    }
  });
}


export function signIn({provider = 'anonymous', credential = null}) {
  if (!FIREBASE_ENABLED) {
    return;
  }
  let signInPromise = null;
  console.log(`signing in with ${provider} provider`);
  switch (provider) {
    case 'anonymous':
      signInPromise = firebase.auth().signInAnonymously();
      break;
    case 'google':
      signInPromise = firebase.auth().signInWithCredential(credential);
      break;
    default:
      console.error(`unsupported sign-in provider ${provider}`);
      return;
  }
  // Returns a Promise
  return signInPromise.then(
    // Extract any new user properties from the sign-in
    (cred) => userToObj(cred.user),
    (error) => error
  );
}


export async function signOut() {
  if (!FIREBASE_ENABLED) {
    return;
  }
  // Returns a Promise
  return firebase.auth().signOut();
}


export async function linkAccount(provider) {
  if (!FIREBASE_ENABLED) {
    return;
  }
  let linkPromise = null;
  console.log(`linking account with the ${provider} provider`);
  switch (provider) {
    case 'google':
      const clientId = getAuthConfig('google').clientId;
      linkPromise = Google.logInAsync({ clientId }).then((result) => {
        const { idToken } = result;
        const cred = firebase.auth.GoogleAuthProvider.credential(idToken);
        const currentUser = firebase.auth().currentUser;
        return currentUser.linkWithCredential(cred).then((result) => result,
          (error) => {
            if (error.code == 'auth/credential-already-in-use') {
              // Try to log in with the provided existing credential
              // TODO: Before we do this, we should probably try to merge
              // accounts, and following a successful merge delete the old
              // anonymous account; see
              // https://github.com/RenewalResearch/Renewal/issues/6
              // TODO: Until merging is working, at the very least delete
              // the old account to prevent clutter of anonymous accounts
              console.log(
                'credential already in use; trying to sign in to exising ' +
                'account');
              return firebase.auth().signInWithCredential(error.credential);
            } else {
              return Promise.reject(new Error(error));
            }
          });
        });
      break;
    default:
      console.error(`unsupported sign-in provider ${provider}`);
  }

  return linkPromise.then(
    (cred) => ({ user: userToObj(cred.user), provider }),
    (error) => Promise.reject(new Error(error.message))
  );
}


// Save changes to the user's account
export function saveAccount(accountUpdates) {
  if (!FIREBASE_ENABLED) {
    return;
  }
  const currentUser = firebase.auth().currentUser;
  if (currentUser == null) {
    console.log('no authenticated user to update');
    return;
  }

  console.log(`saving account updates: ${JSON.stringify(accountUpdates)}`);

  // TODO: Updating name/e-mail/phone number through firebase authentication
  // is a little trickier than I thought since it can actually impact the
  // underlying auth providers; perhaps we should only save some of these
  // in the firestore database entry for the user instead, and be more careful
  // about how we handle things like e-mail updates

  const promises = [];
  Object.entries(accountUpdates).forEach((item) => {
    const [ key, value ] = item;

    switch (key) {
      case 'displayName':
        promises.push(currentUser.updateProfile({ displayName: value }));
        break;
      case 'email':
        // TODO: Per the docs, this may fail in several cases we also need
        // to handle; changing their e-mail is not just a matter of setting
        // a value, for security reasons; see
        // https://firebase.google.com/docs/reference/js/firebase.User#updateprofile
        promises.push(currentUser.updateEmail(value));
        break;
      case 'phoneNumber':
        // TODO: Apparently this will only make sense if the user is using
        // phone-base auth; firebase doesn't store their phone number for any
        // other reason--this re-raises my earlier question of whether we want
        // to ask the user for their phone number in the first place...
        console.log('TODO: phoneNumber not saved currently');
        break;
      default:
        console.log(`TODO: account.${key} needs to be stored in firebase`);
    }
  });

  // Annoyingly, it requires several function calls to update
  // a user's properties in firebase.  I haven't checked whether
  // this is all synced in a single request, or if it makes multiple
  // request for each of these.
  return Promise.all(promises);
}
