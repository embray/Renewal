/* Polyfill for Intl support */
import 'intl';
import 'intl/locale-data/jsonp/en';
import 'intl/locale-data/jsonp/fr';

import { AppLoading } from 'expo';
import * as Font from 'expo-font';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Roboto from 'native-base/Fonts/Roboto.ttf'
import RobotoMedium from 'native-base/Fonts/Roboto_medium.ttf'
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';
import { persistStore, persistReducer } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react'
import { AsyncStorage } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Config from './config';
import { rootReducer } from './src/actions';
import Home from './src/containers/Home';
import ArticleView, { ArticleHeader } from './src/containers/ArticleView';
import { loggerStateTransformer } from './src/utils';

if (Config.debug) {
    console.log(`Config: ${JSON.stringify(Config)}`);
}




// Global Redux store for the App, with persistence
const middleware = [];

if (Config.debug) {
  middleware.push(createLogger({
    stateTransformer: loggerStateTransformer
  }));
}

const persistedReducer = persistReducer({
  key: 'root',
  storage: AsyncStorage
}, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: middleware,
  devTools: !Config.debug
});

const persistedStore = persistStore(store);


const Stack = createStackNavigator();


export default class App extends Component {
  state = {
    isReady: false
  };

  render() {
    if (!this.state.isReady) {
      // NOTE: We use the Redux provider here too in case we want to
      // mutate some of the state, e.g. upon retrieving user login
      // or loading the state from persistent storage
      return (
        <Provider store={ store }>
          <AppLoading
            startAsync={ this._loadResourcesAsync }
            onFinish={ () => this.setState({ isReady: true }) }
            onError={ console.warn }
          />
        </Provider>
      );
    }

    return (
      <Provider store={ store }>
        <PersistGate loading={ <AppLoading /> } persistor={ persistedStore }>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
              <Stack.Screen name="Home" component={Home}
                options={ {headerShown: false} }
              />
              <Stack.Screen name="ArticleView" component={ArticleView}
                options={{ header: (props) => <ArticleHeader {...props} /> }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PersistGate>
      </Provider>
    );
  }

  // Passed to AppLoading.startAsync; should return a Promise
  async _loadResourcesAsync() {
    return Font.loadAsync({
      Roboto: Roboto,
      Roboto_medium: RobotoMedium,
      Arial: Roboto,
      ...Ionicons.font,
      ...MaterialCommunityIcons.font
    });
  }
}
