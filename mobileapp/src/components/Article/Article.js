/* Component representing a single Article card. */

import TimeAgo from 'javascript-time-ago';
import TimeAgoI18nEn from 'javascript-time-ago/locale/en';
import TimeAgoI18nFr from 'javascript-time-ago/locale/fr';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { connect } from 'react-redux';
import {
  Body,
  Card,
  CardItem,
  Left,
  Right,
  Text,
  Thumbnail
} from 'native-base';

import ArticleButtons from './ArticleButtons';


// Initialize the locales supported by ReactTimeAgo
TimeAgo.locale(TimeAgoI18nEn);
TimeAgo.locale(TimeAgoI18nFr);
const timeAgo = new TimeAgo();


class Article extends Component {
  _onPressArticle(article) {
    // this.fetchEvent("pressOnItem", "itemClickedTitle : "+item.title+" itemClickedUrl : "+item.url);
    this.props.navigation.navigate('ArticleView', article);
  }

  render() {
    const { article, source, interactions, navigation } = this.props;
    const { height } = Dimensions.get('window');
    const icon = `data:image/png;base64,${source.icon}`;

    if (article.date) {
      var dateRel = timeAgo.format(new Date(article.date), 'twitter');
    } else {
      // Normally this shouldn't happen, but at least in the debug data
      // some articles are missing dates due to failures of the web scraper;
      // when articles are sourced from RSS feeds this should happen even
      // more rarely.
      var dateRel = '???';
    }

    const Touchable = navigation ? (function (props) {
      return (
        <TouchableOpacity onPress={ this._onPressArticle.bind(this, article) }>
          { props.children }
        </TouchableOpacity>
      );
    }).bind(this) : (function (props) {
      return (
        <TouchableWithoutFeedback>
          <View>{ props.children }</View>
        </TouchableWithoutFeedback>
      );
    });

    return (
      <Card>
        <Touchable>
          <CardItem>
            <Left>
              <Thumbnail source={{ uri: icon }} small />
              <Body>
                <Text style={{ fontWeight: 'bold' }}>{ source.name }</Text>
              </Body>
            </Left>
            <Right>
              <Text note>{ dateRel }</Text>
            </Right>
          </CardItem>
          <CardItem>
            <Body>
              <Text>{ article.title }</Text>
              <Image
                source={{ uri: article.image }}
                style={[ styles.articleImage, { height: height / 4.0 } ]}
              />
            </Body>
          </CardItem>
        </Touchable>
        <CardItem style={{ paddingTop: 0, paddingBottom: 0 }}>
          <ArticleButtons articleId={ article.url } />
        </CardItem>
      </Card>
    );
  }
}


// For some reason useNavigation can only be used in a function component,
// but it's still more convenient than having to pass the navigation down
// through props manually.
// I suspect there's a better way, since useNavigation works through the
// Context API but the docs don't tell us, so I'd have to dig deeper...
// TODO: This withNavigation HOC could be useful elsewhere so it should be
// defined in a utility module.
function withNavigation(WrappedComponent) {
  return function (props) {
    const navigation = useNavigation();
    return (<WrappedComponent { ...props } navigation={ navigation } />);
  }
}


// Map global Redux state to Article props, so all Article has to
// receive explicitly in its props is the article URL
function mapStateToProps(state, props) {
  const { articleId } = props;
  const { articles } = state;
  const article = articles.articles[articleId];
  return {
    article,
    source: articles.sources[article.source],
    interactions: articles.articleInteractions[articleId]
  };
}


export default connect(mapStateToProps)(withNavigation(Article));


const styles = StyleSheet.create({
  articleImage: {
    width: '100%'
  }
});