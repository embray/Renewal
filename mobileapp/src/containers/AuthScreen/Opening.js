import React, { Component } from 'react'
import { StyleSheet, Alert, AsyncStorage, ActivityIndicator, TouchableOpacity, Image, Text } from 'react-native'
import { View } from 'react-native-animatable'
import { AuthSession, Google } from 'expo';
import * as Facebook from 'expo-facebook';
import Constants from 'expo-constants';
import {Actions} from 'react-native-router-flux';
import QueryString from 'query-string';
import Config from '../../../config';
import CustomButton from '../../components/CustomButton'
import metrics from '../../config/metrics'
import I18n from 'ex-react-native-i18n';

I18n.fallbacks = true

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


const FACEBOOK_GRAPH_URI = 'https://graph.facebook.com/me'


export default class Opening extends Component {
  constructor(props) {
    super(props)
    this.state = {
      isLoading: true,
      token : null
    }
  }
  async componentWillMount() {
    try {
     AsyncStorage.getItem('userInformationBasic', (err, result)=>{
      var json = JSON.parse(result)
      this.setState({userInformationBasic : json})
      })
    } catch (error) {
      // Error saving data
    }
    await I18n.initAsync();
    this.setState({isLoading:false})
  }
  async logInFB() {
    const { type, token } = await Facebook.logInWithReadPermissionsAsync(
      Config.auth.facebook.appId, {
        permissions: ['public_profile', 'email', 'user_birthday', 'user_friends'],
    });
    if (type === 'success') {
      // Get the user's name using Facebook's Graph API
      // TODO: It looks like this call isn't even used...
      let qsAuth = { access_token: token };
      const response = await fetch(
          `${FACEBOOK_GRAPH_URI}?${QueryString.stringify(qsAuth)}`
      );
        /*Alert.alert(
          'Logged in!',
          `Hi ${(await response.json()).name}!`,
        );
        const userInfo = await response.json().then(this.setState({ userInfo }));
        console.log(userInfo);*/
        // TODO: Do we need all these fields??
      let qsUserInfo = { ...qsAuth, fields: 'id,name,picture.type(large),email,birthday' };
      let userInfoResponse = await fetch(
        `${FACEBOOK_GRAPH_URI}?${QueryString.stringify(qsUserInfo)}`
      );
      const userInfo = await userInfoResponse.json();
      //this.setState({ userInfo });
      //console.log(userInfo)
      this.updateWithFacebook(userInfo)
      await this._fetchAuth(result.user.email, result.user.id, "fb");

      Actions.screnCenter()
    }
  }
  updateWithFacebook(userInfo){
    console.log(userInfo)
    console.log(userInfo.name)
    const u = this.state.userInformationBasic;
    u.firstName = userInfo.name.split(" ")[0];
    u.lastName = userInfo.name.split(" ")[1];
    u.email = userInfo.email;
    u.image = userInfo.picture.data.url;
    u.birth = userInfo.birthday.split("/")[1]+"-"+userInfo.birthday.split("/")[0]+"-"+userInfo.birthday.split("/")[2];
    u.facebook = 1;
    u.mail=1;
    this.setState({
      userInformationBasic : u,
    });
    console.log(u)
    try {
      AsyncStorage.setItem('userInformationBasic', JSON.stringify(this.state.userInformationBasic));

    } catch (error) {
      // Error saving data
      console.log("error")
    }
    Actions.screnCenter()
  }
  async  signInWithGoogleAsync() {
    try {
      const result = await Google.logInAsync({
        androidClientId: Config.auth.google.androidClientId,
        iosClientId: Config.auth.google.iosClientId,
        scopes: ['profile', 'email'],
      });

      if (result.type === 'success') {
        console.log(result)
        this.updateWithGoogle(result)

        return result.accessToken;
      } else {
        return {cancelled: true};
      }
    } catch(e) {
      return {error: true};
    }
  }
  async updateWithGoogle(result){
    console.log(result)
    const u = this.state.userInformationBasic;
    u.firstName = result.user.givenName;
    u.lastName = result.user.familyName;
    u.email = result.user.email;
    u.image = result.user.photoUrl;
    u.google = 1;
    u.mail=1;
    this.setState({
      userInformationBasic : u,
    });
    console.log(u)
    try {
      AsyncStorage.setItem('userInformationBasic', JSON.stringify(this.state.userInformationBasic));
      await this._fetchAuth(result.user.email, result.user.id, "google");
      await Actions.screnCenter()

    } catch (error) {
      // Error saving data
      console.log("error")
    }
    Actions.screnCenter()

  }

  /*
  fetch(`https://api.parse.com/1/users?foo=${encodeURIComponent(data.foo)}&bar=${encodeURIComponent(data.bar)}`, {
  method: "GET",
  headers: headers,
  body:body
})
  */
 _fetchAuth = async (username, password, socialNetwork) => {

  this.setState({ isLoading: true })


  // TODO: Why twice?
  // TODO: Why is the password sent in the URI?
  // TODO: How is this so bad???
  let authURI = `${Config.api.renewalURL}/auth/${username}/${socialNetwork}/${password}`;
  await fetch(authURI, {
    method: "PUT",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body:JSON.stringify({
      username,
      password
    })
  })
  .then(await fetch(authURI, {
    method: "GET",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body:undefined
  })
  .then((response) =>
    response.json()
  ).then((responseJson)=>{
    console.log(responseJson),
    console.log(responseJson.user_token)
    AsyncStorage.setItem('token', responseJson.user_token);

  })

).catch((error) => {
    console.error(error);
  });
  setTimeout(() => this.setState({isLoading: false }), 1000)
  }

