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
import { PersistGate } from 'redux-persist/integration/react'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Config from './config';
import { signInAnonymously } from './src/auth';
import Home from './src/containers/Home';
import ArticleView, { ArticleHeader } from './src/containers/ArticleView';
import persistedStore, { store } from './src/storage';


if (Config.debug) {
    console.log(`Config: ${JSON.stringify(Config)}`);
}


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
    return Promise.all([
      Font.loadAsync({
        Roboto: Roboto,
        Roboto_medium: RobotoMedium,
        Arial: Roboto,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font
      }),
      signInAnonymously()
    ]);
  }
}
