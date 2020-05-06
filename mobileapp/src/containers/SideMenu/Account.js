import I18n from 'ex-react-native-i18n';
import {
  Body,
  Container,
  Content,
  Icon,
  Input,
  Left,
  List,
  ListItem,
  Radio,
  Right,
  Text
} from 'native-base';
import React, { Component } from 'react';
import { StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createStackNavigator } from '@react-navigation/stack';
import { connect } from 'react-redux';

import accountActions from '../../actions/account';
import { mapToObject } from '../../utils';
import Dialog from '../../components/Dialog';
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


const NameDialog = Dialog(
  I18n.t('account_displayname'),
  I18n.t('account_displayname_popup')
)


// TODO: This dialog needs i18n support
// GenderDialog implements a non-trivial inputter that allows selecting
// male, female, or a custom-input other gender
const GenderDialog = Dialog(
  I18n.t('account_gender'),
  I18n.t('account_gender_popup'),
  function() {
    const onPressBinary = (value) => {
      return () => { this.setState((prevState) => {
        return {
          value,
          otherValue: getOtherValue(prevState.value)
        };
      }) }
    }

    const onPressOther = () => {
      this.setState({
        value: this.state.otherValue || null
      }, () => {
        if (this.otherRef && !this.otherRef._root.isFocused()) {
          this.otherRef._root.focus();
        }
      });
    }

    const getOtherValue = (value) => (
      value && value != 'male' && value != 'female' ?
      value : this.state.otherValue
    );

    let otherSelected = this.state.value == getOtherValue(this.state.value);

    return (
      <>
        <ListItem onPress={ onPressBinary('male') }>
          <Left><Text>Male</Text></Left>
          <Right>
            <Radio selected={ this.state.value == 'male' }
                   onPress={ onPressBinary('male') }
            />
          </Right>
        </ListItem>
        <ListItem onPress={ onPressBinary('female') }>
          <Left><Text>Female</Text></Left>
          <Right>
            <Radio selected={ this.state.value == 'female' }
                   onPress={ onPressBinary('female') }
            />
          </Right>
        </ListItem>
        <ListItem onPress={ onPressOther }>
          <Left>
            <Input placeholder="Other"
              value={ getOtherValue(this.state.value) }
              onChangeText={ (value) => {
                this.setState({ value: value })
              }}
              ref={ (ref) => this.otherRef = ref }
              onFocus={ onPressOther }
            />
          </Left>
          <Right>
            <Radio selected={ otherSelected }
              onPress={ onPressOther }
            />
          </Right>
        </ListItem>
      </>
    );
  }
);


const LocationDialog = Dialog(
  I18n.t('account_location'),
  I18n.t('account_location_popup')
)


const EmailDialog = Dialog(
  I18n.t('account_email'),
  I18n.t('account_email_popup'),
  { keyboardType: "email-address", autoCompleteType: "email" },
  (value) => {
    const regExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return regExp.test(value || '');
  }
)


const PhoneNumberDialog = Dialog(
  I18n.t('account_phonenumber'),
  I18n.t('account_phonenumber_popup'),
  { keyboardType: "phone-pad", autoCompleteType: "tel" }
)


class _AccountContent extends Component {
  state = { visibleDialog: null }

  constructor(props) {
    super(props);
    this.accountChanges = new Map();
    this.navigationUnsubscribe = null;
  }

  componentDidMount() {
    this.navigationUnsubscribe = this.props.navigation.addListener(
      'blur', () => {
        if (this.accountChanges.size) {
          // copy the Map to an object before passing through to the redux
          // action in case the original Map gets mutated again
          this.props.save(mapToObject(this.accountChanges));
          this.accountChanges.clear();
        }
    });
  }

  componentWillUnmount() {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }
  }

  _onChangeUser(prop, value) {
    this.setState({ 'visibleDialog': null });
    if (value !== undefined && value !== this.props.account[prop]) {
      this.props.update({[prop]: value});
      this.accountChanges.set(prop, value);
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
            { this.renderItem('displayName', 'person', '#0063DC', NameDialog) }
            { this.renderItem('gender', 'transgender', '#FF087F',
                              GenderDialog)
            }
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
