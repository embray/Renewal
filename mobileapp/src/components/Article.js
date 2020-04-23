/* Component representing a single Article card. */

import I18n from 'ex-react-native-i18n';
import TimeAgo from 'javascript-time-ago';
import TimeAgoI18nEn from 'javascript-time-ago/locale/en';
import TimeAgoI18nFr from 'javascript-time-ago/locale/fr';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Share,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Body,
  Button,
  Card,
  CardItem,
  Col,
  Grid,
  Left,
  Right,
  Text,
  Thumbnail
} from 'native-base';

import Icon from './Icon';


I18n.fallbacks = true
I18n.translations = {
  'en': require("../i18n/en"),
  'fr': require('../i18n/fr'),
};


// Initialize the locales supported by ReactTimeAgo
TimeAgo.locale(TimeAgoI18nEn);
TimeAgo.locale(TimeAgoI18nFr);
const timeAgo = new TimeAgo();


// Higher-order component for components that modify articles in some
// way; currently does not do much, but this will be a centralized place
// for managing actions on individual articles in such a way that can
// be reused throughout the application
function articleController(WrappedComponent) {
  return class extends WrappedComponent {
    static propTypes = {
      // Minimal article props required for this component
      article: PropTypes.shape({
        url: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        rating: PropTypes.oneOf([-1, 0, 1]).isRequired,
        saved: PropTypes.bool.isRequired
      }).isRequired
    }

    constructor(props) {
      super(props);

      this.state = {
        article: this.props.article
      }

      this.setRating = this.setRating.bind(this);
      this.toggleSaved = this.toggleSaved.bind(this);
      this.share = this.share.bind(this);
    }

    // Set the article's rating.
    setRating(rating) {
      // TODO: For now this just manages the local state of the component;
      // later this will instead dispatch an action to propogate the article's
      // state change through the global application state.  Same with the
      // toogleSaved method.
      console.log(`setRating(${rating})`);
      this.setState((prevState) => ({
        article: { ...prevState.article, rating }
      }));
    }

    // Toggle the article's bookmarked state
    toggleSaved() {
      // TODO: For now this just manages the local state of the component;
      // later this will instead dispatch an action to propogate the article's
      // state change through the global application state.  Same with the
      // toogleSaved method.
      this.setState((prevState) => ({
        article: { ...prevState.article, saved: !prevState.article.saved }
      }));
    }

    // Share the article with the system's native sharing mechanism
    async share() {
      const { title, url } = this.props.article;
      const message = `${I18n.t('share_message_1')} "${title}" ${I18n.t('share_message_2')}\n${url}`;
      const subject = `${I18n.t('share_subject')} "${title}"`;
      try {
        // TODO: It might worth capturing the result of the share action and
        // sending it as an event--I imagine the recommendation engines would want
        // successful share events too...
        await Share.share({ title, url, message, subject })
      } catch (error) {
        Alert.alert(error.message);
      }
    }
  };
}


// Component for the strip of article control buttons at the bottom of an
// Article card
class _ArticleButtons extends Component {
  _toggleRating(rating) {
    const prevRating = this.state.article.rating;
    if (prevRating == rating) {
      this.setRating(0);
    } else {
      this.setRating(rating);
    }
  }

  render() {
    const { rating, saved } = this.state.article;

    return (
      <Grid>
        <Col>
          <Button transparent onPress={ () => this._toggleRating(1) }>
            <Icon name="thumbs-up" active={ rating == 1 } />
          </Button>
        </Col>
        <Col>
          <Button transparent onPress={ () => this._toggleRating(-1) }>
            <Icon name="thumbs-down" active={ rating == -1 } />
          </Button>
        </Col>
        <Col>
          <Button transparent onPress={ this.toggleSaved }>
            <Icon name="bookmark" active={ saved } />
          </Button>
        </Col>
        <Col>
          <Button transparent onPress={ this.share }>
            <Icon name="share" />
          </Button>
        </Col>
      </Grid>
    );
  }
}


const ArticleButtons = articleController(_ArticleButtons);


class Article extends Component {
  _onPressArticle(article) {
    // this.fetchEvent("pressOnItem", "itemClickedTitle : "+item.title+" itemClickedUrl : "+item.url);
    this.props.navigation.navigate('ArticleView', article);
  }

  render() {
    const { article, source, navigation } = this.props;
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
          <ArticleButtons article={ article } />
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


export default withNavigation(Article);


const styles = StyleSheet.create({
  articleImage: {
    width: '100%'
  }
});
