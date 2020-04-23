/* Implements a subclass of native-base's icon
 * The base class has a potentially nice system for setting icons as
 * active or inactive depending on the "active" prop; however for most
 * icons this doesn't actually work--it determines the active/inactive icon
 * to use (as well as iOS/Android variants from an internal JSON database
 * and there is no way to modify the database it uses (since the Icon class
 * just accesses it as a global variable.
 * This class allows me to shim in my own alternative Icon database; anything
 * not found it reverts to the default.
 */

import { Icon as IconNB } from 'native-base';
import React, { Component } from 'react';
import { Platform } from 'react-native';


/* Note: Originally I tried just extending the IconNB class directly
 * but this is considered an anti-pattern in React do to some deep
 * magic it's doing under the hood which I don't fully understand. */
export default class Icon extends Component {
  /* The alt icon database */
  /* This is a nice gallery of available icons; the MaterialCommunityIcons
   * set has the largest selection, including of filled/unfilled versions of
   * icons: https://oblador.github.io/react-native-vector-icons/ */
  static icons = {
    'bookmark': {
      'type': 'MaterialCommunityIcons',
      'ios': {
        'default': 'bookmark-outline',
        'active': 'bookmark',
      },
      'android': {
        'default': 'bookmark-outline',
        'active': 'bookmark',
      }
    },
    'thumbs-down': {
      'type': 'MaterialCommunityIcons',
      'ios': {
        'default': 'thumb-down-outline',
        'active': 'thumb-down',
      },
      'android': {
        'default': 'thumb-down-outline',
        'active': 'thumb-down',
      }
    },
    'thumbs-up': {
      'type': 'MaterialCommunityIcons',
      'ios': {
        'default': 'thumb-up-outline',
        'active': 'thumb-up',
      },
      'android': {
        'default': 'thumb-up-outline',
        'active': 'thumb-up',
      }
    }
  }

  getExtraProps() {
    if (this.props.name && !(this.props.ios || this.props.android)) {
      let icon = Icon.icons[this.props.name];
      if (icon !== undefined) {
        let plat = (Platform.OS == 'ios' ? 'ios' : 'android');
        return {
          'type': icon.type,
          'name': this.props.active ? icon[plat].active : icon[plat].default
        };
      }
    }
    return { 'type': this.props.type, 'name': this.props.name };
  }

  render() {
    return (<IconNB { ...this.props } { ...this.getExtraProps() } />);
  }
}
