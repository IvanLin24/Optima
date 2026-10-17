/** Optima shared domain. Money is integer kopecks. No DOM or network dependencies. */
export const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(Math.round(n)/100);
export const num = n => new Intl.NumberFormat('ru-RU').format(Number(n)||0);
export const date = iso => iso ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(`${iso}T12:00:00`)) : 'Не указан';
export const stamp = iso => iso ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${iso}T12:00:00`)) : '—';
export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clone = value => JSON.parse(JSON.stringify(value));
export const PROC_STATES = {
 collecting:['Идёт набор','progress'],
 negotiating:['Условия на согласовании','attention'],
 contract:['Ожидает подтверждения','attention'],
 fulfillment:['Поставка готовится','positive'],
 delivered:['Завершена','neutral'],
};
export const QUESTION_STATES = {
 pending:['Требует ответа','attention'],
 accepted:['Согласовано предварительно','positive'],
 declined:['Предложение отклонено','neutral']
};
export const CONTRACT_STATES = {
 review:['На подтверждении','attention'],
 confirmed:['Подтверждено в демо','positive'],
 declined:['Отклонено','neutral']
};
export const paymentLabels = {scheduled:['Запланирован','neutral'],executed:['Выполнен (демо)','positive'],pending:['Обрабатывается','attention']};
export function sumMoney(items,key='sumKop'){return items.reduce((s,o)=>s+(Number(o[key])||0),0)}
export function savingRate(separateKop,groupKop){if(separateKop<=0)return 0;return Math.max(0,Math.round((separateKop-groupKop)/separateKop*1000)/10)}
export function calculate(p,qty){const q=Number(qty);if(!Number.isInteger(q)||q<1||q>1000000)throw Error('Некорректное количество');const separateKop=p.singlePriceKop*q+p.deliveryKop;const groupKop=p.groupPriceKop*q+p.deliveryKop;return {separateKop,groupKop,savingKop:separateKop-groupKop,savingPct:savingRate(separateKop,groupKop)};}
export function progress(p){return Math.min(100,Math.round(p.collectedQty/p.thresholdQty*100));}
export function activityEvent(state,verb,details){state.activity.unshift({id:`EV-${String(state.nextId++).padStart(4,'0')}`,date:'2026-10-17',verb,details});state.activity=state.activity.slice(0,50);}
export function notification(state,title,description,target){state.notifications.unshift({id:`NT-${state.nextId++}`,title,description,target,unread:true});}
export function action(state,kind,payload={}){
 const s=clone(state);
 switch(kind){
  case 'answerQuestion':{
    const q=s.questions.find(x=>x.id===payload.id);
    if(!q||q.status!=='pending')throw Error('Предложение уже обработано');
    if(!['accept','decline'].includes(payload.decision))throw Error('Некорректное решение');
    q.status=payload.decision==='accept'?'accepted':'declined';q.answeredAt='2026-10-17';
    if(q.status==='accepted'){
      const p=s.purchases.find(x=>x.id===q.purchaseId);if(!p)throw Error('Закупка не найдена');
      const id=`CT-${s.nextId++}`;
      s.contracts.unshift({id,number:`ДC-${String(s.nextId).padStart(4,'0')}`,purchaseId:p.id,kind:'change',version:2,status:'review',title:`Изменение условий: ${p.title}`,description:q.title,proposedDelivery:q.proposedDelivery||null,oldDelivery:p.delivery,amountKop:p.quantity*p.groupPriceKop+p.deliveryKop,created:'2026-10-17',supplier:p.supplier});
      notification(s,'Подготовлено изменение условий',`Документ ${id} ожидает отдельного подтверждения в разделе «Контракты».`,'contracts');
      activityEvent(s,'Вопрос согласован',`Предварительно согласовано «${q.title}». Условия контракта пока не изменены.`);
    }else activityEvent(s,'Вопрос отклонён',`Предложение «${q.title}» отклонено.`);
    return s;
  }
  case 'confirmContract':{
    const c=s.contracts.find(x=>x.id===payload.id);if(!c||c.status!=='review')throw Error('Документ недоступен для подтверждения');
    c.status='confirmed';c.confirmedAt='2026-10-17';c.confirmedBy=s.company.contact;
    const p=s.purchases.find(x=>x.id===c.purchaseId);
    if(p){if(c.proposedDelivery)p.delivery=c.proposedDelivery;p.status='fulfillment';}
    notification(s,'Условия подтверждены в деморежиме',`Документ ${c.number} подтверждён. Это не юридическая электронная подпись.`,'contracts');
    activityEvent(s,'Контракт подтверждён',`${c.number} — подтверждение условий в демонстрационном режиме.`);
    return s;
  }
  case 'declineContract':{
    const c=s.contracts.find(x=>x.id===payload.id);if(!c||c.status!=='review')throw Error('Документ уже обработан');
    c.status='declined';activityEvent(s,'Контракт отклонён',c.number);return s;
  }
  case 'addNeed':{
    const title=String(payload.title||'').trim(),quantity=Number(payload.quantity),unit=String(payload.unit||'шт.').trim(),deadline=String(payload.deadline||'').trim();
    if(title.length<3||title.length>110)throw Error('Название от 3 до 110 символов');
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error('Количество от 1 до 1 000 000');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline)))throw Error('Укажите дату');
    const id=`NEED-${s.nextId++}`;s.needs.unshift({id,title,quantity,unit:unit.slice(0,12),deadline,status:'matching'});activityEvent(s,'Добавлена потребность',`${title}, ${num(quantity)} ${unit}`);return s;
  }
  case 'removeNeed':{
    if(!s.needs.some(x=>x.id===payload.id))throw Error('Потребность не найдена');s.needs=s.needs.filter(x=>x.id!==payload.id);activityEvent(s,'Потребность удалена',payload.id);return s;
  }
  case 'readNotification':s.notifications.forEach(x=>{if(payload.id==='all'||x.id===payload.id)x.unread=false});return s;
  case 'settings':{
    const name=String(payload.name||'').trim(),contact=String(payload.contact||'').trim();if(name.length<3||contact.length<2)throw Error('Заполните название и контакт');
    s.company.name=name.slice(0,80);s.company.contact=contact.slice(0,80);s.company.email=String(payload.email||'').trim().slice(0,120);activityEvent(s,'Обновлены настройки',name);return s;
  }
  case 'createOffer':{
    const title=String(payload.title||'').trim(),thresholdQty=Number(payload.thresholdQty),groupPriceRub=Number(payload.groupPriceRub),singlePriceRub=Number(payload.singlePriceRub);
    if(title.length<3||!Number.isInteger(thresholdQty)||thresholdQty<1||!Number.isFinite(groupPriceRub)||groupPriceRub<=0||!Number.isFinite(singlePriceRub)||singlePriceRub<groupPriceRub)throw Error('Проверьте название, минимальную партию и цены');
    const id=`OFFER-${s.nextId++}`;s.supplierOffers.unshift({id,title,category:String(payload.category||'Прочее'),thresholdQty,collectedQty:0,groupPriceKop:Math.round(groupPriceRub*100),singlePriceKop:Math.round(singlePriceRub*100),unit:'шт.',promoted:false,published:true});activityEvent(s,'Опубликовано предложение',title);return s;
  }
  case 'togglePromotion':{
    const o=s.supplierOffers.find(x=>x.id===payload.id);if(!o)throw Error('Предложение не найдено');o.promoted=!o.promoted;activityEvent(s,o.promoted?'Включено демопродвижение':'Демопродвижение выключено',o.title);return s;
  }
  default:throw Error('Неизвестное действие');
 }
}
