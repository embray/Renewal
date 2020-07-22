import { AppLoading } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationLock } from 'expo-screen-orientation';
import React, { Component } from 'react';
import {
  AppState,
  AsyncStorage,
  Dimensions,
  StyleSheet
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useSelector } from 'react-redux';
import { Icon, Text, Thumbnail, View } from 'native-base';

import I18n from 'ex-react-native-i18n';

import Recommendations from './Recommendations';
import {
  Menu,
  Bookmarks,
  History,
  Account,
  Settings
} from './SideMenu';


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


function iconFactory(name) {
  return ({ size, focus, color }) => (
    <Icon name={ name } style={{ color }} />
  );
}


// Renders the user's avatar if they are logged in to an auth provider which
// provides one, otherwise falls back on rendering the default icon.
function userIcon({ size, focus, color }) {
  const photoURL = useSelector((state) => state.account.photoURL);
  if (photoURL != null) {
    const style = { height: size, width: size, borderRadius: size / 2 };
    return (<Thumbnail style={ style } source={{ uri: photoURL }} />)
  }
  return iconFactory('md-person')({ size, focus, color });
}


// Icons and menu titles / labels for all the main screens
const SCREEN_OPTIONS = new Map([
  ['recommendations', {
    component: Recommendations,
    label: I18n.t('side_menu_recommendation'),
    icon: iconFactory('md-home')
  }],
  ['bookmarks', {
    component: Bookmarks,
    label: I18n.t('side_menu_bookmarks'),
    icon: iconFactory('md-bookmark')
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
    icon: userIcon
  }]
]);


export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      appState: AppState.currentState,
      isLoading: true,
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
    this.setState({ isLoading: false })
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

  render() {
    if (this.state.isLoading) {
      return (
        <AppLoading />
      );
    }

    /* TODO: Once account management is working again, replace the Account
     * icon default with the user's image if one exists */
    return (
      <Drawer.Navigator initialRouteName="Recommendations"
        drawerContent={ (props) => <Menu {...props} /> }
      >
        { Array.from(SCREEN_OPTIONS.entries(), ([name, opts]) => (
          <Drawer.Screen key={ name } name={ name } component={ opts.component }
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
