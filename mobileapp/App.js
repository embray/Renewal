/* Polyfill for Intl support */
import 'intl';
import 'intl/locale-data/jsonp/en';
import 'intl/locale-data/jsonp/fr';

import { AppLoading, SplashScreen } from 'expo';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Root } from 'native-base';
import Roboto from 'native-base/Fonts/Roboto.ttf'
import RobotoMedium from 'native-base/Fonts/Roboto_medium.ttf'
import React, { Component } from 'react';
import { Image, View } from 'react-native';
import { Provider, connect } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import accountActions from './src/actions/account';
import Home from './src/containers/Home';
import createArticleViewScreen from './src/containers/ArticleView';
import persistedStore, { store } from './src/storage';


if (__DEV__) {
  let config = Constants.manifest;
  console.log(`Loaded config file from ${config.extra.environmentConfig}`);
  console.log(`Config: ${JSON.stringify(config)}`);
}


const Stack = createStackNavigator();


class _RootContainer extends Component {
  state = { isReady: false }

  componentDidMount() {
    this._loadAsync()
  }

  render() {
    // Display splash screen
    if (this.props.isAuthenticating || !this.state.isReady) {
      // See https://docs.expo.io/versions/latest/sdk/splash-screen/#example-without-any-flickering-between-splashscreen-and
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Image
            style={{ width: '100%' }}
            source={ require('./assets/splash.png') }
            resizeMode="contain"
            onLoadEnd={ () => SplashScreen.hide() }
            fadeDuration={ 0 }
          />
        </View>
      );
    }

    return (
      <Root>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={ Home }
              options={{ headerShown: false }}
            />
            { createArticleViewScreen('ArticleView', Stack) }
          </Stack.Navigator>
        </NavigationContainer>
      </Root>
    );
  }

  async _loadAsync() {
    this.props.dispatch(accountActions.checkAuth());
    await Font.loadAsync({
        Roboto: Roboto,
        Roboto_medium: RobotoMedium,
        Arial: Roboto,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font
    });
    this.setState({ isReady: true });
  }
}

function mapStateToProps(state) {
  return { isAuthenticating: state.account.isAuthenticating };
}


const RootContainer = connect(mapStateToProps)(_RootContainer);


export default class App extends Component {
  state = {
    isSplashReady: false,
  };

  render() {
    if (!this.state.isSplashReady) {
      return (
        <AppLoading
          startAsync={ this._loadSplashResourcesAsync }
          onFinish={ () => { this.setState({ isSplashReady: true })} }
          onError={ console.warn }
          autoHideSplash={ false }
        />
      );
    }

    return (
      <Provider store={ store }>
        <PersistGate persistor={ persistedStore }>
          <RootContainer />
        </PersistGate>
      </Provider>
    );
  }

  // Passed to AppLoading.startAsync; should return a Promise
  async _loadSplashResourcesAsync() {
    const splash = require('./assets/splash.png');
    return Asset.loadAsync(splash);
  }
}
