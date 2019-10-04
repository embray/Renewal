/*import React from 'react';
import { StackNavigator } from 'react-navigation';

import WelcomeView from './components/App';
import Movie from './components/Movie';
import Vide from './components/Vide';
import Home from './components/HomeScreen'

const App = StackNavigator({
    WelcomeView: {screen: WelcomeView},
    Movie: {screen: Movie},
    Vide: {screen: Vide},
    Home: { screen: Home}
},
{
    initialRouteName: 'Home',
    headerMode: 'none'
});

export default App;*/
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  StyleSheet,
  View,
  StatusBar
} from 'react-native';
import { AppLoading } from 'expo';
import * as Font from 'expo-font';
import Roboto from 'native-base/Fonts/Roboto.ttf'
import RobotoMedium from 'native-base/Fonts/Roboto_medium.ttf'


import Routes from './src/Routes';
import Config from './config';


if (Config.debug) {
    console.log(`Config: ${JSON.stringify(Config)}`);
}


export default class App extends Component {
  state = {
    isReady: false
  };

  render() {
    if (!this.state.isReady) {
      return (
        <AppLoading
          startAsync={ this._loadResourcesAsync }
          onFinish={ () => this.setState({ isReady: true }) }
          onError={ console.warn }
        />
      );
    }

    return (
      <View style={ styles.container }>
        <StatusBar
           backgroundColor="#1c313a"
           barStyle="light-content"
         />

        <Routes />
      </View>
    );
  };

  // Passed to AppLoading.startAsync; should return a Promise
  async _loadResourcesAsync() {
    return Font.loadAsync({
      Roboto: Roboto,
      Roboto_medium: RobotoMedium,
      Arial: Roboto,
    });
  };

}

const styles = StyleSheet.create({
  container : {
    flex: 1,
  }
});
