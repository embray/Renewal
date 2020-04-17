import { AppLoading } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationLock } from 'expo-screen-orientation';
import React, { Component } from 'react';
import {
  AppState,
  AsyncStorage,
  Dimensions,
  StyleSheet,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import {
  Body,
  Button,
  Header,
  Icon,
  Left,
  Right,
  Root,
  Text,
  Title
} from 'native-base';

import I18n from 'ex-react-native-i18n';

//Import Screen
import ArticlesList from './ArticlesList';
import Menu from './SideMenu/Menu';
import Favorites from './SideMenuScreens/Favorite';
import History from './SideMenuScreens/History';
import Account from './SideMenuScreens/Account';
import Concept from './SideMenuScreens/SimpleConcept';
import Settings from './SideMenuScreens/Settings';


I18n.fallbacks = true
I18n.translations = {
  'en': require("../i18n/en"),
  'fr': require('../i18n/fr'),
};


const Drawer = createDrawerNavigator();


function MiniOfflineSign() {
  return (
    <View style={styles.offlineContainer}>
      <Text style={styles.offlineText}>{I18n.t('no_connection')}</Text>
  </View>
  );
}


class HomeHeader extends Component {
  _onMenuButtonPress() {
    // TODO: Figure out how to connect header to the side menu drawer once it's
    // been added.
    this.props.navigation.toggleDrawer();
  }

  renderHeaderBody() {
    // TODO: Redo this to not use a switch statement, but rather determine
    // the correct title and icon to use from the screen properties.
    //switch(this.props.route.params.screen){
    switch ("") {
      case "Favorite" :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-star' style={{ color: '#fff'}}   />
            </Button>
            <Title style={{color:'white'}}>{I18n.t('side_menu_fav')}</Title>
          </Body>
        );
      case "History" :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-stats' style={{ color: '#fff'}}   />
            </Button>
            <Title style={{color:'white'}}>{I18n.t('side_menu_history')}</Title>
          </Body>
        );
      case "Account" :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-person' style={{ color: '#fff'}}    />
            </Button>
            <Title style={{color:'white'}}>{I18n.t('side_menu_account')}</Title>
          </Body>
        );
      case "SimpleConcept" :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-cafe' style={{ color: '#fff'}}   />
            </Button>
            <Title style={{color:'white'}}>{I18n.t('side_menu_concept')}</Title>
          </Body>

        );
      case "Settings" :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-settings' style={{ color: '#fff'}}    />
            </Button>
            <Title style={{color:'white'}}>{I18n.t('side_menu_account')}</Title>
          </Body>
        );
      default :
        return (
          <Body style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} >
            <Button transparent>
              <Icon name='md-home' style={{ color: '#fff'}}    />
            </Button>
            <Title style={{color:'white'}}>RENEWAL</Title>
          </Body>
      );

    }
    return null;
  }

  render() {
    const width = Dimensions.get('window').width;

    return (
      <Header style={[styles.header, {'width': width}]}>
        <Left>
          <Button transparent onPress={ this._onMenuButtonPress.bind(this) }>
            <Icon name='menu' style={{ color: '#fff'}} />
          </Button>
        </Left>
        {this.renderHeaderBody()}
        <Right>
        </Right>
      </Header>
    );
  }
}


// In order to add a header to DrawerNavigator screens it's apparently
// necessary to wrap each Screen in its own StackNavigator, which is
// a bit of a mess...

// https://github.com/react-navigation/react-navigation/issues/1632
// Not sure why DrawerNavigator screens can't also just have headers...
const RecommendationsStack = createStackNavigator();


// Contains the StackNavigator for the home screen which is
// embedded in the DrawerNavigator
class Recommendations extends Component {
  render() {
    return (
      <RecommendationsStack.Navigator
        screenOptions={{ header: (props) => <HomeHeader {...props} /> }}
      >
        <RecommendationsStack.Screen name="Recommendations"
          component={ ArticlesList }
      />
      </RecommendationsStack.Navigator>
    );
  }
}


