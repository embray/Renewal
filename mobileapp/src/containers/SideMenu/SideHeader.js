import {
  Body,
  Button,
  Header,
  Icon,
  Left,
  Right,
  Title
} from 'native-base';
import React, { Component } from 'react';
import { StyleSheet } from 'react-native';

import { capitalize } from '../../utils';


// Screen header for all side-screens
// This is distinct from the more stylize home screen header.
// TODO: Need to centralize header styles; there is currently a lot of
// duplication of this.
export default class SideHeader extends Component {
  _onBack() {
    this.props.navigation.goBack();
  }

  render() {
    const { name } = this.props.scene.route;

    return (
      <Header style={ styles.header }>
        <Left style={ styles.headerLeft }>
          <Button transparent onPress={ this._onBack.bind(this) }>
            <Icon name='md-arrow-back' style={ styles.headerIcon } />
          </Button>
        </Left>
        <Body>
          <Title style={ styles.headerTitle }>{ capitalize(name) }</Title>
        </Body>
        <Right>
        </Right>
      </Header>
    );
  }
}


const styles = StyleSheet.create({
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
  }
});
