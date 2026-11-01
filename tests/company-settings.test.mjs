import test from 'node:test';
import assert from 'node:assert/strict';
import { profileDraft,profilePayload,companySettingsScreen,createCompanySettings } from '../frontend/product/company-settings.js';

test('placeholder requisites stay blank, optional values normalize and login email is never submitted',()=>{
 const draft=profileDraft({name:'ООО «Линия ABCD»',inn:'0000000010',needs_setup:true,login_email:'owner@example.test'});
 assert.equal(draft.name,'');assert.equal(draft.inn,'');
 const body=profilePayload({...draft,name:'  Компания  ',contact_email:'team@example.test'},4);
 assert.equal(body.name,'Компания');assert.equal(body.profile_revision,4);assert.equal(body.inn,null);
 assert.equal(Object.hasOwn(body,'login_email'),false);
 const html=companySettingsScreen({phase:'ready',profile:{login_email:'owner@example.test',can_edit_requisites:false},draft:{...draft,name:'Компания'},saving:false,error:''});
 assert.match(html,/name="name"[^>]*readonly/);assert.match(html,/name="contact_email"/);
 assert.match(html,/data-action="virtual-logout"/);
 assert.doesNotMatch(html,/name="login_email"/);
});

test('switching accounts discards old profile responses and drafts',async()=>{
 const pending=[];
 const controller=createCompanySettings({request:()=>new Promise(resolve=>pending.push(resolve)),render(){},notify(){},onSaved(){}});
 controller.activate('owner-a');controller.activate('owner-b');
 pending[0]({id:'owner-a',name:'Чужая компания',can_edit_requisites:true});await new Promise(setImmediate);
 assert.equal(controller.getModel().phase,'loading');
 pending[1]({id:'owner-b',name:'Своя компания',can_edit_requisites:true});await new Promise(setImmediate);
 assert.equal(controller.getModel().draft.name,'Своя компания');
 controller.deactivate();assert.equal(controller.getModel().phase,'idle');
});

test('failed save keeps the draft, blocks a duplicate submission and submits only company fields',async()=>{
 let rejectSave;const calls=[];
 const profile={id:'owner',name:'Компания',inn:null,profile_revision:3,can_edit_requisites:true,login_email:'owner@example.test'};
 const controller=createCompanySettings({request:(url,options)=>{calls.push([url,options]);return options?new Promise((resolve,reject)=>{rejectSave=reject;}):Promise.resolve(profile);},render(){},notify(){},onSaved(){throw Error('Failed save must not update company identity');}});
 controller.activate('owner');await new Promise(setImmediate);
 const data={...controller.getModel().draft,contact_name:'Новый контакт'};
 const listeners={},submit={};
 const form={elements:{namedItem:key=>({value:data[key]})},addEventListener:(name,handler)=>listeners[name]=handler,querySelectorAll:()=>[],querySelector:selector=>selector==='[type=submit]'?submit:{},setAttribute(){}};
 controller.bind(form);listeners.input();
 const first=listeners.submit({preventDefault(){}}),second=listeners.submit({preventDefault(){}});
 assert.equal(calls.length,2);assert.equal(submit.textContent,'Сохраняем…');
 assert.equal(calls[1][1].body.contact_name,'Новый контакт');assert.equal(calls[1][1].body.profile_revision,3);
 assert.equal(Object.hasOwn(calls[1][1].body,'login_email'),false);
 rejectSave(Error('Нет соединения'));await Promise.all([first,second]);
 assert.equal(controller.getModel().draft.contact_name,'Новый контакт');
 assert.equal(controller.getModel().saving,false);assert.equal(controller.getModel().error,'Нет соединения');
});
