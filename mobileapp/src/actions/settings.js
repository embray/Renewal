import * as firebase from 'firebase/app';
import 'firebase/firestore';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { initializeFirebase, objectPrefix } from '../utils';

const FIREBASE_ENABLED = initializeFirebase();

/* Action constants */
// NOTE: Some of these are generated automatically by createSlice
const SAVE = 'settings/save';

// NOTE: Most sensors are disabled by default since enabling them will require
// user permissions.
// TODO: Do we really need all these sensors?  Location maybe, but I'm less
// sure about things like gyroscope and magnetometer...
export const initialState = {
  // Sensors
  location: false,
  pedometer: false,
  gyroscope: false,
  accelerometer: false,
  network: true,

  // Other settings
  activity: true,
  access: true,
  targeting: true,
  notifications: true
}


const actions = {
  save: createAsyncThunk(SAVE, async ({ changes, prevSettings }, thunkAPI) => {
    if (!FIREBASE_ENABLED) {
      return;
    }
    const db = firebase.firestore();
    const uid = thunkAPI.getState().account.uid;
    const settings = objectPrefix(changes, 'settings.');
    try {
      return await db.collection('users').doc(uid).update(settings);
    } catch (err) {
      return thunkAPI.rejectWithValue({ error: err.message, prevSettings });
    }
  })
}


// NOTE: For now there is one simple action for updating settings; however
// this may need to become an async thunk especially for the case of changing
// sensor settings, as it will need to ask for user permissions (though I think
// this can also be done synchronously...)
const settings = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    update: (state, action) => Object.assign(state, action.payload)
  },
  extraReducers: {
    [actions.save.pending]: (state, action) => {},
    [actions.save.fulfilled]: (state, action) => {
      console.log('successfully saved settings');
    },
    [actions.save.rejected]: (state, action) => {
      if (action.payload) {
        const { error, prevSettings } = action.payload;
        // Reset the settings to the previous state if saving them
        // failed
        Object.assign(state, prevSettings);
        console.log(action.error);
      } else {
        console.log(action.error);
      }
    },
  }
});


Object.assign(actions, settings.actions);
export const reducer = settings.reducer;
export default actions;
