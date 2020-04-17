import {
  Body,
  Button,
  Container,
  Content,
  Footer,
  FooterTab,
  Header,
  Icon,
  Left,
  List,
  ListItem,
  Right,
  Text,
  Title
} from 'native-base';
import React from 'react';
import { StyleSheet } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList
} from '@react-navigation/drawer';
import Constants from 'expo-constants';

import I18n from 'ex-react-native-i18n';

I18n.fallbacks = true
const deviceLocale = I18n.locale

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


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
      </DrawerContentScrollView>
    </Container>
  );
}


const styles = StyleSheet.create({
  header: {
    backgroundColor: '#212121',
    marginBottom: 5,
  },
  headerTitle: {
    color: 'white'
  }
});
