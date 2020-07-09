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
import RenewalAPI from '../api';
import { Article } from '../components/Article';
import TickMessage from '../components/TickMessage';


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

    this.api = new RenewalAPI();

    this.flatList = React.createRef();

    // Mysteriously, this is need just for this event handler, otherwise
    // an error results every time the component's state changes; see
    // https://github.com/facebook/react-native/issues/17408
    this._onViewableItemsChanged = this._onViewableItemsChanged.bind(this);

    // This count is increased very time onScrollToIndexFailed is triggered
    // which can happen sometimes if the article list is long and it takes
    // multiple attempts to scroll to last article.
    // By keeping count we can set a threshold on retries so that it doesn't
    // go into an infinite loop.
    this.scrollToIndexErrors = 0;
  }

  async componentDidMount() {
    if (this.props.articleList.list.length > 0) {
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
      this.setState({ loading: false });
    } else {
      this._fetchArticles();
    }
  }

  async _fetchArticles(old = false) {
    const { listName, articleList, perPage } = this.props;
    const list = articleList.list;
    const fetchParams = { limit: perPage };

    if (old) {
      fetchParams.max_id = list[list.length - 1];
    } else {
      fetchParams.since_id = list[0];
    }

    // NOTE: The API has an articles fetch method corresponding with the
    // name of each article list
    const fetch = this.api[listName].bind(this.api);
    const response = await fetch(fetchParams);

    if (old) {
      this.props.oldArticles(
        response.articles,
        response.sources
      );
    } else {
      this.props.newArticles(
        response.articles,
        response.sources
      );
    }

    this.setState((prevState) => ({
      refreshing: false,
      showRefreshHint: false,
      loading: false,
      loadingMore: false,
      endOfData: (this.props.infiniteScroll ?
        (old && response.articles.length == 0) : true)
    }));
  }

  _renderArticle(articleId, index, nativeEvent) {
    // TODO: Load article images asynchronously outside the main component rendering;
    // makes articles load slowly otherwise.
    return (<Article articleId={ articleId } />);
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
    if (this.state.loading) {
      return null;
    }
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
    return (
      <SafeAreaView>
        <Animated.FlatList
          { ...this.props }
          ref={ this.flatList }
          data={ this.props.articleList.list }
          // toString() since the items are article_ids (numbers) and
          // the key is expected to be a string
          keyExtractor={ (item, index) => item.toString() }
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
