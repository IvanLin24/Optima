import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../dist/workspace/seed.js';
import {action,calculate,progress,sumMoney} from '../dist/workspace/model.js';

test('seed stores separate procurement, questions, contracts and transfers',()=>{
 const s=seed();assert.equal(s.purchases.length,5);assert.equal(s.questions.length,3);assert.equal(s.contracts.length,2);assert.equal(s.payments.length,3);assert.equal(s.company.inn,'7700000000');
});
test('currency is integer kopecks and includes delivery',()=>{
 const s=seed(),p=s.purchases.find(x=>x.id==='PR-2403');const c=calculate(p,1000);
 assert.deepEqual([c.groupKop,c.separateKop,c.savingKop],[305000,385000,80000]);assert.equal(c.savingPct,20.8);
});
test('progress caps at 100',()=>{const p=seed().purchases.find(x=>x.id==='PR-2404');assert.equal(progress(p),100)});
test('preliminary answer creates proposed contract but never changes delivery',()=>{
 const s=seed();const updated=action(s,'answerQuestion',{id:'Q-101',decision:'accept'});
 assert.equal(updated.questions.find(x=>x.id==='Q-101').status,'accepted');
 assert.equal(updated.purchases.find(x=>x.id==='PR-2401').delivery,'2026-10-21');
 const change=updated.contracts.find(x=>x.kind==='change');assert.equal(change.proposedDelivery,'2026-10-22');assert.equal(change.status,'review');
 assert.equal(s.contracts.length,2,'immutable base state');
});
test('confirming a separate demo contract changes delivery and status',()=>{
 let s=action(seed(),'answerQuestion',{id:'Q-101',decision:'accept'});
 s=action(s,'confirmContract',{id:s.contracts.find(x=>x.kind==='change').id});
 assert.equal(s.purchases.find(x=>x.id==='PR-2401').delivery,'2026-10-22');
 assert.equal(s.purchases.find(x=>x.id==='PR-2401').status,'fulfillment');
 assert.equal(s.contracts.find(x=>x.kind==='change').status,'confirmed');
});
test('rejecting a question does not create a contract',()=>{const s=action(seed(),'answerQuestion',{id:'Q-101',decision:'decline'});assert.equal(s.contracts.length,2);assert.equal(s.purchases[0].delivery,'2026-10-21')});
test('a question or contract cannot be processed twice',()=>{
 let s=action(seed(),'answerQuestion',{id:'Q-101',decision:'accept'});
 assert.throws(()=>action(s,'answerQuestion',{id:'Q-101',decision:'accept'}));
 const id=s.contracts[0].id;s=action(s,'confirmContract',{id});assert.throws(()=>action(s,'confirmContract',{id}));
});
test('declining a contract preserves purchase delivery',()=>{
 let s=seed();s=action(s,'declineContract',{id:'CT-501'});
 assert.equal(s.contracts[0].status,'declined');assert.equal(s.purchases.find(x=>x.id==='PR-2403').delivery,'2026-10-27');
});
test('buyer needs can be added and removed safely',()=>{
 let s=action(seed(),'addNeed',{title:'Кофе для переговорных',quantity:25,unit:'кг',deadline:'2026-11-06'});
 assert.equal(s.needs[0].title,'Кофе для переговорных');const id=s.needs[0].id;
 s=action(s,'removeNeed',{id});assert.equal(s.needs.length,3);
 assert.throws(()=>action(s,'addNeed',{title:'x',quantity:1,deadline:'2026-11-01'}));
 assert.throws(()=>action(s,'addNeed',{title:'Вода',quantity:-3,deadline:'2026-11-01'}));
});
test('supplier offers maintain promotion status without charge',()=>{
 let s=action(seed(),'createOffer',{title:'Коробка упаковочная',category:'Упаковка',thresholdQty:300,singlePriceRub:110,groupPriceRub:85});
 assert.equal(s.supplierOffers[0].groupPriceKop,8500);const id=s.supplierOffers[0].id;
 s=action(s,'togglePromotion',{id});assert.equal(s.supplierOffers[0].promoted,true);
 assert.equal(s.payments.length,3,'no payments for demo promotion');
});
test('payment totals use only purchase-linked demo transactions',()=>{
 const s=seed();assert.equal(sumMoney(s.payments.filter(p=>p.status==='executed')),3455000);
});
