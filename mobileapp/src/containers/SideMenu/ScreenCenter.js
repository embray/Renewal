import { AppLoading } from 'expo';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationLock } from 'expo-screen-orientation';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import React, { Component } from 'react';
import {
  AppState,
  AsyncStorage,
  Dimensions,
  Platform,
  StyleSheet,
  View,
  YellowBox
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Actions } from 'react-native-router-flux';
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

// TODO: Ignore as of yet unfixed warnings from react-native-side-menu
// Remove this later when Drawer is fixed.
YellowBox.ignoreWarnings([
  'Warning: componentWillMount has been renamed',
  'Warning: componentWillReceiveProps has been renamed',
  'Warning: Can only update a mounted or mounting component'
]);
// TODO: This package is not well maintained and is pretty out of date
// and produces warnings.  Replace with something else soon.
import SideMenu from 'react-native-side-menu';

import Menu from '../SideMenu/Menu';
const screen = Dimensions.get('window');
import I18n from 'ex-react-native-i18n';
I18n.fallbacks = true
const deviceLocale = I18n.locale
I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};

//Import Screen
import DiverseRecommendation from '../ListOfArticles/DiverseRecommendation';
import Favorites from '../SideMenuScreens/Favorite';
import History from '../SideMenuScreens/History';
import Account from '../SideMenuScreens/Account';
import Concept from '../SideMenuScreens/SimpleConcept';
import Settings from '../SideMenuScreens/Settings';

//import sensors
import accelerometerSensor  from '../Sensors/AccelerometerSensor';
import gyroscopeSensor from '../Sensors/GyroscopeSensor';
import locationSensor from '../Sensors/LocationSensor';
import deviceInfoSensor from '../Sensors/DeviceInfoSensor';


function MiniOfflineSign() {
  return (
    <View style={styles.offlineContainer}>
      <Text style={styles.offlineText}>{I18n.t('no_connection')}</Text>
  </View>
  );
}

export default class ScreenCenter extends Component {
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
    //accelerometerSensor._subscribe();
    //gyroscopeSensor._subscribe();
    //locationSensor._subscribe();
    try {
      AsyncStorage.getItem('token', (err, result)=>{
        setTimeout(() => this.setState({ token:result }))//this.setState({token: result});
       console.log("mon token de merde "+result)
       })
     } catch (error) {
       // Error saving data
       console.log("oh mon dieu le token a disparu")
     }
     setTimeout(() => this.setState({ loading:false }))
  }

  componentWillUnmount() {
    this.unsubscribeConnectivityChange();
    AppState.removeEventListener('change', this._handleAppStateChange);
    //accelerometerSensor._unsubscribe();
    //gyroscopeSensor._unsubscribe();
    //locationSensor._unsubscribe();
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
    this.props.navigation.state.params.screen = item;
  }

  contentSwitch(){
    /*if(this.state.isConnected === false){
      return <View style={{flex:1}} ><MiniOfflineSign /></View>
    }*/
    ScreenOrientation.lockAsync(OrientationLock.ALL);
    switch(this.props.navigation.state.params.screen){
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
          <DiverseRecommendation />
          //this.state.isConnected === false ? <View style={{flex:1}}><View style={{height:30}}><MiniOfflineSign /></View><DiverseRecommendation /></View> : <DiverseRecommendation />
        );

    }
    return null;
  }
  contentHeaderSwitch(){
    switch(this.props.navigation.state.params.screen){
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
    let content = this.contentSwitch();
    let contentHeader = this.contentHeaderSwitch();


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
      <SideMenu
        menu={menu}
        isOpen={this.state.isOpen}
        onChange={isOpen => this.updateMenuState(isOpen)}
      >
      <View style={{ justifyContent: 'center', flex:1,backgroundColor : "#212121"}}>
        <Header style={{backgroundColor: '#212121'}}>
          <Left>
            <Button transparent>
              <Icon name='menu' style={{ color: '#fff'}}   onPress={()=>this._sideMenuPress()} />
            </Button>
          </Left>
          {contentHeader}
          <Right>
          </Right>
        </Header>
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
  }
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
  },
  textView: {
    textAlignVertical:'center',
    textAlign: 'center',
    padding:10,
    color: '#000',
    width : '80%',
    margin:0,
    padding:0

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
    color: '#fff', }
});
