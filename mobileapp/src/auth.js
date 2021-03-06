import Constants from 'expo-constants';
import * as GoogleAppAuth from 'expo-google-app-auth';
import * as GoogleSignIn from 'expo-google-sign-in';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import { Platform, YellowBox } from 'react-native';

import {
  initializeFirebase,
  objectSlice,
  objectNonNull,
  getNested
} from './utils';


// This is a warning which comes from react-native when using the
// firestore JS SDK and which currently doesn't have an obvious
// solution except to ignore it; the links provided here offer some
// potential workarounds but until it is clear that it is really a problem
// this warning will just be ignored for now
// https://stackoverflow.com/questions/56012521/does-react-native-firebase-package-handle-the-setting-a-timer-for-a-long-period
YellowBox.ignoreWarnings(['Setting a timer for a long period of time']);


const FIREBASE_ENABLED = initializeFirebase();


function userToObj(user) {
  const obj = {};
  const keys = [ 'uid', 'isAnonymous', 'displayName', 'photoURL', 'email' ];
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


// For a given e-mail address, return whether the user is linked
// using their e-mail + password
export function hasEmailPasswordAccount(email) {
  const providerId = firebase.auth.EmailAuthProvider.PROVIDER_ID;
  return firebase.auth().fetchSignInMethodsForEmail(email).then(
    (providers) => providers.indexOf(providerId) >= 0).catch((error) => false);
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
    case 'email':
      // For e-mail the passed in credential is email + password
      const { email, password } = credential;
      credential = firebase.auth.EmailAuthProvider.credential(email, password);
      signInPromise = firebase.auth().signInWithCredential(credential);
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


function deleteUser(user) {
  const db = firebase.firestore();
  // Delete the user from the authentication database, then delete
  // their data from the Renewal users database
  // TODO: as noted in linkAccount this should only be done after the
  // old user account has been merged into the linked account when
  // linking a second device for example
  console.log(`deleting ${user.isAnonymous ? 'anonymous ' : ''}user ${user.uid}`);
  return user.delete().then(db.collection('users').doc(user.uid).delete());
}


async function googleGetIdToken() {
  if (Constants.appOwnership === "standalone") {
    // Using native Google sign-in
    await GoogleSignIn.initAsync();
    try {
      await GoogleSignIn.askForPlayServicesAsync();
      let { type, user } = await GoogleSignIn.signInAsync();
      if (type === 'success') {
        return user.auth.idToken;
      }
    } catch ({ message }) {
      console.error(`login: Error: ${message}`);
    }
  } else {
    // Using (sometimes flakey) web redirect sign-in
    let clientId = getAuthConfig('google').clientId;
    let creds = await GoogleAppAuth.logInAsync({ clientId });
    return creds.idToken;
  }
}


export function linkAccount(provider, credential = null) {
  if (!FIREBASE_ENABLED) {
    return;
  }
  let credentialPromise = null;
  let existingAccount = false;
  console.log(`linking account with the ${provider} provider`);
  switch (provider) {
    case 'google':
      credentialPromise = googleGetIdToken().then((idToken) => {
        return firebase.auth.GoogleAuthProvider.credential(idToken);
      });
      break;
    case 'email':
      const { email, password } = credential;
      credential = firebase.auth.EmailAuthProvider.credential(email, password);
      credentialPromise = Promise.resolve(credential);
      break;
    default:
      console.log(`unsupported sign-in provider ${provider}`);
      return Promise.reject(new Error(`unsupported sign-in provider ${provider}`));
  }

  return credentialPromise.then((cred) => {
    const currentUser = firebase.auth().currentUser;
    return currentUser.linkWithCredential(cred).then((result) => result,
      (error) => {
        if (error.code == 'auth/credential-already-in-use') {
          // Try to log in with the provided existing credential
          // TODO: Before we do this, we should probably try to merge
          // accounts, and following a successful merge delete the old
          // anonymous account; see
          // https://github.com/RenewalResearch/Renewal/issues/6
          console.log(
            'credential already in use; trying to sign in to exising ' +
            'account');
          existingAccount = true;
          // Delete the old anonymous account, then sign in with the
          // new credentials; this is a little dangerous because if the
          // new sign-in fails the old account will still be lost forever
          // so this really should only happen only after the accounts
          // have been successfully merged
          return deleteUser(currentUser).then(() => {
            console.log('deleted old user successfully, now signing in ' +
                        'with new credentials');
            return firebase.auth().signInWithCredential(error.credential)
          });
        } else if (error.code == 'auth/email-already-in-use') {
          return Promise.reject(new Error(
            'this e-mail address is already in used; perhaps you already ' +
            'linked your account using a different authentication provider ' +
            'that uses this e-mail address'));
        } else {
          return Promise.reject(new Error(error));
        }
      });
  }, (error) => Promise.reject(new Error(error.message))).then(
    (cred) => {
      return { user: userToObj(cred.user), provider }
    },
    (error) => Promise.reject(new Error(error.message))
  ).then(
    ({ user, provider }) => {
      // Save the user in the firestore DB
      if (!existingAccount) {
        const db = firebase.firestore();
        return db.collection('users').doc(user.uid).set(user).then(
          ({ user, provider }),
          (error) => Promise.reject(new Error(error.message))
        );
      } else {
        return { user, provider };
      }
    },
    (error) => Promise.reject(new Error(error.message))
  );
}


// Save changes to the user's account
export function saveAccount(accountUpdates) {
  if (!FIREBASE_ENABLED) {
    return;
  }
  const currentUser = firebase.auth().currentUser;
  const db = firebase.firestore();
  if (currentUser == null) {
    console.log('no authenticated user to update');
    return;
  }

  console.log(`saving account updates: ${JSON.stringify(accountUpdates)}`);

  const promises = [];
  Object.entries(accountUpdates).forEach((item) => {
    const [ key, value ] = item;

    switch (key) {
      // NOTE: This is a switch statement because previously there
      // were other special cases, but now there is only one special
      // case for now.
      case 'displayName':
        promises.push(currentUser.updateProfile({ displayName: value }));
        break;
    }
  });

  promises.push(db.collection('users').doc(currentUser.uid).set(
    accountUpdates, { merge: true }
  ));

  // Annoyingly, it requires several function calls to update
  // a user's properties in firebase.  I haven't checked whether
  // this is all synced in a single request, or if it makes multiple
  // request for each of these.
  return Promise.all(promises);
}


export async function getIdToken() {
  const currentUser = firebase.auth().currentUser;
  return currentUser.getIdToken();
}
