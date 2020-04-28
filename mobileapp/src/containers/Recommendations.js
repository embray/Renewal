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
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { connect } from 'react-redux';

import ArticlesList from './ArticlesList';

// In order to add a header to DrawerNavigator screens it's apparently
// necessary to wrap each Screen in its own StackNavigator, which is
// a bit of a mess...

// https://github.com/react-navigation/react-navigation/issues/1632
// Not sure why DrawerNavigator screens can't also just have headers...
const RecommendationsStack = createStackNavigator();


// This is required as a workaround to
// https://reactnavigation.org/docs/troubleshooting/#i-get-the-warning-non-serializable-values-were-found-in-the-navigation-state
const headerExtraParams = {}


// This is the "main" home screen header.
class RecommendationsHeader extends Component {
  _onMenuButtonPress() {
    this.props.navigation.toggleDrawer();
  }

  render() {
    const { name } = this.props.scene.route;
    //const headerTop = headerExtraParams.headerTop;
    const headerTranslateY = headerExtraParams.headerTranslateY;
    const width = Dimensions.get('window').width;
    //const translateY = (headerTop !== undefined ? headerTop : 0);
    const translateY = (headerTranslateY !== undefined ? headerTranslateY : 0);
    const transform = [{ translateY }];
    // Modify the flexbox for the main heading to put the title in
    // the center
    const flexStyle = {'flex': 1, 'justifyContent': 'center'};

    return (
      <Animated.View style={[ styles.headerContainer, { width, transform } ]}>
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
      </Animated.View>
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


class _RecommendationsContent extends Component {
  constructor(props) {
    super(props);

    // This is a fixed constant hard-coded in native-base.
    // Here we are just using the default theme.
    const headerHeight = ThemeVariables.toolbarHeight;
    this.scrollYAnim = new Animated.Value(0);

    // Using Animated.diffClamp ensures that the raw scroll
    // animation value (the contentOffset.y of the page) is
    // simply the difference between scrollYAnim's current and previous values
    // clamped to the range [0, headerHeight]; the interpolation then
    // merely inverts the value to set the header translation
    headerExtraParams.headerTranslateY = Animated.diffClamp(
      this.scrollYAnim, 0, headerHeight).interpolate({
        inputRange: [0, 1],
        outputRange: [0, -1]
      });
  }

  render() {
    // Note: The paddingTop: ThemeVariables.toolbarHeight
    // is crucial to ensure that the top of the ArticlesList
    // is not overlapped by the animated header; I cannot
    // figure out exactly why this is where the padding is needed
    // and why, say, a margin wouldn't work instead, but this seems
    // to do the trick.
    //
    // Note: overScrollMode prevents a 'bounce' on android when reaching
    // the top of the last that can cause the header to get bumped out of
    // place a bit; can't figure out how to prevent that otherwise.
    return (
      <ArticlesList { ...this.props }
        style={{ paddingTop: ThemeVariables.toolbarHeight }}
        onScroll={ Animated.event([{
          nativeEvent: {contentOffset: {y: this.scrollYAnim}}
        }], { useNativeDriver: true }) }
        scrollEventThrottle={ 16 }
        overScrollMode={ 'never' }
      />
    );
  }
}


function mapStateToProps(state) {
  return {
    articleIds: state.articles.recommendationsList
  };
}


const RecommendationsContent = connect(
  mapStateToProps
)(_RecommendationsContent);


const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    overflow: 'hidden'
  },
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
