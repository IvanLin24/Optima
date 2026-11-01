import { money, company } from './data.js';
import { homeWorkspace, homeDateValid } from './home-model.js';
import { calculationView } from './purchase-calculator.js';
import { esc, icon, routeLink, btn, tag } from './ui.js';
import { hasQuotedComparison } from './price-provenance.js';
export { nextStep } from './home-model.js';

const number = value => new Intl.NumberFormat('ru-RU').format(value);
const panelNames = [['action','Следующий шаг'],['calculation','Расчёт'],['activity','История']];
const filters = [['active','В работе'],['attention','Нужно решение'],['complete','Завершены'],['all','Все']];
const quoteCaption = item => item.pending ? 'Текущий расчёт' : item.paid ? 'Оплачено по заказу' : item.accepted ? 'Стоимость заказа' : 'Предварительный расчёт';

function dateParts(value) {
 if (!homeDateValid(value)) return {day:'—',month:'Дата уточняется',full:'Дата уточняется'};
 const date = new Date(value+'T12:00:00+03:00');
 const parts = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).formatToParts(date);
 return {day:String(Number(value.slice(8))),month:parts.find(p=>p.type==='month').value,full:parts.map(p=>p.value).join('')};
}

export function overview(ui,s) {
 const workspace = homeWorkspace(s,ui);
 const item = workspace.selected;
 const panel = panelNames.some(([id])=>id===ui.homePanel) ? ui.homePanel : 'action';
 const showQueue=workspace.items.length>1||Boolean(workspace.query);
 const today = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',weekday:'long',timeZone:'Europe/Moscow'}).format(new Date());
 return `<div class="workbench">
  <header class="wb-heading" data-motion="desk-heading">
   <div><p>${esc(company.name||'Компания не заполнена')}<span>${esc(today)}</span></p><h1>Обзор</h1></div>
   ${workspace.items.length?`<div class="wb-heading-actions">${btn(icon('plus',18)+' Потребность','create-need','secondary','aria-label="Создать потребность"')}${routeLink('Найти закупку '+icon('arrow',16),'purchases/offers','button primary')}</div>`:''}
  </header>
  ${!showQueue&&workspace.items.length?`<nav class="wb-pulse" aria-label="Состояние закупок" data-home-filter-group="summary">${[['active','В работе'],['attention','Нужно решение'],...(workspace.counts.complete?[['complete','Завершены']]:[])].map(([id,label])=>`<button data-action="home-filter" data-filter="${id}" aria-pressed="${workspace.filter===id}">${label}<span>${workspace.counts[id]}</span></button>`).join('')}</nav>`:''}
  <div class="wb-workspace ${showQueue?'':'wb-workspace--single'}" data-motion="desk-workspace">
   ${showQueue?queueView(workspace,ui):''}
   ${item?selectedView(item,workspace,panel,s):emptyView(workspace)}
  </div>
  <p class="sr-only" role="status" aria-live="polite">${item?'Выбрана закупка: '+esc(item.offer.name)+'. '+esc(item.step.title):'В выбранном списке нет закупок.'}</p>
 </div>`;
}


function queueView(w,ui) {
 return `<aside class="wb-queue" id="home-queue" aria-label="Закупки компании">
  <header><div><h2>Мои закупки</h2><span>${w.counts.all}</span></div><a href="#purchases/offers" class="wb-queue-add" aria-label="Найти новую закупку">${icon('plus',17)}</a></header>
  <label class="wb-search">${icon('search',16)}<input id="home-search" aria-label="Найти свою закупку" value="${esc(ui.homeSearch||'')}" placeholder="Название или поставщик">${ui.homeSearch?btn(icon('close',14),'home-clear-search','quiet','aria-label="Очистить поиск закупок"'):''}</label>
  <nav class="wb-filters" data-home-filter-group="queue" aria-label="Состояние закупок">${filters.map(([id,label])=>`<button data-action="home-filter" data-filter="${id}" aria-pressed="${w.filter===id}">${label}<span>${w.counts[id]}</span></button>`).join('')}</nav>
  <div class="wb-order-list" aria-label="Выбор закупки">${w.rows.length?w.rows.map(i=>queueRow(i,w.selected?.id)).join(''):`<div class="wb-list-empty">${icon(ui.homeSearch?'search':'check',23)}<strong>${ui.homeSearch?'Совпадений нет':w.filter==='attention'?'Нет открытых решений':w.filter==='complete'?'Пока нет завершённых заказов':'Список пока пуст'}</strong><p>${ui.homeSearch?'Попробуйте другое название или поставщика.':'Выберите другой список или найдите новое предложение.'}</p>${ui.homeSearch?btn('Очистить поиск','home-clear-search','text'):''}</div>`}</div>
 </aside>`;
}

