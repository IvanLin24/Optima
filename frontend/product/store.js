import { hydrateSupplier, supplierTransition } from './supplier-model.js';
import { hydrateDeals, dealTransition } from './deal-model.js';
import { baseState, canAccept, quantityError, offers } from './data.js';
import { validateNeed, unresolvedIssues, matchPaperNeed } from './workflow-model.js';
let KEY='optima.product.v3';
const now=()=>new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date());
// Only this adapter knows about browser storage. Replace it with the team's API adapter later.
export const localRepository = {
 read(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}},
 write(state){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}},
};
export function hydrate(raw){
 const clean=baseState();
 if(!raw||raw.schema!==3)return clean;
 clean.role=raw.role==='supplier'?'supplier':'buyer';
 if(!quantityError(offers[0],raw.ownQuantity))clean.ownQuantity=raw.ownQuantity;
 for(const k of ['joined','accepted','paid','received','readMessages','notificationsRead'])clean[k]=raw[k]===true;
 clean.signatures={buyer:raw.signatures?.buyer===true,supplier:raw.signatures?.supplier===true};
 if(!clean.accepted){clean.signatures={buyer:false,supplier:false};clean.paid=false;clean.received=false;}
 if(!clean.signatures.buyer||!clean.signatures.supplier){clean.paid=false;clean.received=false;}
 if(!clean.paid)clean.received=false;
 for(const k of ['saved','needs','comments','issues','tasks','events'])if(Array.isArray(raw[k]))clean[k]=raw[k].filter(x=>k==='saved'?typeof x==='string':x&&typeof x==='object').slice(-200);
 for(const channel of ['group','private']){
  clean.messages[channel]=(Array.isArray(raw.messages?.[channel])?raw.messages[channel]:[]).filter(m=>m&&typeof m.text==='string'&&typeof m.id==='string').slice(-200);
  clean.drafts[channel]=typeof raw.drafts?.[channel]==='string'?raw.drafts[channel].slice(0,4000):'';
 }
 if(raw.delivery&&typeof raw.delivery==='object')for(const k of Object.keys(clean.delivery))if(typeof raw.delivery[k]==='string')clean.delivery[k]=raw.delivery[k].slice(0,160);
 Object.assign(clean,hydrateSupplier(raw));
 clean.deals=hydrateDeals(raw.deals,clean.vendorOffers);
 return clean;
}
export function transition(current,action){
 const s=structuredClone(current);
 if(action.type.startsWith('deal-')){dealTransition(s,action);return s;}
 if(action.type.startsWith('vendor-')){supplierTransition(s,action);return s;}
 if(s.role!=='buyer'&&['quantity','accept','pay','receive','need','delete-need','apply-need','delivery','comment','task','task-status','issue','close-issue'].includes(action.type))throw Error('Это действие доступно покупателю.');
 if(action.type==='issue-response'&&s.role!=='supplier')throw Error('Ответить на обращение может поставщик.');
 const event=(title,detail='')=>s.events.unshift({id:crypto.randomUUID(),title,detail,time:now()});
 switch(action.type){
  case 'role':s.role=action.value==='supplier'?'supplier':'buyer';break;
  case 'save':s.saved=s.saved.includes(action.id)?s.saved.filter(id=>id!==action.id):[...s.saved,action.id];break;
  case 'quantity':if(s.accepted)throw Error('Объём уже зафиксирован. Изменения требуют отдельного согласования.');if(quantityError(offers[0],action.value))throw Error(quantityError(offers[0],action.value));s.ownQuantity=action.value;s.joined=true;event('Изменён собственный объём',`${action.value} пачек`);break;
  case 'accept':if(!canAccept(s))throw Error('Для фиксации пока не хватает подтверждённого объёма.');s.accepted=true;event('Согласованы условия версии 2','Поставка 29 октября. Создан личный заказ.');break;
  case 'sign':if(!s.accepted)throw Error('Сначала согласуйте условия закупки.');s.signatures[s.role]=true;event(s.role==='buyer'?'Договор подписан покупателем':'Договор подписан поставщиком','Демонстрационный режим');break;
  case 'pay':if(!s.accepted||!s.signatures.buyer||!s.signatures.supplier)throw Error('Для этой закупки нужны подписи обеих сторон.');s.paid=true;event('Оплата отмечена исполненной','Демонстрация без списания средств');break;
  case 'receive':if(!s.paid)throw Error('В выбранном сценарии сначала предусмотрена предоплата.');if(unresolvedIssues(s).length)throw Error('Перед полной приёмкой урегулируйте открытые обращения.');s.received=true;event('Получение подтверждено','Заказ закрыт в демонстрации.');break;
  case 'message':if(!action.text.trim()&&!action.attachment)return s;s.messages[action.channel].push({id:crypto.randomUUID(),side:s.role,name:s.role==='buyer'?'Иван Л.':'Алексей Б.',company:s.role==='buyer'?'Линия':'Поставщик',initials:s.role==='buyer'?'ИЛ':'АБ',text:action.text.trim(),attachment:action.attachment||null,reply:action.reply||null,time:now()});s.drafts[action.channel]='';break;
  case 'draft':s.drafts[action.channel]=action.text;break;
  case 'read-messages':s.readMessages=true;break;
  case 'read-notifications':s.notificationsRead=true;break;
  case 'need':{const error=validateNeed(action.value);if(error)throw Error(error);const record={...action.value,name:action.value.name.trim(),city:action.value.city.trim(),id:action.id||crypto.randomUUID()};const i=s.needs.findIndex(n=>n.id===record.id);if(i<0)s.needs.push(record);else s.needs[i]=record;break;}
  case 'delete-need':s.needs=s.needs.filter(n=>n.id!==action.id);break;
  case 'apply-need':{if(s.accepted)throw Error('Текущий заказ уже зафиксирован. Его объём не меняется из потребности.');const need=s.needs.find(n=>n.id===action.id);if(!need||matchPaperNeed(need).state!=='ready')throw Error('Сначала проверьте все характеристики потребности.');s.ownQuantity=Number(need.quantity);s.joined=true;need.linkedGroup='paper';event('Объём перенесён из потребности',`${s.ownQuantity} пачек · группа ЗК-2048`);break;}
  case 'comment':if(action.text.trim())s.comments.push({id:crypto.randomUUID(),text:action.text.trim(),time:now()});break;
  case 'issue':if(!s.accepted)throw Error('Обращение создаётся по оформленному заказу.');if(!String(action.value.description||'').trim())throw Error('Опишите расхождение.');s.issues.push({id:crypto.randomUUID(),...action.value,status:'На рассмотрении',time:now()});event('Создано обращение по заказу',action.value.reason);break;
  case 'issue-response':{const issue=s.issues.find(i=>i.id===action.id);if(!issue||issue.status==='Урегулировано')throw Error('Нет открытого обращения.');if(!String(action.text||'').trim())throw Error('Опишите решение для покупателя.');issue.response={text:action.text.trim(),time:now()};issue.status='Ответ поставщика';event('Поставщик ответил на обращение',issue.reason);break;}
  case 'close-issue':{const issue=s.issues.find(i=>i.id===action.id);if(!issue?.response)throw Error('Сначала дождитесь ответа поставщика.');issue.status='Урегулировано';issue.resolvedAt=now();event('Обращение урегулировано',issue.reason);break;}
  case 'task':{if(!String(action.value?.person||'').trim())throw Error('Укажите ответственного.');s.tasks.unshift({id:crypto.randomUUID(),person:String(action.value.person).trim(),comment:String(action.value.comment||'').trim(),status:'Ожидает решения',time:now()});break;}
  case 'task-status':{const task=s.tasks.find(t=>t.id===action.id);if(!task)throw Error('Задача не найдена.');if(!['Выполнена','Ожидает решения'].includes(action.status))throw Error('Недопустимое состояние задачи.');task.status=action.status;task.updatedAt=now();break;}
  case 'delivery':s.delivery={...s.delivery,...action.value};event('Уточнены данные получения','Данные доступны только сторонам заказа.');break;
  default:throw Error('Неизвестное действие');
 }
 return s;
}
let state=hydrate(null);
const listeners=new Set();
export const store={get:()=>state,
 replace(raw,companyId){if(companyId)KEY='optima.product.v3.'+companyId;state=hydrate(raw);localRepository.write(state);},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 dispatch(action){state=transition(state,action);const saved=localRepository.write(state);for(const fn of listeners)fn(state,action);return {state,saved};}};
