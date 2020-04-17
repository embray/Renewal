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
  StatusBar,
  AsyncStorage,
  ListView,
  Linking,
  TouchableHighlight
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { Container, Header, Title, Content, Footer, FooterTab, Button, Left, Right, Body, Icon, Text, List, ListItem, Switch, Separator, Card, CardItem} from 'native-base';
import { AuthSession } from 'expo';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';

import SideHeader from './SideHeader';

const screen = Dimensions.get('window');

let settings = [
  {
  location : true,
  pedometer : true,
  gyroscope : true,
  accelerometer : true,
  magnetometer : true,
  networks : true,
  activity : true,
  access :true,
  target:true,
  notification : true

}];

// TODO: Enabling and disabling of settings appears to be pretty broken.

import I18n from 'ex-react-native-i18n';
I18n.fallbacks = true

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


async function alertIfRemoteNotificationsDisabledAsync() {
  const { status } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
  if (status !== 'granted') {
    alert('Hey! You might want to enable notifications for my app, they are good.');
  }
}


async function getLocationAsync() {
  const { status } = await Permissions.getAsync(Permissions.LOCATION);
  if (status === 'granted') {
    //return Location.getCurrentPositionAsync({enableHighAccuracy: true});
    const location = await Location.getCurrentPositionAsync({
      enableHighAccuracy: true,
    });
    return location;
  } else {
    throw new Error('Location permission not granted');
  }
}



const SettingsStack = createStackNavigator();


export default class Settings extends Component {
  render() {
    return (
      <SettingsStack.Navigator
        screenOptions={{ header: (props) => <SideHeader {...props} /> }}
      >
        <SettingsStack.Screen name="settings"
          component={ SettingsContents }
      />
      </SettingsStack.Navigator>
    );
  }
}


class SettingsContents extends Component {
  state = {
    isLoading: true,
    isOpen: false,
    selectedItem: 'param',
    settings: {}
  }

  async componentDidMount(){
    try {
      AsyncStorage.getItem('settings', (err, result) => {
        let settings = JSON.parse(result);
        settings = settings === null ? {} : settings;
        this.setState({ settings });
      })
    } catch (error) {
      // Error saving data
      console.log(`Settings: error retrieving settings: ${error}`);
    }
    await I18n.initAsync();
    this.setState({isLoading:false})
  }

  changeStateLocation(){
    const s = this.state.settings;
    console.log(s)
    s.location = s.location === 0 ? 1:0
    if(s.location===1){
      Alert.alert(
        I18n.t('settings_popup_location'),
        I18n.t('settings_popup_location_explain'),
        [
          {text: I18n.t('settings_popup_cancel'), onPress: () => this.changeStateLocation(), style: 'cancel'},
          // TODO: This appears to be broken.
          {text: I18n.t('settings_popup_gosettings'), onPress: () => Linking.openURL('app-settings:')},
        ],
        { cancelable: false })
      //Linking.openURL('app-settings:')
    }
    this.update(s)
  }
  async getLocationAsync() {
    const { status } = await Permissions.getAsync(Permissions.LOCATION);
    if (status === 'granted') {
      //return Location.getCurrentPositionAsync({enableHighAccuracy: true});
      console.log(Location.getCurrentPositionAsync({enableHighAccuracy: true}))
      return true;
    } else {
      throw new Error('Location permission not granted');
      return false;
    }
  }

