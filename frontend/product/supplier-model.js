import { offerVersion, revisionFields, revisionChanges, sameRevisionIdentity } from './offer-revision.js';
import { offers as seededOffers } from '../domain.js';

export const defaultProducts=()=>[{id:'seed-paper',name:seededOffers[0].name,sku:'A4-80-500',detail:seededOffers[0].detail,category:'Офис',unit:'пачек',image:'',status:'active'}];
export const productCategories=['Офис','Упаковка','Гигиена','Другое'];
export const productUnits={пачек:'пачку',штук:'штуку',канистр:'канистру',рулонов:'рулон',кг:'кг'};
export const offerFields=['current','next','retail','target','min','step','max','delivery','retailDelivery','deadlineDate','deliveryDate','region'];
const idOK=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
const bounded=(value,max)=>String(value??'').trim().slice(0,max);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateOK=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export const safeProductImage=value=>typeof value==='string'&&value.length<=750000&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';

export function cleanProduct(value={}){
 return {name:bounded(value.name,120),sku:bounded(value.sku,60),detail:bounded(value.detail,500),category:productCategories.includes(value.category)?value.category:'Офис',unit:Object.hasOwn(productUnits,value.unit)?value.unit:'штук',image:safeProductImage(value.image)};
}
export function productError(value){
 if(!String(value.name||'').trim())return 'Укажите название товара.';
 if(!String(value.detail||'').trim())return 'Добавьте характеристики: они помогут покупателю сравнить товары.';
 return '';
}
export function cleanOffer(value={}){
 const result={productId:bounded(value.productId,100),region:bounded(value.region,120),deadlineDate:bounded(value.deadlineDate,10),deliveryDate:bounded(value.deliveryDate,10)};
 for(const key of offerFields.filter(k=>!['region','deadlineDate','deliveryDate'].includes(k)))result[key]=value[key]===''||value[key]==null?'':Number(value[key]);
 return result;
}
export function offerError(o,products,{complete=true,referenceDate=today()}={}){
 const product=products.find(p=>p.id===o.productId&&p.status!=='archived');
 if(!product)return 'Выберите действующий товар.';
 const labels={current:'Цена до порога',next:'Цена при пороге',retail:'Цена отдельной покупки',target:'Оптовый порог',min:'Минимальный заказ',step:'Шаг заказа',max:'Максимальный заказ',delivery:'Доставка в группе',retailDelivery:'Доставка при отдельной покупке'};
 for(const [key,label]of Object.entries(labels)){
  if(o[key]===''||o[key]==null){if(complete)return `Заполните поле «${label}».`;continue;}
  const integer=['target','min','step','max'].includes(key),zero=['delivery','retailDelivery'].includes(key);
  if(!integer&&Math.abs(o[key]*100-Math.round(o[key]*100))>.00001)return `В поле «${label}» допускается не более двух знаков после запятой.`;
  if(!Number.isFinite(o[key])||(integer&&!Number.isSafeInteger(o[key]))||o[key]<(zero?0:integer?1:.01)||o[key]>1000000000)return `Проверьте поле «${label}».`;
 }
 if(o.current!==''&&o.next!==''&&o.next>o.current)return 'Цена при оптовом пороге не должна быть выше цены до порога.';
 if(o.min!==''&&o.max!==''&&o.max<o.min)return 'Максимальный заказ не может быть меньше минимального.';
 if(o.step)for(const key of ['min','max','target'])if(o[key]!==''&&o[key]%o.step)return 'Минимум, максимум и оптовый порог должны быть кратны шагу заказа.';
 if(o.target!==''&&o.min!==''&&o.target<o.min)return 'Оптовый порог не может быть меньше минимального заказа.';
 if(complete&&!o.region)return 'Укажите регион поставки.';
 for(const [key,label]of [['deadlineDate','срок завершения набора'],['deliveryDate','дату поставки']]){
  if(!o[key]){if(complete)return `Укажите ${label}.`;continue;}
  if(!dateOK(o[key]))return `Проверьте ${label}.`;
 }
 if(o.deadlineDate&&o.deliveryDate&&o.deliveryDate<o.deadlineDate)return 'Поставка не может быть раньше завершения набора.';
 if(complete&&o.deadlineDate<referenceDate)return 'Срок набора уже прошёл. Укажите актуальную дату.';
 return '';
}

