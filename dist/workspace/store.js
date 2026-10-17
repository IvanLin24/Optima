import {seed} from './seed.js';
import {action,clone} from './model.js';
const KEY='optima-platform-preview-v1';
const listeners=new Set();
function read(){try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.version===1&&Array.isArray(saved.purchases)&&Array.isArray(saved.questions)&&Array.isArray(saved.contracts))return saved;}catch{}return seed();}
let state=read();
export const getState=()=>clone(state);
export const subscribe=fn=>(listeners.add(fn),()=>listeners.delete(fn));
function notify(){for(const fn of listeners)fn(getState());}
export function dispatch(type,payload){const updated=action(state,type,payload);state=updated;try{localStorage.setItem(KEY,JSON.stringify(updated));}catch{}notify();return clone(state);}
export function resetDemo(){state=seed();try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}notify();}
export function applyStateForTests(next){state=clone(next);notify();}
globalThis.addEventListener?.('storage',ev=>{if(ev.key===KEY){state=read();notify();}});
