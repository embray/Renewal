import { Icon, Item, Input } from 'native-base';
import React, { Component, useState } from 'react';
import RNDialog from "react-native-dialog";


export function ValidatingInput(props) {
  const { value, validate, inputStyle, onChangeText } = props;
  const [ valid, setValid ] = useState(validate ? validate(value) : true);

  const inputProps = { ...props };
  inputProps.style = inputStyle;
  delete inputProps.value;  // This should only set the initial value

  const itemProps = { style: props.style };
  let inputIcon = null;

  if (validate !== undefined) {
    if (valid) {
      itemProps['success'] = true;
      inputIcon = (<Icon name="checkmark-circle" />);
    } else {
      itemProps['error'] = true;
      inputIcon = (<Icon name="close-circle" />);
    }
  }

  const _onChangeText = (value) => {
    value = value.trim();
    const valid = validate ? validate(value) : true;
    if (onChangeText !== undefined) {
      // Call the onChangeText callback passed by the parent
      // returning null to indicate an invalid value
      onChangeText(valid ? value : null);
    }
    setValid(valid);
  }

  return (
    <Item { ...itemProps }>
      <Input { ...inputProps } onChangeText={ _onChangeText }>
        { value }
      </Input>
      { inputIcon }
    </Item>
  );
}


// Higher-order component which creates a modal dialog
// By default has an input text box, but if passed an inputter function
// a different inputter can be provided.  The Component instance is bound
// to the inputter function's `this`, so do not use an arrow function unless
// the inputter does not require access to the Dialog's state.
//
// If inputter is an object instead of a function, it is passed as props to the
// default inputter.
//
// If passed a validate function, the input will only be accepted if it
// passes validation.
//
// The returned component should be given an onChange prop, a function
// which accepts the value of the of Dialog's input when accepted (it
// is passed undefined when the Dialog is canceled instead of confirmed)
export default function Dialog(title, description, inputter, validate) {
  return class Dialog extends Component {
    static defaultProps = {
      title, description, inputter, validate,
      visible: false
    }

    constructor(props) {
      super(props);
      const value = this.props.value;
      const validate = this.props.validate;
      this.state = { value };
    }

    render() {
      const inputterProps = {
        onChangeText: (value) => this.setState({ value })
      };

      const defaultInputter = () => {
        return (
          <ValidatingInput { ...inputterProps }
            validate={ validate } value={ this.state.value }
          />
        );
      }

      let inputter = defaultInputter;

      if (this.props.inputter) {
        if (typeof(this.props.inputter) === 'object') {
          Object.assign(inputterProps, this.props.inputter);
        } else if (typeof(this.props.inputter) === 'function') {
          inputter = this.props.inputter.bind(this);
        }
      }

      return (
        <RNDialog.Container visible={ this.props.visible }>
          <RNDialog.Title style={{ fontWeight: 'bold' }}>
            { this.props.title }
          </RNDialog.Title>
          <RNDialog.Description>
            { this.props.description }
          </RNDialog.Description>
          { inputter() }
          <RNDialog.Button label="Cancel" onPress={ () => this.props.onChange() } />
          <RNDialog.Button label="OK"
            onPress={ () => this.props.onChange(this.state.value) }
            disabled={ this.state.value === null || this.state.value === undefined }
          />
        </RNDialog.Container>
      );
    }
  }
}