export function hydrateSupplier(raw){
 const products=(Array.isArray(raw.vendorProducts)?raw.vendorProducts:defaultProducts()).filter(p=>p&&idOK(p.id)).slice(0,100).map(p=>({...cleanProduct(p),id:p.id,status:p.status==='archived'?'archived':'active'})).filter(p=>!productError(p));
 const seen=new Set();
 const offers=(Array.isArray(raw.vendorOffers)?raw.vendorOffers:[]).filter(o=>o&&idOK(o.id)&&!seen.has(o.id)&&seen.add(o.id)).slice(0,100).map(o=>{
  const clean={...cleanOffer(o),id:o.id,version:offerVersion(o),revisionReason:bounded(o.revisionReason,1000),revisionTime:bounded(o.revisionTime,50),revisions:[],status:['draft','published','archived'].includes(o.status)?o.status:'draft'};
  if(o.snapshot&&!productError(cleanProduct(o.snapshot)))clean.snapshot=cleanProduct(o.snapshot);
  if(clean.snapshot){
   const seenVersions=new Set();
   clean.revisions=(Array.isArray(o.revisions)?o.revisions:[]).filter(r=>r&&Number.isSafeInteger(r.version)&&r.version>0&&r.version<=clean.version&&!seenVersions.has(r.version)&&seenVersions.add(r.version)).slice(0,20).map(r=>({version:r.version,reason:bounded(r.reason,1000),time:bounded(r.time,50),terms:cleanOffer({...r.terms,productId:clean.productId})})).filter(r=>!offerError(r.terms,[{...clean.snapshot,id:clean.productId,status:'active'}],{referenceDate:'0000-00-00'})).sort((a,b)=>b.version-a.version);
  }
  // Existing publications retain their frozen product even if the source is archived.
  if(clean.status==='published'&&(!clean.snapshot||offerError(clean,[{...clean.snapshot,id:clean.productId,status:'active'}],{referenceDate:'0000-00-00'})))clean.status='draft';
  return clean;
 });
 return {vendorProducts:products,vendorOffers:offers};
}

export function supplierTransition(s,action){
 if(s.role!=='supplier')throw Error('Это действие доступно поставщику.');
 if(action.type==='vendor-product'){
  const value=cleanProduct(action.value),error=productError(value);if(error)throw Error(error);
  const existing=s.vendorProducts.find(p=>p.id===action.id);if(action.id&&!existing)throw Error('Товар не найден.');
  if(existing&&existing.status==='archived')throw Error('Сначала восстановите товар из архива.');
  if(existing)Object.assign(existing,value);else{if(s.vendorProducts.length>=100)throw Error('В демоверсии доступно до 100 товаров.');s.vendorProducts.unshift({...value,id:'prod-'+crypto.randomUUID(),status:'active'});}return;
 }
 if(action.type==='vendor-product-status'){
  const p=s.vendorProducts.find(p=>p.id===action.id);if(!p)throw Error('Товар не найден.');
  if(!['active','archived'].includes(action.status))throw Error('Неизвестное состояние товара.');p.status=action.status;return;
 }
 if(action.type==='vendor-offer'){
  const value=cleanOffer(action.value),error=offerError(value,s.vendorProducts,{complete:false});if(error)throw Error(error);
  const existing=s.vendorOffers.find(o=>o.id===action.id);if(action.id&&!existing)throw Error('Предложение не найдено.');
  if(existing&&existing.status!=='draft')throw Error('Редактировать можно только черновик. Для опубликованного предложения создайте копию.');
  if(existing)Object.assign(existing,value);else{if(s.vendorOffers.length>=100)throw Error('В демоверсии доступно до 100 предложений.');s.vendorOffers.unshift({...value,id:'offer-'+crypto.randomUUID(),status:'draft'});}return;
 }
 const o=s.vendorOffers.find(o=>o.id===action.id);if(!o)throw Error('Предложение не найдено.');
 if(action.type==='vendor-publish'){
  if(o.status!=='draft')throw Error('Опубликовать можно только черновик.');const error=offerError(o,s.vendorProducts);if(error)throw Error(error);
  publishVersion(s,o,cleanOffer(o),cleanProduct(s.vendorProducts.find(p=>p.id===o.productId)),o.snapshot?'Предложение опубликовано повторно':'Первая публикация');return;
 }
 if(action.type==='vendor-revise'){
  if(o.status!=='published'||!o.snapshot)throw Error('Изменить условия можно у опубликованного предложения.');
  if(action.baseVersion!==offerVersion(o))throw Error('Предложение уже изменилось. Откройте актуальную версию.');
  const reason=bounded(action.reason,1000);if(!reason)throw Error('Объясните покупателю причину изменения.');
  const value=cleanOffer({...o,...Object.fromEntries(Object.keys(revisionFields).map(key=>[key,action.value?.[key]??o[key]]))});
  const error=offerError(value,[{...o.snapshot,id:o.productId,status:'active'}]);if(error)throw Error(error);
  if(!revisionChanges(o,value).length)throw Error('Условия не изменились. Исправьте нужные поля перед публикацией.');
  if(!o.revisions?.length)o.revisions=[{version:offerVersion(o),reason:o.revisionReason||'Предыдущая публикация',time:o.revisionTime||'',terms:cleanOffer(o)}];
  publishVersion(s,o,value,o.snapshot,reason);return;
 }
 if(action.type==='vendor-offer-status'){
  if(action.status==='archived'){if(o.snapshot&&!o.revisions?.length)o.revisions=[{version:offerVersion(o),reason:o.revisionReason||'Предыдущая публикация',time:o.revisionTime||'',terms:cleanOffer(o)}];o.status='archived';return;}
  if(action.status==='draft'&&o.status==='archived'){o.status='draft';return;}
  throw Error('Недопустимое изменение состояния предложения.');
 }
 if(action.type==='vendor-copy'){
  if(s.vendorOffers.length>=100)throw Error('В демоверсии доступно до 100 предложений.');
  s.vendorOffers.unshift({...cleanOffer(o),id:'offer-'+crypto.randomUUID(),status:'draft'});return;
 }
 throw Error('Неизвестное действие поставщика.');
}

