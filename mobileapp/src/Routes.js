import React, { Component } from 'react';
import {Router, Stack, Scene} from 'react-native-router-flux';
{/*initial path*/}
import InitialPath from './containers/InitialPath';
{/*login*/}
import LoginApp from './containers/LoginAnimation';
import HomeSreen from './containers/HomeScreen/HomeScreen';
{/*Home*/}
import Home from './containers/Home';
{/*sidemenu*/}
import DiverseRecommendation from './containers/ListOfArticles/DiverseRecommendation';
import Favorite from './containers/SideMenuScreens/Favorite';
import History from './containers/SideMenuScreens/History';
import Account from './containers/SideMenuScreens/Account';
import SConcept from './containers/SideMenuScreens/SimpleConcept';
import Settings from './containers/SideMenuScreens/Settings';
{/*webview*/}
import Webview from './containers/WebView/WebView';
{/*prototypes*/}
import ListView from './prototypes/ListView/ListView';
import ArticleView from './prototypes/ListView/ArticleView';
import Timer from './prototypes/Timer';
{/*sensors*/}
import Accelerometer from './prototypes/Sensors/Accelerometer';
import Gyroscope from './prototypes/Sensors/Gyroscope';
import Localization from './prototypes/Sensors/Localization';
import Location from './prototypes/Sensors/Location';
import Magnetometer from './prototypes/Sensors/Magnetometer';
import Pedometer from './prototypes/Sensors/PedometerSensor';

export default class Routes extends Component {
	render() {
		return(
			<Router>
				<Stack key="root" hideNavBar={true}>
					<Scene key="initialPath" component={InitialPath} title="RENEWAL" initial />


					{/*concept swipe*/}
					<Scene key="conceptSwipe" component={SConcept} title="Le Concept" />

					{/*login*/}
					<Scene key="loginapp" component={LoginApp} title="LoginApp" />

					{/*home*/}
					<Scene key="screenCenter" component={Home} title="RENEWAL"   />
					{/* sidemenu */}
					<Scene key="diverseRecommendation" component={DiverseRecommendation} title="RENEWAL" />
					<Scene key="favorite" component={Favorite} title="Favorite" />
					<Scene key="history" component={History} title="History" />
					<Scene key="account" component={Account} title="Account" />
					<Scene key="settings" component={Settings} title="Settings"  />


					{/*webview*/}
					<Scene key="webview" component={Webview} title="Webview"  />



					{/*prototypes*/}
					<Scene key="flatListViewArticle" component={ListView} title="FlatListViewArticle" />
					<Scene key="articleView" component={ArticleView} title="Details" />
					<Scene key="timer" component={Timer} title="Timer" />

					{/*sensors*/}
					<Scene key="accelerometer" component={Accelerometer} title="Accelerometer" />
					<Scene key="gyroscope" component={Gyroscope} title="Gyroscope" />
					<Scene key="localization" component={Localization} title="Localization" />
					<Scene key="location" component={Location} title="Location" />
					<Scene key="magnetometer" component={Magnetometer} title="Magnetometer" />
					<Scene key="pedometer" component={Pedometer} title="Pedometer" />

				</Stack>
			 </Router>
			)
	}
}
