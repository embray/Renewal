import React, { Component } from 'react';
import { AppLoading } from 'expo';
import * as Font from 'expo-font';
import Roboto from 'native-base/Fonts/Roboto.ttf'
import RobotoMedium from 'native-base/Fonts/Roboto_medium.ttf'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Config from './config';
import Home, { HomeHeader } from './src/containers/Home';
import Article, { ArticleHeader } from './src/containers/Article';

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
      return (
        <AppLoading
          startAsync={ this._loadResourcesAsync }
          onFinish={ () => this.setState({ isReady: true }) }
          onError={ console.warn }
        />
      );
    }

    return (
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={Home}
            options={{ header: (props) => <HomeHeader {...props} /> }}
          />
          <Stack.Screen name="Article" component={Article}
            options={{ header: (props) => <ArticleHeader {...props} /> }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Passed to AppLoading.startAsync; should return a Promise
  async _loadResourcesAsync() {
    return Font.loadAsync({
      Roboto: Roboto,
      Roboto_medium: RobotoMedium,
      Arial: Roboto,
    });
  }
}
