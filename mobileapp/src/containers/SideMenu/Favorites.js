import { AppLoading } from 'expo';
import Constants from 'expo-constants';
import * as SQLite from 'expo-sqlite';
import React, { Component } from 'react';
import {
  StyleSheet,
  Platform,
  View,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
  TouchableOpacity,
  Dimensions,
  StatusBar
} from 'react-native';
import {Actions} from 'react-native-router-flux';
import { createStackNavigator } from '@react-navigation/stack';
import { Container, Header, Title, Content, Footer, FooterTab, Button, Left, Right, Body, Icon, Text, List, ListItem } from 'native-base';
const screen = Dimensions.get('window');
const db = SQLite.openDatabase('db.db');
import I18n from 'ex-react-native-i18n';

import SideHeader from './SideHeader';


I18n.fallbacks = true
const deviceLocale = I18n.locale

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


const FavoritesStack = createStackNavigator();

// Wrapper class needed to put the Favorites header in a StackNavigator
// TODO: This code is repeated in a number of places; I wonder if it could
// be refactored.
export default class Favorites extends Component {
  render() {
    return (
      <FavoritesStack.Navigator
        screenOptions={{ header: (props) => <SideHeader {...props} /> }}
      >
        <FavoritesStack.Screen name="favorites"
          component={ FavoritesContent }
      />
      </FavoritesStack.Navigator>
    );
  }
}


// TODO: Much of this is currently broken; need to make some dummy favorites
// for testing.
class FavoritesContent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      isOpen: false,
      selectedItem: 'favoris',
      //items:null,
      newscastSavedState:null,
      refreshing: false
    }
  }

  async componentDidMount(){
    this.update();
  }

  _onPressOnItem (item) {
    let pack = {
      title: item.title,
      url:item.url,
      previous : "Favorite"
    }
    Actions.webview(pack)
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
  render() {
    return (
      <View style={{justifyContent: 'center', flex:1, backgroundColor : "#212121",paddingTop: Platform.OS === 'ios' ? 0 : Constants.statusBarHeight}}>
      <Content  style={{backgroundColor:'#212121'}} >
      <FlatList
          data={ this.state.newscastSavedState }
          extraData={this.state}
          ItemSeparatorComponent = {this.FlatListItemSeparator}
          renderItem={({item, index}) =>
          <View style={{backgroundColor:'white'}}>
            <TouchableOpacity onPress={()=> this._onPressOnItem(item)} >
              <Image source = {{ uri: item.image }} style={styles.imageView}/>
            </TouchableOpacity>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width:'100%', }}>
            <TouchableOpacity
              key={item.id}
              onPress={()=> this._onPressOnItem(item)}
              style={{
                padding: 5,
                backgroundColor: 'white',
                width:'90%'
              }}
            >
            <Text>{item.title}</Text>
            </TouchableOpacity>
                  <Icon name='ios-close' style={styles.iconStyle}  onPress={() => this.remove(item).then(this.update())} />
            </View>

        </View>
          }
          keyExtractor={(item, index) => index.toString()}
          onRefresh={this.handleRefresh}
          refreshing={this.state.refreshing}
          />
      </Content>
      </View>
   );
  }
  executeSql = async (sql, params = []) => {
    return new Promise((resolve, reject) => db.transaction(tx => {
      tx.executeSql(sql, params, (_, { rows }) => resolve(rows._array), reject)
    }))
  }
  update= async () => {
    console.log("je suis dans update")
    await this.executeSql('select * from newscastSaved', []).then(newscastSavedState => this.setState({newscastSavedState})  );
    this.setState({
      refreshing: false,
      isLoading : false,
    })

  }
  remove = async (item) => {
    console.log("je suis dans remove avec title:"+item.title)
    await this.executeSql('delete from newscastSaved  where title = ?', [item.title]);
    await this.executeSql('update  newscasts set isSaved = ? where title = ?', [0, item.title]);
    return true;
  }
  handleRefresh = () => {
    this.setState(
      {
        refreshing: true
      },
      () => {
        this.update();
      }
    );

  };

}


const styles = StyleSheet.create({
  MainContainer :{
    justifyContent: 'center',
    flex:1,
    backgroundColor : "white"
    //margin: 5,
    //marginTop: (Platform.OS === 'ios') ? 20 : 0,
  },
  imageView: {
    height: screen.height / 5,

    margin: 7,
    borderRadius : 7,
    justifyContent: 'center',
    alignItems: 'center',
   // tintColor: 'gray',
  },
  textView: {
    textAlignVertical:'center',
    textAlign: 'center',
    padding:10,
    color: '#fff',
    width : '80%',

  },
  iconStyle:{
    color: 'red',
    width :'10%',
    paddingLeft: '3%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    textAlign: 'center',
    color :'#fff'
  },
});

/**
 * https://react-native.canny.io/feature-requests/p/scrollview-animation-events-eg-onscrollanimationend
 */
