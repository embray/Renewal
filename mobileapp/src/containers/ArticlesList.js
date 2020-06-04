import { Icon, Text, View } from 'native-base';
import React, { Component } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { connect } from 'react-redux';

import { articleActions } from '../actions';
import { Article } from '../components/Article';
import TickMessage from '../components/TickMessage';
import { sleep } from '../utils';


// TODO: These will probably be moved again elsewhere once the backend API is
// in-place; then the backend API would handle debug simulations.
// Sort newest first
const DEBUG_ARTICLES = require('../data/debug_articles.json');
const DEBUG_SOURCES = require('../data/debug_sources.json');
const DEBUG_DATA_SOURCE = {
  articles: Object.fromEntries(DEBUG_ARTICLES.map((a) => [a.url, a])),
  articleLists: {
    recommendations: DEBUG_ARTICLES.sort((a, b) => {
      if (a.date < b.date) {
        return -1;
      } else if (a.date > b.date) {
        return 1;
      } else {
        return 0;
      }
    }).map((a) => a.url),
    bookmarks : []
  },
  articleInteractions: [],
  sources: DEBUG_SOURCES
};

// Fetch fake debug data
async function _debugFetch(listName, latestArticleId, perPage) {
  // TODO: Here we would actually fetch the data from the backend
  let articles = DEBUG_DATA_SOURCE.articleLists[listName];

  let start = (latestArticleId ?
    articles.findIndex(id => id == latestArticleId) + 1 : 0);
  let end = start + perPage;

  articles = articles.slice(start, end);
  articles = articles.map((id) => DEBUG_DATA_SOURCE.articles[id])

  const interactions = {};
  const sources = {}

  // Article fetches include their associated sources and interactions
  articles.forEach((article) => {
    interactions[article.url] = DEBUG_DATA_SOURCE.articleInteractions[article.url];
    sources[article.source] = DEBUG_DATA_SOURCE.sources[article.source];
  });

  // Simulate loading time;
  await sleep(500);

  return { articles, interactions, sources };
}


class ArticlesList extends Component {
  static defaultProps = {
    articleList: { list: {}, current: 0 },
    perPage: 10,
    infiniteScroll: false
  }

  constructor(props) {
    super(props);

    this.state = {
      refreshing: false,
      showRefreshHint: false,
      loading: true,
      loadingMore: false,
      // If infiniteScrolling is enabled then by default we are not
      // at the end of the data
      endOfData: !this.props.infiniteScroll
    }

    this.flatList = React.createRef();

    // Mysteriously, this is need just for this event handler, otherwise
    // an error results every time the component's state changes; see
    // https://github.com/facebook/react-native/issues/17408
    this._onViewableItemsChanged = this._onViewableItemsChanged.bind(this);
  }

  async componentDidMount() {
    if (this.props.articleList.list.length == 0) {
      this._fetchArticles();
    } else {
      // If the list is empty this will try to scroll to a non-existent
      // item resulting in a warning.
      // Sometimes this can fail if the flatList reference has not been
      // assigned yet, so we put it on a timer
      this.scrollToInterval = setInterval(() => {
        if (this.flatList.current) {
          this.flatList.current.getNode().scrollToIndex({
            index: this.props.articleList.current || 0,
            viewPosition: 0.5,
            animated: false
          });
          clearInterval(this.scrollToInterval);
        }
      }, 50);
    }
  }

