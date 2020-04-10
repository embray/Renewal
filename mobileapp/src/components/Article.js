import React, { Component } from 'react';
import {
  Dimensions,
  ImageBackground,              // Renders background image
  StyleSheet,         // CSS-like styles
  Text,               // Renders text
  Image,              // renders img
  TouchableOpacity,   // Handles row presses
  View                // Container component
} from 'react-native';
import { Icon } from 'native-base'
import {
  StackNavigator,
  NavigationActions
} from 'react-navigation';
// Detect screen size to calculate row height
const screen = Dimensions.get('window');
let {navigate} = NavigationActions;
export default class Article extends React.Component {
    render({ article, onPress } = this.props) {
      const { title, rating, image } = article;
      return (
        <View style={styles.article}>
          <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <ImageBackground
              source={{uri: image}} style={styles.image} blurRadius={0}
            >
              <View style={styles.titleContainer}>
                <Text adjustsFontSizeToFitWidth={true} style={styles.title}>
                  {title}
                </Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>
      );
    }
}


  const styles = StyleSheet.create({
    article: {
      marginTop: 5,
      marginBottom: 5
    },
    image: {
      height: screen.height / 3,          // Divide screen height by 3
      justifyContent: 'flex-end',           // Center vertically
      alignItems: 'center',
      borderRadius: 10,
      overflow: 'hidden'
    },
    // Shared text style
    text: {
      width: '100%',
      textAlign: 'center'
    },
    titleContainer: {
      paddingHorizontal: 5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: screen.width,
      height: (screen.height/5)/2.5,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.75)'
    },
    title: {
      fontSize: 16,                       // Bigger font size
      fontWeight: 'bold',
      color: 'white'
    },
    // Rating row
    rating: {
      flexDirection: 'row',               // Arrange icon and rating in one line
    },
    // Certified fresh icon
    icon: {
      width: 22,                          // Set width
      height: 22,                         // Set height
      marginRight: 5,                     // Add some margin between icon and rating
    },
    // Rating value
    value: {
      fontSize: 12,                       // Smaller font size
      textAlign: 'left',
    },
    bloc:{
      position: 'absolute',
      bottom: 0,
      width: '100%'
    }
  });
