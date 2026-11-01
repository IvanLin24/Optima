import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntryMotion } from '../frontend/product/entry-motion.js';

function environment({reduced=false,viewTransition}={}){
  const descriptors=new Map(['document','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const calls=[];
  const root={isConnected:true,inert:false,animate(frames,options){calls.push(options);return {finished:Promise.resolve(),cancel(){}};}};
  globalThis.matchMedia=()=>({matches:reduced});
  globalThis.document={querySelector:()=>root,...(viewTransition?{startViewTransition:viewTransition}:{})};
  return {root,calls,restore(){for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('shared-element navigation commits once, ignores repeated clicks and releases the outgoing page',async()=>{
  let finish,renderCount=0,focusCount=0;
  const env=environment({viewTransition(update){update();return {finished:new Promise(resolve=>{finish=resolve;})};}});
  try{
    const motion=createEntryMotion();
    const running=motion.navigate(()=>renderCount++,()=>focusCount++);
    assert.equal(renderCount,1);assert.equal(motion.busy(),true);assert.equal(env.root.inert,true);
    await motion.navigate(()=>renderCount++);
    assert.equal(renderCount,1);
    finish();await running;
    assert.equal(renderCount,1);assert.equal(focusCount,1);
    assert.equal(motion.busy(),false);assert.equal(env.root.inert,false);
  }finally{env.restore();}
});

test('reduced motion renders immediately and never starts animation',async()=>{
  const env=environment({reduced:true,viewTransition(){throw Error('Unexpected view transition');}});
  try{
    const motion=createEntryMotion();let rendered=false;
    const result=motion.navigate(()=>{rendered=true;});
    assert.equal(rendered,true);await result;
    assert.equal(env.calls.length,0);assert.equal(env.root.inert,false);
  }finally{env.restore();}
});

test('fallback animates out and in while keeping one render and restoring interaction',async()=>{
  const env=environment();
  try{
    const motion=createEntryMotion();let renders=0;
    await motion.navigate(()=>renders++);
    assert.equal(renders,1);assert.equal(env.calls.length,2);
    assert.equal(env.root.inert,false);assert.equal(motion.busy(),false);
  }finally{env.restore();}
});

test('a skipped browser transition still commits its destination',async()=>{
  const env=environment({viewTransition(){return {finished:Promise.reject(Error('Snapshot skipped'))};}});
  try{
    const motion=createEntryMotion();let renders=0;
    await motion.navigate(()=>renders++);
    assert.equal(renders,1);assert.equal(env.root.inert,false);assert.equal(motion.busy(),false);
  }finally{env.restore();}
});
