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
  ScrollView
} from 'react-native';
import {Actions} from 'react-native-router-flux';
import { Container, Header, Title, Content, Footer, FooterTab, Left, Right, Body, Icon, Text, List, ListItem, DeckSwiper, Card, CardItem,Thumbnail} from 'native-base';
import TreePicker from 'react-native-tree-picker';
import I18n from 'ex-react-native-i18n';
I18n.fallbacks = true
const deviceLocale = I18n.locale

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};

const screen = Dimensions.get('window');

export default class Historique extends Component {
  constructor(props) {
    super(props);
    this.state = { isLoading: true, languages: []}
  }

  async componentDidMount() {
    await I18n.initAsync();
    this.setState({ isLoading:false })
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
      <View style={styles.contents}>
        <Image
          style={{width: 150, height: 150}}
          source={require('../../images/coming-soonn.png')}
        />
      </View>

   );
  }
}


const styles = StyleSheet.create({
  contents: {
    justifyContent: 'center',
    alignItems: 'center',
    // TODO:  Huh???
    height: screen.height > screen.width ? screen.height-100 : screen.height,
    width: '100%'
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
