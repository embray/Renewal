import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  AsyncStorage,
  ActivityIndicator
} from 'react-native';
import Expo, { AppLoading } from 'expo';
import { Container, Header, Left, Body, Right, Button, Icon, Title, Footer, FooterTab } from 'native-base';
import {Actions} from 'react-native-router-flux';
import I18n from 'ex-react-native-i18n';
const SCREEN_HEIGHT = Dimensions.get('window').height
const SCREEN_WIDTH  = Dimensions.get('window').width

const styles = StyleSheet.create({
  wrapper: {
  },
  slide1: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#67daff',
  },
  slide2: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#03a9f4',
  },
  slide3: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007ac1',
  },
  text: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center'
  }
})

// TODO: This is an empty container that's the first in the the routing stack
// and then redirects to other parts of the stack depending on whether or not
// a user is logged in.  Unfortunately, since this part of the stack it's
// possible to *back* to it despite it just being an empty view.
// This can and should probably be done away with or, at the very least, make
// it impossible to go back to it.
export default class InitialPath extends Component {
    constructor(props) {
        super(props);
        this.state = {isConnected : false, isLoading: true}
    }

    async componentDidMount(){
        try {
            AsyncStorage.getItem('userInformationBasic', (err, result)=>{
                if(result === null){
                    //if user not connected, we need to init async storage
                    console.log("User not connected")
                    Actions.conceptSwipe();
                }else{
                    console.log("userInformationBasic's true")
                    var json = JSON.parse(result)
                    this.setState({userInformationBasic : json })
                    if(this.state.userInformationBasic.email === "Empty"){
                        console.log("But user is not connecter")
                        Actions.conceptSwipe();
                    }else{
                        this.setState({isConnected : true})
                        Actions.screenCenter();
                    }
                }
            })
        } catch (error) {
            // Error saving data
        }
        this.setState({isLoading:false})
    }


    render(){
        if (this.state.isLoading) {
            return (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                    <ActivityIndicator size="large" />
                </View>
            );
        }else{
            return (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>

                </View>
            );
        }
    }
}
