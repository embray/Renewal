import { Text, View } from 'native-base';
import React, { Component } from 'react';


export default class TickMessage extends Component {
  static defaultProps = { message: '' }
  state = { dots: '' }

  componentDidMount() {
    this.ticker = setInterval(() => {
      this.setState((prevState) => ({
        dots: (prevState.dots == '...' ? '' : prevState.dots + '.')
      }));
    }, 500);
  }

  componentWillUnmount() {
    clearInterval(this.ticker);
  }

  render() {
    const style = [{ flexDirection: 'row' }];
    if (this.props.style) {
      style.splice(0, 0, this.props.style);
    }
    return (
      <View style={ style }>
        <Text>{ this.props.message }</Text>
        <Text style={{ width: 15 }}>{ this.state.dots }</Text>
      </View>
    );
  }
}