  // TODO: Eventually this will use the API for the backend to fetch
  // articles, and may include a built-in layer for article caching,
  // as well as the fallback that loads demo data in debug mode.
  // If old = true fetch old articles (for infinite scrolling) rather
  // than newer articles (refreshing)
  async _fetchArticles(old = false) {
    const { listName, articleList, perPage } = this.props;
    const list = articleList.list;
    if (old) {
      var latestArticleId = list[list.length - 1];
    } else {
      var latestArticleId = list[0];
    }


    // TODO: Here we would actually fetch the data from the backend
    // Depending on whether old or new we might have an argument
    // specifying prior/since
    const response = await _debugFetch(listName, latestArticleId, perPage);

    if (old) {
      this.props.oldArticles(
        response.articles,
        response.interactions,
        response.sources
      );
    } else {
      this.props.newArticles(
        response.articles,
        response.interactions,
        response.sources
      );
    }

    this.setState((prevState) => ({
      refreshing: false,
      showRefreshHint: false,
      loading: false,
      loadingMore: false,
      endOfData: (this.props.infiniteScroll ? true :
                  (old && response.articles.length == 0))
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
      { refreshing: true, loadingMore: true },
      this._fetchArticles
    );
  }

  _onEndReached(info) {
    if (this.props.infiniteScroll) {
      console.log(`loading more: ${JSON.stringify(info)}`);
      this.setState((prevState) => ({
        loadingMore: true
      }), () => { this._fetchArticles(true) });
    }
  }

  _onViewableItemsChanged({ viewableItems, changed }) {
    // The top-most viewable item is set as the current
    // item in this ArticlesList
    // NOTE: Sometimes when deleting items (such as when removing
    // bookmarks from the bookmarks view) it's possible to get in
    // a situation where no items are viewable (i.e. neither is
    // 50% on screen).  In this case just ignore the change
    if (viewableItems.length) {
      let current = viewableItems[0].index;
      this.props.setCurrentArticle(current);
      if (current == 0 && current != this.props.articleList.current) {
        this.setState({ showRefreshHint: true });
      }
    }
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

  _renderListEmpty() {
    if (this.state.loading) {
      return (
        <>
          <ActivityIndicator size="large" />
          <TickMessage style={ styles.loadingText }
            message={ 'Loading ' + this.props.listName }
          />
        </>
      );
    } else {
      return null;
    }
  }

  _renderHeader() {
    if (this.state.showRefreshHint) {
      // Don't show by default, only display when scrolling to the top
      return (
        <View style={ styles.refreshHint }>
          <Icon name='md-arrow-dropdown' />
          <Text note>pull down to refresh</Text>
          <Icon name='md-arrow-dropdown' />
        </View>
      );
    } else {
      return null;
    }
  }

  _renderFooter() {
    const { height, width } = Dimensions.get('window');
    if (this.state.endOfData) {
      return (
        <View style={[ styles.endFooter, { width } ]}>
          <Text style={ styles.endFooterText}>·</Text>
        </View>
      );
    } else {
      return (
        <View style={[ styles.loadingFooter, { width, height: height / 2} ]}>
          <ActivityIndicator animating size="large" />
        </View>
      )
    }
  }

  render() {
    // TODO: Need to figure out a more precise number for
    // onEndReachedThreshold, perhaps based on the size of the screen and the
    // article cards?
    console.log(this.state.loading);
    return (
      <SafeAreaView>
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
          ListEmptyComponent={ this._renderListEmpty.bind(this) }
          ListHeaderComponent={ this._renderHeader.bind(this) }
          ListFooterComponent={ this._renderFooter.bind(this) }
        />
      </SafeAreaView>
    );
  }
}


// Doesn't need any props from the global state (it takes the array of
// article IDs in ownProps) but does need dispatch
function mapStateToProps(state, ownProps) {
  if (__DEV__) {
    // TODO: Debug only--remove when we fix the debug article fetching
    // Fill the debug article interactions and bookmarks from the state.
    const interactions = state.articles.articleInteractions;
    const bookmarksList = state.articles.articleLists.bookmarks.list;

    Object.assign(DEBUG_DATA_SOURCE.articleInteractions, interactions);
    DEBUG_DATA_SOURCE.articleLists.bookmarks = [ ...bookmarksList ];
  }

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
    oldArticles: (articles, articleInteractions, sources) => {
      dispatch(articleActions.oldArticles(
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
  refreshHint: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 20
  },
  loadingText: {
    alignSelf: 'center'
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
