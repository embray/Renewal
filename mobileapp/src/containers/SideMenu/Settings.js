import Constants from 'expo-constants';
import I18n from 'ex-react-native-i18n';
import {
  Body,
  Button,
  Content,
  Icon,
  List,
  ListItem,
  Left,
  Right,
  Switch,
  Text
} from 'native-base';
import React, { Component } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { connect } from 'react-redux';
import { Alert, Linking, StyleSheet } from 'react-native';

import settingsActions from '../../actions/settings';
import { capitalize } from '../../utils';
import SideHeader from './SideHeader';


I18n.fallbacks = true
I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


const SettingsStack = createStackNavigator();


export default class Settings extends Component {
  render() {
    return (
      <SettingsStack.Navigator
        screenOptions={{ header: (props) => <SideHeader {...props} /> }}
      >
        <SettingsStack.Screen name="settings"
          component={ SettingsContents }
      />
      </SettingsStack.Navigator>
    );
  }
}


const CONTACT_EMAIL = Constants.manifest.extra.contactEmail;


class _SettingsContents extends Component {
  settingsSections = [{
    name: 'title',
    explain: true
  }, {
    name: 'sensors',
    explain: true,
    settings: [
      { name: 'location' },
      { name: 'pedometer' },
      { name: 'gyroscope' },
      { name: 'accelerometer' },
      { name: 'magnetometer' },
      { name: 'network' }
    ]
  }, {
    name: 'recommendations',
    explain: true,
    settings: [
      { name: 'activity', explain: true },
      { name: 'access', explain: true },
      { name: 'targeting', explain: true },
      { name: 'notifications' }
    ]
  }, {
    name: 'more_information',
    // TODO: Several of these links need to be updated; currently they just
    // link to Facebook's policies, whereas I assume at some point there
    // will be a webpage for Renewal and policies on that site.
    links: [{
      name: 'assistance',
      uri: `mailto:${CONTACT_EMAIL}?subject=Renewal:assistance`
    }, {
      name: 'privacy',
      uri: 'https://www.facebook.com/privacy/explanation'
    }, {
      name: 'terms',
      uri: 'https://www.facebook.com/terms'
    }, {
      name: 'legal',
      uri: 'https://www.facebook.com/terms'
    }]
  }];

  constructor(props) {
    super(props);
    this.origSettings = { ...this.props.settings };
    this.settingsChanges = new Map();
    this.navigationUnsubscribe = null;
  }

  componentDidMount() {
    this.navigationUnsubscribe = this.props.navigation.addListener(
      'blur', () => {
        if (this.settingsChanges.size) {
          // Diff the changed settings with the original settings
          // and see if anything needs to be saved.
          const changes = {};
          this.settingsChanges.forEach((value, key) => {
            if (value != this.origSettings[key]) {
              changes[key] = value;
            }
          });
          // copy the Map to an object before passing through to the redux
          // action in case the original Map gets mutated again
          this.props.save({ changes, prevSettings: this.origSettings });
          this.origSettings = { ...this.props.settings };
        }
    });
  }

