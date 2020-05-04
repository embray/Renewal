import Constants from 'expo-constants';
import {
  Body,
  Button,
  Container,
  Header,
  Left,
  ListItem,
  Right,
  Separator,
  Text,
  Title,
  View
} from 'native-base';
import React, { Component } from 'react';
import { StyleSheet } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList
} from '@react-navigation/drawer';
import { purgeStoredState } from 'redux-persist';

import Config from '../../../config';
import { persistConfig } from '../../storage';


export default function Menu(props) {
  return (
    <Container>
      <Header style={styles.header}>
        <Left />
        <Body>
          <Title style={styles.headerTitle}>RENEWAL</Title>
        </Body>
        <Right />
      </Header>
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
        { Config.debug && (<DevMenu />) }
      </DrawerContentScrollView>
    </Container>
  );
}


// Additional menu items for development; this is easier than for example trying
// add additional items to the react-native development menu
class DevMenu extends Component {
  // Clear the redux-persist state from AsyncStorage to start from a fresh
  // state.
  _clearPersistedState() {
    purgeStoredState(persistConfig);
    console.warn("State cleared; reload app to reset the in-memory state");
  }

  render() {
    return (
      <View style={ styles.devMenuContainer }>
        <Separator bordered>
          <Text>Dev menu</Text>
        </Separator>
        <Button light onPress={ this._clearPersistedState.bind(this) }>
          <Text>Clear Persisted State</Text>
        </Button>
      </View>
    );
  }
}


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121',
    marginBottom: 5,
  },
  headerTitle: {
    color: 'white'
  },
  devMenuContainer: {
    marginTop: 10
  }
});
