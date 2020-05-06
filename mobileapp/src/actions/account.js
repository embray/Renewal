import { createAction, createReducer } from '@reduxjs/toolkit';

import { signInAnonymously, signOut, saveAccount } from '../auth';
import { objectSlice, objectNonNull } from '../utils';


/* Action constants */
const SIGN_IN_BEGIN = 'account/sign_in/begin';
const SIGN_IN_SUCCEEDED = 'account/sign_in/succeeded';
const SIGN_IN_FAILED = 'account/sign_in/failed';

const SIGN_OUT_BEGIN = 'account/sign_out/begin';
const SIGN_OUT_SUCCEEDED = 'account/sign_out/succeeded';
const SIGN_OUT_FAILED = 'account/sign_out/failed';

const SAVE_BEGIN = 'account/save/begin';
const SAVE_SUCCEEDED = 'account/save/succeeded';
const SAVE_FAILED = 'account/save/failed';

// NOTE: This action only updates the in-memory account state;
// use SAVE_* to save the account details to firebase (or whatever
// the backend is)
const UPDATE = 'account/update';


/* Initial state for account */
// TODO: Include some state related to which additional auth providers the
// user's account is linked to (e.g. good to have when displaying the
// account details page so they can link/unlink accounts).  Will figure this
// out once I get account linking working.
export const initialState = {
  // These attributes come from the firebase user account
  uid: null,
  isAnonymous: true,
  displayName: "",
  photoURL: null,
  email: null,
  phoneNumber: null,

  // These additional attributes are stored in the database (as are copies
  // of most of the above attributes)
  gender: null,
  birthdate: null,
  location: null,  // Might have a special flag to always use current location

  // Additional application state
  isAuthenticating: false,  // Set to true if signing in/out
  isSaving: false  // Set to true if saving account changes
};


/* Action creators for account */
// TODO: Creating asynchronous actions is currently very verbose; it would
// be easy to write a helper function to simplify this.
const actions = {
  /* Sign-in actions */
  signIn: () => {
    /* returns a thunk */
    return (dispatch) => {
      dispatch(actions.signInBegin());
      // Don't use catch; there is a warning in the redux-thunk docs
      // about this; instead pass an error callback to then()
      return signInAnonymously().then(
        (cred) => dispatch(actions.signInSucceeded(cred.user)),
        (error) => dispatch(actions.signInFailed(error))
      );
    }
  },
  signInBegin: createAction(SIGN_IN_BEGIN),
  signInSucceeded: createAction(SIGN_IN_SUCCEEDED),
  signInFailed: createAction(SIGN_IN_FAILED),

  /* Sign-out actions */
  signOut: () => {
    return (dispatch) => {
      dispatch(actions.signOutBegin);
      return signOut().then(
        () => dispatch.actions(signOutSucceeded()),
        (error) => dispatch.actions(signOutFailed(error))
      );
    }
  },
  signOutBegin: createAction(SIGN_OUT_BEGIN),
  signOutSucceeded: createAction(SIGN_OUT_SUCCEEDED),
  signOutFailed: createAction(SIGN_OUT_FAILED),

  /* Save actions */
  save: (changes) => {
    return (dispatch) => {
      // Argument to saveBegin currently not used, but recorded for logging
      dispatch(actions.saveBegin(changes));
      return saveAccount(changes).then(
        (responses) => dispatch(actions.saveSucceeded(responses)),
        (error) => dispatch(actions.saveFailed(error))
      );
    };
  },
  saveBegin: createAction(SAVE_BEGIN),
  saveSucceeded: createAction(SAVE_SUCCEEDED),
  saveFailed: createAction(SAVE_FAILED),

  /* Other actions */
  update: createAction(UPDATE)
}


/* Reducers for article account */
export const reducer = createReducer(initialState, {
  /* Sign-in actions */
  [actions.signInBegin]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.signInSucceeded]: (state, action) => {
    const user = action.payload;
    // For displayName and photoURL I'm not sure if those are
    // automatically updated to some default the first time the
    // account is linked, or if I specifically have to dig into
    // user.providerData; we'll see...
    // TODO: Is there any valid reason we should want to ask for the user's
    // phone number??
    console.log(`user signed in successfully: ${JSON.stringify(user)}`);
    Object.assign(state, objectNonNull(objectSlice(user,
      'uid', 'isAnonymous', 'displayName', 'photoURL', 'email',
      'phoneNumber')));
    state.isAuthenticating = false;
  },
  [actions.signInFailed]: (state, action) => {
    console.error(`sign-in failed: ${action.payload}`);
    state.isAuthenticating = false;
  },

  /* Sign-out actions */
  [actions.signOutBegin]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.signOutSucceeded]: (state, action) => {
    return { ...initialState };
  },
  [actions.signOutFailed]: (state, action) => {
    console.error(`sign-out failed: ${action.payload}`);
    state.isAuthenticating = false;
  },

  /* Save actions */
  [actions.saveBegin]: (state, action) => {
    state.isSaving = true;
  },
  [actions.saveSucceeded]: (state, action) => {
    // TODO: Maybe flash a Toast when saving suceeded/failed; need to figure
    // out how to do that.
    console.log('saving account changes succeeded');
    state.isSaving = false;
  },
  [actions.saveFailed]: (state, action) => {
    console.log(`saving account changes failed: ${action.payload}`);
    state.isSaving = false;
    // TODO: Maybe revert the changes to the in-memory state as well?
  },

  /* Other actions */
  [actions.update]: (state, action) => {
    Object.assign(state, action.payload);
  }
});


export default actions;
