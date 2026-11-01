import test from 'node:test';
import assert from 'node:assert/strict';

async function sessionFixture(hash='',transport){
 const keys=['document','location','history','window','sessionStorage','fetch','FormData'];
 const original=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const app={innerHTML:''},requests=[],listeners={},routes=[];
 const location={hash,pathname:'/',search:''};
 Object.assign(globalThis,{
  document:{title:'',addEventListener(type,handler){listeners[type]=handler;},querySelector:s=>s==='#app'?app:null,querySelectorAll:()=>[]},
  location,history:{replaceState(){location.hash='';}},window:{scrollTo(){}},
  sessionStorage:{getItem:()=>'',setItem(){},removeItem(){}},
  fetch:async(...args)=>{requests.push(args);if(transport)return transport(...args);throw Error('Unexpected network call while rendering public UI');},
 });
 const {prototypeSession:session}=await import('../frontend/product/prototype-session.js?fixture='+Math.random());
 await session.init({store:{subscribe(){},replace(){}},render:()=>session.gate(),go:route=>routes.push(route),notify(){},modal(){throw Error('Anonymous flow must use its gate');}});
 return {session,app,requests,listeners,routes,restore(){for(const [key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('public landing and auth navigation cannot open the workspace or issue authentication requests',async()=>{
 const f=await sessionFixture();try{
  f.session.gate();assert.match(f.app.innerHTML,/landing-title/);assert.doesNotMatch(f.app.innerHTML,/id="virtual-auth-form"/);
  for(const type of ['accept','pay','signature','message'])assert.equal(f.session.canDispatch({type}),false);
  f.session.open('create');assert.match(f.app.innerHTML,/type="password"[^>]*required[^>]*minlength="6"/);
  assert.match(f.app.innerHTML,/name="accepted"[^>]*required/);
  f.session.open('login');assert.match(f.app.innerHTML,/id="virtual-auth-form"/);assert.match(f.app.innerHTML,/autocomplete="current-password"/);
  assert.equal(f.session.gated(),true);assert.equal(f.requests.length,0);
 }finally{f.restore();}
});

test('a pending registration sends one request and keeps the workspace gated until code confirmation',async()=>{
 let respond;
 const f=await sessionFixture('',()=>new Promise(resolve=>{respond=resolve;}));
 try{
  f.session.open('create');
  const form={id:'virtual-auth-form',querySelector:()=>null};
  globalThis.FormData=class {get(key){return {email:'member@example.test',password:'test-only-long-passphrase',accepted:'on'}[key];}};
  const event={target:{closest:()=>form},preventDefault(){},stopImmediatePropagation(){}};
  f.listeners.submit(event);f.listeners.submit(event);f.session.open('login');
  assert.equal(f.requests.length,1);assert.match(f.app.innerHTML,/type="password"/);
  assert.equal(f.requests[0][0],'/api/v1/auth/virtual-company');
  respond({ok:true,json:async()=>({challenge_id:'11111111-1111-4111-8111-111111111111',resend_after:0})});
  await new Promise(setImmediate);
  assert.match(f.app.innerHTML,/id="virtual-code-form"/);
  assert.equal(f.session.gated(),true);assert.equal(f.session.canDispatch({type:'pay'}),false);
  assert.equal(f.requests.length,1);
  f.session.open('login');assert.match(f.app.innerHTML,/autocomplete="current-password"/);
 }finally{f.restore();}
});

test('a failed password login unlocks navigation without opening the workspace',async()=>{
 const f=await sessionFixture('',async()=>({ok:false,status:401,json:async()=>({error:{message:'Неверная почта или пароль'}})}));
 try{
  f.session.open('login');
  const form={id:'virtual-auth-form',querySelector:()=>null};
  globalThis.FormData=class {get(key){return key==='email'?'member@example.test':'incorrect-password';}};
  f.listeners.submit({target:{closest:()=>form},preventDefault(){},stopImmediatePropagation(){}});
  await new Promise(setImmediate);
  assert.equal(f.session.gated(),true);assert.equal(f.requests.length,1);
  assert.equal(f.requests[0][0],'/api/v1/auth/login');
  assert.deepEqual(JSON.parse(f.requests[0][1].body),{email:'member@example.test',password:'incorrect-password'});
  f.session.open('create');assert.match(f.app.innerHTML,/type="password"/);
 }finally{f.restore();}
});

test('an email code link goes directly to explicit confirmation, never the poster or automatic verification',async()=>{
 const hash='#email-code?email=landing%40example.test&challenge=11111111-1111-4111-8111-111111111111&code=000000';
 const f=await sessionFixture(hash);try{
  assert.match(f.app.innerHTML,/id="virtual-code-form"/);assert.match(f.app.innerHTML,/Подтвердить и войти/);
  assert.doesNotMatch(f.app.innerHTML,/id="landing-title"/);assert.equal(globalThis.location.hash,'');
  assert.equal(f.session.gated(),true);assert.equal(f.requests.length,0);
 }finally{f.restore();}
});

test('password login loads the workspace directly without requesting or verifying an email code',async()=>{
 const f=await sessionFixture('',async url=>({ok:true,json:async()=>url.endsWith('/auth/login')?{access_token:'test-only-session'}:{company:{id:'test-company',name:'Тестовая компания'},revision:1,companies:[],state:{}}}));
 try{
  f.session.open('login');
  globalThis.FormData=class {get(key){return key==='email'?'member@example.test':'test-only-password';}};
  const form={id:'virtual-auth-form',querySelector:()=>null};
  f.listeners.submit({target:{closest:()=>form},preventDefault(){},stopImmediatePropagation(){}});
  await new Promise(setImmediate);
  assert.deepEqual(f.requests.map(([url])=>url),['/api/v1/auth/login','/api/v1/prototype/state']);
  assert.equal(f.session.gated(),false);assert.deepEqual(f.routes,['overview']);
  assert.doesNotMatch(f.app.innerHTML,/id="virtual-code-form"/);
 }finally{f.restore();}
});
