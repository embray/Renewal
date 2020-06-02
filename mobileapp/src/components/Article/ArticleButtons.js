import I18n from 'ex-react-native-i18n';
import { Button, Col, Grid } from 'native-base';
import React, { Component } from 'react';
import { Share, StyleSheet } from 'react-native';
import { connect } from 'react-redux';

import { articleActions } from '../../actions';
import Icon from '../Icon';


I18n.fallbacks = true;
I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


const styles = StyleSheet.create({
  button: {
    justifyContent: 'center'
  }
});


// Component for the strip of article control buttons at the bottom of an
// Article card
class ArticleButtons extends Component {
  _toggleRating(rating) {
    const prevRating = this.props.rating;
    if (prevRating == rating) {
      this.props.setInteraction({ rating: 0 });
    } else {
      this.props.setInteraction({ rating });
    }
  }

  async _share() {
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
    const { rating, bookmarked } = this.props;

    return (
      <Grid style={ this.props.style }>
        <Col>
          <Button style={ styles.button } transparent
                  onPress={ this._toggleRating.bind(this, 1) }
          >
            <Icon name="thumbs-up" active={ rating == 1 } />
          </Button>
        </Col>
        <Col>
          <Button style={ styles.button } transparent
            onPress={ this._toggleRating.bind(this, -1) }
          >
            <Icon name="thumbs-down" active={ rating == -1 } />
          </Button>
        </Col>
        <Col>
          <Button style={ styles.button } transparent
                  onPress={ this.props.toggleBookmarked }
          >
            <Icon name="bookmark" active={ bookmarked } />
          </Button>
        </Col>
        <Col>
          <Button style={ styles.button } transparent
                  onPress={ this._share.bind(this) }
          >
            <Icon name="share" />
          </Button>
        </Col>
      </Grid>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const { articleId } = ownProps;
  const article = state.articles.articles[articleId];
  const interactions = state.articles.articleInteractions[articleId];
  return {
    article,
    rating: interactions.rating,
    bookmarked: interactions.bookmarked
  }
}


function mapDispatchToProps(dispatch, ownProps) {
  const { articleId } = ownProps;
  // Curry the articleId into the relevant action creators
  return {
    setInteraction: (interaction) => {
      dispatch(articleActions.setInteraction(articleId, interaction))
    },
    toggleBookmarked: () => {
      dispatch(articleActions.toggleBookmarked(articleId))
    }
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(ArticleButtons);
