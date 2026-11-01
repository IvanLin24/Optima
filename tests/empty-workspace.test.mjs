import test from 'node:test';
import assert from 'node:assert/strict';
import { baseState } from '../frontend/product/data.js';
import { overview } from '../frontend/product/overview.js';
import { documentRegister } from '../frontend/product/documents.js';
import { chat,threadMessages } from '../frontend/product/conversations.js';
import { supplierRegister } from '../frontend/product/supplier-register.js';
import { workspaceNavigation,activeWorkspaceRoute } from '../frontend/product/workspace-navigation.js';
import { catalogOffers } from '../frontend/product/supplier-model.js';
import { catalog } from '../frontend/product/procurement.js';

test('fresh workspace has no personal purchases, documents, messages or seller publications',()=>{
 const state=baseState();
 assert.equal(state.joined,false);assert.equal(state.vendorProducts.length,0);
 assert.match(overview({},state),/первой закупки/);
 assert.doesNotMatch(overview({},state),/home-focus-title/);
 const documents=documentRegister({docFilter:'all'},state);
 assert.match(documents,/Документов пока нет/);assert.doesNotMatch(documents,/ОП-2048/);
 assert.match(chat({},state),/Разговоров пока нет/);
 assert.deepEqual(threadMessages(state,'group'),[]);assert.deepEqual(threadMessages(state,'private'),[]);
 assert.equal(supplierRegister({},state).count,0);
 assert.deepEqual(catalogOffers(state),[]);
 const listing=catalog({purchaseFilter:'offers',search:'',catalogCategory:'all',catalogSort:'deadline'},state);
 assert.match(listing,/Предложений пока нет/);assert.doesNotMatch(listing,/Бумага A4|Бумага для офиса|₽|Экономия/);
});

test('navigation keeps five core tasks and retires auxiliary screens for both roles',()=>{
 for(const role of ['buyer','supplier']){
  const nav=workspaceNavigation(role);
  assert.equal(nav.length,5);
  for(const page of ['tasks','analytics','district']){
   assert.equal(nav.some(([id])=>id===page),false);
   assert.equal(activeWorkspaceRoute(page,role),role==='buyer'?'overview':'supplier');
  }
 }
});
