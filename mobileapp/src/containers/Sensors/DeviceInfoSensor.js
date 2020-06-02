import React from 'react';
import Constants from 'expo-constants';
const deviceInfoSensor = {
    _deviceName : function(){
        return Constants.deviceName
    },
    _manifest : function(){
        return Constants.manifest
    },
    isDevice : function(){
        return Constants.isDevice
    },
    _platform : function(){
        return Constants.deviceYearClass
    }
}
export default deviceInfoSensor;
