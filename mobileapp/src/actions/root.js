import { combineReducers } from 'redux';

import articleActions, {
  initialState as articleInitialState,
  reducer as articleReducer
} from './articles';


// TODO: In practice we will probably load a persisted state from local
// storage, but we also still need a bare initial state for when local
// storage is empty
export const initialState = {
  account: {},
  settings: {},
  articles: articleInitialState
};


export const reducer = combineReducers({
  articles: articleReducer
});


const actions = {
  articles: articleActions
};


export default actions;
