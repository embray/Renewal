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

  renderHeaderBody(routeName) {
    let { label, icon } = SCREEN_OPTIONS.get(routeName);
    // Special case for the main screen
    if (routeName == 'recommendations') {
      label = 'RENEWAL'
      icon = () => null;
    }
    return (
      <>
        { icon({ color: 'white' }) }
        <Title style={ styles.headerTitle }>{ label }</Title>
      </>
    );
  }

  render() {
    const width = Dimensions.get('window').width;
    const { name } = this.props.scene.route;
    // Modify the flexbox for the main heading to put the title in
    // the center
    const flexStyle = (name == 'recommendations' ?
      {'flex': 1, 'justifyContent': 'center'} : {});

    return (
      <Header style={[styles.header, {'width': width}]}>
        <Left style={ flexStyle }>
          <Button transparent onPress={ this._onMenuButtonPress.bind(this) }>
            <Icon name='menu' style={{ color: '#fff'}} />
          </Button>
        </Left>
        <Body style={ [styles.headerBody, flexStyle] }>
          {this.renderHeaderBody(name)}
        </Body>
        <Right style={ flexStyle }>
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
        <RecommendationsStack.Screen name="recommendations"
          component={ ArticlesList }
      />
      </RecommendationsStack.Navigator>
    );
  }
}


function iconFactory(name) {
  return ({size, focus, color}) => (
    <Icon name={ name } style={{ color }} />
  );
}


// Icons and menu titles / labels for all the main screens
const SCREEN_OPTIONS = new Map([
  ['recommendations', {
    component: Recommendations,
    label: I18n.t('side_menu_recommendation'),
    icon: iconFactory('md-home')
  }],
  ['favorites', {
    component: Favorites,
    label: I18n.t('side_menu_fav'),
    icon: iconFactory('md-star')
  }],
  ['history', {
    component: History,
    label: I18n.t('side_menu_history'),
    icon: iconFactory('md-stats')
  }],
  ['settings', {
    component: Settings,
    label: I18n.t('side_menu_settings'),
    icon: iconFactory('md-settings')
  }],
  ['account', {
    component: Account,
    label: I18n.t('side_menu_account'),
    icon: iconFactory('md-person')
  }]
]);


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

    /* TODO: Once account management is working again, replace the Account
     * icon default with the user's image if one exists */
    return (
      <Drawer.Navigator initialRouteName="Recommendations"
        drawerContent={ (props) => <Menu {...props} /> }
      >
        { Array.from(SCREEN_OPTIONS.entries(), ([name, opts]) => (
          <Drawer.Screen name={ name } component={ opts.component }
            options={{ drawerLabel: opts.label, drawerIcon: opts.icon }}
          />
        ))}
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
  headerTitle: {
    color: 'white'
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
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
