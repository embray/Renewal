import * as firebase from 'firebase/app';
import 'firebase/auth';

import Config from '../config';


// Prevent reinitialization of the app when hot-reloading
if (!firebase.apps.length) {
  firebase.initializeApp(Config.firebase);
}


export function signInAnonymously() {
  // Returns a Promise
  return firebase.auth().signInAnonymously();
}


export async function signOut() {
  // Returns a Promise
  return firebase.auth().signOut();
}