export default class Home extends Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.state = {
      appState: AppState.currentState,
      isLoading: true,
      isOpen: false,
      refreshing: true,
      selectedItem: null,
      items: null,
      loading: true,
      token : undefined
    }
    this.unsubscribeConnectivityChange = () => {};
  }

  async componentDidMount(){
    await I18n.initAsync();
    //console.log(this.props)
    //this.setState({ loading: false });
    this.unsubscribeConnectivityChange = NetInfo.addEventListener((state) => {
      this.handleConnectivityChange(state.isConnected)
    });

    AppState.addEventListener('change', this._handleAppStateChange);
    try {
      AsyncStorage.getItem('token', (err, result)=>{
        setTimeout(() => this.setState({ token:result }))//this.setState({token: result});
       console.log("mon token de merde "+result)
       })
     } catch (error) {
       // Error saving data
       console.log("oh mon dieu le token a disparu")
     }
     setTimeout(() => this.setState({ loading: false }))
  }

  componentWillUnmount() {
    this.unsubscribeConnectivityChange();
    AppState.removeEventListener('change', this._handleAppStateChange);
  }

  _handleAppStateChange = (nextAppState) => {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
    }
    this.setState({appState: nextAppState});
  }

  handleConnectivityChange = (isConnected) => {
    this.setState({ isConnected });
  };
  /*
    Partie side menu
  */
  _sideMenuPress(){
    this.toggle();
  }
  toggle() {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  }

  updateMenuState(isOpen) {
    this.setState({ isOpen });
  }
  fetchEvent =  async (something, someData)=>{
    console.log(this.state.token)
    await FetchFunction._event(this.state.token,something, someData)
    /*
    let userData = null;
    console.log(this.props)
    someData === null ?
      userData = "[{Event : "+something+", timestamp :"+Date.now()+"}]"
      :
     userData="[{Event : "+something+", timestamp :"+Date.now()+","+someData+"}]";
     const urlConst = 'https://api.renewal-research.com/user/events/'+this.state.token+'/'+userData;

     console.log(urlConst)
     fetch('https://api.renewal-research.com/user/events/'+this.state.token+'/'+userData, {
      method: "POST",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body:JSON.stringify({
        something,
        userData
      })
    })*/

  }
  onMenuItemSelected = item =>{
    this.setState({
      isOpen: false,
      selectedItem: item,
    });
    // TODO: This was sending an event to the server every time the user
    // selects a menu item, making things incredibly slow.  I'm not sure if
    // it's even worth recording such an event, but if we really wanted to
    // it should happen in the background and not slow down the UI.
    //this.fetchEvent("menuItemSelected", "goToScreen : "+item+", from : "+this.props.navigation.state.params.screen)
    this.props.route.params.screen = item;
  }

  contentSwitch(){
    /*if(this.state.isConnected === false){
      return <View style={{flex:1}} ><MiniOfflineSign /></View>
    }*/
    ScreenOrientation.lockAsync(OrientationLock.ALL);
    //switch(this.props.route.params.screen){
    switch ("") {
      case "Favorite" :
        return (
          <Favorites />
        );
      case "History" :
        return (
          <History />
        );
      case "Account" :
        return (
          <Account />
        );
      case "SimpleConcept" :
        return (
          <Concept />
        );
      case "Settings" :
        return (
          <Settings />
        );
      default :
        return (
          <ArticlesList {...this.props} />
          //this.state.isConnected === false ? <View style={{flex:1}}><View style={{height:30}}><MiniOfflineSign /></View><DiverseRecommendation /></View> : <DiverseRecommendation />
        );

    }
    return null;
  }

  render() {
    let content = this.contentSwitch();

    const menu = <Menu onItemSelected={this.onMenuItemSelected} />;
    //console.log(this.state.selectedItem)

    if (this.state.loading) {
      return (
        <Root>
          <AppLoading />
        </Root>
      );
    }

    return (
      <Drawer.Navigator initialRouteName="Recommendations">
        <Drawer.Screen name="Recommendations" component={ Recommendations } />
        <Drawer.Screen name="Favorites" component={ Favorites } />
        <Drawer.Screen name="History" component={ History } />
        <Drawer.Screen name="Settings" component={ Settings } />
        <Drawer.Screen name="Account" component={ Account } />
      </Drawer.Navigator>
    );

    /* TODO: Move implementation of the MiniOfflineSign elsewhere and figure
     * out an effective way to display it on all screens when applicable
     *
      <SideMenu
        menu={menu}
        isOpen={this.state.isOpen}
        onChange={isOpen => this.updateMenuState(isOpen)}
      >
      <View style={{ justifyContent: 'center', flex:1,backgroundColor : "#212121"}}>
        <View style={{flex:1}}>
        {
          this.state.isConnected === false
            ?
              <View style={{height:30}}><MiniOfflineSign /></View>
            :
            <View></View>
        }
        {content}

        </View>
      </View>
      </SideMenu>
    );
    */
  }
}


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121'
  },
  offlineContainer: {
    backgroundColor: '#b52424',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width : '100%',
    position: 'absolute',
  },
  offlineText: {
    color: '#fff'
  }
});
