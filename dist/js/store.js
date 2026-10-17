import {INITIAL_NEEDS} from './data.js';
const KEY='optima-vtb-state-v1';
export const initialState=()=>({needs:structuredClone(INITIAL_NEEDS),orders:[],favorites:[],events:[],notificationsRead:false,ui:{catalogLayout:'grid'}});
export function loadState(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Array.isArray(s.needs)&&Array.isArray(s.orders))return {...initialState(),...s};}catch{}return initialState();}
export function saveState(state){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
export function event(state,message){state.events.unshift({at:new Date().toISOString(),message});state.events=state.events.slice(0,40);}
