import { Icon } from 'native-base';
import React, { Component } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { connect } from 'react-redux';

import { articleActions } from '../actions';
import { Article } from '../components/Article';


// TODO: These will probably be moved again elsewhere once the backend API is
// in-place; then the backend API would handle debug simulations.
// Sort newest first
const DEBUG_ARTICLES = require('../data/debug_articles.json').sort((a, b) => {
  if (a.date > b.date) {
    return -1;
  } else if (a.date < b.date) {
    return 1;
  } else {
    return 0;
  }
});

const DEBUG_SOURCES = require('../data/debug_sources.json');

function _fake_article_interactions(articles) {
  // Here we cycle through bookmarked statuses and ratings for each debug article
  var bookmarked = false;
  var rating = 0;
  let interactions = {};
  articles.forEach((article) => {
    interactions[article.url] = { rating, bookmarked };
    bookmarked = !bookmarked;
    rating = (rating == 1 ? -1 : rating + 1);
  });
  return interactions;
}

const DEBUG_INTERACTIONS = _fake_article_interactions(DEBUG_ARTICLES);

// Fetch fake debug data
function _debugFetch(lastArticleId, perPage) {
  // TODO: Here we would actually fetch the data from the backend
  let start = (lastArticleId ?
    DEBUG_ARTICLES.findIndex(a => a.url == lastArticleId) + 1 : 0);
  let end = start + perPage;
  const articles = DEBUG_ARTICLES.slice(start, end);
  const interactions = {};
  const sources = {};
  // Article fetches include their associated sources and interactions
  articles.forEach((article) => {
    interactions[article.url] = DEBUG_INTERACTIONS[article.url];
    sources[article.source] = DEBUG_SOURCES[article.source];
  });

  return { articles, interactions, sources };
}


// TODO: Move this to a utilities module.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


class ArticlesList extends Component {
  static defaultProps = {
    articleList: { list: {}, current: 0 },
    perPage: 10
  }

  constructor(props) {
    super(props);

    this.state = {
      refreshing: false,
      loading: true,
      loadingMore: false,
      endOfData: false,
    }

    this.flatList = React.createRef();

    // Mysteriously, this is need just for this event handler, otherwise
    // an error results every time the component's state changes; see
    // https://github.com/facebook/react-native/issues/17408
    this._onViewableItemsChanged = this._onViewableItemsChanged.bind(this);
  }

  async componentDidMount() {
    await this._fetchArticles();
    this.flatList.current.getNode().scrollToIndex({
      index: this.props.articleList.current || 0,
      viewPosition: 0.5,
      animated: false
    });
  }

  // TODO: Eventually this will use the API for the backend to fetch
  // articles, and may include a built-in layer for article caching,
  // as well as the fallback that loads demo data in debug mode.
  async _fetchArticles() {
    const { articleList, perPage } = this.props;
    const list = articleList.list;
    const lastArticleId = list[list.length - 1];

    // Simulate data being refreshed
    // TODO: Only do this in debug mode--simul
    await sleep(50);

    // TODO: Here we would actually fetch the data from the backend
    const response = _debugFetch(lastArticleId, perPage);

    this.props.newArticles(
      response.articles,
      response.interactions,
      response.sources
    );

    this.setState((prevState) => ({
      refreshing: false,
      loading: false,
      loadingMore: false,
      endOfData: (response.articles.length === 0)
    }));
  }

  _renderArticle(url, index, nativeEvent) {
    // TODO: Need a proper way for loading sources alongside articles.
    // Either they would be fetched simulateneously with articles or cached separately
    // somehow.  If nothing else we need to cache source logos somewhere or else we'd
    // have to load them over and over again.
    // TODO: Load article images asynchronously outside the main component rendering;
    // makes articles load slowly otherwise.
    return (<Article articleId={ url } />);
  }

  _onRefresh() {
    console.log('refreshing');
    this.setState(
      { refreshing: true },
      this._fetchArticles
    );
  }

  _onEndReached(info) {
    console.log(`loading more: ${JSON.stringify(info)}`);
    this.setState((prevState) => ({
      loadingMore: true
    }), () => { this._fetchArticles() });
  }

  _onViewableItemsChanged({ viewableItems, changed }) {
    // The top-most viewable item is set as the current
    // item in this ArticlesList
    this.props.setCurrentArticle(viewableItems[0].index);
  }

  _onScrollToIndexFailed(error) {
    const flatList = this.flatList.current.getNode();
    flatList.scrollToOffset({
      offset: error.averageItemLength * error.index,
      animated: false
    });

    setTimeout(() => {
      if (this.props.articleList.list !== 0 && this.flatList !== null) {
        this.flatList.current.getNode().scrollToIndex({
          index: error.index,
          viewPosition: 0.5,
          animated: false
        });
      }
    }, 100);
  }

  _renderFooter() {
    const { height, width } = Dimensions.get('window');

    if (this.state.endOfData) {
      return (
        <View style={[ styles.endFooter, { width } ]}>
          <Text style={ styles.endFooterText}>·</Text>
        </View>
      );
    }

    return (
      <View style={[ styles.loadingFooter, { width, height: height / 2} ]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  render() {
    // TODO: Need to figure out a more precise number for
    // onEndReachedThreshold, perhaps based on the size of the screen and the
    // article cards?
    return (
      <SafeAreaView>
        { !this.state.loading ? (
          <Animated.FlatList
            { ...this.props }
            ref={ this.flatList }
            data={ this.props.articleList.list }
            keyExtractor={ (item, index) => item }
            renderItem={ ({item}) => this._renderArticle(item) }
            initialNumToRender={ this.props.perPage }
            refreshing={ this.state.refreshing }
            onRefresh={ this._onRefresh.bind(this) }
            onEndReached={ this._onEndReached.bind(this) }
            onEndReachedThreshold={ 0.75 }
            onViewableItemsChanged={ this._onViewableItemsChanged }
            onScrollToIndexFailed={ this._onScrollToIndexFailed.bind(this) }
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            ListFooterComponent={ this._renderFooter.bind(this) }
          />
        ) : (
          <>
            <Text style={ styles.loadingText }>Loading news...</Text>
            <ActivityIndicator size="large" />
          </>
        )}
      </SafeAreaView>
    );
  }
}


// Doesn't need any props from the global state (it takes the array of
// article IDs in ownProps) but does need dispatch
function mapStateToProps(state, ownProps) {
  return {
    articleList: state.articles.articleLists[ownProps.listName]
  };
}

function mapDispatchToProps(dispatch, ownProps) {
  // Curry the ArticleList's listName into the action creators
  const { listName } = ownProps;
  return {
    newArticles: (articles, articleInteractions, sources) => {
      dispatch(articleActions.newArticles(
        listName, articles, articleInteractions, sources
      ))
    },
    setCurrentArticle: (current) => {
      dispatch(articleActions.setCurrentArticle(listName, current))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(ArticlesList);


const styles = StyleSheet.create({
  loadingText: {
    alignSelf: 'center'
  },
  loadingFooter: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: '#f2f2f2',
    marginTop: 10,
    marginBottom: 10
  },
  endFooter: {
    height: 20,
    alignItems: 'center'
  },
  endFooterText: {
    color: 'black',
    fontWeight: 'bold'
  }
});
