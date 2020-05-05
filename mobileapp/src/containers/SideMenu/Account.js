import I18n from 'ex-react-native-i18n';
import {
  Body,
  Container,
  Content,
  Icon,
  Input,
  Item,
  Left,
  List,
  ListItem,
  Right,
  Text
} from 'native-base';
import React, { Component } from 'react';
import { StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Dialog from "react-native-dialog";
import { createStackNavigator } from '@react-navigation/stack';
import { connect } from 'react-redux';

import accountActions from '../../actions/account';
import SideHeader from './SideHeader';


I18n.fallbacks = true
const deviceLocale = I18n.locale

I18n.translations = {
  'en': require("../../i18n/en"),
  'fr': require('../../i18n/fr'),
};


const AccountStack = createStackNavigator();


export default class Account extends Component {
  render() {
    return (
      <AccountStack.Navigator
        screenOptions={{ header: (props) => <SideHeader {...props} /> }}
      >
        <AccountStack.Screen name="account"
          component={ AccountContent }
      />
      </AccountStack.Navigator>
    );
  }
}


function DatePicker(props) {
  // TODO: the "select date" text should be localized
  const { value } = props;
  if (value == null) {
    var date = new Date();  // Today
  } else {
    // Date obj from date string
    var date = new Date(value);
  }

  const onChange = (evt, value) => {
    if (value !== undefined) {
      // Convert to the string format that's stored in our state
      value = value.toISOString().slice(0, 10);
    }
    if (props.onChange) {
      props.onChange(value)
    }
  }

  if (!props.visible) {
    return null;
  }

  return (
    <DateTimePicker
      value={ date }
      mode="date"
      minimumDate={ new Date(1900, 0, 1) }
      maximumDate={ new Date() }
      onChange={ onChange }
    />
  );
}


class LocationDialog extends Component {
  constructor(props) {
    super(props);
    this.state = { location: props.value };
  }

  _onChangeText(location) {
    this.setState({ location })
  }

  render() {
    // TODO: For location, add an option to detect location automatically
    // (given user location permissions)
    return (
      <Dialog.Container visible={ this.props.visible }>
        <Dialog.Title>{I18n.t('account_location')}</Dialog.Title>
        <Dialog.Description>
          {I18n.t('account_location_popup')}
        </Dialog.Description>
        <Item>
          <Input onChangeText={ this._onChangeText.bind(this) }>
            { this.props.location }
          </Input>
        </Item>
        <Dialog.Button label="Cancel" onPress={ () => this.props.onChange() } />
        <Dialog.Button label="OK"
          onPress={ () => this.props.onChange(this.state.location) }
        />
      </Dialog.Container>
    );
  }
}


// TODO: This is almost verbatim same as LocationDialog; come up with maybe
// a more generic dialog component...
class EmailDialog extends Component {
  static regExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

  constructor(props) {
    super(props);
    this.state = {
      email: props.value,
      valid: this._validate(props.value)
    };
  }

  _validate(email) {
    return EmailDialog.regExp.test(email || '');
  }

  _onChangeText(email) {
    email = email.trim();
    this.setState({
      email,
      valid: this._validate(email)
    })
  }

  render() {
    const inputStyle = {};
    let inputIcon = 'close-circle';
    if (this.state.valid) {
      inputStyle['success'] = true;
      inputIcon = 'checkmark-circle';
    } else {
      inputStyle['error'] = true;
    }
    return (
      <Dialog.Container visible={ this.props.visible }>
        <Dialog.Title>{I18n.t('account_email')}</Dialog.Title>
        <Dialog.Description>
        {I18n.t('account_email_popup')}
        </Dialog.Description>
        <Item { ...inputStyle }>
          <Input onChangeText={ this._onChangeText.bind(this) }
                 keyboardType="email-address" autoCompleteType="email"
          >
            {this.state.email}
          </Input>
          <Icon name={ inputIcon } />
        </Item>
        <Dialog.Button label="Cancel" onPress={ () => this.props.onChange() } />
        <Dialog.Button label="OK"
          onPress={ () => this.props.onChange(this.state.email) }
          disabled={ !this.state.valid }
        />
      </Dialog.Container>
    );
  }
}


// TODO: Again, largely repetitive; this could be cleaned up significantly.
class PhoneNumberDialog extends Component {
  constructor(props) {
    super(props);
    this.state = { phoneNumber: props.value };
  }

  _onChangeText(phoneNumber) {
    this.setState({ phoneNumber })
  }

  render() {
    // TODO: For location, add an option to detect location automatically
    // (given user location permissions)
    return (
      <Dialog.Container visible={ this.props.visible }>
        <Dialog.Title>{I18n.t('account_phonenumber')}</Dialog.Title>
        <Dialog.Description>
          {I18n.t('account_phonenumber_popup')}
        </Dialog.Description>
        <Item>
          <Input onChangeText={ this._onChangeText.bind(this) }
                 keyboardType="phone-pad" autoCompleteType="tel"
          >
            { this.props.phoneNumber }
          </Input>
        </Item>
        <Dialog.Button label="Cancel" onPress={ () => this.props.onChange() } />
        <Dialog.Button label="OK"
          onPress={ () => this.props.onChange(this.state.phoneNumber) }
        />
      </Dialog.Container>
    );
  }
}


class _AccountContent extends Component {
  state = { visibleDialog: null }

  _onChangeUser(prop, value) {
    this.setState({ 'visibleDialog': null });
    if (value !== undefined) {
      this.props.update({[prop]: value});
    }
  }

  _onPressItem(name) {
    this.setState({ 'visibleDialog': name });
  }

  renderItem(propName, icon, iconColor, Dialog, placeholder, formatter) {
    const title = I18n.t('account_' + propName.toLowerCase());
    const value = this.props.account[propName];
    let formattedValue = value;
    if (value !== null && formatter) {
      formattedValue = formatter(value)
    }

    return (
      <ListItem icon onPress={ this._onPressItem.bind(this, propName) }>
        <Left>
          <Icon name={ icon } style={{ color: iconColor }}/>
        </Left>
        <Body>
          <Text>{ title }</Text>
        </Body>
        <Right style={{ flex: 2 }}>
          { Dialog ? (
            <Dialog
              visible={ this.state.visibleDialog == propName }
              value={ value }
              onChange={ this._onChangeUser.bind(this, propName) }
            />
          ) : null }
          { value == null && placeholder ? (
            <Text note>{ placeholder }</Text>) : null
          }
          <Text>{ formattedValue }</Text>
          <Icon name="arrow-forward" />
        </Right>
      </ListItem>
    );
  }

  render() {
    // TODO: Replace the default account icon with the user's avatar
    // if a user image URL is available.
    return (
      <Container>
        <Content>
          <List>
            <ListItem>
              <Left style={{ flex: 1 }} />
              <Body style={ styles.accountIcon }>
                <Icon name="account-circle" type="MaterialCommunityIcons"
                      style={{ fontSize: 56, color: 'gray' }}
                />
              </Body>
              <Right style={{ flex: 1 }} />
            </ListItem>
            { this.renderItem('displayname', 'person', '#0063DC') }
            { this.renderItem('gender', 'transgender', '#FF087F') }
            { this.renderItem('birthdate', 'calendar', '#33CCFF', DatePicker,
                              'select date',
                              (date) => new Date(date).toLocaleDateString())
            }
            { this.renderItem('location', 'navigate', 'green', LocationDialog) }
            { this.renderItem('email', 'mail', '#FF3333', EmailDialog) }
            { this.renderItem('phoneNumber', 'ios-phone-portrait', 'black',
                              PhoneNumberDialog)
            }
          </List>
        </Content>
      </Container>
    );
  }
}


function mapStateToProps(state) {
  return { account: state.account };
}


const AccountContent = connect(
  mapStateToProps,
  accountActions
)(_AccountContent);


const styles = StyleSheet.create({
  accountIcon: {
    alignItems: 'center',
  }
});