  // TODO: Not sure why there's _fetchAuth and fetchAuth
  // TODO: Need to figure out which is actually used, although in fact neither
  //       should really be used considering the URL syntax...
  fetchAuth(login, password){
    //console.log(""+login+""+password)
    let authURI = `${Config.api.renewalURI}/auth/${login}/${password}`;
    return fetch(authURI, {
      method: "GET",
      headers: headers,
      body:body
    })
      .then((response) => response.json())
      .then((responseJson) => {
        console.log(responseJson)
      })
      .catch((error) => {
        console.error(error);
      });
    //Actions.screnCenter()
  }
  loginG = async () => {
    const result = await this.signInWithGoogleAsync()
  }

  render () {
    if (this.state.isLoading) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
    return (
      <View style={styles.container}>

        <View animation={'zoomIn'} delay={600} duration={400}>
        <TouchableOpacity style={styles.EmailStyle} activeOpacity={0.5} onPress={this.props.onSignInPress}>
          <Image
            source={require('../../images/email.png')}
            style={styles.ImageIconStyle}
          />
          <View style={styles.SeparatorLine} />
            <Text style={styles.TextStyle}> {I18n.t('opening_email')}</Text>
          </TouchableOpacity>

        </View>
        <View style={styles.separatorContainer} animation={'zoomIn'} delay={700} duration={400}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorOr}>{I18n.t('opening_or')}</Text>
          <View style={styles.separatorLine} />
        </View>
        <View animation={'zoomIn'} delay={700} duration={400}>
        <TouchableOpacity style={styles.GooglePlusStyle} activeOpacity={0.5} onPress={()=>this.loginG()}>
          <Image
            source={require('../../images/Google_Plus.png')}
            style={styles.ImageIconStyle}
          />
          <View style={styles.SeparatorLine} />
            <Text style={styles.TextStyle}> Login Using Google </Text>
          </TouchableOpacity>
        </View>

        <View animation={'zoomIn'} delay={700} duration={400}>
        <TouchableOpacity style={styles.FacebookStyle} activeOpacity={0.5} onPress={()=>this.logInFB()}>

         <Image
          source={require('../../images/Facebook_Login_Button.png')}
          style={styles.ImageIconStyle}
          />

         <View style={styles.SeparatorLine} />

         <Text style={styles.TextStyle}> Login Using Facebook </Text>

       </TouchableOpacity>
        </View>

        <View animation={'zoomIn'} delay={700} duration={400}>
        <TouchableOpacity style={styles.TwitterStyle} activeOpacity={0.5} onPress={() => Alert.alert(
                  'lifehack',
                  'Delete Twitter from your phone, because it is the worst',
                  [
                    {text: 'Cancel', onPress: () => console.log('Cancel Pressed!')},
                    {text: 'OK', onPress: this.onDeleteBTN},
                  ],
                  { cancelable: false }
                )}>

         <Image
          source={require('../../images/twitter.png')}
          style={styles.ImageIconStyle}
          />

         <View style={styles.SeparatorLine} />

         <Text style={styles.TextStyle}> Login Using Twitter </Text>

       </TouchableOpacity>

        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: metrics.DEVICE_WIDTH * 0.1,
    justifyContent: 'center'
  },
  createAccountButton: {
    backgroundColor: '#9B9FA4'
  },
  createAccountButtonText: {
    color: 'white'
  },
  separatorContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 20
  },
  separatorLine: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    height: StyleSheet.hairlineWidth,
    borderColor: '#9B9FA4'
  },
  separatorOr: {
    color: '#9B9FA4',
    marginHorizontal: 8
  },
  signInButton: {
    backgroundColor: '#1976D2'
  },
  signInButtonText: {
    color: 'white'
  },
  FacebookStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#485a96',
    borderWidth: .5,
    borderColor: '#fff',
    height: 40,
    borderRadius: 5 ,
    margin: 5,

  },
  GooglePlusStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc4e41',
    borderWidth: .5,
    borderColor: '#fff',
    height: 40,
    borderRadius: 5 ,
    margin: 5,

 },
 TwitterStyle: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#00aced',
  borderWidth: .5,
  borderColor: '#fff',
  height: 40,
  borderRadius: 5 ,
  margin: 5,

},
 EmailStyle: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#212121',
  borderWidth: .5,
  borderColor: '#fff',
  height: 40,
  borderRadius: 5 ,
  margin: 5,

},
  ImageIconStyle: {
     padding: 10,
     margin: 5,
     height: 25,
     width: 25,
     resizeMode : 'stretch',

  },
  TextStyle :{

    color: "#fff",
    marginBottom : 4,
    marginRight :20,

  },

  SeparatorLine :{

  backgroundColor : '#fff',
  width: 1,
  height: 40

  }
})
