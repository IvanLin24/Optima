import test from 'node:test';
import assert from 'node:assert/strict';
import {initTheme,themeButton,toggleTheme} from '../frontend/product/theme.js';
function fixture(){
 const keys=['document','localStorage','matchMedia','innerWidth','innerHeight'];
 const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const root={dataset:{},style:{}};let stored='dark';
 globalThis.document={documentElement:root,querySelector:()=>null,querySelectorAll:()=>[]};
 globalThis.localStorage={getItem:()=>stored,setItem:(_,value)=>{stored=value;}};
 globalThis.matchMedia=()=>({matches:true});globalThis.innerWidth=1200;globalThis.innerHeight=800;
 return {root,restore(){for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}};
}
test('theme switch describes the current dark appearance and remains usable without animation',async()=>{
 const f=fixture();try{
  initTheme();assert.equal(f.root.dataset.theme,'dark');assert.match(themeButton(),/aria-label="Тёмная тема" aria-checked="true"/);
  await toggleTheme();assert.equal(f.root.dataset.theme,'light');assert.match(themeButton(),/aria-label="Светлая тема" aria-checked="false"/);
 }finally{f.restore();}
});
test('a failed browser snapshot still applies the appearance once and unlocks the switch',async()=>{
 const f=fixture();try{
  initTheme();globalThis.matchMedia=()=>({matches:false});
  document.startViewTransition=()=>{throw Error('Snapshot unavailable');};
  await toggleTheme();assert.equal(f.root.dataset.theme,'light');assert.equal(f.root.dataset.themeTransition,undefined);
  await toggleTheme();assert.equal(f.root.dataset.theme,'dark');
 }finally{f.restore();}
});
