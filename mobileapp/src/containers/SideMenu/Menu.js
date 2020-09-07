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
import { Dimensions, Platform, StyleSheet } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList
} from '@react-navigation/drawer';
import { purgeStoredState } from 'redux-persist';

import { signOut } from '../../auth';
import { persistConfig } from '../../storage';


// This logic is copied from the DrawerView.tsx sources in
// @react-navigation/drawer; I can't figure out if there is an easier way to
// determine the default drawer width
function getDefaultDrawerWidth() {
  const { width, height } = Dimensions.get('window');
  const smallerAxisSize = Math.min(height, width);
  const isLandscape = width > height;
  const isTablet = smallerAxisSize >= 600;
  const appBarHeight = Platform.OS === 'ios' ? (isLandscape ? 32 : 44) : 56;
  const maxWidth = isTablet ? 320 : 280;

  return Math.min(smallerAxisSize - appBarHeight, maxWidth);
}


export default function Menu(props) {
  // Use up to 90% of the drawer width for the title
  const titleWidth = getDefaultDrawerWidth() * 0.9;

  return (
    <Container>
      <Header style={ styles.header }>
        <Body>
          <Title adjustsFontSizeToFit
                 style={[ styles.headerTitle, { width: titleWidth } ]}
          >
            Renewal
          </Title>
        </Body>
        <Right />
      </Header>
      <DrawerContentScrollView { ...props }>
        <DrawerItemList { ...props } />
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
    color: 'white',
    fontFamily: 'Chomsky',
    fontSize: 30
  },
  devMenuContainer: {
    marginTop: 10
  }
});
