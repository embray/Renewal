import React, { Component } from "react";
import {
  ActivityIndicator,
  Error,
  Share,
  Slider,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { WebView } from 'react-native-webview';
import {
  Header,
  Title,
  Button,
  Left,
  Right,
  Body,
  Icon,
  Text,
} from 'native-base';

import I18n from 'ex-react-native-i18n';
I18n.fallbacks = true

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};
import injectionJS from './injectionJS';


// TODO: This Component is extremely buggy and will need to be totally
// redone.
// It's also not very clear what the difference is between the two sliders
// (heart vs sad/happy).  Maybe try to simplify for now.  Do we want a full
// slider?  Maybe just a +1 -1 or now.  Can make more of a range later.


class BottomDrawer extends Component {
  state = {
    drawerVisible: false
  }

  _arrowBarOnPress() {
    this.setState((prevState) => ({
      drawerVisible: !prevState.drawerVisible
    }));
  }

  render() {
    if (!this.props.children) {
      return null;
    }

    return (
      <View style={this.props.style}>
        <TouchableOpacity style={styles.drawerArrowBar}
          onPress={this._arrowBarOnPress.bind(this)}
        >
          <Icon
            name={this.state.drawerVisible ? "md-arrow-dropdown" : "md-arrow-dropup"}
            style={{ color: 'black' }}
          />
        </TouchableOpacity>
        {this.state.drawerVisible ? this.props.children : null}
      </View>
    );
  }
}


