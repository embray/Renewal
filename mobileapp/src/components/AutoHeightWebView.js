/* Implements a WebView component that automatically sets its own height
 * based on the size of its contents.  Normally, a WebView flexes to fill
 * the height of its parent component.  However, children of ScrollViews
 * do not do this--they must have a fixed height in order for the ScrollView
 * know the size of its content--this is not specific to WebViews--it's true
 * of any child component of a ScrollView; see this post for an explanation
 * (sort of): https://github.com/facebook/react-native/issues/4773#issuecomment-198738602
 *
 * We would like a self-sizing WebView that can be embedded inside a ScrollView,
 * for use with the AnimatedHeaderScrollView wrapper.
 *
 * This is inspired by the react-native-webview-autoheight package, but we don't use
 * it because the copy on NPM appears to be un/under-maintained, and it is easy
 * enough to roll our own using the same approach...
 * https://github.com/scazzy/react-native-webview-autoheight
 */

import React, { Component } from 'react';
import { Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';


const injectedScript = function() {
  function postMessage(height) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AUTO_HEIGHT_WEB_VIEW',
      payload: height
    }));
  }

  // Post the initial message with the current document height
  postMessage(Math.max(document.documentElement.clientHeight,
                       document.documentElement.scrollHeight,
                       document.body.clientHeight,
                       document.body.scrollHeight));

  // Create a new ResizeObserver to watch changes in the document
  // height
  const resizeObserver = new ResizeObserver((entries) => {
    const heights = [];
    entries.forEach((entry) => {
      if (entry.contentBoxSize) {
        heights.push(entry.contentBoxSize.blockSize);
      } else {
        heights.push(entry.contentRect.height);
      }
    });
    postMessage(Math.max(...heights));
  });

  resizeObserver.observe(document.documentElement);
  resizeObserver.observe(document.body);
}


export default class AutoHeightWebView extends Component {
  static defaultProps = {
    onMessage: () => {},
    injectedJavaScript: ''
  }

  state = {
    webViewHeight: 0
  }

  constructor(props) {
    super(props);
    this.webView = null;
    this._onMessage = this._onMessage.bind(this);
  }

  _onMessage(evt) {
    const { onMessage } = this.props;
    const messageStr = evt.nativeEvent.data;
    let message = null;

    try {
      message = JSON.parse(messageStr);
    } catch {
      // Not a JSON message; ignored by this handler
    }

    if (message !== null) {
      if (message.type == 'AUTO_HEIGHT_WEB_VIEW') {
        this.setState({ webViewHeight: message.payload });
      }
    }

    onMessage(evt);
  }

  render() {
    let { injectedJavaScript, ...otherProps } = this.props;
    const window = Dimensions.get('window');
    const width = window.width;
    const height = this.state.webViewHeight || window.height;
    injectedJavaScript = `(${String(injectedScript)})();` + injectedJavaScript;

    return (
      <WebView
        ref={ (ref) => { this.webView = ref } }
        { ...otherProps }
        injectedJavaScript={ injectedJavaScript }
        scrollEnabled={ this.props.scrollEnabled || false }
        javaScriptEnabled={ true }
        automaticallyAdjustContentInsets={ true }
        onMessage={ this._onMessage }
        style={[ { width }, this.props.style, { height } ]}
      />
    );
  }
}
