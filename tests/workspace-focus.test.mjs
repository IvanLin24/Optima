import test from 'node:test';
import assert from 'node:assert/strict';
import { baseState,offers,quote,money } from '../frontend/product/data.js';
import { overview } from '../frontend/product/overview.js';
import { needsScreen } from '../frontend/product/workflow-pages.js';
import { catalog } from '../frontend/product/procurement.js';
import { hydrateDeals } from '../frontend/product/deal-model.js';
import { company } from '../frontend/product/company-context.js';

test('a single purchase keeps its decision, complete cost and discussion without a redundant queue',()=>{
 const state=baseState();state.joined=true;const html=overview({},state);
 assert.match(html,/Проверьте новую дату поставки/);
 assert.match(html,/href="#group\/conditions"/);
 assert.ok(html.includes(money(quote(state).total)));
 assert.match(html,/href="#group\/discussion"/);
 assert.doesNotMatch(html,/id="home-queue"/);
 for(const panel of ['action','calculation','activity'])assert.ok(html.includes(`data-panel="${panel}"`));
});

test('several purchases retain selection and search; a completed purchase stays reachable',()=>{
 const state=baseState();state.joined=true;
 state.deals=hydrateDeals([{id:'deal-boxes',offer:offers[1],quantity:offers[1].initial}]);
 assert.equal(state.deals.length,1);
 const html=overview({},state);
 assert.match(html,/id="home-queue"/);assert.match(html,/id="home-search"/);
 assert.equal((html.match(/data-action="home-select-purchase"/g)||[]).length,2);
 Object.assign(state,{deals:[],accepted:true,paid:true,received:true,signatures:{buyer:true,supplier:true}});
 const completed=overview({homeFilter:'complete'},state);
 assert.match(completed,/Получение подтверждено/);assert.match(completed,/data-filter="complete"/);
});

test('empty planning has one creation action; saved needs keep edit and matching',()=>{
 const state=baseState();
 const empty=needsScreen({},state);
 assert.equal((empty.match(/data-action="create-need"/g)||[]).length,1);
 assert.match(empty,/data-action="import"/);
 state.needs=[{id:'need-test',name:'Бумага A4',quantity:100,unit:'пачек',city:'Москва',date:'2026-11-10'}];
 const populated=needsScreen({},state);
 assert.match(populated,/data-action="edit-need"/);assert.match(populated,/data-action="match-need"/);
});

test('catalog keeps quantity context and all cost components available after shortening explanations',()=>{
 Object.assign(company,{id:'test-supplier',name:'Поставщик из настроек'});
 const state=baseState();
 const product={id:'product-test',name:'Товар пользователя',detail:'Указанные характеристики',category:'Другое',unit:'штук',sku:'',image:'',status:'active'};
 state.vendorProducts=[product];state.vendorOffers=[{id:'offer-test',productId:product.id,status:'published',snapshot:product,version:1,current:100,next:80,retail:110,target:100,min:10,step:10,max:500,delivery:500,retailDelivery:600,deadlineDate:'2026-11-10',deliveryDate:'2026-11-20',region:'Москва'}];
 const html=catalog({purchaseFilter:'offers',search:'',catalogCategory:'all',catalogSort:'deadline',offerQuantities:{'offer-test':50}},state);
 assert.match(html,/data-action="offer"/);assert.match(html,/buy-estimate-breakdown/);
 for(const label of ['Товар','Доставка','Комиссия · 3% экономии','Покупка отдельно'])assert.ok(html.includes(label));
 assert.match(html,/buy-cost-help/);assert.match(html,/data-action="catalog-save"/);
 assert.match(html,/Поставщик из настроек/);assert.doesNotMatch(html,/Бумага и дело/);
});
