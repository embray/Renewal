import {
  createAction,
  createAsyncThunk,
  createReducer
} from '@reduxjs/toolkit';

import * as auth from '../auth';

// TODO: Consider using createSlice from redux-toolkit
// now that I understand how it works (I didn't previously) I can see that
// it reduces the amount of boilerplate even more--this can be used in
// account actions as well.

/* Action constants */
const CHECK_AUTH = 'account/check_auth';
const SIGN_IN = 'account/sign_in';
const SIGN_OUT = 'account/sign_out';
const LINK = 'account/link';
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
  isSaving: false,  // Set to true if saving account changes

  authProviders: {
    email: false,
    google: false,
    facebook: false,
    twitter: false
  }
};


let checkAuthRegistered = false;


/* Action creators for account */
const actions = {
  checkAuth: createAsyncThunk(CHECK_AUTH, (arg, thunkAPI) => {
    if (checkAuthRegistered) {
      return;
    } else {
      // Initial call to this action; this action should only be
      // called once to register the auth state handler.
      thunkAPI.dispatch(actions.signIn.pending());
    }

    auth.checkAuth((user) => {
      const { isAuthenticating } = thunkAPI.getState().account;
      if (user) {
        thunkAPI.dispatch(actions.signIn.fulfilled(user));
      } else {
        // If we are not already in the process of a manually
        // initiated signIn/Out procedure.
        thunkAPI.dispatch(actions.signIn('anonymous'))
      }
    });
  }),
  signIn: createAsyncThunk(SIGN_IN, auth.signIn),
  signOut: createAsyncThunk(SIGN_OUT, auth.signOut),
  linkAccount: createAsyncThunk(LINK, auth.linkAccount),
  save: createAsyncThunk(SAVE, auth.saveAccount),
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
    console.error(`sign-in failed: ${JSON.stringify(action.error)}`);
  },

  /* Sign-out actions */
  [actions.signOut.pending]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.signOut.fulfilled]: (state, action) => {
    state.isAuthenticating = false;
    return { ...initialState };
  },
  [actions.signOut.rejected]: (state, action) => {
    console.error(`sign-out failed: ${JSON.stringify(action.error)}`);
  },

  /* Link actions */
  // NOTE: Fairly similar to signIn actions and likely to be used more commonly
  // the main difference is it checks whether or not the account was already
  // anonymous--if so it updates the user profile from the newly linked account
  // otherwise if the account was already linked to a different provider we
  // keep the profile details from the first provider.
  [actions.linkAccount.pending]: (state, action) => {
    state.isAuthenticating = true;
  },
  [actions.linkAccount.fulfilled]: (state, action) => {
    const { user, provider } = action.payload;
    // For displayName and photoURL I'm not sure if those are
    // automatically updated to some default the first time the
    // account is linked, or if I specifically have to dig into
    // user.providerData; we'll see...
    // TODO: Is there any valid reason we should want to ask for the user's
    // phone number??
    console.log(
      `user successfully linked to ${provider}: ${JSON.stringify(user)}`);
    if (state.isAnonymous) {
      Object.assign(state, user);
    }
    state.authProviders[provider] = true;
    state.isAuthenticating = false;
  },
  [actions.linkAccount.rejected]: (state, action) => {
    console.error(
      `link account failed: ${JSON.stringify(action.error.message)}`
    );
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
