import { createAction, createReducer } from '@reduxjs/toolkit';

import { objectSlice } from '../utils';


/* Action constants */
const SIGN_IN = 'account/sign_in';
const SIGN_OUT = 'account/sign_out';
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
  location: null  // Might have a special flag to always use current location
};


/* Action creators for account */
const actions = {
  signIn: createAction(SIGN_IN),
  signOut: createAction(SIGN_OUT),
  update: createAction(UPDATE)
}


/* Reducers for article account */
export const reducer = createReducer(initialState, {
  [actions.signIn]: (state, action) => {
    const user = action.payload;
    // For displayName and photoURL I'm not sure if those are
    // automatically updated to some default the first time the
    // account is linked, or if I specifically have to dig into
    // user.providerData; we'll see...
    // TODO: Is there any valid reason we should want to ask for the user's
    // phone number??
    Object.assign(state, objectSlice(user,
      'uid', 'isAnonymous', 'displayName', 'photoURL', 'email',
      'phoneNumber'));
  },
  [actions.signOut]: (state, action) => {
    return { ...initialState };
  },
  [actions.update]: (state, action) => {
    Object.assign(state, action.payload);
  }
});


export default actions;
