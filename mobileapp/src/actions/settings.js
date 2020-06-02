import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

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
  save: createAsyncThunk(SAVE, () => {
    // TODO: This is just a dummy for now in place of a "real" function
    // that will handle saving settings to the remote database
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
    [actions.save.fulfilled]: (state, action) => {},
    [actions.save.rejected]: (state, action) => {},
  }
});


Object.assign(actions, settings.actions);
export const reducer = settings.reducer;
export default actions;
