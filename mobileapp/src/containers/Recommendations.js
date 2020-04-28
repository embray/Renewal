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


// This is the "main" home screen header.
class RecommendationsHeader extends Component {
  _onMenuButtonPress() {
    this.props.navigation.toggleDrawer();
  }

  render() {
    const { name } = this.props.route;
    const { translateYAnim } = this.props;
    //const headerTop = headerExtraParams.headerTop;
    const width = Dimensions.get('window').width;
    //const translateY = (headerTop !== undefined ? headerTop : 0);
    const translateY = (translateYAnim !== undefined ? translateYAnim : 0);
    const transform = [{ translateY }];
    // Modify the flexbox for the main heading to put the title in
    // the center
    const flexStyle = {'flex': 1, 'justifyContent': 'center'};

    return (
      <Animated.View style={[ styles.headerContainer, { width, translateY } ]}>
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
    // Hack: We set the navigation header to null here, which just leaves
    // a blank space in the header content area.  The header content will
    // be filled by RecommendationsHeader, but because it is absolutely
    // positioned in order to make the animation look good, it cannot
    // receive touch events unless it is actually lower in the DOM than
    // other components.  Basically absolutely positioned elements get
    // implicit negative zorder than can't be overridden unless they are
    // positioned later in the DOM--this is true of web development as well.
    return (
      <RecommendationsStack.Navigator
        screenOptions={{ header: (props) => null }}
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
    this.headerTranslateYAnim = Animated.diffClamp(
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
    // the center
    //
    // Hack!!  We include RecommendationsHeader here *after* ArticlesList
    // since it's an absolutely positioned element and can't be interacted
    // with otherwise.  See note the Recommendations.render() method for more
    // details.
    const flexStyle = {'flex': 1, 'justifyContent': 'center'};
    return (
      <>
        <ArticlesList { ...this.props }
          style={{ paddingTop: ThemeVariables.toolbarHeight }}
          onScroll={ Animated.event([{
            nativeEvent: {contentOffset: {y: this.scrollYAnim}}
          }], { useNativeDriver: true }) }
          scrollEventThrottle={ 16 }
          overScrollMode={ 'never' }
        />
        <RecommendationsHeader route={ this.props.route }
          navigation={ this.props.navigation }
          translateYAnim={ this.headerTranslateYAnim }
        />
      </>
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