function queueRow(i,selected) {
 const tone = i.complete?'complete':i.attention?'attention':'waiting';
 return `<button class="wb-order ${i.id===selected?'is-selected':''}" data-action="home-select-purchase" data-id="${esc(i.id)}" aria-pressed="${i.id===selected}" aria-controls="home-scene home-finance">
  <span class="wb-order-meta"><span>${esc(i.number)}</span><i class="${tone}"></i></span>
  <strong>${esc(i.offer.name)}</strong><span class="wb-order-quantity">${number(i.quantity)} ${esc(i.offer.unit)} · ${esc(i.offer.supplier)}</span>
  <span class="wb-order-bottom"><span>${esc(i.status)}</span><b>${money(i.quote.total)}</b></span>
 </button>`;
}

function selectedView(i,w,panel,s) {
 return `<section class="wb-detail" id="home-scene" aria-label="Выбранная закупка">
  <header class="wb-order-heading"><div><p>${esc(i.offer.category)}<span>${esc(i.number)}</span><span>Условия v${i.version}</span></p><h2 id="wb-selected-title" tabindex="-1">${esc(i.offer.name)}</h2><span>${esc(i.offer.supplier)}</span></div>${routeLink('Открыть '+(i.accepted?'заказ':'закупку')+' '+icon('arrow',16),i.route,'wb-open-order')}</header>
  <nav class="wb-panels" aria-label="Детали выбранной закупки">${panelNames.map(([id,label])=>`<button data-action="home-panel" data-panel="${id}" aria-pressed="${panel===id}" ${panel===id?'aria-current="page"':''}>${icon(id==='action'?'arrow':id==='calculation'?'chart':'clock',16)}${label}${id==='action'&&i.attention?'<i></i>':''}</button>`).join('')}${w.items.length>1?btn('Все закупки '+icon('down',14),'home-show-queue','wb-mobile-switch','aria-label="Выбрать другую закупку"'):''}</nav>
  <div class="wb-panel-content" data-motion-content>
   ${panel==='calculation'?calculationPanel(i):panel==='activity'?activityPanel(i,s):actionPanel(i)}
  </div>
 </section>`;
}

function actionPanel(i) {
 const changedDate = i.pending&&i.offer.deliveryDate!==i.pending.offer.deliveryDate;
 const legacyChange = i.id==='paper'&&i.step.kind==='conditions';
 const shipping = dateParts(changedDate?i.pending.offer.deliveryDate:i.deliveryDate);
 return `<div class="wb-decision-grid">
  <section class="wb-next" data-tone="${i.step.tone}" data-kind="${i.step.kind}" aria-labelledby="home-focus-title">
   <div class="wb-next-label"><span class="wb-signal ${i.attention?'attention':i.complete?'complete':'waiting'}">${icon(i.complete?'check':i.attention?'info':'clock',17)}</span>${i.attention?'Нужно ваше решение':i.complete?'Заказ завершён':'Текущий этап'}${i.complete?'':tag(i.step.stage,i.step.tone)}</div>
   <h3 id="home-focus-title" tabindex="-1">${esc(i.step.title)}</h3><p>${esc(i.step.description)}</p>
   ${legacyChange||changedDate?`<div class="wb-change"><span>${icon('clock',17)} Новая дата поставки</span><div><del>${legacyChange?'27 октября':dateParts(i.deliveryDate).full}</del>${icon('arrow',16)}<strong>${shipping.full}</strong></div></div>`:''}
   <div class="wb-next-actions">${routeLink(i.step.action+' '+icon('arrow',17),i.step.route,'button primary')}${routeLink(icon('chat',17)+' Обсудить',i.discussionRoute,'button secondary')}</div>
   ${!i.accepted?volumeView(i):`<p class="wb-fixed-note">${icon('lock',14)} Условия и объём этого заказа зафиксированы</p>`}
  </section>
  ${financeView(i)}
 </div><nav class="wb-related" aria-label="Детали закупки">${routeLink(icon('pin',16)+'<span>Поставка <strong>'+esc(dateParts(i.deliveryDate).full)+'</strong></span>'+icon('arrow',14),i.route)}${routeLink(icon('chat',16)+'<span>Обсуждение'+(i.unread?' <b>'+i.unread+' новых</b>':'')+'</span>'+icon('arrow',14),i.discussionRoute)}</nav>`;
}

function volumeView(i) {
 const q=i.quote,percent=Math.min(100,q.projected/i.offer.target*100);
 return `<div class="wb-volume"><div><span>Объём группы с вашим участием</span><strong>${number(q.projected)} <small>/ ${number(i.offer.target)} ${esc(i.offer.unit)}</small></strong></div><div class="wb-volume-track" role="meter" aria-label="Объём группы" aria-valuemin="0" aria-valuemax="${i.offer.target}" aria-valuenow="${Math.min(q.projected,i.offer.target)}"><i style="width:${percent}%"></i></div><p>${q.projected>=i.offer.target?'Оптовый порог достигнут':'До порога ещё '+number(i.offer.target-q.projected)+' '+esc(i.offer.unit)}</p></div>`;
}

