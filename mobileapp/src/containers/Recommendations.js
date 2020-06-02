import {
  Body,
  Button,
  Header,
  Icon,
  Left,
  Right,
  Title
} from 'native-base';
import React, { Component } from 'react';
import { StyleSheet } from 'react-native';

import AnimatedHeaderScrollView from '../components/AnimatedHeaderScrollView';
import ArticlesList from './ArticlesList';


// This is the "main" home screen header.
class RecommendationsHeader extends Component {
  _onMenuButtonPress() {
    this.props.navigation.toggleDrawer();
  }

  render() {
    // Modify the flexbox for the main heading to put the title in
    // the center
    const flexStyle = {'flex': 1, 'justifyContent': 'center'};

    return (
      <Header style={ styles.header }>
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


class RecommendationsContent extends Component {
  render() {
    return (
      <ArticlesList { ...this.props } listName={ 'recommendations' } />
    );
  }
}


export default  AnimatedHeaderScrollView(
  'recommendations', RecommendationsHeader, RecommendationsContent);


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121',
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
