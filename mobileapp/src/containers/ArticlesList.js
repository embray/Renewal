import Expo, { AppLoading } from 'expo';
import * as SQLite from 'expo-sqlite';
import React, { Component } from 'react';
import {
  StyleSheet,
  Platform,
  Dimensions,
  PixelRatio,
  View,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Container, Header, Title, Content, Footer, FooterTab, Button, Left, Right, Body, Text, List, ListItem, Icon } from 'native-base';
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


export default class ArticlesList extends Component {
  constructor(props) {
    super(props);
    var {height, width} = Dimensions.get('window');
      this.state = {
        height : screen.height > screen.width ? screen.height : screen.width,
        width : screen.width > screen.height ? screen.width : screen.height,
        isLoading: true,
        globalDataSource : null,
        displayDataSource : null,
        page : 1,
        nbItemPerPage : 5,
        newscastSavedState : null,
        refreshing: false,
        token : null,
        sizeImageRatio : 210,
        sizeViewRatio : 150,
        ratio : PixelRatio.get(),
        orientation : height > width ? 'portrait' : 'landscape'
      }
  }

  async componentDidMount(){
    await this._initSqlTable();
    await this.webCall();

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
      console.log(this.state.orientation);
    });
    //console.log("pixel ratio : "+PixelRatio.get())
    //console.log("pixel round : "+PixelRatio.roundToNearestPixel(100))
    //this.getMoviesFromApi();
    //this.getNewsFromApi();
   // await this._generateDisplayItems()

  }

  fetchEvent =  async (something, someData)=>{
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
  _generateDisplayItems(){
    console.log("display")
    let pack = []
    let i = this.state.displayDataSource === null ? 0 : this.state.displayDataSource.length;
    while(i != this.state.nbItemPerPage*this.state.page){
      console.log(this.state.globalDataSource[i])
    }
  }

  _onPressItem (item) {
    console.log(item);
    this.fetchEvent("pressOnItem", "itemClickedTitle : "+item.title+" itemClickedUrl : "+item.url);
    this.props.navigation.navigate('Article', item);
  }

  GetItem (flower_name) {
    Alert.alert(flower_name);
  }

  FlatListItemSeparator = () => {
    return (
      <View
        style={{
          height: .5,
          width: "100%",
          backgroundColor: "#000",
        }}
      />
    );
  }

  async webCall() {
    // TODO: This had all kinds of sample calls originally.
    // Eventually we will replace this so that it only tries to request from
    // our backend, but in DEBUG mode it can also use the dummy data if the
    // backend is not configured.
    // Furthermore, this should be replaced with an API abstractio of the
    // backend.
    //return fetch('https://129.175.22.71:4243/url/bulk/100')
    //return fetch('https://api.renewal-research.com/news/url/bulk/99')
    //return fetch('https://facebook.github.io/react-native/movies.json')
    //return fetch('https://reactnativecode.000webhostapp.com/FlowersList.php')
    //  .then((response) => response.json())
    //  .then((responseJson) => {
    // TODO: Clean up this entire mess.
        this.setState({
          //isLoading: false,
          //dataSource: responseJson,
          // NOTE: The original demo news list was actually split into two
          // separate lists; now we just put it in one list but take a slice;
          // originally the first list happened to contain 17 items for some
          // reason.
          globalDataSource : DEBUG_ARTICLE_DATA.slice(0, 17)
        }, function() {
             // In this block you can do something with new state.
             console.log(this.state.dataSource)
            let pack = []
            let i = this.state.displayDataSource === null ? 0 : this.state.displayDataSource.length;
            while(i != this.state.nbItemPerPage*this.state.page){
              //console.log(i)
              //console.log(this.state.globalDataSource[i])
              i++;
              pack.push(this.state.globalDataSource[i])
            }
            this.setState({
              isLoading: false,
              page : this.state.page+1,
              displayDataSource : pack
            })
        });
      //})
      //.catch((error) => {
      //  console.error(error);
      //});
  }
  /*_ItemLoadMore = () => {
    let pack = this.state.displayDataSource;
    let i = this.state.displayDataSource === null ? 0 : this.state.displayDataSource.length;
    //if(this.state.displayDataSource[this.state.displayDataSource.length]!=this.state.globalDataSource[this.state.globalDataSource.length] || this.state.nbItemPerPage*this.state.page < this.state.globalDataSource.length){
    if(this.state.nbItemPerPage*this.state.page < this.state.globalDataSource.length){
      while(i != this.state.nbItemPerPage*this.state.page ){
        //console.log(i)
        //console.log(this.state.globalDataSource[i])
        i++;
        pack.push(this.state.globalDataSource[i])
      }
      this.setState({
        page : this.state.page+1,
        displayDataSource : pack
      })
    }
    this._updateSelectedItems()
  }*/
  _ItemLoadMore = () => {
    let pack = this.state.displayDataSource;
    let i = this.state.displayDataSource === null ? 0 : this.state.displayDataSource.length;
    let j = this.state.nbItemPerPage*this.state.page > this.state.globalDataSource.length ? this.state.globalDataSource.length : this.state.nbItemPerPage*this.state.page;
    while(i!=j){
      pack.push(this.state.globalDataSource[i])
      i++;
    }
    console.log(pack.length)
    console.log(this.state.globalDataSource.length)
    if(pack.length > this.state.globalDataSource.length/2){
      console.log("################################################ ok ####################################");
      let global = this.state.globalDataSource;
      // NOTE: Originally this was a separate list; now both
      // lists are combined into one; the original first list
      // had 17 items for some reason...
      let more = DEBUG_ARTICLE_DATA.slice(17);
      for (let i=0; i != more.length; i++) {
        console.log(more[i])
        global.push(more[i]);
      }
      this.setState({
        globalDataSource : global
      })
    }
    this.setState({
      page : this.state.page+1,
      displayDataSource : pack
    })
    this._updateSelectedItems()
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
  async getMoviesFromApi() {
    let response = null;
    let responseJson = null;
    try {
      response = await fetch(
        'https://facebook.github.io/react-native/movies.json'
        );
        responseJson = await response.json();
        console.log(responseJson)
        return responseJson.movies;
    } catch (error) {
      console.error(error);
    }
  }
    async getNewsFromApi() {
        let response = null;
        let responseJson = null;
        try {
            response = await fetch(
            `https://129.175.22.71:4243/news/url/bulk/100`
        );
        responseJson = await response.json();
        console.log(responseJson)
        return responseJson;
        } catch (error) {
        console.error(error);
        }
    }

  renderItem=({item, index, nativeEvent}) => (
    <View  onPressItem={this._onPressItem}  >
      <View style={{flex:1, backgroundColor: item.rating == -1 ? "#484848" : "#fff"}}>
        <TouchableOpacity onPress={item.rating == -1 ? console.log("item rejected") : this._onPressItem.bind(this, item)} >
          <Image source = {{ uri: item.image }}
            style={{
              //height: this.state.height / 5,
              height : PixelRatio.roundToNearestPixel(70),//94.5,//135,
              height : Platform.OS === 'ios' ? PixelRatio.roundToNearestPixel(140/PixelRatio.get()) : PixelRatio.roundToNearestPixel(70),
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
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width:'100%',
                      //height: this.state.height / 17

                      height : Platform.OS === 'ios' ? PixelRatio.roundToNearestPixel(100/PixelRatio.get()) : PixelRatio.roundToNearestPixel(50)
        }}>
          <Icon name="md-download" style={styles.iconStyle}    onPress={()=>item.rating == -1 ? console.log("error") :this._toggleFav( { item, index } )} />
          <Text numberOfLines={2} style={styles.textView} onPress={item.rating == -1 ? console.log("item rejected") :this._onPressItem.bind(this, item)}>{item.title}</Text>
          <Icon name={item.rating == -1 ? "md-checkmark" : "md-close"}  style={{color: 'black', width :'10%', paddingLeft: '3%', alignItems: 'center', justifyContent: 'center',color: item.rating == -1 ? "green" :"red"}}   onPress={()=>this._toggleReject( { item, index } )} />
        </View>
      </View>
    </View>
  )
  renderItemLandscape=({item, index, nativeEvent}) => (
    <View  onPressItem={this._onPressItem}  >
      <View style={{flex:1, flexDirection: 'row', backgroundColor: item.rating == -1 ? "#484848" : "#fff"}}>
        <TouchableOpacity onPress={item.rating == -1 ? console.log("item rejected") : this._onPressItem.bind(this, item)} >
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
          <Text numberOfLines={3} style={styles.textViewLandscape} onPress={item.rating == -1 ? console.log("item rejected") :this._onPressItem.bind(this, item)}>{item.title}</Text>
          <View style={{alignItems: 'center', justifyContent: 'center', flexDirection : 'column'}} >
            <Icon name="md-download" onPress={()=>item.rating == -1 ? console.log("error") :this._toggleFav( { item, index } )} />
            <Icon name={item.rating == -1 ? "md-checkmark" :"md-close"}  style={{color: 'black', alignItems: 'center', justifyContent: 'center',color: item.rating == -1 ? "green" :"red"}}   onPress={()=>this._toggleReject( { item, index } )} />
          </View>
        </View>
      </View>
    </View>
  )
  getItemLayout= (data, index) => (
    {length: (screen.height / 17) + (screen.height / 5), offset: (screen.height / 17) + (screen.height / 5) * index, index}
  );
  percentageCalculator= async(sizeOneNews, position)=>{
    let currentItemIndex = 0;
    if(sizeOneNews > position){
      currentItemIndex = 0;
    }else{
      currentItemIndex = (position/sizeOneNews+"").split('.')[0];
    }
    currentItemIndex++;
    console.log(currentItemIndex)
    let positionEndItem = currentItemIndex*sizeOneNews
    //console.log(sizeOneNews)
    //console.log(position)
    //console.log("##################")
    //console.log("positon end "+positionEndItem)
    //console.log(positionEndItem-position)
    let p = ((100*(positionEndItem-position))/sizeOneNews+"").split('.')[0]
    //console.log("percent top :"+p)
    currentItemIndex--;
    return {
        index : currentItemIndex,
        title : this.state.displayDataSource[currentItemIndex].title,
        url : this.state.displayDataSource[currentItemIndex].url,
        percent : p+"%"
      };
  }
  percentageCalculatorBottom= async(sizeOneNews, position, sizeGlobalDisplay)=>{
    if(position < sizeGlobalDisplay) {
      let currentItemIndex = (position/sizeOneNews+"").split('.')[0];

    let positionEndItem = currentItemIndex*sizeOneNews
    //console.log(sizeOneNews)=
    //console.log("##################")
    //console.log(position)
    //console.log("positon end "+positionEndItem)
    //console.log(position-positionEndItem)
    let p = ((100*(position-positionEndItem))/sizeOneNews+"").split('.')[0]
    //console.log("percent bottom :"+p)
    currentItemIndex++;
    currentItemIndex--;
    return {
        index : currentItemIndex,
        title : this.state.displayDataSource[currentItemIndex].title,
        url : this.state.displayDataSource[currentItemIndex].url,
        percent : p+"%"
      };
    }else{
      return null
    }

  }
  _onScrollItem = async (nativeEvent) => {
    // TODO: This appears to be a no-op.  Maybe it was an incomplete feature; I
    // don't know.
    //console.log("##### detect scroll item ####")
    const sizeGlobalDisplay = nativeEvent.contentSize.height;
    const displayLenght = this.state.displayDataSource.length;
    //let tailleItem =  (screen.height / 17) + (screen.height / 5) + .5 > sizeGlobalDisplay/displayLenght ? (screen.height / 17) + (screen.height / 5) + .5 : sizeGlobalDisplay/displayLenght;
    let tailleItem = sizeGlobalDisplay/displayLenght;
    const tailleEcran = nativeEvent.layoutMeasurement.height;
    //console.log("taille ecran"+ tailleEcran);
    //console.log("Taille item"+tailleItem);
    //console.log("NB items visible : "+tailleEcran/tailleItem)
    let paquet = [ ];
    const itemTop = await this.percentageCalculator(tailleItem, nativeEvent.contentOffset.y);
    paquet.push(itemTop)
    const itemBottom = await this.percentageCalculatorBottom(tailleItem, nativeEvent.contentOffset.y+tailleEcran,sizeGlobalDisplay);
    let i = await itemTop.index;
    let j = itemBottom === null ? this.state.displayDataSource.length : itemBottom.index;
    //console.log("j : "+j)
    i++;
    for(i; i<j;i++){
      paquet.push(
        {
          index : i,
          title : this.state.displayDataSource[i].title,
          url : this.state.displayDataSource[i].url,
          percentage : "100%"
        }
      )
    }
    paquet.push(itemBottom)

    console.log(paquet)
    //console.log(tailleEcran/tailleItem)

  }

  FlatListItemSeparator = () => {
      return (
        <View
          style={{
            height: .5,
            width: "100%",
            backgroundColor: "#000",
          }}
        />
      );
  }
  renderEmpty = () => {
    return (
      <View
        style={{
          paddingVertical: 20,
          borderTopWidth: 1,
          borderColor: "#CED0CE"
        }}
      >
        <ActivityIndicator animating size="large" />
      </View>
    );
  };
  renderFooter = () => {
    return (
      <View
        style={{
          paddingVertical: 20,
          borderTopWidth: 1,
          borderColor: "#CED0CE"
        }}
      >
        <ActivityIndicator animating size="large" />
      </View>
    );
  };
  async onRefresh() {
    await console.log('refreshing')
    await this.webCall();
  }
  render() {
    if (this.state.isLoading) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" />
        </View>
      );
    }


    return (


      <FlatList
          data={ this.state.displayDataSource }
          debug={this.state.debug}
          extraData={this.state}
          refreshing={this.state.isLoading}
          onRefresh={()=>this.onRefresh()}
          ListEmptyComponent={this.renderEmpty}
          ListFooterComponent={this.renderFooter}
          ItemSeparatorComponent = {this.FlatListItemSeparator}
          renderItem={({item, index, nativeEvent}) => this.state.orientation === 'portrait' ? this.renderItem({item, index, nativeEvent}) : this.renderItemLandscape({item, index, nativeEvent}) }
          initialNumToRender={5}
          keyExtractor={(item, index) => index.toString()}
          onEndReachedThreshold={0.5}
          onEndReached={({ distanceFromEnd }) => {
            this._ItemLoadMore();
         }}

          ref={ (el) => this._flatList = el }



          onLayout={ ({nativeEvent}) => {
            //console.log("onLayout")
            //console.log(nativeEvent)
            Platform.OS === 'ios' ?
            this._flatList.scrollToOffset({
              offset: 1,
              animated: false
           }) :
           this._flatList.getScrollResponder().scrollTo({x: 0, y: 1, animated: true});
          } }
          getItemLayout={(data, index)=>this.getItemLayout(data, index)}
          viewabilityConfig={this.viewabilityConfig}
          onScroll={ ({ nativeEvent }) => {
            this._onScrollItem(nativeEvent);
          }}
          />

   );
  }
}

const styles = StyleSheet.create({

MainContainer :{

    justifyContent: 'center',
    flex:1,
    marginTop: (Platform.OS === 'ios') ? 20 : 0,

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
},

});
