import { offers, quote, groupVolume, seedMessages, orderStatus } from './data.js';
import { calculate } from '../domain.js';
import { visibleDeals, dealNumber, dealStatus } from './deal-model.js';
import { openDealIssues, unreadDealMessages } from './deal-communication-model.js';
import { unresolvedIssues } from './workflow-model.js';
import { pendingRevision, offerVersion } from './offer-revision.js';

// The original A4 demonstration retains its own transition rules.
export function nextStep(s) {
 if(unresolvedIssues(s).length)return {stage:'Обращение по заказу',title:'Есть неурегулированное расхождение',description:s.received?'Проверьте обращение после приёмки и ответ поставщика. Подтвердите урегулирование, когда расхождение устранено.':'Проверьте обращение и ответ поставщика. Полная приёмка станет доступна после урегулирования.',action:'Открыть обращение',route:'order',tone:'warning',kind:'issue'};
 if(!s.accepted&&groupVolume(s)<1000)return {stage:'Объём группы',title:'До оптовой цены не хватает объёма',description:`В группе ${groupVolume(s)} из 1 000 пачек. Можно уточнить свой объём или дождаться других участников.`,action:'Посмотреть закупку',route:'group',tone:'neutral',kind:'volume'};
 if(!s.accepted)return {stage:'Изменение условий',title:'Проверьте новую дату поставки',description:'Поставщик перенёс доставку на два дня. Проверьте новую дату, чтобы продолжить оформление заказа.',action:'Сравнить и согласовать',route:'group/conditions',tone:'warning',kind:'conditions'};
 if(!s.signatures.buyer)return {stage:'Договор',title:'Проверьте и подпишите договор',description:'Заказ создан на согласованных условиях. Следующий шаг — договор между вашей компанией и поставщиком.',action:'Открыть договор',route:'document',tone:'blue',kind:'signature'};
 if(!s.signatures.supplier)return {stage:'Договор',title:'Ожидается подпись поставщика',description:'Ваша подпись отмечена. Оплата станет доступна, когда договор подпишут обе стороны.',action:'Посмотреть договор',route:'document',tone:'neutral',kind:'waiting'};
 if(!s.paid)return {stage:'Оплата',title:'Заказ готов к оплате',description:'Договор подписан обеими сторонами. Проверьте состав суммы перед демонстрацией оплаты.',action:'Перейти к заказу',route:'order',tone:'blue',kind:'payment'};
 if(!s.received)return {stage:'Получение',title:s.delivery.address?'Ожидаем поставку 29 октября':'Уточните адрес получения',description:s.delivery.address?'После поставки проверьте количество и состояние товара. Подтверждение получения доступно в заказе.':'Оплата отмечена. Укажите адрес и контакт получателя в личном заказе.',action:s.delivery.address?'Открыть заказ':'Указать данные получения',route:'order',tone:'blue',kind:s.delivery.address?'delivery':'address'};
 return {stage:'Заказ завершён',title:'Получение подтверждено',description:'Договор, платёж и результат приёмки сохранены в личном заказе.',action:'Посмотреть заказ',route:'order',tone:'success',kind:'complete'};
}
function dealStep(d){
 const route=tab=>'deal/'+d.id+'/'+tab,issues=openDealIssues(d),pending=pendingRevision(d),q=calculate(d.offer,d.quantity);
 if(issues.length){const answered=issues.some(i=>i.status==='answered');return {kind:answered?'issue':'issue-waiting',stage:'Обращение по заказу',title:answered?'Проверьте решение поставщика':'Ожидается ответ по обращению',description:answered?'Поставщик предложил решение. Проверьте результат и подтвердите урегулирование.':'Обращение сохранено в заказе. Ответ и дальнейшие шаги появятся в его карточке.',action:'Открыть обращение',route:route('issues'),tone:'warning'};}
 if(pending)return {kind:'revision',stage:'Новые условия · v'+offerVersion(pending.offer),title:'Поставщик обновил условия',description:pending.reason||'Сравните изменения цены, сроков и доставки перед оформлением своего заказа.',action:'Сравнить изменения',route:route('changes'),tone:'warning'};
 if(d.received)return {kind:'complete',stage:'Заказ завершён',title:'Получение подтверждено',description:'Условия, договор и история заказа сохранены в рабочем пространстве закупки.',action:'Посмотреть заказ',route:route('overview'),tone:'success'};
 if(d.paid)return {kind:'delivery',stage:'Получение',title:'Заказ оплачен. Ждём поставку',description:'После поставки проверьте количество, характеристики и упаковку. Подтвердить получение можно в заказе.',action:'Открыть заказ',route:route('overview'),tone:'blue'};
 if(!d.accepted)return q.projected>=d.offer.target?{kind:'conditions',stage:'Оформление',title:'Можно оформить свой заказ',description:'Оптовый порог достигнут с вашим объёмом. Проверьте полную стоимость, дату и условия перед согласованием.',action:'Проверить условия',route:route('conditions'),tone:'blue'}:{kind:'volume',stage:'Сбор группы',title:'Собираем объём для оптовой цены',description:'Ваше участие сохранено. Договор и оплата появятся после достижения порога и оформления заказа.',action:'Посмотреть закупку',route:route('overview'),tone:'neutral'};
 if(!d.signatures.buyer)return {kind:'signature',stage:'Договор',title:'Договор готов к вашей подписи',description:'Проверьте свой экземпляр: товар, количество, полную стоимость и дату поставки.',action:'Проверить договор',route:route('contract'),tone:'blue'};
 if(!d.signatures.supplier)return {kind:'waiting',stage:'Договор',title:'Ожидается подпись поставщика',description:'Ваша подпись отмечена. После подписей обеих сторон можно перейти к следующему шагу.',action:'Посмотреть договор',route:route('contract'),tone:'neutral'};
 if(!d.delivery.address||!d.delivery.contact)return {kind:'address',stage:'Данные получения',title:'Уточните адрес и получателя',description:'Добавьте данные получения в личном заказе. Они доступны вашей компании и поставщику.',action:'Указать данные',route:route('overview'),tone:'blue'};
 return {kind:'payment',stage:'Оплата',title:'Заказ готов к оплате',description:'Договор подписан обеими сторонами. Полная сумма включает товар, доставку и сервисный сбор.',action:'Перейти к заказу',route:route('overview'),tone:'blue'};
}
const priorities={issue:100,revision:95,signature:85,address:80,payment:75,conditions:70,'issue-waiting':55,waiting:40,delivery:30,volume:20,complete:0};
const actionKinds=new Set(['issue','revision','signature','address','payment','conditions']);
const seedDeadlines={paper:'2026-10-21',boxes:'2026-10-23',soap:'2026-10-22',tape:'2026-10-24'};
function prepare(item){return {...item,attention:actionKinds.has(item.step.kind),priority:priorities[item.step.kind]||0,stages:[['Условия',item.accepted],['Договор',item.signatures.buyer&&item.signatures.supplier],['Оплата',item.paid],['Получение',item.received]],deadlineDate:item.offer.deadlineDate||seedDeadlines[item.offer.id]||'',deliveryDate:item.offer.deliveryDate||'2026-10-29'};}
export function homeItems(s){
 const list=[];
 if(s.joined||s.accepted){const issues=unresolvedIssues(s);let step=nextStep(s);if(issues.length&&!issues.some(i=>i.response?.text))step={...step,kind:'issue-waiting',title:'Ожидается ответ по обращению',description:'Обращение сохранено в заказе. После ответа поставщика вы сможете проверить решение и подтвердить урегулирование.'};list.push(prepare({id:'paper',offer:offers[0],quantity:s.ownQuantity,quote:quote(s),accepted:s.accepted,paid:s.paid,received:s.received,signatures:s.signatures,complete:s.received&&!issues.length,issues,pending:null,step,status:orderStatus(s),number:s.accepted?'ОП-2048/Л':'ЗК-2048',route:s.accepted?'order':'group',discussionRoute:'group/discussion',messages:[...seedMessages.filter(m=>!m.event),...s.messages.group],unread:s.readMessages?0:2,delivery:s.delivery,version:2}));}
 for(const d of visibleDeals(s)){const issues=openDealIssues(d);list.push(prepare({id:d.id,offer:d.offer,quantity:d.quantity,quote:calculate(d.offer,d.quantity),accepted:d.accepted,paid:d.paid,received:d.received,signatures:d.signatures,complete:d.received&&!issues.length,issues,pending:pendingRevision(d),step:dealStep(d),status:dealStatus(d),number:d.accepted?dealNumber(d):'Участие в группе',route:'deal/'+d.id+'/overview',discussionRoute:'deal/'+d.id+'/discussion',messages:d.messages.group,unread:unreadDealMessages(d,'buyer','group'),delivery:d.delivery,version:offerVersion(d.offer)}));}
 return list.sort((a,b)=>b.priority-a.priority);
}
export function homeWorkspace(s,ui={}){
 const items=homeItems(s),filter=['all','active','attention','complete'].includes(ui.homeFilter)?ui.homeFilter:'active';
 const counts={all:items.length,active:items.filter(i=>!i.complete).length,attention:items.filter(i=>i.attention).length,complete:items.filter(i=>i.complete).length};
 const query=String(ui.homeSearch||'').trim().toLocaleLowerCase('ru');
 const rows=items.filter(i=>(filter==='all'||filter==='attention'&&i.attention||filter==='complete'&&i.complete||filter==='active'&&!i.complete)&&(!query||[i.offer.name,i.offer.supplier,i.number,i.offer.category].join(' ').toLocaleLowerCase('ru').includes(query)));
 const selected=rows.find(i=>i.id===ui.homeSelection)||rows[0]||null;
 return {items,rows,selected,filter,counts,query};
}
export const homeDateValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function deadlineLabel(value,reference=new Date()){
 if(!homeDateValid(value))return 'Срок уточняется';
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(reference),days=Math.round((Date.parse(value)-Date.parse(day))/86400000);
 if(days<0)return 'Набор завершён';
 if(days===0){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'}).format(reference));return hour>=18?'Набор завершён':'Сегодня, до 18:00 МСК';}
 if(days===1)return 'Завтра, до 18:00 МСК';
 return 'До '+new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date(value+'T12:00:00+03:00'));
}