class RatingPanel extends Component {
  // TODO: This uses a lot of TouchableOpacities that don't
  // seem to do anything, and that probably needs to be fixed
  // (It seems maybe the intent was that clicking on the icons
  // would move the slider all the way to the left or the right.
  // TODO: Also the left-hand heart icon needs to be fixed.  Actually
  // it's not clear what both sliders are for.  They seem to be
  // redundant.
  render() {
    return (
      <View style={styles.ratingPanel}>
        <Text style={{ fontWeight: 'bold', fontSize: 22 }}>
          {I18n.t('wv_opinion')}
        </Text>
        <View style={styles.ratingPanelSliderContainer}>
          <TouchableOpacity>
            <Icon name="md-heart" style={{ color: 'black' }} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Slider
              style={{ width: 150 }}
              step={1}
              minimumValue={0}
              maximumValue={100}
              value={50}
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <Icon name="md-heart" style={{ color: 'black' }} />
          </TouchableOpacity>
        </View>
        <View style={styles.ratingPanelSliderContainer}>
          <TouchableOpacity>
            <Icon name="md-sad" style={{ color: 'black' }} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Slider
                style={{ width: 150 }}
                step={1}
                minimumValue={0}
                maximumValue={100}
                value={50}
            />
          </TouchableOpacity>
          <TouchableOpacity  >
            <Icon name="md-happy" style={{ color: 'black' }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}


export class ArticleHeader extends Component {
  _onBack() {
    /*
    TODO: This tries to send an event message that the user went back from
    a news article; this is maybe a worthwhile event to send since it tells us
    how much time the user spent reading an article.  However, it should be done
    asynchronously without slowing down user interactions.
    this.fetchEvent("back", "fromTitle : "+this.props.navigation.state.params.title+" fromUrl : "+this.props.navigation.state.params.url);
    */
    this.props.navigation.goBack();
  }

  _setModalVisible(visible) {
    // TODO: Need to figure out how to connect this up, or if we'll even
    // keep this button
  }

  render() {
    const { title } = this.props.scene.route.params;

    return (
      <Header style={styles.header}>
        <Left style={styles.headerLeft}>
          <Button transparent onPress={ this._onBack.bind(this) }>
            <Icon name='md-arrow-back' style={styles.headerIcon} />
          </Button>
        </Left>
        <Body>
          <Title style={styles.headerTitle}>{title}</Title>
        </Body>
        <Right>
          <Button transparent
            onPress={ this._setModalVisible.bind(this, true) }
          >
            <Icon name='md-add' style={styles.headerIcon} />
          </Button>
        </Right>
      </Header>
    );
  }
}


export default class ArticleView extends Component {
  constructor(props) {
    super(props)
    this.state = {
      modalVisible : false,
    };

    this._webView = null;
  }

  async componentDidMount() {
    await I18n.initAsync();
  }

  _shareArticle() {
    // TODO: This needs to be fixed.
    const { title, url } = this.props.route.params;
    Share.share({
        title: title,
        message: `Bonjour, \n je pense que l'article : ${title} pourrait t'interresser. \n `,
        url: url,
        subject: `Je recommande l'article : ${title}` //  for email
    }).then(result => console.log(result)).catch(errorMsg => console.log(errorMsg));
  }

  setModalVisible(visible) {
      this.setState({modalVisible: visible});
  }
  //WebView content part

  /*
  WebView content fixed message
  */
  onMessageFromWebView(message) {
    message = JSON.parse(message);
    if (message.appTag === "renewal") {
      switch (message.event) {
        /* TODO: Send these events */
        case "load" :
          console.log(JSON.stringify(message));
          break;
        case "scroll" :
          console.log(JSON.stringify(message));
          break;
      }
    }
  }

    fetchEvent =  async (something, someData)=>{
        return someData === null ?
            console.log("[{Event : "+something+", timestamp :"+Date.now()+"}]")
            :
            console.log("[{Event : "+something+", timestamp :"+Date.now()+","+someData+"}]")
    }

  renderLoadingWebView() {
    return (<ActivityIndicator size={'large'} />);
  }

  /* TODO: This should check the actual error state and also
   * specify if the internet connection is down; earler there was
   * a message saying "no internet" but we can't actually say that for
   * sure unless we know the connection status; it could also be that the
   * site had a 404 for example
   */
  renderErrorWebView(errorName) {
    return (
      <View style={{flex:1}}>
        <Error name={errorName} />
        <Text>Failed to load site; try reloading later...</Text>
        <Button block rounded danger
          onPress={() => {this.setModalVisible(!this.state.modalVisible)}}
          style={{padding: 15, margin: 15}}
        >
          <Text>Refresh</Text>
        </Button>
      </View>
    );
  }

  render() {
    /* TODO: The original version of this view was very buggy, so I am in the
     * process of trying to reconstruct it. Not all features, particularly the
     * ratings view, are re-enabled yet because they were barely working at all.
     * In particular, the use of ScrollView appears to be broken, since WebView
     * already has its own scrolling. */

    /* TODO: Should use injectedJavaScriptBeforeContentLoaded
      * but it doesn't work on Anroid, see
      * https://github.com/react-native-community/react-native-webview/issues/1095
      * As such we cannot capture window.onload events; need a
      * different workaround */
    const { url } = this.props.route.params;

    return (
      <View style={ styles.container }>
        <WebView
          javaScriptEnabled
          injectedJavaScript={ injectionJS }
          source={ {uri: url} }
          renderLoading={ () => this.renderLoadingWebView() }
          renderError={ (errorName) => this.renderErrorWebView(errorName) }
          ref={ x => {this._webView = x} }
          onMessage={ e => this.onMessageFromWebView(e.nativeEvent.data) }
        />
        <BottomDrawer style={ styles.bottomDrawer }>
          <RatingPanel />
        </BottomDrawer>
      </View>
    );
  }
}


// TODO: Consolidate header styles--some views have different header
// components, but the styling for them is roughly the same across
// the board.
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: '#212121' },
  headerIcon: {
    color: '#fff'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  headerTitle: {
    color: '#fff'
  },
  ratingPanel: {
    alignItems: 'center',
    paddingBottom: 20
  },
  ratingPanelSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bottomDrawer: {
    justifyContent: 'center',
    backgroundColor : "white"
  },
  drawerArrowBar: {
    alignItems: 'center',
    borderTopColor: 'black',
    borderTopWidth: 1
  }
})
