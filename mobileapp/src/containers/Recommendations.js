import {
  Body,
  Button,
  Header,
  Icon,
  Left,
  Right,
  Title,
  variables as ThemeVariables
} from 'native-base';
import React, { Component } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import ArticlesList from './ArticlesList';

// In order to add a header to DrawerNavigator screens it's apparently
// necessary to wrap each Screen in its own StackNavigator, which is
// a bit of a mess...

// https://github.com/react-navigation/react-navigation/issues/1632
// Not sure why DrawerNavigator screens can't also just have headers...
const RecommendationsStack = createStackNavigator();


// This is the "main" home screen header.
class RecommendationsHeader extends Component {
  _onMenuButtonPress() {
    this.props.navigation.toggleDrawer();
  }

  render() {
    const width = Dimensions.get('window').width;
    const { name } = this.props.scene.route;
    // Modify the flexbox for the main heading to put the title in
    // the center
    const flexStyle = {'flex': 1, 'justifyContent': 'center'};

    return (
      <Header style={ [styles.header, {'width': width}] }>
        <Left style={ flexStyle }>
          <Button transparent onPress={ this._onMenuButtonPress.bind(this) }>
            <Icon name='menu' style={{ color: '#fff'}} />
          </Button>
        </Left>
        <Body style={ [styles.headerBody, flexStyle] }>
          <Title style={ styles.headerTitle }>RENEWAL</Title>
        </Body>
        <Right style={ flexStyle }>
        </Right>
      </Header>
    );
  }
}




// Contains the StackNavigator for the home screen which is
// embedded in the DrawerNavigator
export default class Recommendations extends Component {
  render() {
    return (
      <RecommendationsStack.Navigator
        screenOptions={{ header: (props) => <RecommendationsHeader {...props} /> }}
      >
        <RecommendationsStack.Screen name="recommendations"
          component={ RecommendationsContent }
        />
      </RecommendationsStack.Navigator>
    );
  }
}


class RecommendationsContent extends Component {
  _onScroll(e) {
    // console.log(e.nativeEvent.contentOffset.y);
  }

  render() {
    return (
      <ArticlesList { ...this.props }
        onScroll={ this._onScroll.bind(this) }
        scrollEventThrottle={ 16 }
      />
    );
  }
}


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121'
  },
  headerTitle: {
    color: 'white'
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  }
});
