import { combineReducers } from 'redux';

import accountActions, {
  initialState as accountInitialState,
  reducer as accountReducer
} from './account';
import articleActions, {
  initialState as articleInitialState,
  reducer as articleReducer
} from './articles';


// TODO: In practice we will probably load a persisted state from local
// storage, but we also still need a bare initial state for when local
// storage is empty
export const initialState = {
  account: accountInitialState,
  settings: {},
  articles: articleInitialState
};


export const reducer = combineReducers({
  account: accountReducer,
  articles: articleReducer
});


const actions = {
  account: accountActions,
  articles: articleActions
};


export default actions;
