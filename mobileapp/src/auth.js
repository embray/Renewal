import * as firebase from 'firebase/app';
import 'firebase/auth';

import Config from '../config';
import accountActions from './actions/account';
import { store } from './storage';


// Prevent reinitialization of the app when hot-reloading
if (!firebase.apps.length) {
  firebase.initializeApp(Config.firebase);
}


firebase.auth().onAuthStateChanged((user) => {
  if (user != null) {
    console.log(`authenticated as: ${JSON.stringify(user)}`);
    store.dispatch(accountActions.signIn(user));
  } else {
    // User signed out
    store.dispatch(accountActions.signOut());
  }
});


export async function signInAnonymously() {
  try {
    await firebase.auth().signInAnonymously();
  } catch (error) {
    // TODO: Better error handling later--this this is called early in the
    // app startup we should do something like allow the user to retry
    // connecting (e.g. this could fail if they don't have an internet connection
    console.error(`failure to sign in [${error.code}]: ${error.message}`);
  }
}


export async function signOut() {
  try {
    await firebase.auth().signOut();
  } catch (error) {
    console.error(`failure to sign out [${error.code}]: ${error.message}`);
  }
}
