import * as Google from 'expo-google-app-auth';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Platform } from 'react-native';

import Config from '../config';
import { objectSlice, objectNonNull } from './utils';


// Prevent reinitialization of the app when hot-reloading
if (!firebase.apps.length) {
  firebase.initializeApp(Config.firebase);
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


// TODO: Clean up handling of different auth providers; each one needs
// to implement slightly different workflows for providing credentials, etc.
export function getAvailableProviders() {
  const providers = ['anonymous', 'email'];
  if (Config.auth.google[Platform.OS].clientId) {
    providers.push('google');
  }
  return providers;
}


export function checkAuth(callback) {
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


export function signIn(provider = 'anonymous') {
  let signInPromise = null;
  console.log(`signing in with ${provider} provider`);
  switch (provider) {
    case 'anonymous':
      signInPromise = firebase.auth().signInAnonymously();
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
  // Returns a Promise
  return firebase.auth().signOut();
}


export async function linkAccount(provider) {
  let linkPromise = null;
  console.log(`linking account with the ${provider} provider`);
  switch (provider) {
    case 'google':
      linkPromise = Google.logInAsync({
        clientId: Config.auth.google[Platform.OS].clientId
      }).then((result) => {
          const { idToken } = result;
          const cred = firebase.auth.GoogleAuthProvider.credential(idToken);
          return firebase.auth().currentUser.linkWithCredential(cred);
        });
      break;
    default:
      console.error(`unsupported sign-in provider ${provider}`);
  }

  return linkPromise.then(
    (cred) => ({ user: userToObj(cred.user), provider }),
    (error) => Promise.reject(new Error(error.code))
  );
}


// Save changes to the user's account
export function saveAccount(accountUpdates) {
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
