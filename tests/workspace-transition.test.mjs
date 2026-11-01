import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceTransition} from '../frontend/product/workspace-transition.js';

test('rapid navigation commits only the newest destination and releases interaction',async()=>{
 let release;const commits=[];
 const target={isConnected:true,inert:false,animate(){return {finished:new Promise(resolve=>{release=resolve;}),cancel(){}};}};
 const motion=createWorkspaceTransition({getTargets:()=>[target],reduced:()=>false});
 const first=motion.navigate(()=>commits.push('first'));
 const middle=motion.navigate(()=>commits.push('middle'));
 const last=motion.navigate(()=>commits.push('last'));
 assert.equal(target.inert,true);assert.equal(await middle,false);
 release();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(commits,['last']);assert.equal(target.inert,false);
 release();assert.equal(await first,false);assert.equal(await last,true);assert.equal(motion.busy(),false);
});

test('reduced motion switches role without animation; failed navigation does not lock the next one',async()=>{
 const target={isConnected:true,inert:false,animate(){throw Error('Animation should be skipped');}};
 let focus=0,role=false;
 const motion=createWorkspaceTransition({getTargets:value=>{role=value;return [target];},reduced:()=>true,after:()=>focus++});
 await assert.rejects(motion.navigate(()=>{throw Error('render failed');}),/render failed/);
 assert.equal(target.inert,false);
 await motion.navigate(()=>{}, {role:true});
 assert.equal(role,true);assert.equal(focus,1);assert.equal(target.inert,false);
});
