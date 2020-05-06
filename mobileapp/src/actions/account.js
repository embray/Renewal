import {
  createAction,
  createAsyncThunk,
  createReducer
} from '@reduxjs/toolkit';

import { signInAnonymously, signOut, saveAccount } from '../auth';

// TODO: Consider using createSlice from redux-toolkit
// now that I understand how it works (I didn't previously) I can see that
// it reduces the amount of boilerplate even more--this can be used in
// account actions as well.

/* Action constants */
const SIGN_IN = 'account/sign_in';
const SIGN_OUT = 'account/sign_out';
const SAVE = 'account/save';
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
const actions = {
  signIn: createAsyncThunk(SIGN_IN, signInAnonymously),
  signOut: createAsyncThunk(SIGN_OUT, signOut),
  save: createAsyncThunk(SAVE, saveAccount),
  update: createAction(UPDATE)
}


/* Reducers for article account */
export const reducer = createReducer(initialState, {
  /* Sign-in actions */
  [actions.signIn.pending]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.signIn.fulfilled]: (state, action) => {
    const user = action.payload;
    // For displayName and photoURL I'm not sure if those are
    // automatically updated to some default the first time the
    // account is linked, or if I specifically have to dig into
    // user.providerData; we'll see...
    // TODO: Is there any valid reason we should want to ask for the user's
    // phone number??
    console.log(`user signed in successfully: ${JSON.stringify(user)}`);
    Object.assign(state, user);
    state.isAuthenticating = false;
  },
  [actions.signIn.rejected]: (state, action) => {
    console.error(`sign-in failed: ${action.payload}`);
    state.isAuthenticating = false;
  },

  /* Sign-out actions */
  [actions.signOut.pending]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.signOut.fulfilled]: (state, action) => {
    return { ...initialState };
  },
  [actions.signOut.rejected]: (state, action) => {
    console.error(`sign-out failed: ${action.payload}`);
    state.isAuthenticating = false;
  },

  /* Save actions */
  [actions.save.pending]: (state, action) => {
    state.isSaving = true;
  },
  [actions.save.fulfilled]: (state, action) => {
    // TODO: Maybe flash a Toast when saving suceeded/failed; need to figure
    // out how to do that.
    console.log('saving account changes succeeded');
    state.isSaving = false;
  },
  [actions.save.rejected]: (state, action) => {
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
