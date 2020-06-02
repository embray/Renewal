import React from 'react';
import { AppState } from 'react-native';

const dimensionsSensor = {
    _subscribe : function (){
        AppState.addEventListener('change', appStateSensor._handleAppStateChange);
    },
    _unsubscribe : function(){
        AppState.removeEventListener('change', appStateSensor._handleAppStateChange);
    },
    _handleAppStateChange : (nextAppState) => {
        if (AppState.currentState.match(/inactive|background/) && nextAppState === 'active') {
          console.log('App has come to the foreground!')
        }else{
            console.log('New app state is '+nextAppState)
        }
        //this.setState({appState: nextAppState});
    },
    _getCurrentState(){
        return AppState.currentState;
    }
}
export default dimensionsSensor;
