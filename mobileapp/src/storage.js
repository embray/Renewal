// Global Redux store for the App, with persistence
import { AsyncStorage } from 'react-native';
import { createLogger } from 'redux-logger';
import { persistStore, persistReducer } from 'redux-persist';
import thunkMiddleware from 'redux-thunk';
import { configureStore } from '@reduxjs/toolkit';

import Config from '../config';
import { rootReducer } from './actions';
import { loggerStateTransformer } from './utils';


const middleware = [ thunkMiddleware ];

if (Config.debug) {
  middleware.push(createLogger({
    stateTransformer: loggerStateTransformer
  }));
}

const persistConfig = {
  key: 'root',
  storage: AsyncStorage
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: middleware,
  devTools: !Config.debug
});

const persistedStore = persistStore(store);

export { store, persistConfig };
export default persistedStore;
