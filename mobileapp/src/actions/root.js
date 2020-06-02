import { combineReducers } from 'redux';

import accountActions, {
  initialState as accountInitialState,
  reducer as accountReducer
} from './account';
import articleActions, {
  initialState as articleInitialState,
  reducer as articleReducer
} from './articles';
import settingsActions, {
  initialState as settingsInitialState,
  reducer as settingsReducer
} from './settings';


// TODO: In practice we will probably load a persisted state from local
// storage, but we also still need a bare initial state for when local
// storage is empty
export const initialState = {
  account: accountInitialState,
  settings: settingsInitialState,
  articles: articleInitialState
};


export const reducer = combineReducers({
  account: accountReducer,
  articles: articleReducer,
  settings: settingsReducer
});


const actions = {
  account: accountActions,
  articles: articleActions,
  settings: settingsActions
};


export default actions;
