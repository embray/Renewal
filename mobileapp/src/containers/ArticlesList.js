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
import renewalAPI from '../api';
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
      initialScroll: true,
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
            animated: true
          });
          clearInterval(this.scrollToInterval);
        }
      }, 1000);
      this.setState({ loading: false });
    } else {
      this.setState({ initialScroll: false });
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
    // TODO: It might make more sense if the API request were actually moved
    // into the async action creator
    const fetch = renewalAPI[listName].bind(renewalAPI);
    const response = await fetch(fetchParams);

    if (!response.error) {
      // TODO: Do something on error?  Fail quietly?
      if (old) {
        this.props.oldArticles(response);
      } else {
        this.props.newArticles(response);
      }
    }

    this.setState((prevState) => ({
      refreshing: false,
      showRefreshHint: false,
      loading: false,
      loadingMore: false,
      endOfData: (this.props.infiniteScroll ?
        (old && (response.error || response.length == 0)) : true)
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
    console.log(`viewable items changed; viewableItems: ${JSON.stringify(viewableItems)}; changed: ${JSON.stringify(changed)}`);
    if (viewableItems.length) {
      let current = viewableItems[0].index;
      if (this.state.initialScroll) {
        // When the list first renders we try to scroll to the last viewed
        // article; during this initial scroll the currently viewed item
        // can jump around a bit triggering onViewableItemsChanged, and we
        // don't want to trigger the setCurrentArticle action during this
        // initial scroll.
        if (current == this.props.articleList.current) {
          this.setState({ initialScroll: false });
        }
      } else {
        this.props.setCurrentArticle(current);
        if (current == 0 && current != this.props.articleList.current) {
          this.setState({ showRefreshHint: true });
        }
      }
    }
  }

  _onScrollToIndexFailed(error) {
    console.log(`scroll to index failed: ${JSON.stringify(error)}`);
    if (error.averageItemLength == 0) {
      // Hasn't finished dynamic layout; try the scrollToIndex again
      setTimeout(() => {
        if (this.flatList.current) {
          this.flatList.current.getNode().scrollToIndex({
            index: error.index,
            viewPosition: 0.5,
            animated: true
          });
        }
      }, 250);
    } else {
      this.flatList.current.getNode().scrollToOffset({
        offset: error.averageItemLength * error.index,
        animated: true
      });
    }
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
    const numToRender = Math.max(this.props.perPage,
                                 this.props.articleList.current + 1);
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
          initialNumToRender={ numToRender }
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


function mapStateToProps(state, ownProps) {
  return {
    articleList: state.articles.articleLists[ownProps.listName],
    idToken: state.account.idToken
  };
}

function mapDispatchToProps(dispatch, ownProps) {
  // Curry the ArticleList's listName into the action creators
  const { listName } = ownProps;
  return {
    newArticles: (articles) => {
      dispatch(articleActions.newArticles(
        { listName, articles }
      ))
    },
    oldArticles: (articles) => {
      dispatch(articleActions.oldArticles(
        { listName, articles }
      ))
    },
    setCurrentArticle: (current) => {
      dispatch(articleActions.setCurrentArticle({ listName, current }))
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
