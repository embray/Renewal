import * as SQLite from 'expo-sqlite';
import { Icon } from 'native-base';
import React, { Component } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PixelRatio,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const screen = Dimensions.get('window');
const db = SQLite.openDatabase('db.db');

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
    //await this._initSqlTable();
    await this._fetchArticles();

    // TODO: ignore the rest of this function for now until we get the basics
    // working.
    return;

    // TODO: Need to figure out what's going on with this sqlite storage
    // and if we still have a use for it or not.
    await this._updateSelectedItems()
    try {
      AsyncStorage.getItem('token', (err, result)=>{
       this.setState({token: result});
       //console.log("mon token de merde "+result)
       })
     } catch (error) {
       // Error saving data
       //console.log("oh mon dieu le token a disparu")
     }
    this.fetchEvent("launch",null)
    Dimensions.addEventListener('change', () => {
      //var {height, width} = Dimensions.get('window');
      var deviceHeight = Dimensions.get('window').height;
      var deviceWidth = Dimensions.get('window').width;
      this.setState({
          orientation: deviceHeight > deviceWidth ? 'portrait' : 'landscape',
          height : deviceHeight > deviceWidth ? deviceHeight : deviceWidth,
          width : deviceWidth > deviceHeight ? deviceWidth : deviceHeight,

      });
    });
  }

  fetchEvent = async (something, someData)=>{
    return someData === null ?
      console.log("[{Event : "+something+", timestamp :"+Date.now()+"}]")
      :
      console.log("[{Event : "+something+", timestamp :"+Date.now()+","+someData+"}]")
  }

  executeSql = async (sql, params = []) => {
    return new Promise((resolve, reject) => db.transaction(tx => {
      tx.executeSql(sql, params, (_, { rows }) => resolve(rows._array), reject)
    }))
  }

  _initSqlTable = async () => {
    //await this.executeSql('DROP TABLE newscastSaved;');
    //await this.executeSql('DROP TABLE newscasts;');
    await this.executeSql('create table if not exists newscastSaved (id integer primary key , done int, title text,image text,url text);');
    //await this.executeSql('create table if not exists newscasts ( id integer primary key , title text not null,image text not null,url text not null,isSaved integer default 0, isRejected integer default 0 );');
  }

  _updateSelectedItems = async()=>{
    //console.log("update")
    await this.executeSql('select * from newscastSaved', []).then(newscastSavedState => this.setState({newscastSavedState})  );
    await this._checkSavedItems();
  }

  _downloadSqlTableSaved= async () => {
    await this.executeSql('select * from newscastSaved', []).then(newscastSavedState => this.setState({newscastSavedState})  );
  }

  _checkSavedItems(){
    let display = this.state.displayDataSource;
    if(this.state.newscastSavedState != null){
      //console.log(this.state.newscastSavedState[0])
      for(let j=0;this.state.displayDataSource.length!=j;j++){
        //console.log(this.state.newscastSavedState[i].url)
        display[j].saved = false;
        for(let i=0;this.state.newscastSavedState.length !=i;i++){
          //console.log(this.state.displayDataSource[j].url)
          if(this.state.newscastSavedState[i].url === this.state.displayDataSource[j].url ){
            //console.log("it's match!")
            display[j].saved = true;

          }
        }
      }
      this.setState({
        displayDataSource : display
      })
    }
  }

  _onPressItem(item) {
    console.log(item);
    this.fetchEvent("pressOnItem", "itemClickedTitle : "+item.title+" itemClickedUrl : "+item.url);
    this.props.navigation.navigate('Article', item);
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

  _toggleFav = async({ item, index })=>{

    let display = this.state.displayDataSource;
    display[index].saved = !display[index].saved
    this.setState({
      displayDataSource : display
    })

    display[index].saved ?
      await this.executeSql('insert into newscastSaved (done, title, image, url ) values (0, ?, ?, ?)', [display[index].title, display[index].image, display[index].url])
      :
      await this.executeSql('delete from newscastSaved  where title = ?', [display[index].title])
    display[index].saved ?
      this.fetchEvent('savedNews'," title : "+display[index].title+", url : "+display[index].url)
      :
      this.fetchEvent('unsavedNews'," title : "+display[index].title+", url : "+display[index].url)

  }
  _toggleReject = async({ item, index })=>{
    let display = this.state.displayDataSource;
    display[index].rating = 0
    this.setState({
      displayDataSource : display
    })
    display[index].rating == -1 ?
      this.fetchEvent('rejectNews'," title : "+display[index].title+", url : "+display[index].url)
      :
      this.fetchEvent('unrejectNews'," title : "+display[index].title+", url : "+display[index].url)
  }

  _renderArticle(url, index, nativeEvent) {
    const article = this.articles.get(url);
    // TODO: Replace this with an article card component
    // TODO: Load article images asynchronously outside the main component rendering;
    // makes articles load slowly otherwise.
    return (
      <View onPressItem={this._onPressItem}>
        <View style={{flex:1, backgroundColor: article.rating == -1 ? "#484848" : "#fff"}}>
          <TouchableOpacity onPress={article.rating == -1 ? null : this._onPressItem.bind(this, article)} >
            <Image source = {{ uri: article.image }}
              style={{
                //height: this.state.height / 5,
                height : PixelRatio.roundToNearestPixel(70),//94.5,//135,
                height : Platform.OS === 'ios' ? PixelRatio.roundToNearestPixel(140/PixelRatio.get()) : PixelRatio.roundToNearestPixel(70),
                opacity: article.rating == -1 ? 0.3:1,
                margin: 1,
                borderRadius : 7,
                justifyContent: 'center',
                alignItems: 'center',

              }}//style={styles.imageView}
              onPress={this._onPressItem.bind(this, article)
              //onPress={this._onScrollItem(nativeEvent)

              }
              progressiveRenderingEnabled
               />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width:'100%',
                        //height: this.state.height / 17

                        height : Platform.OS === 'ios' ? PixelRatio.roundToNearestPixel(100/PixelRatio.get()) : PixelRatio.roundToNearestPixel(50)
          }}>
            <Icon name="md-download" style={styles.iconStyle}    onPress={()=>article.rating == -1 ? console.log("error") :this._toggleFav( { article, index } )} />
            <Text numberOfLines={2} style={styles.textView} onPress={article.rating == -1 ? null : this._onPressItem.bind(this, article)}>{article.title}</Text>
            <Icon name={article.rating == -1 ? "md-checkmark" : "md-close"}  style={{color: 'black', width :'10%', paddingLeft: '3%', alignItems: 'center', justifyContent: 'center',color: article.rating == -1 ? "green" :"red"}}   onPress={()=>this._toggleReject( { article, index } )} />
          </View>
        </View>
      </View>
    );
  }

  // TODO: Decide how to render articles in landscape mode.
  renderItemLandscape=({item, index, nativeEvent}) => (
    <View  onPressItem={this._onPressItem}  >
      <View style={{flex:1, flexDirection: 'row', backgroundColor: item.rating == -1 ? "#484848" : "#fff"}}>
        <TouchableOpacity onPress={item.rating == -1 ? null : this._onPressItem.bind(this, item)} >
          <Image source = {{ uri: item.image }}
            style={{
              //height: this.state.height / 8,
              height: 90,
              width : this.state.width/3,
              opacity: item.rating == -1 ? 0.3:1,
              margin: 1,
              borderRadius : 7,
              justifyContent: 'center',
              alignItems: 'center',

            }}//style={styles.imageView}
            onPress={this._onPressItem.bind(this, item)
            //onPress={this._onScrollItem(nativeEvent)

            }
             />
        </TouchableOpacity>
        <View style={{width:'100%', flexDirection : 'row',  height:90//this.state.height / 8
          }}>
          <Text numberOfLines={3} style={styles.textViewLandscape} onPress={item.rating == -1 ? null : this._onPressItem.bind(this, item)}>{item.title}</Text>
          <View style={{alignItems: 'center', justifyContent: 'center', flexDirection : 'column'}} >
            <Icon name="md-download" onPress={()=>item.rating == -1 ? console.log("error") :this._toggleFav( { item, index } )} />
            <Icon name={item.rating == -1 ? "md-checkmark" :"md-close"}  style={{color: 'black', alignItems: 'center', justifyContent: 'center',color: item.rating == -1 ? "green" :"red"}}   onPress={()=>this._toggleReject( { item, index } )} />
          </View>
        </View>
      </View>
    </View>
  )

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
  },
  imageView: {
    height: screen.height / 5,

    margin: 7,
    borderRadius : 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineContainer: {
    backgroundColor: '#b52424',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width : screen.width,
    position: 'absolute',
    top: 30
  },
  offlineText: { color: '#fff' },
  textView: {
    textAlignVertical:'center',
    textAlign: 'center',
    padding:10,
    color: '#000',
    width : '80%',
    margin:0,
    padding:0

  },
  textViewLandscape: {
      //width: screen.height < screen.width ?  screen.width/1.6 : screen.height/2,
      width: '63%',
      textAlignVertical:'center',
      alignItems: 'center',
      textAlign: 'left',
      //textAlign: 'left',
      //paddingTop:screen.height / 20,
      paddingTop: 30,
      //paddingBottom : 30,
      paddingLeft : 10,
      paddingRight : 10,
      //padding : 30,

      color: '#000',
     // backgroundColor : 'yellow'

  },
  iconStyle:{
    color: 'black',
    width :'10%',
    paddingLeft: '3%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop : 0,
    paddingBottom : 0
  }
});
