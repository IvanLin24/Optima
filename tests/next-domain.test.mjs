import test from 'node:test';
import assert from 'node:assert/strict';
import {quote,roundStep,parseNeeds,sumQuotes} from '../dist/next/domain.js';
import {mockApi} from '../dist/next/mock-api.js';

test('bags price includes per-company delivery in integer kopecks',async()=>{
 const s=await mockApi.bootstrap();const b=s.offers.find(x=>x.id==='bags');const q=quote(b,1000);
 assert.equal(q.retailTotalKop,385000);
 assert.equal(q.groupTotalKop,305000);
 assert.equal(q.savingKop,80000);
 assert.equal(q.progress,100);
 assert.equal(q.ready,true);
 assert.equal(q.missing,0);
});
test('quantity limits and threshold remain explicit',async()=>{
 const s=await mockApi.bootstrap();const b=s.offers.find(x=>x.id==='bags');
 assert.equal(roundStep(1049,100,100),1000);
 assert.equal(roundStep(20,100,100),100);
 const c=quote(b,100);
 assert.equal(c.missing,900);
 assert.equal(c.ready,false);
});
test('catalog savings are summed without float money',async()=>{
 const s=await mockApi.bootstrap(),totals=sumQuotes(s.offers);
 assert.equal(totals.savingKop,s.offers.reduce((sum,o)=>sum+quote(o,o.defaultQuantity).savingKop,0));
});
test('CSV parser validates position fields',()=>{
 const needs=parseNeeds('name;quantity;unit\n"Картонные коробки";200;шт.','needs.csv');
 assert.equal(needs[0].name,'Картонные коробки');
 assert.equal(needs[0].quantity,200);
 assert.throws(()=>parseNeeds('name;quantity\nТовар;-1','needs.csv'));
});