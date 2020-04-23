/* Component representing a single Article card. */

import I18n from 'ex-react-native-i18n';
import TimeAgo from 'javascript-time-ago';
import TimeAgoI18nEn from 'javascript-time-ago/locale/en';
import TimeAgoI18nFr from 'javascript-time-ago/locale/fr';
import React, { Component } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Share,
  StyleSheet
} from 'react-native';
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


export default class Article extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rating: this.props.article.rating,
      saved: this.props.article.saved
    }
  }

  _onThumbsUp() {
    console.log('thumbs up');
    this.setState((prevState) => ({
      rating: prevState.rating == 1 ? 0 : 1
    }));
  }

  _onThumbsDown() {
    console.log('thumbs down');
    this.setState((prevState) => ({
      rating: prevState.rating == -1 ? 0 : -1
    }));
  }

  _onSave() {
    this.setState((prevState) => ({
      saved: !prevState.saved
    }));
  }

  async _onShare() {
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

  render() {
    const { article, source } = this.props;
    const { rating, saved } = this.state;
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

    // TODO: This re-renders whenever the user clicks the save button
    // or one of the rating buttons which is a bit slow; we could optimize this
    // significantly by pushing those state variables down into sub-components

    return (
      <Card>
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
        <CardItem style={{ paddingTop: 0, paddingBottom: 0 }}>
          <Grid>
            <Col>
              <Button transparent onPress={ this._onThumbsUp.bind(this) }>
                <Icon name="thumbs-up" active={ rating == 1 } />
              </Button>
            </Col>
            <Col>
              <Button transparent onPress={ this._onThumbsDown.bind(this) }>
                <Icon name="thumbs-down" active={ rating == -1 } />
              </Button>
            </Col>
            <Col>
              <Button transparent onPress={ this._onSave.bind(this) }>
                <Icon name="bookmark" active={ saved } />
              </Button>
            </Col>
            <Col>
              <Button transparent onPress={ this._onShare.bind(this) }>
                <Icon name="share" />
              </Button>
            </Col>
          </Grid>
        </CardItem>
      </Card>
    );
  }
}


const styles = StyleSheet.create({
  articleImage: {
    width: '100%'
  }
});
