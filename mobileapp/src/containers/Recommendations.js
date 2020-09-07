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
import { Dimensions, StyleSheet } from 'react-native';

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
    const { width } = Dimensions.get('window');

    // Use up to 80% of the screen width for the title; we must give it an
    // explicit width for adjustsFontSizeToFit to work
    const titleWidth = width * 0.8;

    return (
      <Header style={ styles.header }>
        <Left style={ flexStyle }>
          <Button transparent onPress={ this._onMenuButtonPress.bind(this) }>
            <Icon name='menu' style={{ color: '#fff'}} />
          </Button>
        </Left>
        <Body style={ [styles.headerBody, flexStyle] }>
          <Title adjustsFontSizeToFit
                 style={[ styles.headerTitle, { width: titleWidth } ]}
          >
            Renewal
          </Title>
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
      <ArticlesList { ...this.props } listName={ 'recommendations' } infiniteScroll />
    );
  }
}


export default  AnimatedHeaderScrollView(
  'recommendations', RecommendationsHeader, RecommendationsContent);


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121'
  },
  headerTitle: {
    color: 'white',
    fontFamily: 'Chomsky',
    fontSize: 30
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  }
});