function financeView(i) {
 const q=i.quote,negative=q.saving<0,uncertain=Boolean(i.issues.length);
 return `<aside class="wb-money" id="home-finance" aria-label="Расчёт выбранной закупки">
  <div class="wb-money-caption"><span>${quoteCaption(i)}</span><b>v${i.version}</b></div>
  <strong class="wb-total">${money(q.total)}</strong><p>${number(i.quantity)} ${esc(i.offer.unit)} · с доставкой и сбором</p>
  <details class="wb-cost-details"><summary>Состав суммы ${icon('down',14)}</summary><dl class="wb-cost"><div><dt>Товар</dt><dd>${money(q.goods)}</dd></div><div><dt>Доставка</dt><dd>${money(i.offer.delivery)}</dd></div><div><dt>Комиссия · 3% экономии</dt><dd>${money(q.fee)}</dd></div></dl></details>
  ${hasQuotedComparison(i.offer)?`<div class="wb-saving"><span>Разница по указанным ценам</span><strong>${uncertain?'—':money(Math.abs(q.saving))}</strong></div>`:'<p>Для сравнения с отдельной покупкой нет подтверждённых данных</p>'}
  ${i.pending?`<p class="wb-version-note">${icon('info',14)} Новая версия ещё не принята. Здесь действуют условия v${i.version}.</p>`:''}
 </aside>`;
}

function calculationPanel(i) {
 return `<div class="wb-calculation"><div class="wb-calculation-main"><header><span>Ваш объём · ${number(i.quantity)} ${esc(i.offer.unit)}</span>${tag('Условия v'+i.version,'blue')}</header>${calculationView(i.offer,i.quantity)}</div><aside class="wb-calculation-note"><span>${icon('lock',22)}</span><h3>Свой заказ. Полная стоимость.</h3><p>Товар, доставка и сервисный сбор рассчитаны для вашей компании. Обязательства других участников не входят в эту сумму.</p>${i.pending?`<div class="wb-note-warning">Есть новая версия условий. Пока вы её не приняли, расчёт сохраняется по версии ${i.version}.</div>`:''}<dl><div><dt>Поставщик</dt><dd>${esc(i.offer.supplier)}</dd></div><div><dt>Поставка</dt><dd>${dateParts(i.deliveryDate).full}</dd></div><div><dt>Состояние</dt><dd>${i.accepted?'Условия зафиксированы':'Предварительное участие'}</dd></div></dl>${routeLink('Открыть '+(i.accepted?'заказ':'закупку')+' '+icon('arrow',16),i.route,'button secondary')}</aside></div>`;
}

function activityPanel(i,s) {
 const history=i.id==='paper'?s.events:s.deals.find(d=>d.id===i.id)?.history||[];
 return `<section class="wb-history"><header><div><span>Только выбранная закупка</span><h3>История вашей компании</h3></div>${routeLink('Открыть '+(i.accepted?'заказ':'закупку')+' '+icon('arrow',15),i.route)}</header>${history.length?`<ol>${history.map((event,index)=>`<li><span>${index===0?icon('check',13):''}</span><div><strong>${esc(event.title)}</strong>${event.detail?`<p>${esc(event.detail)}</p>`:''}</div><time>${esc(event.time||'')}</time></li>`).join('')}</ol>`:'<div class="wb-history-empty">'+icon('clock',27)+'<h4>История начнётся с первого действия</h4><p>Здесь будут сохранены изменения участия, согласование и этапы вашего заказа.</p></div>'}<footer>${icon('lock',15)} Личные адреса и переписка не публикуются в общей группе</footer></section>`;
}

function emptyView(w) {
 return `<section class="wb-detail wb-detail-empty"><span>${icon(w.filter==='attention'?'check':'bag',30)}</span><h2>${w.items.length?'В этом списке нет закупок':'Начнём с вашей первой закупки'}</h2><p>${w.items.length?'Смените фильтр или очистите поиск в списке закупок.':'Выберите предложение поставщика и укажите свой объём. Условия, расчёт и следующий шаг появятся здесь.'}</p>${w.items.length?(w.query?btn('Очистить поиск','home-clear-search','secondary'):btn('Все закупки','home-filter','secondary','data-filter="all"')):'<div class="wb-empty-actions">'+routeLink('Найти закупку '+icon('arrow',16),'purchases/offers','button primary')+btn('Создать потребность','create-need','secondary')+'</div>'}</section>`;
}

