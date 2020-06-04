import React, { Component } from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ArticlesList from '../ArticlesList';
import SideHeader from './SideHeader';


const BookmarksStack = createStackNavigator();

// Wrapper class needed to put the Bookmarks header in a StackNavigator
// TODO: This code is repeated in a number of places; I wonder if it could
// be refactored.
export default class Bookmarks extends Component {
  render() {
    return (
      <BookmarksStack.Navigator
        screenOptions={{ header: (props) => <SideHeader {...props} /> }}
      >
        <BookmarksStack.Screen name="bookmarks"
          component={ BookmarksContent }
      />
      </BookmarksStack.Navigator>
    );
  }
}


class BookmarksContent extends Component {
  render() {
    return (
      <ArticlesList { ...this.props } listName="bookmarks" infiniteScroll />
    );
  }
}
