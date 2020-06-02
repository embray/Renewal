// This higher order component is a generalization of the Recommendations
// component which has a Header that hides/shows as the user scrolls through
// the view.
//
// It takes a Header Component and a Content Component (which should be a
// ScrollView or a Component derived from ScrollView) and wraps the whole
// thing in a StackNavigator with a header that hides/shows during scroll.

// If the StackNavigator argument is given, the view is added as a screen on an
// existing Stack, otherwise a new StackNavigator is created and the screen is
// wrapped in it and returned as a Component class

import { variables as ThemeVariables } from 'native-base';
import React, { Component } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';


export default function AnimatedHeaderScrollView(
  screenName, Header, Content, StackNavigator) {
  class AnimatedHeaderHeaderWrapper extends Component {
    render() {
      const { translateYAnim } = this.props;
      //const headerTop = headerExtraParams.headerTop;
      const width = Dimensions.get('window').width;
      //const translateY = (headerTop !== undefined ? headerTop : 0);
      const translateY = (translateYAnim !== undefined ? translateYAnim : 0);
      // Modify the flexbox for the main heading to put the title in
      // the center
      const style = [ styles.headerContainer, { width, translateY } ];

      return (
        <Animated.View style={ style }>
          <Header { ...this.props } />
        </Animated.View>
      );
    }
  }

  class AnimatedHeaderContentWrapper extends Component {
    constructor(props) {
      super(props);

      // This is a fixed constant hard-coded in native-base.
      // Here we are just using the default theme.
      this.headerHeight = ThemeVariables.toolbarHeight;
      this.scrollYAnim = new Animated.Value(0);

      // Using Animated.diffClamp ensures that the raw scroll
      // animation value (the contentOffset.y of the page) is
      // simply the difference between scrollYAnim's current and previous values
      // clamped to the range [0, headerHeight]; the interpolation then
      // merely inverts the value to set the header translation
      this.headerTranslateYAnim = Animated.diffClamp(
        this.scrollYAnim, 0, this.headerHeight).interpolate({
          inputRange: [0, 1],
          outputRange: [0, -1]
        });
    }

    render() {
      // Note: The paddingTop: ThemeVariables.toolbarHeight is crucial to
      // ensure that the top of the Content is not overlapped by the animated
      // header; I cannot figure out exactly why this is where the padding is
      // needed and why, say, a margin wouldn't work instead, but this seems to
      // do the trick.
      //
      // Note: overScrollMode prevents a 'bounce' on android when reaching the
      // top of the last that can cause the header to get bumped out of place a
      // bit; can't figure out how to prevent that otherwise.  the center
      //
      // Hack!!  We include the Header here *after* ArticlesList since it's an
      // absolutely positioned element and can't be interacted with otherwise.
      // See note the AnimatedHeaderStackNavigator.render() method for more
      // details.
      return (
        <>
          <Content { ...this.props }
            onScroll={ Animated.event([{
              nativeEvent: {contentOffset: {y: this.scrollYAnim}}
            }], { useNativeDriver: true }) }
            scrollEventThrottle={ 16 }
            overScrollMode={ 'never' }
            contentContainerStyle={{ paddingTop: this.headerHeight }}
          />
          <AnimatedHeaderHeaderWrapper
            route={ this.props.route }
            navigation={ this.props.navigation }
            translateYAnim={ this.headerTranslateYAnim }
          />
        </>
      );
    }
  }

  // In order to add a header to DrawerNavigator screens it's apparently
  // necessary to wrap each Screen in its own StackNavigator, which is
  // a bit of a mess...

  // https://github.com/react-navigation/react-navigation/issues/1632
  // Not sure why DrawerNavigator screens can't also just have headers...
  let Stack = StackNavigator;
  if (StackNavigator === undefined) {
    Stack = createStackNavigator();
  }

  if (Stack === StackNavigator) {
    return (
      <Stack.Screen name={ screenName }
                    component={ AnimatedHeaderContentWrapper }
                    options={{ header: (props) => null }}
      />
    );
  }

  class AnimatedHeaderStackNavigator extends Component {
    render() {
      // Hack: We set the navigation header to null here, which just leaves a
      // blank space in the header content area.  The header content will be
      // filled by RecommendationsHeader, but because it is absolutely
      // positioned in order to make the animation look good, it cannot receive
      // touch events unless it is actually lower in the DOM than other
      // components.  Basically absolutely positioned elements get implicit
      // negative zorder than can't be overridden unless they are positioned
      // later in the DOM--this is true of web development as well.

      // Return the screen wrapped in the new StackNavigator
      return (
        <Stack.Navigator screenOptions={{ header: (props) => null }}>
          <Stack.Screen name={ screenName }
                        component={ AnimatedHeaderContentWrapper }
          />
        </Stack.Navigator>
      );
    }
  }

  return AnimatedHeaderStackNavigator;
}


const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    overflow: 'hidden'
  }
});
