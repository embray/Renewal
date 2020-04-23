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

import Article from '../components/Article';


// TODO: Originally this data include the user's saved articles and rejected
// articles in the same data structure; this excludes them for now because
// the dummy data is not user-specific.  We might later include this
// either via a separate API request, or part of the same request with some
// kind of graphql query; for debugging we can load these randomly or according
// to some pattern.
// TODO: Later these will be loaded conditionally depending on whether we're in
// debug mode (if this is even possible).
const DEBUG_ARTICLE_DATA = _fake_article_statuses(
  require('../data/debug_articles.json'));
const DEBUG_SOURCE_DATA = require('../data/debug_sources.json');


function _fake_article_statuses(articles) {
  // Here we cycle through saved statuses and ratings for each debug article
  var _saved = false;
  var _rating = 0;
  articles.forEach((article) => {
    article.saved = _saved;
    article.rating = _rating;
    _saved = !_saved;
    _rating = _rating == 1 ? -1 : _rating + 1;
  });
  return articles;
}


// TODO: Move this to a utilities module.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export default class ArticlesList extends Component {
  static defaultProps = {
    perPage: 5
  }

  constructor(props) {
    super(props);

    const {height, width} = Dimensions.get('window');

    this.state = {
      refreshing: false,
      loading: true,
      loadingMore: false,
      endOfData: false,
      articlesList: [],
      page: 0,

      // TODO: old state variables that may or may not be used
      height : height > width ? height : width,
      width : width > height ? width : height,
      displayDataSource : null,
      newscastSavedState : null,
    }

    // NOTE: Not part of the state; only the list of article keys is
    // in the state.  For now we key articles on their URLs but later
    // we'll use something more efficient (i.e. an ID number)
    this.articles = new Map();
  }

  async componentDidMount() {
    await this._fetchArticles();
  }

  // TODO: Eventually this will use the API for the backend to fetch
  // articles, and may include a built-in layer for article caching,
  // as well as the fallback that loads demo data in debug mode.
  async _fetchArticles() {
    const { perPage } = this.props;
    const { page } = this.state;

    console.log(`fetching articles page ${page} with ${perPage} per page`);
    // Simulate data being refreshed
    // TODO: Only do this in debug mode--simul
    await sleep(50);

    // TODO: Here we would actually fetch the data from the backend
    const response = DEBUG_ARTICLE_DATA.slice(page * perPage,
                                              (page + 1) * perPage);
    const newArticles = [];

    // TODO: This line is debug only to test refreshing
    // to simulate getting new articles.
    if (page == 0) {
      this.articles.clear();
    }

    for (let article of response) {
      if (!this.articles.has(article.url)) {
        newArticles.push(article.url);
        this.articles.set(article.url, article);
      }
    }

    this.setState((prevState) => ({
      articlesList: (prevState.page === 0 ?
        newArticles : [...prevState.articlesList, ...newArticles]),
      refreshing: false,
      loading: false,
      loadingMore: false,
      endOfData: (response.length === 0)
    }));
  }

  _renderArticle(url, index, nativeEvent) {
    const article = this.articles.get(url);
    // TODO: Need a proper way for loading sources alongside articles.
    // Either they would be fetched simulateneously with articles or cached separately
    // somehow.  If nothing else we need to cache source logos somewhere or else we'd
    // have to load them over and over again.
    const source = DEBUG_SOURCE_DATA[article.source];
    // TODO: Load article images asynchronously outside the main component rendering;
    // makes articles load slowly otherwise.
    return (<Article article={ article } source={ source } />);
  }

  _onRefresh() {
    console.log('refreshing');
    this.setState(
      { page: 0, refreshing: true },
      this._fetchArticles
    );
  }

  _onEndReached(info) {
    console.log(`loading more: ${JSON.stringify(info)}`);
    this.setState((prevState) => ({
      page: prevState.page + 1,
      loadingMore: true
    }), () => { this._fetchArticles() });
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
    // onEndReachedThreshold, perhaps based on the size of the screen
    // and the article cards?
    return (
      <SafeAreaView style={ styles.container }>
        { !this.state.loading ? (
          <Animated.FlatList
            { ...this.props }
            data={ this.state.articlesList }
            keyExtractor={ (item, index) => item }
            renderItem={ ({item}) => this._renderArticle(item) }
            initialNumToRender={ this.props.perPage }
            refreshing={ this.state.refreshing }
            onRefresh={ this._onRefresh.bind(this) }
            onEndReached={ this._onEndReached.bind(this) }
            onEndReachedThreshold={ 0.75 }
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    alignSelf: 'center'
  },
  loadingFooter: {
    position: 'relative',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: '#f2f2f2',
    marginTop: 10,
    marginBottom: 10
  },
  endFooter: {
    position: 'relative',
    height: 20,
    alignItems: 'center'
  },
  endFooterText: {
    color: 'black',
    fontWeight: 'bold'
  }
});
