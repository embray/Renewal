// This screen implements account linking via e-mail
// The user is first asked to enter their e-mail address--if the address
// is already associated with an e-mail/password-based account then we
// ask for their password, otherwise we ask them to create an account
// by providing a password (with confirmation).
//
// The flow is almost exactly the same in either case, saving the need
// for separate sign-in/sign-up components.  The only difference is
// whether an existing account is signed into, or a new account is
// created (and immediately signed into).
import { Button, Text, View } from 'native-base';
import React, { Component } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { connect } from 'react-redux';
import { unwrapResult } from '@reduxjs/toolkit'

import accountActions from '../../actions/account';
import { hasEmailPasswordAccount } from '../../auth';
import { ValidatingInput } from '../../components/Dialog';


const emailRegexp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;


class _EmailSignin extends Component {
  constructor(props) {
    super(props);

    this.state = {
      step: 'email',
      loading: false,
      email: null,
      password: null,
      confirmPassword: null
    }
  }

  // Check if an account already exists for this e-mail address
  // (with password-based auth provider); if so move to the signin
  // screen; otherwise to the signup screen
  async checkAccount() {
    this.setState({ loading: true });
    const hasAccount = await hasEmailPasswordAccount(this.state.email);
    if (hasAccount) {
      this.setState({ step: 'signin', loading: false });
    } else {
      this.setState({ step: 'signup', loading: false });
    }
  }

  signUp() {
    this.props.linkAccount({
      provider: 'email',
      credential: { email: this.state.email, password: this.state.password }
    }).then(unwrapResult).then(() => this.props.navigation.goBack());
  }

  signIn() {
    this.props.signIn({
      provider: 'email',
      credential: { email: this.state.email, password: this.state.password }
    }).then(unwrapResult).then(() => this.props.navigation.goBack());
  }

  renderEmailStep() {
    return (
      <>
        <Text>link your account with e-mail/password</Text>
        <ValidatingInput style={ style.input }
          keyboardType="email-address"
          autoCompleteType="email"
          validate={ (value) => emailRegexp.test(value || '') }
          onChangeText={ (email) => this.setState({ email }) }
          textAlign="center"
          placeholder="enter your e-mail address"
        />
        <Button
          style={ this.state.email == null ? {} : style.button }
          disabled={ this.state.email == null }
          onPress={ () => this.checkAccount() }
        >
          <Text>Continue</Text>
        </Button>
      </>
    );
  }

  renderSignupStep() {
    return (
      <>
        <Text>enter a password (8 characters minimum)</Text>
        <ValidatingInput style={ style.input }
          autoCompleteType="password"
          secureTextEntry
          validate={ (value) => value && value.length >= 8 }
          onChangeText={ (password) => this.setState({ password }) }
          placeholder="password"
        />
        <ValidatingInput style={ style.input }
          autoCompleteType="password"
          secureTextEntry
          validate={ (value) => value && value.length >= 8 && value == this.state.password }
          onChangeText={ (confirmPassword) => this.setState({ confirmPassword }) }
          placeholder="confirm password"
        />
        <Button
          style={ this.state.confirmPassword == null ? {} : style.button }
          disabled={ this.state.confirmPassword == null }
          onPress={ () => this.signUp() }
        >
          <Text>Sign Up</Text>
        </Button>
      </>
    );
  }

  renderSigninStep() {
    return (
      <>
        <Text>sign in with the password associated with this e-mail</Text>
        <ValidatingInput style={ style.input }
          autoCompleteType="password"
          secureTextEntry
          onChangeText={ (password) => this.setState({ password }) }
          placeholder="password"
        />
        <Button
          style={ this.state.password == null ? {} : style.button }
          disabled={ this.state.password == null }
          onPress={ () => this.signIn() }
        >
          <Text>Sign Up</Text>
        </Button>
      </>
    );
  }

  renderCurrentStep() {
    switch (this.state.step) {
      case 'email':
        return this.renderEmailStep();
        break;
      case 'signup':
        return this.renderSignupStep();
        break;
      case 'signin':
        return this.renderSigninStep();
        break;
      default:
        return null;
    }
  }

  render() {
    return (
      <View style={ style.container }>
        <Text style={ style.logo }>Renewal</Text>
        { this.state.loading ? (
          <ActivityIndicator small animated />
        ) : this.renderCurrentStep() }
      </View>
    );
  }
}


const EmailSignin = connect(undefined, accountActions)(_EmailSignin);
export default EmailSignin;


const style = StyleSheet.create({
  container: {
    backgroundColor: 'lightgray',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logo: {
    color: 'black',
    fontFamily: 'Chomsky',
    fontSize: 60
  },
  input: {
    marginTop: 20,
    marginBottom: 10,
    marginLeft: '10%',
    marginRight: '10%',
    backgroundColor: 'white'
  },
  button: {
    color: 'white',
    backgroundColor: 'gray',
    borderColor: 'lightgray',
    borderWidth: 1
  }
});
