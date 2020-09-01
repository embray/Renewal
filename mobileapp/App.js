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
import { Button, ImageBackground, View, StyleSheet } from 'react-native';
import { purgeStoredState } from 'redux-persist';
import { Provider, connect } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Font for the masthead
import Chomsky from './assets/Chomsky.otf'
import accountActions from './src/actions/account';
import TickMessage from './src/components/TickMessage';
import Home from './src/containers/Home';
import createArticleViewScreen from './src/containers/ArticleView';
import persistedStore, { store } from './src/storage';
import { sleep } from './src/utils';


if (__DEV__) {
  let config = Constants.manifest;
  console.log(`Loaded config file from ${config.extra.environmentConfig}`);
  console.log(`Config: ${JSON.stringify(config)}`);
}


const styles = StyleSheet.create({
  splashScreen: {
    width: '100%',
    height: '100%',
    alignItems: 'center'
  },
  splashMessage: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center'
  }
});


const Stack = createStackNavigator();


class _RootContainer extends Component {
  state = {
    isReady: false,
    splashMessage: ''
  }

  componentDidMount() {
    this._loadAsync();

    // Display any queued toasts related to authentication
    // after a brief delay to ensure that the Root container
    // has been rendered
    setTimeout(() => this.props.popToasts(), 250);
  }

  render() {
    let splashMessage = this.state.splashMessage;
    if (!splashMessage.length && this.props.isAuthenticating) {
      // If there is no other message to display on the splash screen but we
      // are still waiting on authentication, display the authentication message
      splashMessage = 'Logging in';
    }
    // Display splash screen
    if (this.props.isAuthenticating || !this.state.isReady) {
      // See https://docs.expo.io/versions/latest/sdk/splash-screen/#example-without-any-flickering-between-splashscreen-and
      return (
        <Root>
          <ImageBackground
            style={ styles.splashScreen }
            source={ require('./assets/splash.png') }
            resizeMode="contain"
            onLoadEnd={ () => SplashScreen.hide() }
            fadeDuration={ 0 }
          >
            <View style={ styles.splashMessage }>
              <TickMessage message={ splashMessage } />
            </View>
            { __DEV__ ? (
              <Button onPress={ () => persistedStore.purge() }
                      title="Clear Persisted State"
              />
            ) : null }
          </ImageBackground>
        </Root>
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
    this.props.checkAuth();
    this.setState({ splashMessage: 'Loading assets' });
    await Font.loadAsync({
        Roboto: Roboto,
        Roboto_medium: RobotoMedium,
        Arial: Roboto,
        Chomsky: Chomsky,
        ...Ionicons.font,
        ...MaterialCommunityIcons.font
    });

    if (__DEV__) {
      // Give an extra 3 seconds to purge the persisted state and restart
      // with a fresh state
      await sleep(3000);
    }

    this.setState({
      isReady: true,
      splashMessage: ''
    });
  }
}

function mapStateToProps(state) {
  return { isAuthenticating: state.account.isAuthenticating };
}

const RootContainer = connect(mapStateToProps, accountActions)(_RootContainer);


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
