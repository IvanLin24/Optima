import { defaultDealCommunication, hydrateDealCommunication, communicationTransition, openDealIssues } from './deal-communication-model.js';
import { calculate, quantityError } from '../domain.js';
import { catalogOffers, safeProductImage, compileOffer, offerError } from './supplier-model.js';
import { offerVersion, pendingRevision, sameRevisionIdentity } from './offer-revision.js';

export const ownsDeal=d=>d.offer.supplier==='ООО «Бумага и дело»';
export const visibleDeals=s=>(s.deals||[]).filter(d=>s.role==='buyer'||ownsDeal(d));
export const dealNumber=d=>'ОП-'+d.id.replace('deal-','').slice(0,8).toUpperCase();
export const dealStatus=d=>pendingRevision(d)?'Новые условия':openDealIssues(d).length?'Есть обращение':d.received?'Получен':d.paid?'Ожидается поставка':d.accepted?(d.signatures.buyer&&d.signatures.supplier?(d.delivery.address&&d.delivery.contact?'Готов к оплате':'Данные получения'):'Подписание договора'):'Предварительное участие';
const text=(v,n=160)=>String(v??'').trim().slice(0,n);
function snapshot(o){
 if(!o||typeof o.id!=='string'||!/^[\w-]{1,100}$/.test(o.id)||o.id==='paper')return null;
 const copy={};
 for(const key of ['min','max','step','others','target','current','next','retail','delivery','retailDelivery']){
  const n=o[key];if(!Number.isFinite(n)||n<(['others','delivery','retailDelivery'].includes(key)?0:.01)||n>1e9)return null;copy[key]=n;
 }
 if(!['min','max','step','others','target'].every(k=>Number.isSafeInteger(copy[k]))||copy.min>copy.max||copy.next>copy.current||['min','max','target'].some(k=>copy[k]%copy.step))return null;
 for(const key of ['id','name','category','unit','priceUnit','supplier','region','deadline','deadlineDate','deliveryDate'])copy[key]=text(o[key]);
 copy.version=offerVersion(o);copy.revisionReason=text(o.revisionReason,1000);copy.revisionTime=text(o.revisionTime,50);
 copy.detail=text(o.detail,500);copy.image=safeProductImage(o.image);copy.local=o.local===true;
 if(!copy.name||!copy.supplier||!copy.unit||!copy.priceUnit)return null;
 // Seeded catalogue dates belong to the original October demonstration.
 if(!copy.deliveryDate)copy.deliveryDate='2026-10-29';
 return copy;
}
function restoreRevision(d,offer,vendorOffers){
 const candidates=[d.pendingRevision];
 const source=vendorOffers.find(o=>o.id===offer.id&&['published','archived'].includes(o.status)&&o.snapshot);
 if(source&&!offerError(source,[{...source.snapshot,id:source.productId,status:'active'}],{referenceDate:'0000-00-00'}))candidates.push({offer:compileOffer(source,source.snapshot),reason:source.revisionReason,time:source.revisionTime});
 return candidates.flatMap(r=>{const next=snapshot(r?.offer);return next&&offerVersion(next)>offerVersion(offer)&&sameRevisionIdentity(offer,next)?[{offer:next,reason:text(r.reason||next.revisionReason,1000),time:text(r.time||next.revisionTime,50)}]:[];}).sort((a,b)=>offerVersion(b.offer)-offerVersion(a.offer))[0];
}
export function hydrateDeals(raw,vendorOffers=[]){
 const seen=new Set();
 return (Array.isArray(raw)?raw:[]).slice(0,100).flatMap(d=>{
  if(!d||!/^deal-[\w-]{1,100}$/.test(d.id)||seen.has(d.id))return [];
  const offer=snapshot(d.offer);if(!offer||quantityError(offer,d.quantity)||seen.has('offer:'+offer.id))return [];
  seen.add(d.id);seen.add('offer:'+offer.id);
  const accepted=d.accepted===true&&calculate(offer,d.quantity).projected>=offer.target;
  const signatures={buyer:accepted&&d.signatures?.buyer===true,supplier:accepted&&d.signatures?.supplier===true};
  const delivery={address:text(d.delivery?.address,240),contact:text(d.delivery?.contact,120)};
  const paid=signatures.buyer&&signatures.supplier&&Boolean(delivery.address&&delivery.contact)&&d.paid===true;
  const revision=accepted?null:restoreRevision(d,offer,vendorOffers);
  return [{id:d.id,offer,quantity:d.quantity,accepted,signatures,paid,received:paid&&d.received===true,...(revision?{pendingRevision:revision}:{}),
   delivery,...hydrateDealCommunication(d,d.quantity),
   history:(Array.isArray(d.history)?d.history:[]).filter(e=>e&&typeof e.title==='string').slice(0,30).map(e=>({title:text(e.title),time:text(e.time,40)}))}];
 });
}
export function dealTransition(s,a){
 const stamp=()=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date());
 if(a.type==='deal-join'){
  if(s.role!=='buyer')throw Error('Участие оформляет покупатель.');
  let d=s.deals.find(d=>d.offer.id===a.offerId);
  const o=catalogOffers(s).find(o=>o.id===a.offerId),offer=d?.offer||snapshot(o);
  if(!offer)throw Error('Предложение недоступно для нового участия.');
  if(!d&&offer.deadlineDate&&offer.deadlineDate<new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))throw Error('Набор по предложению завершён.');
  const error=quantityError(offer,a.quantity);if(error)throw Error(error);
  if(d?.accepted)throw Error('Заказ уже оформлен. Его условия зафиксированы.');
  if(d&&pendingRevision(d))throw Error('Сначала проверьте новые условия поставщика.');
  if(d){d.quantity=a.quantity;d.history.unshift({title:'Объём участия обновлён',time:stamp()});}
  else{if(s.deals.length>=100)throw Error('В демоверсии доступно до 100 участий.');s.deals.unshift({id:'deal-'+crypto.randomUUID(),offer,quantity:a.quantity,accepted:false,signatures:{buyer:false,supplier:false},paid:false,received:false,delivery:{address:'',contact:''},...defaultDealCommunication(),history:[{title:'Вы присоединились к закупке',time:stamp()}]});}
  return;
 }
 const d=s.deals.find(d=>d.id===a.id);if(!d)throw Error('Закупка не найдена.');
 if(s.role==='supplier'&&!ownsDeal(d))throw Error('Заказ относится к другому поставщику.');
 if(communicationTransition(d,s.role,a,stamp)){d.history=d.history.slice(0,30);return;}
 if(s.role!=='buyer'&&a.type!=='deal-sign')throw Error('Это действие доступно покупателю.');
 const event=title=>d.history.unshift({title,time:stamp()});
 switch(a.type){
  case 'deal-leave':if(d.accepted)throw Error('Оформленный заказ нельзя отменить выходом из группы.');s.deals=s.deals.filter(x=>x.id!==d.id);return;
  case 'deal-review-accept':{
   const revision=pendingRevision(d);if(!revision)throw Error('Новых условий для проверки нет.');
   if(a.expectedVersion!==offerVersion(revision.offer))throw Error('Условия уже изменились. Проверьте актуальную версию.');
   d.offer=structuredClone(revision.offer);delete d.pendingRevision;event('Новые условия v'+offerVersion(d.offer)+' приняты. Участие остаётся предварительным');break;
  }
  case 'deal-accept':
   if(d.accepted)throw Error('Условия уже согласованы.');
   if(pendingRevision(d))throw Error('Сначала проверьте новые условия поставщика.');
   if(calculate(d.offer,d.quantity).projected<d.offer.target)throw Error('Оптовый порог ещё не достигнут.');
   d.accepted=true;event('Условия согласованы, личный заказ создан');break;
  case 'deal-sign':
   if(!d.accepted)throw Error('Сначала согласуйте условия.');
   if(d.signatures[s.role])throw Error('Ваша подпись уже отмечена.');
   d.signatures[s.role]=true;event(s.role==='buyer'?'Подпись покупателя отмечена в деморежиме':'Подпись поставщика отмечена в деморежиме');break;
  case 'deal-delivery':
   if(d.received)throw Error('Заказ уже получен.');
   if(!text(a.value?.address,240)||!text(a.value?.contact,120))throw Error('Укажите адрес и контакт получателя.');
   d.delivery={address:text(a.value.address,240),contact:text(a.value.contact,120)};event('Данные получения сохранены');break;
  case 'deal-pay':
   if(!d.accepted||!d.signatures.buyer||!d.signatures.supplier)throw Error('Для оплаты нужны подписи обеих сторон.');
   if(d.paid)throw Error('Оплата уже отмечена.');
   if(!d.delivery.address||!d.delivery.contact)throw Error('Сначала заполните данные получения.');
   d.paid=true;event('Оплата отмечена в деморежиме');break;
  case 'deal-receive':
   if(!d.paid)throw Error('Сначала предусмотрена предоплата.');
   if(d.received)throw Error('Получение уже подтверждено.');
   if(openDealIssues(d).length)throw Error('Перед полной приёмкой урегулируйте открытые обращения.');
   d.received=true;event('Получение подтверждено, заказ завершён');break;
  default:throw Error('Неизвестное действие по закупке.');
 }
 d.history=d.history.slice(0,30);
}
