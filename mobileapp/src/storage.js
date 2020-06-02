// Global Redux store for the App, with persistence
import { AsyncStorage } from 'react-native';
import { createLogger } from 'redux-logger';
import { persistStore, persistReducer } from 'redux-persist';
import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';

import { rootReducer } from './actions';
import { loggerStateTransformer } from './utils';


const middleware = getDefaultMiddleware({
  serializableCheck: {
    // redux-persist uses some special actions that are non-serializable,
    // so we want to ignore those in the serializable check
    ignoredActions: ['persist/PERSIST']
  }
});

if (__DEV__) {
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
  devTools: __DEV__
});

const persistedStore = persistStore(store);

export { store, persistConfig };
export default persistedStore;
