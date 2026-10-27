import { visibleDeals, dealNumber } from './deal-model.js';
import { calculate, money } from '../domain.js';
import { esc, btn } from './ui.js';
import { issueReasons } from './deal-communication-model.js';
import { offerVersion, pendingRevision } from './offer-revision.js';
import { revisionDate } from './revision-views.js';
import { dealContractCopy } from './deal-pages.js';

export function createDealController({getState,dispatch,go,openModal,notify,editOffer,ui,redrawView}){
 const close=()=>document.querySelector('#modal').close();
 function prompt(title,body,action,d,label){openModal(title,`${body}<div class="modal-actions">${btn('Отмена','close-modal','secondary')}${btn(label,action,'primary',`data-id="${esc(d.id)}"`)}</div>`);}
 function handle(action,control){
  const s=getState(),d=visibleDeals(s).find(d=>d.id===control.dataset.id);
  if(!d){notify('Закупка недоступна в выбранной компании.',true);return;}
  const q=calculate(d.offer,d.quantity);
  switch(action){
   case 'deal-download':{
    if(!d.accepted){notify('Договор появится после создания личного заказа.',true);return;}
    const url=URL.createObjectURL(new Blob([dealContractCopy(d)],{type:'text/html;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='Договор_'+dealNumber(d).replace(/[^\p{L}\p{N}-]/gu,'_')+'_демо.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);notify('Скачана демонстрационная HTML-копия договора.');return;
   }
   case 'deal-reply':ui.dealReply=control.dataset.message;redrawView();document.querySelector('#deal-message-text')?.focus({preventScroll:true});return;
   case 'deal-clear-reply':ui.dealReply=null;redrawView();document.querySelector('#deal-message-text')?.focus({preventScroll:true});return;
   case 'deal-clear-chat-search':ui.dealChatSearch='';redrawView();document.querySelector('#deal-chat-search')?.focus({preventScroll:true});return;
   case 'deal-issue-prompt':
    openModal('Расхождение по заказу',`<p class="modal-description">${esc(d.offer.name)} · в заказе ${d.quantity} ${esc(d.offer.unit)}.</p><form id="deal-issue-form" class="form-grid"><label>Причина<select name="reason">${issueReasons.map(r=>`<option>${r}</option>`).join('')}</select></label><label id="deal-actual-field">Фактически получено, ${esc(d.offer.unit)}<input name="actualQuantity" type="number" min="0" max="${d.quantity-1}" step="1" required></label><label>Что произошло?<textarea name="description" rows="4" maxlength="2000" placeholder="Опишите фактическое состояние и ожидаемый результат" required></textarea></label><div class="modal-actions">${btn('Отмена','close-modal','secondary','type="button"')}<button type="submit" class="button primary">Создать обращение</button></div></form>`);
    document.querySelector('#deal-issue-form select').onchange=e=>{const shortage=e.target.value==='Не хватает товара';document.querySelector('#deal-actual-field').hidden=!shortage;const actual=document.querySelector('[name=actualQuantity]');actual.required=shortage;actual.disabled=!shortage;};
    document.querySelector('#deal-issue-form').onsubmit=e=>{e.preventDefault();if(dispatch({type:'deal-issue',id:d.id,value:Object.fromEntries(new FormData(e.target))},false)){close();go('deal/'+d.id+'/issues');notify('Обращение сохранено в этом заказе.');}};return;
   case 'deal-response-prompt':{
    const issue=d.issues.find(i=>i.id===control.dataset.issue);if(!issue)return;
    openModal('Решение по обращению №'+issue.number,`<p class="modal-description">${esc(issue.reason)}. ${esc(issue.description)}</p><form id="deal-response-form" class="form-grid"><label>Как и когда будет решён вопрос?<textarea name="text" rows="5" maxlength="2000" required autofocus>${esc(issue.response?.text||'')}</textarea></label><p class="fine-print">Ответ увидит покупатель. Урегулирование он подтвердит отдельно.</p><div class="modal-actions">${btn('Отмена','close-modal','secondary','type="button"')}<button class="button primary" type="submit">Сохранить решение</button></div></form>`);
    document.querySelector('#deal-response-form').onsubmit=e=>{e.preventDefault();if(dispatch({type:'deal-issue-response',id:d.id,issueId:issue.id,text:new FormData(e.target).get('text')},false)){close();go('deal/'+d.id+'/issues');notify('Решение сохранено. Подтверждение — за покупателем.');}};return;
   }
   case 'deal-resolve-prompt':{
    const issue=d.issues.find(i=>i.id===control.dataset.issue);if(!issue)return;
    prompt('Расхождение устранено?',`<p class="modal-description">${esc(issue.reason)}. Подтвердите после выполнения согласованного решения.</p>`,'deal-resolve',d,'Подтвердить урегулирование');document.querySelector('[data-action="deal-resolve"]').dataset.issue=issue.id;return;
   }
   case 'deal-resolve':if(dispatch({type:'deal-issue-resolve',id:d.id,issueId:control.dataset.issue},false)){close();go('deal/'+d.id+'/issues');notify('Урегулирование подтверждено.');}return;
   case 'deal-edit':if(pendingRevision(d)){go('deal/'+d.id+'/changes');return;}editOffer(d.offer,d.quantity);return;
   case 'deal-review-prompt':{
    const revision=pendingRevision(d);if(!revision||Number(control.dataset.version)!==offerVersion(revision.offer)){go('deal/'+d.id+'/changes');notify('Проверьте актуальную версию условий.',true);return;}
    prompt('Принять условия v'+offerVersion(revision.offer)+'?',`<p class="modal-description">${esc(d.offer.name)} · ${d.quantity} ${esc(d.offer.unit)}. Поставка ${revisionDate(revision.offer.deliveryDate)}.</p><div class="deal-prompt-total"><span>По новым условиям, с доставкой и сбором</span><strong>${money(calculate(revision.offer,d.quantity).total)}</strong></div><p class="fine-print">Расчёт участия обновится. Личный заказ можно будет создать отдельно после проверки условий.</p>`,'deal-review-accept',d,'Принять условия');document.querySelector('[data-action="deal-review-accept"]').dataset.version=offerVersion(revision.offer);return;
   }
   case 'deal-review-accept':if(dispatch({type:action,id:d.id,expectedVersion:Number(control.dataset.version)},false)){close();go('deal/'+d.id+'/conditions');notify('Новые условия приняты. Участие остаётся предварительным.');}return;
   case 'deal-accept-prompt':prompt('Создать личный заказ?',`<p class="modal-description">${esc(d.offer.name)} · ${d.quantity} ${esc(d.offer.unit)}.</p><div class="deal-prompt-total"><span>С доставкой и сбором</span><strong>${money(q.total)}</strong></div><p class="fine-print">Количество и условия будут зафиксированы. Подпись договора и демооплата выполняются отдельно.</p>`,'deal-accept',d,'Согласовать условия');return;
   case 'deal-sign-prompt':prompt('Отметить подпись в деморежиме?',`<p class="modal-description">${esc(dealNumber(d))} · ${esc(d.offer.name)} · ${money(q.total)}.</p><p class="fine-print">Это локальная проверка сценария подписания. Юридически значимая подпись не создаётся.</p>`,'deal-sign',d,'Отметить подпись');return;
   case 'deal-pay-prompt':prompt('Демонстрация оплаты',`<p class="modal-description">Получатель: ${esc(d.offer.supplier)}.</p><div class="deal-prompt-total"><span>${esc(dealNumber(d))} · итоговая сумма</span><strong>${money(q.total)}</strong></div><p class="fine-print">Деньги не списываются. После подтверждения в заказе появится отметка демооплаты.</p>`,'deal-pay',d,'Отметить демооплату');return;
   case 'deal-receive-prompt':prompt('Товар получен полностью?',`<p class="modal-description">${esc(d.offer.name)} · ${d.quantity} ${esc(d.offer.unit)}. Подтверждайте получение после проверки количества и характеристик.</p><p class="fine-print">В этом сценарии подтверждение завершит заказ.</p>`,'deal-receive',d,'Подтвердить получение');return;
   case 'deal-leave-prompt':prompt('Выйти из предварительной закупки?',`<p class="modal-description">Участие, предварительный расчёт и локальная переписка по нему будут удалены. Можно будет присоединиться заново, пока предложение доступно.</p>`,'deal-leave',d,'Выйти из закупки');return;
   case 'deal-delivery-prompt':
    openModal('Данные получения',`<p class="modal-description">${esc(d.offer.name)}. Данные доступны только сторонам вашего заказа.</p><form id="deal-delivery-form" class="form-grid"><label>Адрес получения<textarea name="address" rows="3" maxlength="240" required autofocus placeholder="Город, улица, дом, помещение">${esc(d.delivery.address)}</textarea></label><label>Контакт получателя<input name="contact" maxlength="120" value="${esc(d.delivery.contact)}" placeholder="Имя и телефон" required></label><div class="modal-actions">${btn('Отмена','close-modal','secondary','type="button"')}<button type="submit" class="button primary">Сохранить данные</button></div></form>`);
    document.querySelector('#deal-delivery-form').onsubmit=e=>{e.preventDefault();if(dispatch({type:'deal-delivery',id:d.id,value:Object.fromEntries(new FormData(e.target))},false)){close();go('deal/'+d.id+'/overview');notify('Данные получения сохранены.');}};return;
   case 'deal-accept':case 'deal-sign':case 'deal-pay':case 'deal-receive':case 'deal-leave':
    if(dispatch({type:action,id:d.id},false)){close();go(action==='deal-leave'?'purchases':'deal/'+d.id+'/'+(action==='deal-sign'?'contract':'overview'));notify(action==='deal-sign'?'Подпись отмечена в деморежиме.':action==='deal-pay'?'Демооплата отмечена.':action==='deal-receive'?'Получение подтверждено.':action==='deal-leave'?'Вы вышли из предварительной закупки.':'Личный заказ создан.');}return;
  }
 }
 function bindFields(){
  const tabs=document.querySelector('.deal-tabs'),active=tabs?.querySelector('[aria-current=page]');
  if(active&&tabs.scrollWidth>tabs.clientWidth){const offset=active.getBoundingClientRect().left-tabs.getBoundingClientRect().left+tabs.scrollLeft;tabs.scrollLeft=Math.max(0,offset-(tabs.clientWidth-active.clientWidth)/2);}
  const form=document.querySelector('#deal-message-form');if(!form)return;
  const input=document.querySelector('#deal-message-text'),channel=form.dataset.channel,id=form.dataset.id;
  input.addEventListener('input',()=>{dispatch({type:'deal-draft',id,channel,text:input.value},false);form.querySelector('[type=submit]').disabled=!input.value.trim();});
  input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();form.requestSubmit();}});
  form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;if(dispatch({type:'deal-message',id,channel,text:input.value,replyTo:ui.dealReply},false)){ui.dealReply=null;ui.dealChatSearch='';redrawView();const feed=document.querySelector('#deal-message-feed');feed.scrollTop=feed.scrollHeight;document.querySelector('#deal-message-text').focus({preventScroll:true});}};
  document.querySelector('#deal-chat-search').oninput=e=>{const caret=e.target.selectionStart;ui.dealChatSearch=e.target.value;redrawView();const search=document.querySelector('#deal-chat-search');search.focus({preventScroll:true});search.setSelectionRange(caret,caret);};
  if(!ui.dealChatSearch){const feed=document.querySelector('#deal-message-feed');feed.scrollTop=feed.scrollHeight;}
 }
 return {handle,bindFields};
}
