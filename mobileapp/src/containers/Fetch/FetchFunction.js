import React, { Component } from "react";
import {
  StyleSheet,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
  Image,
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  FlatList,
  Slider,
  ScrollView,
  WebView,
  View,
  StatusBar,
  Share,
  Linking
} from "react-native";
import NetInfo from '@react-native-community/netinfo';
import {Actions} from 'react-native-router-flux';
import * as Animatable from 'react-native-animatable';
import { Container, Header, Title, Content, Footer, FooterTab, Button, Left, Right, Body, Icon, Text, List, ListItem } from 'native-base';
import Config from '../../../config';
{/*import { Header } from 'react-native-elements';*/}
const SCREEN_HEIGHT = Dimensions.get('window').height
const SCREEN_WIDTH  = Dimensions.get('window').width
const SCREEN_WIDTH_CUSTOM_PADDING = SCREEN_WIDTH*0.47;
const SCREEN_HEIGHT_CUSTOM = SCREEN_HEIGHT-(SCREEN_HEIGHT/20);
const SCREEN_HEIGHT_CUSTOM_HEADER = SCREEN_HEIGHT/20;
const SCREEN_HEIGHT_CUSTOM_REST= SCREEN_HEIGHT - SCREEN_HEIGHT_CUSTOM_HEADER;
const PropTypes = require('prop-types');

const timer = require('react-native-timer');

// TODO: This entire module appears to be buggy, at best.  And it's in a
// strange location in the project hierarchy.  Probably just delete it once
// we find out exactly what it's used for.

const fetchFunction = {
    // TODO: It seems like there's a whole duplicate of the user auth functionality
    //       from the auth module here.  Just get rid of the duplication!
    // TODO: See if there's a decent library for wrapping simple REST APIs.
    _auth : async function (username, password, service){
        let authURI = `${Config.api.renewalURI}/auth/${username}/${service}/${password}`;
        await fetch(authURI,
            {
                method: "PUT",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
            },
            body:JSON.stringify
                ({
                    username,
                    password
                })
            }
        )

        .then(
            // TODO: I'm still confused that the thing they need to do a GET after a PUT;
            //       does the PUT not return a response?  Why does it always pass the password?
            await fetch(authURI,
                {
                method: "GET",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body:undefined
                }
            )
            .then((response) => response.json())
            .then((responseJson)=>{
                console.log(responseJson["user_token"])
                AsyncStorage.setItem('token', JSON.stringify(responseJson["user_token"]));
            })
        ).catch((error) => {
            console.error(error);
        });
    },
    _register : async function (username,password, service){
        let authURI = `${Config.api.renewalURI}/auth/${username}/${service}/${password}`;
        await fetch(authURI,
            {
                method: "PUT",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
            },
            body:JSON.stringify
                ({
                    username,
                    password
                })
            }
        )

        .then(
            await fetch(authURI,
                {
                method: "GET",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body:undefined
                }
            )
            .then((response) => response.json())
            .then((responseJson)=>{
                console.log(responseJson["user_token"])
                AsyncStorage.setItem('token', JSON.stringify(responseJson["user_token"]));
            })
        ).catch((error) => {
            console.error(error);
        });
    },
    _verify : async function(){
        console.log("let s start verify")
        let response = undefined;
        NetInfo.fetch().then((state) => {
            //res = connectionInfo.type === none ? res : connectionInfo.type
            console.log(state.type)
            response = state.type;
            //return connectionInfo.type === none ? false : true
        });
        response = response === "none" ? false : true;
        return response;
    },
    _event : async function (token, something, someData){
        console.log("inside function : "+token+','+something+","+someData)

        console.log(await fetchFunction._verify());
        await fetchFunction._verify() ?
            fetchFunction._fetchURL(token, something, someData)
            :
            timer.setTimeout(
                this, 'sendMsgEvent', () => fetchFunction._event(token,something, someData), 4000
              );
        /*
        if(fetchFunction._verify()===true){
            fetchFunction._fetchURL(urlConst);
        }else{
            timer.setTimeout(
                this, 'sendMsgEvent', () => fetchFunction._fetchURL(urlConst), 4000
              );
        }
        console.log(urlConst) */
    },
    _fetchURL : async function (token, something, someData) {
        let userData = null;
        someData === null ?
          userData = "[{Event : "+something+", timestamp :"+Date.now()+"}]"
          :
         userData="[{Event : "+something+", timestamp :"+Date.now()+","+someData+"}]";

        // TODO: Why is this userData some kind of JSON-encoded list-like thing?
        // TODO: What is someData?
        // TODO: What is this even used for?
        let fetchURI = `${Config.auth.renewalURI}/user/events/${token}/${userData}`;

        fetch(fetchURI, {
          method: "POST",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body:JSON.stringify({
            something,
            userData
          })
        })
        .then((response)=> console.log(response))
    }
}
export default fetchFunction;
