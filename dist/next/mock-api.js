import {quote,matchingOffers,roundStep} from './domain.js';

/** The only demo data source. A real API implementation can replace this adapter. */
const offers=[
{id:'paper',sku:'PPR-A4-80',name:'Бумага А4',spec:'80 г/м² · 500 листов · белая',category:'Офис',unit:'пач.',minQuantity:5,step:5,defaultQuantity:10,retailUnitKop:44000,groupUnitKop:36500,retailDeliveryKop:90000,groupDeliveryKop:35000,groupQuantity:80,threshold:100,participants:5,supplier:'Офис Снаб',supplierCode:'OS',deadline:'2026-10-23',deliveryDate:'2026-10-27',termsVersion:'paper-v3',art:'paper'},
{id:'bags',sku:'PK-2535-50',name:'Курьерские пакеты',spec:'250 × 350 мм · 50 мкм · непрозрачные',category:'Упаковка',unit:'шт.',minQuantity:100,step:100,defaultQuantity:1000,retailUnitKop:340,groupUnitKop:280,retailDeliveryKop:45000,groupDeliveryKop:25000,groupQuantity:9000,threshold:10000,participants:8,supplier:'ПакетПро',supplierCode:'PP',deadline:'2026-10-22',deliveryDate:'2026-10-26',termsVersion:'bags-v4',art:'bags'},
{id:'labels',sku:'TE-5840-700',name:'Термоэтикетки',spec:'58 × 40 мм · 700 шт. в рулоне',category:'Упаковка',unit:'рул.',minQuantity:10,step:10,defaultQuantity:30,retailUnitKop:24500,groupUnitKop:19800,retailDeliveryKop:45000,groupDeliveryKop:25000,groupQuantity:150,threshold:200,participants:4,supplier:'Этикетка Плюс',supplierCode:'EP',deadline:'2026-10-23',deliveryDate:'2026-10-27',termsVersion:'labels-v1',art:'labels'},
{id:'gloves',sku:'NT-M-100',name:'Перчатки нитриловые',spec:'Размер M · 100 шт. в упаковке',category:'Расходники',unit:'уп.',minQuantity:5,step:5,defaultQuantity:20,retailUnitKop:53000,groupUnitKop:43500,retailDeliveryKop:60000,groupDeliveryKop:30000,groupQuantity:180,threshold:200,participants:6,supplier:'ПрофСнаб',supplierCode:'PS',deadline:'2026-10-24',deliveryDate:'2026-10-28',termsVersion:'gloves-v2',art:'gloves'},
{id:'coffee',sku:'CF-AR-100',name:'Кофе в зёрнах',spec:'Арабика · средняя обжарка · 1 кг',category:'Офис',unit:'кг',minQuantity:1,step:1,defaultQuantity:5,retailUnitKop:120000,groupUnitKop:99000,retailDeliveryKop:50000,groupDeliveryKop:25000,groupQuantity:45,threshold:50,participants:7,supplier:'Кофе Дело',supplierCode:'KD',deadline:'2026-10-25',deliveryDate:'2026-10-29',termsVersion:'coffee-v2',art:'coffee'},
{id:'film',sku:'ST-500-20',name:'Стрейч-плёнка',spec:'500 мм · 20 мкм · рулон 2 кг',category:'Упаковка',unit:'рул.',minQuantity:5,step:5,defaultQuantity:15,retailUnitKop:45000,groupUnitKop:37000,retailDeliveryKop:50000,groupDeliveryKop:30000,groupQuantity:75,threshold:100,participants:5,supplier:'ПакетПро',supplierCode:'PP',deadline:'2026-10-24',deliveryDate:'2026-10-28',termsVersion:'film-v1',art:'film'}
];
const initialNeeds=[
{id:'need-1',offerId:'paper',name:'Бумага А4',spec:'80 г/м²',quantity:10,unit:'пач.',deadline:'2026-10-28',source:'Демо'},
{id:'need-2',offerId:'bags',name:'Курьерские пакеты',spec:'250 × 350 мм',quantity:1000,unit:'шт.',deadline:'2026-10-29',source:'Демо'},
{id:'need-3',offerId:'gloves',name:'Перчатки нитриловые',spec:'Размер M',quantity:20,unit:'уп.',deadline:'2026-10-30',source:'Демо'}
];
const KEY='optima-next-standalone-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=()=>('id-'+Math.random().toString(36).slice(2,11));
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&Array.isArray(x.orders)&&Array.isArray(x.needs)?x:{orders:[],needs:clone(initialNeeds),history:[]}}catch{return {orders:[],needs:clone(initialNeeds),history:[]}}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s));return s}
const wait=()=>Promise.resolve();
export const mockApi={
 async bootstrap(){await wait();const s=load();return {company:{id:'demo-sever',name:'ООО «Север»',role:'Покупатель'},offers:clone(offers),orders:clone(s.orders),needs:clone(s.needs),history:clone(s.history),serverTime:'2026-10-17T12:00:00+03:00',demo:true}},
 async previewQuote({offerId,quantity}){const offer=offers.find(o=>o.id===offerId);if(!offer)throw new Error('Предложение больше недоступно');return quote(offer,quantity)},
 async createOrder({offerId,quantity,termsVersion,accepted}){
  if(!accepted)throw new Error('Необходимо подтвердить ознакомление с условиями');
  const offer=offers.find(x=>x.id===offerId);if(!offer)throw new Error('Предложение не найдено');
  if(offer.termsVersion!==termsVersion)throw Object.assign(new Error('Условия изменились. Пересчитайте заказ'),{status:409});
  const q=quote(offer,quantity),s=load();
  const active=s.orders.find(x=>x.offerId===offerId&&x.status!=='cancelled');
  if(active)throw new Error('По этому предложению уже есть действующая заявка');
  const order={id:uid(),number:`OP-${String(Date.now()).slice(-6)}`,offerId,quantity:q.quantity,status:q.ready?'threshold_reached':'collecting',createdAt:new Date().toISOString(),quote:q,termsVersion};
  s.orders.unshift(order);s.history.unshift({id:uid(),at:new Date().toISOString(),kind:'order',title:`Создана заявка на ${offer.name}`});save(s);return clone(order);
 },
 async cancelOrder(id){const s=load(),order=s.orders.find(x=>x.id===id);if(!order)throw new Error('Заявка не найдена');if(order.status==='cancelled')return clone(order);order.status='cancelled';s.history.unshift({id:uid(),at:new Date().toISOString(),kind:'cancel',title:`Отменена заявка ${order.number}`});save(s);return clone(order)},
 async createNeed(payload){const name=String(payload.name||'').trim(),quantity=Number(payload.quantity),unit=String(payload.unit||'шт.').trim();if(name.length<2||name.length>120||!Number.isFinite(quantity)||quantity<=0||quantity>1e7)throw new Error('Проверьте название и количество');
  const s=load(),record={id:uid(),name,quantity,unit,spec:String(payload.spec||'').slice(0,180),deadline:String(payload.deadline||'').slice(0,10),source:'Вручную',offerId:payload.offerId||null};s.needs.unshift(record);save(s);return clone(record)},
 async importNeeds(rows){const s=load();for(const row of rows){s.needs.unshift({id:uid(),...row,offerId:null});}save(s);return rows.length},
 async deleteNeed(id){const s=load();s.needs=s.needs.filter(n=>n.id!==id);save(s);return true},
 async quoteForNeed(id){const s=load(),need=s.needs.find(n=>n.id===id);return need?clone(matchingOffers(need,offers)):[]}
};