  changeStatePedometer(){
    const s = this.state.settings;
    console.log(s)
    s.pedometer = s.pedometer === 0 ? 1:0;
    if(s.pedometer===1){
      Alert.alert(
        I18n.t('settings_popup_pedometer'),
        I18n.t('settings_popup_pedometer_explain'),
        [
          {text: I18n.t('settings_popup_refuse'), onPress: () => this.changeStatePedometer(), style: 'cancel'},
          // TODO: This appears to be broken.
          {text: I18n.t('settings_popup_allow'), onPress: () => Linking.openURL('app-settings:')},
        ],
        { cancelable: false })
      //Linking.openURL('app-settings:')
    }
    this.update(s)
  }
  changeStateGyroscope(){
    const s = this.state.settings;
    console.log(s)
    s.gyroscope = s.gyroscope === 0 ? 1:0;
    this.update(s)
  }
  changeStateAccelerometer(){
    const s = this.state.settings;
    console.log(s)
    s.accelerometer = s.accelerometer === 0 ? 1:0;
    this.update(s)
  }
  changeStateMagnetometer(){
    const s = this.state.settings;
    console.log(s)
    s.magnetometer = s.magnetometer === 0 ? 1:0;
    this.update(s)
  }
  changeStateNetwork(){
    const s = this.state.settings;
    console.log(s)
    s.networks = s.networks === 0 ? 1:0;
    this.update(s)
  }
  changeStateActivity(){
    const s = this.state.settings;
    console.log(s)
    s.activity = s.activity === 0 ? 1:0;
    this.update(s)
  }
  changeStateAcess(){
    const s = this.state.settings;
    console.log(s)
    s.access = s.access === 0 ? 1:0;
    this.update(s)
  }
  changeStateTarget(){
    const s = this.state.settings;
    console.log(s)
    s.target = s.target === 0 ? 1:0;
    this.update(s)
  }
  changeStateNotification(){
    const s = this.state.settings;
    console.log(s)
    s.notification = s.notification === 0 ? 1:0;
    if(s.notification===1){
      Alert.alert(
        I18n.t('settings_popup_notification'),
        I18n.t('settings_popup_notification_explain'),
        [
          {text: I18n.t('settings_popup_refuse'), onPress: () => this.changeStateNotification(), style: 'cancel'},
          // TODO: This appears to be broken.
          {text: I18n.t('settings_popup_gosettings'), onPress: () => Linking.openURL('app-settings:')},
        ],
        { cancelable: false })
      //Linking.openURL('app-settings:')
    }
    this.update(s)
  }
  update(s){
    console.log(s)
    this.setState({
      settings : s
    })
    AsyncStorage.setItem('settings', JSON.stringify(s));
  }
  handleChangePhone(){
    console.log(this.state.dialogText)
    const userInformationBasic = this.state.userInformationBasic;
    userInformationBasic.phone = this.state.dialogText;
    this.setState({
      userInformationBasic,
      dialogPhoneIsVisible:false
    });
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

        <View style={{justifyContent: 'center', flex:1, backgroundColor : "#212121",paddingTop: Platform.OS === 'ios' ? 0 : Constants.statusBarHeight}}>

          <Content>
            <List>
              <ListItem itemDivider style={{backgroundColor:'#eeeeee'}}>
                <Text style={{fontWeight: 'bold'}}>{I18n.t('settings_title')}</Text>
              </ListItem>
              <ListItem itemDivider style={{backgroundColor:'#e0e0e0'}}>
                <Text style={{color:'#a4a4a4', fontSize:14}}>
                  {I18n.t('settings_title_explain')}
                </Text>
              </ListItem>
              <ListItem itemDivider style={{backgroundColor:'#eeeeee'}}>
                <Text style={{fontWeight: 'bold'}}>
                  {I18n.t('settings_section_sensors')}
                </Text>
              </ListItem>
              <ListItem itemDivider style={{backgroundColor:'#e0e0e0'}}>
                <Text style={{color:'#a4a4a4', fontSize:14}}>
                  {I18n.t('settings_section_sensors_explain')}
                </Text>
              </ListItem>
              <List style={{backgroundColor:'#ffffff'}}>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_location')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.location === 0 ? false : true}
                      onChange={()=>this.changeStateLocation()}
                    />
                  </Right>
                </ListItem>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_pedometer')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.pedometer === 0 ? false : true} onChange={()=>this.changeStatePedometer()}/>
                  </Right>
                </ListItem>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_gyroscope')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.gyroscope === 0 ? false : true}  onChange={()=>this.changeStateGyroscope()}/>
                  </Right>
                </ListItem>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_accelerometer')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.accelerometer === 0 ? false : true}   onChange={()=>this.changeStateAccelerometer()}/>
                  </Right>
                </ListItem>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_magnetometer')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.magnetometer === 0 ? false : true}   onChange={()=>this.changeStateMagnetometer()}/>
                  </Right>
                </ListItem>
                <ListItem icon >
                  <Left>
                    <Text>{I18n.t('sensor_network')}</Text>
                  </Left>
                  <Body>
                  </Body>
                  <Right>
                    <Switch value={this.state.settings.networks === 0 ? false : true}   onChange={()=>this.changeStateNetwork()}/>
                  </Right>
                </ListItem>
              </List>
            </List>

            {/*coupure*/}
            <ListItem itemDivider style={{backgroundColor:'#eeeeee'}}>
              <Text  style={{fontWeight: 'bold'}}>{I18n.t('settings_section_recommendations')}</Text>
            </ListItem>

            <ListItem itemDivider icon style={{backgroundColor:'#ffffff'}}>
              <Left>
                <Text>{I18n.t('settings_section_recommendations_activity')}</Text>
              </Left>
              <Body>
              </Body>
              <Right>
                <Switch value={this.state.settings.activity === 0 ? false : true}  onChange={()=>this.changeStateActivity()} />
              </Right>
            </ListItem>
            <List style={{backgroundColor:'#ffffff'}}>
              <ListItem itemDivider style={{backgroundColor:'#f5f5f5'}}>
                <Text style={{color:'#a4a4a4', fontSize:14}}>
                  {I18n.t('settings_section_recommendations_activity_explain')}
                </Text>
              </ListItem>
              <ListItem icon >
                <Left>
                  <Text>{I18n.t('settings_section_recommendations_access')}</Text>
                </Left>
                <Body>
                </Body>
                <Right>
                  <Switch value={this.state.settings.access === 0 ? false : true}  onChange={()=>this.changeStateAcess()} />
                </Right>
              </ListItem>
              <ListItem itemDivider style={{backgroundColor:'#f5f5f5'}}>
                <Text style={{color:'#a4a4a4', fontSize:14}}>
                  {I18n.t('settings_section_recommendations_access_explain')}
                </Text>
              </ListItem>
              <ListItem icon >
                <Left>
                  <Text>{I18n.t('settings_section_recommendations_target')}</Text>
                </Left>
                <Body>
                </Body>
                <Right>
                  <Switch value={this.state.settings.target === 0 ? false : true}  onChange={()=>this.changeStateTarget()} />
                </Right>
              </ListItem>
              <ListItem itemDivider style={{backgroundColor:'#f5f5f5'}}>
                <Text style={{color:'#a4a4a4', fontSize:14}}>
                  {I18n.t('settings_section_recommendations_target_explain')}
                </Text>
              </ListItem>
              <ListItem icon >
                <Left>
                  <Text>{I18n.t('settings_section_recommendations_notification')}</Text>
                </Left>
                <Body>
                </Body>
                <Right>
                  <Switch value={this.state.settings.notification === 0 ? false : true}  onChange={()=>this.changeStateNotification()} />
                </Right>
              </ListItem>
            </List>
            <ListItem itemDivider style={{backgroundColor:'#eeeeee'}}>
              <Text style={{fontWeight: 'bold'}}>{I18n.t('settings_section_more_information')}</Text>
            </ListItem>
            <List style={{backgroundColor:'#ffffff'}}>
            <ListItem icon >
              <Left>
                <TouchableOpacity  onPress={() => Linking.openURL( (Platform.OS === 'android')
                  ? 'mailto:hay.julien1@gmail.com?cc=?subject=Renewal:assistance&body=yourMessage'
                  : 'mailto:hay.julien1@gmail.com?cc=&subject=Renewal:assistance&body=yourMessage')}
                >
                  <Text>{I18n.t('settings_section_more_information_assistance')}</Text>
                </TouchableOpacity>
              </Left>
              <Body>
              </Body>
              <Right>
                <TouchableOpacity  onPress={() => Linking.openURL( (Platform.OS === 'android')
                  ? 'mailto:hay.julien1@gmail.com?cc=?subject=Renewal:assistance&body=yourMessage'
                  : 'mailto:hay.julien1@gmail.com?cc=&subject=Renewal:assistance&body=yourMessage')}
                >
                  {/* (Platform.OS === 'android')
                    ? sms:1-408-555-1212?body=yourMessage
                    : sms:1-408-555-1212&body=yourMessage;*/}
                  <Icon name="arrow-forward" />
                </TouchableOpacity>
              </Right>
            </ListItem>
            <ListItem icon >
              <Left>
                <TouchableOpacity  onPress={() => Linking.openURL("https://www.facebook.com/privacy/explanation")}>
                  <Text>{I18n.t('settings_section_more_information_privacy')}</Text>
                </TouchableOpacity>
              </Left>
              <Body>
              </Body>
              <Right>
                <TouchableOpacity  onPress={() => Linking.openURL("https://www.facebook.com/privacy/explanation")}>
                  <Icon name="arrow-forward" />
                </TouchableOpacity>
              </Right>
            </ListItem>
            <ListItem icon >
              <Left>
                <TouchableOpacity  onPress={() => Linking.openURL("https://www.facebook.com/terms")}>
                  <Text>{I18n.t('settings_section_more_information_condition_of_service')}</Text>
                </TouchableOpacity>
              </Left>
              <Body>
              </Body>
              <Right>
              </Right>
            </ListItem>
            <ListItem icon >
              <Left>
                <TouchableOpacity  onPress={() => Linking.openURL("https://www.facebook.com/terms")}>
                  <Text>{I18n.t('settings_section_more_information_legal')}</Text>
                </TouchableOpacity>
              </Left>
              <Body>
              </Body>
              <Right>
                <TouchableOpacity  onPress={() => Linking.openURL("https://www.facebook.com/terms")}>
                  <Icon name="arrow-forward" />
                </TouchableOpacity>
              </Right>
            </ListItem>
          </List>
          <Button block danger>
            <Text>{I18n.t('settings_button_request_my_data')}</Text>
          </Button>
        </Content>
      </View>
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

  },
  iconStyle:{
    color: 'black',
    width :'10%',
    paddingLeft: '3%',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

/**
 * https://react-native.canny.io/feature-requests/p/scrollview-animation-events-eg-onscrollanimationend
 */
