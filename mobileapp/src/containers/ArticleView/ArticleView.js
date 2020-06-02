import {
  getTheme,
  Header,
  Button,
  Left,
  Right,
  Body,
  Icon,
  Text,
  View
} from 'native-base';
import React, { Component } from "react";
import {
  ActivityIndicator,
  Animated,
  Error,
  Share,
  Slider,
  StyleSheet,
  TouchableOpacity
} from "react-native";
import TextTicker from 'react-native-text-ticker';

import ArticleButtons from '../../components/Article/ArticleButtons';
import WebView from '../../components/AutoHeightWebView';
import AnimatedHeaderScrollView from '../../components/AnimatedHeaderScrollView';
import injectionJS from './injectionJS';


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

  render() {
    const { title } = this.props.route.params;

    return (
      <Header style={ styles.header }>
        <Left style={ styles.headerLeft }>
          <Button transparent onPress={ this._onBack.bind(this) }>
            <Icon name='md-arrow-back' style={ styles.headerIcon } />
          </Button>
        </Left>
        <Body style={ styles.headerBody }>
          <TextTicker style={ styles.headerTitle } marqueeDelay={ 1000 }>
            { title }
          </TextTicker>
        </Body>
        <Right style={{ flex: 0 }} />
      </Header>
    );
  }
}


export class ArticleView extends Component {
  constructor(props) {
    super(props)
    this.state = {
      modalVisible : false,
    };

    this._webView = null;
  }

  setModalVisible(visible) {
      this.setState({ modalVisible: visible });
  }

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
      <View style={{ flex:1 }}>
        <Error name={ errorName } />
        <Text>Failed to load site; try reloading later...</Text>
        <Button block rounded danger
          onPress={ () => { this.setModalVisible(!this.state.modalVisible) } }
          style={{ padding: 15, margin: 15 }}
        >
          <Text>Refresh</Text>
        </Button>
      </View>
    );
  }

  render() {
    /* TODO: Should use injectedJavaScriptBeforeContentLoaded
      * but it doesn't work on Anroid, see
      * https://github.com/react-native-community/react-native-webview/issues/1095
      * As such we cannot capture window.onload events; need a
      * different workaround */
    const { url } = this.props.route.params;

    return (
      <View style={ styles.container }>
        <Animated.ScrollView { ...this.props }
          style={[ this.props.style, styles.container ]}
        >
          <WebView
            javaScriptEnabled
            injectedJavaScript={ injectionJS }
            source={ {uri: url} }
            renderLoading={ () => this.renderLoadingWebView() }
            renderError={ (errorName) => this.renderErrorWebView(errorName) }
            ref={ x => {this._webView = x} }
            onMessage={ e => this.onMessageFromWebView(e.nativeEvent.data) }
          />
        </Animated.ScrollView>
        <ArticleButtons style={ styles.buttons } articleId={ url } />
      </View>
    );
  }
}


// Create a StackNavigator.Screen for an ArticleView given a StackNavigator
export default function createArticleViewScreen(screenName, StackNavigator) {
  return AnimatedHeaderScrollView(
    screenName, ArticleHeader, ArticleView, StackNavigator);
}


// TODO: Consolidate header styles--some views have different header
// components, but the styling for them is roughly the same across
// the board.
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#212121',
    flexDirection: 'row'
  },
  headerIcon: {
    color: '#fff'
  },
  headerLeft: {
    alignItems: 'flex-start',
    flex: 0.2
  },
  headerBody: {
    flex: 1,
    alignItems: 'flex-start'
  },
  headerTitle: {
    ...getTheme()['NativeBase.Title'],
    marginLeft: 0,
    color: '#fff'
  },
  buttons: {
    flex: 0,
    height: 48,
    backgroundColor: 'white'
  }
})
