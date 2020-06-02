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

import { signOut } from '../../auth';
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
        { __DEV__ && (<DevMenu />) }
      </DrawerContentScrollView>
    </Container>
  );
}


// Additional menu items for development; this is easier than for example trying
// add additional items to the react-native development menu
class DevMenu extends Component {
  // Clear the redux-persist state from AsyncStorage to start from a fresh
  // state.
  _onClearPersistedState() {
    purgeStoredState(persistConfig);
    console.warn("State cleared; reload app to reset the in-memory state");
  }

  async _onSignOut() {
    await signOut();
    console.warn("Signed out from the user account");
  }

  render() {
    return (
      <View style={ styles.devMenuContainer }>
        <Separator bordered>
          <Text>Dev menu</Text>
        </Separator>
        <Button light onPress={ this._onClearPersistedState.bind(this) }>
          <Text>Clear Persisted State</Text>
        </Button>
        <Button danger onPress={ this._onSignOut.bind(this) }>
          <Text>Sign Out</Text>
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