function publishVersion(s,o,value,product,reason){
 const version=o.snapshot?offerVersion(o)+1:1;
 if(version>=1000000)throw Error('Достигнут предел версий. Создайте копию предложения.');
 const time=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date());
 const next={...o,...value,version,snapshot:cleanProduct(product),revisionReason:reason,revisionTime:time,status:'published'};
 const compiled=compileOffer(next,next.snapshot),participants=(s.deals||[]).filter(d=>d.offer.id===o.id&&!d.accepted);
 if(participants.some(d=>!sameRevisionIdentity(d.offer,compiled)))throw Error('Для другого товара, порога или шага создайте копию предложения. Предварительные участники сохраняют свои условия.');
 Object.assign(o,next);o.revisions=[{version,reason,time,terms:cleanOffer(o)},...(o.revisions||[])].slice(0,20);
 for(const d of participants){d.pendingRevision={offer:structuredClone(compiled),reason,time};d.history.unshift({title:'Поставщик опубликовал условия v'+version,time});d.history=d.history.slice(0,30);}
}

export function compileOffer(o,product){
 const threshold=Math.max(o.min,Math.ceil((o.target*.1)/o.step)*o.step);
 const initial=Math.min(o.max,threshold);
 const date=new Date(o.deadlineDate+'T12:00:00+03:00');
 return {id:o.id,version:offerVersion(o),revisionReason:o.revisionReason||'',revisionTime:o.revisionTime||'',name:product.name,detail:product.detail,category:product.category,unit:product.unit,priceUnit:productUnits[product.unit],image:product.image||null,supplier:'ООО «Бумага и дело»',others:0,people:0,initial,...Object.fromEntries(['current','next','retail','target','min','step','max','delivery','retailDelivery'].map(k=>[k,o[k]])),deadline:new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(date)+', 18:00 МСК',days:Math.ceil((date-new Date(today()+'T12:00:00+03:00'))/86400000),region:o.region,deadlineDate:o.deadlineDate,deliveryDate:o.deliveryDate,local:true};
}
export function catalogOffers(s){
 return [...seededOffers,...(s.vendorOffers||[]).filter(o=>o.status==='published'&&o.snapshot).map(o=>compileOffer(o,o.snapshot))];
}