  componentWillUnmount() {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }
  }

  onChangeLocation(value) {
    if (value) {
      Alert.alert(
        I18n.t('settings_popup_location'),
        I18n.t('settings_popup_location_explain'),
        [{
          text: I18n.t('settings_popup_cancel'),
          onPress: () => this.updateSetting('location', false),
          style: 'cancel'
        }, {
          // TODO: This appears to be broken.
          text: I18n.t('settings_popup_gosettings'),
          onPress: () => Linking.openURL('app-settings:')
        }],
        { cancelable: false }
      );
    }
  }

  onChangePedometer(value) {
    if (value) {
      Alert.alert(
        I18n.t('settings_popup_pedometer'),
        I18n.t('settings_popup_pedometer_explain'),
        [{
          text: I18n.t('settings_popup_refuse'),
          onPress: () => this.updateSetting('pedometer', false),
          style: 'cancel'
        }, {
          // TODO: This appears to be broken.
          text: I18n.t('settings_popup_allow'),
          onPress: () => Linking.openURL('app-settings:')
        }],
        { cancelable: false }
      );
    }
  }

  onChangeNotifications(value) {
    if (value) {
      Alert.alert(
        I18n.t('settings_popup_notification'),
        I18n.t('settings_popup_notification_explain'),
        [{
          text: I18n.t('settings_popup_refuse'),
          onPress: () => this.updateSetting('notifications', false),
          style: 'cancel'
        }, {
          // TODO: This appears to be broken.
          text: I18n.t('settings_popup_gosettings'),
          onPress: () => Linking.openURL('app-settings:'),
        }],
        { cancelable: false }
      );
    }
  }

  updateSetting(setting, value) {
    this.props.update({ [setting]: value });
    this.settingsChanges.set(setting, value);
  }

  toggleSetting(setting, value) {
    // Some settings can define an onChange<Setting> handler which
    // intercepts the value and can modify the new value depending
    // on the outcome of a user interaction
    const handler = this[`onChange${capitalize(setting)}`];
    this.updateSetting(setting, value);
    if (handler !== undefined) {
      handler.bind(this)(value);
    }
  }

  renderSetting(section, setting) {
    const name = setting.name;
    return (
      <React.Fragment key={ name }>
        <ListItem icon style={ styles.setting }>
          <Left style={ styles.settingLeft }>
            <Text>{ I18n.t(`settings_section_${section}_${name}`) }</Text>
          </Left>
          <Body />
          <Right>
            <Switch value={ this.props.settings[name] }
                    onValueChange={ this.toggleSetting.bind(this, name) }
            />
          </Right>
        </ListItem>
        { setting.explain ? (
          <ListItem itemDivider style={ styles.settingExplain }>
            <Text style={ styles.settingExplainText }>
              { I18n.t(`settings_section_${section}_${name}_explain`) }
            </Text>
          </ListItem>
        ): null }
      </React.Fragment>
    );
  }

  renderLink(section, link) {
    const name = link.name;
    return (
      <ListItem onPress={ () => Linking.openURL(link.uri) } key={ name }>
        <Left>
          <Text>{I18n.t(`settings_section_${section}_${name}`)}</Text>
        </Left>
        <Body />
        <Right>
          <Icon name="arrow-forward" />
        </Right>
      </ListItem>
    );
  }

  renderSection(section) {
    const name = section.name;
    const settings = (section.settings ?
      section.settings.map(
        (setting) => (this.renderSetting(name, setting)), this
      ) : null);
    const links = (section.links ?
      section.links.map((link) => (this.renderLink(name, link)), this): null);
    return (
      <React.Fragment key={ `section_${name}` }>
        <ListItem itemDivider style={ styles.sectionTitle }>
          <Text style={ styles.sectionTitleText }>
            { I18n.t(`settings_section_${name}`) }
          </Text>
        </ListItem>
        { section.explain === true ? (
          <ListItem itemDivider style={ styles.sectionExplain }>
            <Text style={ styles.sectionExplainText }>
              { I18n.t(`settings_section_${name}_explain`) }
            </Text>
          </ListItem>
        ) : null }
        { settings }
        { links }
      </React.Fragment>
    );
  }

  render() {
    const sections = this.settingsSections.map(this.renderSection, this);
    return (
      <Content>
        <List style={ styles.sections }>
          { sections }
        </List>
        <Button block danger>
          <Text>{I18n.t('settings_button_request_my_data')}</Text>
        </Button>
    </Content>
   );
  }
}


function mapStateToProps(state) {
  return { settings: state.settings };
}


const SettingsContents = connect(
  mapStateToProps,
  settingsActions
)(_SettingsContents);


const styles = StyleSheet.create({
  sections: {
    backgroundColor: 'white'
  },
  sectionTitle: {
    backgroundColor: '#eeeeee'
  },
  sectionTitleText: {
    fontWeight: 'bold'
  },
  sectionExplain: {
    backgroundColor: '#e0e0e0'
  },
  sectionExplainText: {
    fontSize: 14,
    color: '#a4a4a4'
  },
  setting: {
    backgroundColor: 'white'
  },
  settingExplain: {
    backgroundColor: '#f5f5f5'
  },
  settingExplainText: {
    fontSize: 14,
    color: '#a4a4a4'
  },
  link: {
    backgroundColor: 'white'
  }
});
