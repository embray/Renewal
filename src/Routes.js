import React, { Component } from 'react';

import {Router, Stack, Scene} from 'react-native-router-flux';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Listview from './pages/ListView';
import Anim from './proto/Anim';
import Ub from './proto/LoginScreen';
import ExpandPage from './proto/ProtoAnimation';
import Webviewcustom from './pages/MessageWebView'

export default class Routes extends Component<{}> {
	render() {
		return(
			<Router>
				<Stack key="root" hideNavBar={true}>
			    	<Scene key="login" component={Login} title="Login" initial={false}/>
			      	<Scene key="signup" component={Signup} title="Register"/>
					<Scene back={true} key="listview" component={Listview} title="Listview" panHandlers={null} />
					<Scene key="webviewcustom" component={Webviewcustom} title="Webviewcustom"  />
					<Scene key="anim" component={Anim} title="Anim"  />
					<Scene key="ub" component={Ub} title="Ub"  />
					<Scene key="expandPage" component={ExpandPage} title="ExpandPage"  initial ={true} />
				</Stack>
			 </Router>
			)
	}
}
