import { Toast } from 'native-base';
import {
  createAsyncThunk,
  createSlice
} from '@reduxjs/toolkit';

import * as auth from '../auth';


/* Action constants */
const CHECK_AUTH = 'account/check_auth';
const SIGN_IN = 'account/sign_in';
const SIGN_OUT = 'account/sign_out';
const LINK = 'account/link';
const SAVE = 'account/save';


/* Initial state for account */
export const initialState = {
  // These attributes come from the firebase user account
  uid: null,
  isAnonymous: true,
  displayName: "",
  photoURL: null,
  email: null,

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
  },

  toastQueue: []
};


// TODO: Perhaps this should be part of the state, but it should
// not be persisted.
let checkAuthRegistered = false;


/* Action creators for account */
// These are just the async actions; other actions are declared
// in createSlice
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
        if (!checkAuthRegistered) {
          // This is the initial call to firebase.auth().onAuthStateChanged
          // If it returns null then the user is not signed in, so sign
          // in anonymously; otherwise we are processing a sign-out
          thunkAPI.dispatch(actions.signIn({ provider: 'anonymous' }));
        } else {
          thunkAPI.dispatch(actions.signOut.fulfilled())
        }
      }
      checkAuthRegistered = true;
    });
  }),
  signIn: createAsyncThunk(SIGN_IN, auth.signIn),
  signOut: createAsyncThunk(SIGN_OUT, auth.signOut),
  linkAccount: createAsyncThunk(LINK, (arg) => (
    auth.linkAccount(arg.provider, arg.credential)
  )),
  save: createAsyncThunk(SAVE, auth.saveAccount)
}


/* Reducers for article account */
const account = createSlice({
  name: 'account',
  initialState,
  reducers: {
    update: (state, action) => {
      Object.assign(state, action.payload);
    },
    // This is a hack to display toasts related to authentication once the main
    // root component has been mounted, as it's possible for authentication to
    // complete before that happens.
    popToasts: (state, action) => {
      while (state.toastQueue.length) {
        let toast = state.toastQueue.shift();
        Toast.show(toast);
      }
    }
  },
  extraReducers: {
    /* Sign-in actions */
    [actions.signIn.pending]: (state, action) => {
      state.isAuthenticating = true;
    },
    [actions.signIn.fulfilled]: (state, action) => {
      const user = action.payload;
      let provider = null;
      if (action.meta.arg !== undefined) {
        provider = action.meta.arg.provider;
      }
      // TODO: Is there any valid reason we should want to ask for the user's
      // phone number??
      console.log(`user signed in successfully: ${JSON.stringify(user)}`);
      // Only display this if the user wasn't already previously signed in with
      // a cached sign-in
      if (state.uid == null) {
        state.toastQueue.push({
          text: 'Signed in successfully!', type: 'success'
        });
      }
      if (provider) {
        // Normally this should only need to be done when first linking
        // an account, but sometimes (due to a bug, e.g.) where the account
        // is successfully linked, but the state doesn't get updated properly
        // so we can do that here as well.  This normally shouldn't happen in
        // production at all, but it's happened a few times during development.
        state.authProviders[provider] = true;
      }

      Object.assign(state, user);
      state.isAuthenticating = false;
    },
    [actions.signIn.rejected]: (state, action) => {
      if (__DEV__) {
        console.error(`sign-in failed: ${JSON.stringify(action.error)}`);
      } else {
        state.toastQueue.push({
          text: `Signed in failed: ${action.error.message}`,
          type: 'danger'
        });
      }
    },

    /* Sign-out actions */
    [actions.signOut.pending]: (state, action) => {
      state.isAuthenticating = true;
    },
    [actions.signOut.fulfilled]: (state, action) => {
      state.isAuthenticating = false;
      // Re-initialize the user to its initial state
      Object.assign(state, initialState);
    },
    [actions.signOut.rejected]: (state, action) => {
      console.error(`sign-out failed: ${JSON.stringify(action.error)}`);
    },

    /* Link actions */
    // NOTE: Fairly similar to signIn actions and likely to be used more
    // commonly the main difference is it checks whether or not the account was
    // already anonymous--if so it updates the user profile from the newly
    // linked account otherwise if the account was already linked to a
    // different provider we keep the profile details from the first provider.
    [actions.linkAccount.pending]: (state, action) => {
      state.isAuthenticating = true;
    },
    [actions.linkAccount.fulfilled]: (state, action) => {
      const { user, provider } = action.payload;
      console.log(
        `user successfully linked to ${provider}: ${JSON.stringify(user)}`);
      if (state.isAnonymous) {
        Object.assign(state, user);
      }
      state.authProviders[provider] = true;
      state.isAuthenticating = false;
      Toast.show({ text: 'Account successfully linked!', type: 'success' });
    },
    [actions.linkAccount.rejected]: (state, action) => {
      if (__DEV__) {
        console.error(
          `link account failed: ${JSON.stringify(action.error.message)}`
        );
      } else {
        Text.show({
          text: `Failed to link account: ${action.error.message}`,
          type: 'danger'
        });
      }
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
  }
});

Object.assign(actions, account.actions);
export const reducer = account.reducer;
export default actions;
