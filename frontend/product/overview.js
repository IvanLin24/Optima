import { money, company } from './data.js';
import { homeWorkspace, deadlineLabel, homeDateValid } from './home-model.js';
import { offerVersion } from './offer-revision.js';
import { calculationView } from './purchase-calculator.js';
import { esc, icon, routeLink, btn, tag, avatar } from './ui.js';
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
 const active = workspace.items.filter(i=>!i.complete);
 const total = active.reduce((sum,i)=>sum+i.quote.total,0);
 const today = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',weekday:'long',timeZone:'Europe/Moscow'}).format(new Date());
 return `<div class="workbench">
  <header class="wb-heading" data-motion="desk-heading">
   <div><p>${esc(company.name)}<span>${esc(today)}</span></p><h1>Закупки компании</h1></div>
   <div class="wb-heading-actions">${routeLink('Найти предложение '+icon('arrow',16),'purchases/offers','button secondary')}${btn(icon('plus',18)+' Создать потребность','create-need','primary','aria-label="Создать потребность"')}</div>
  </header>
  <section class="wb-metrics" aria-label="Сводка по компании" data-home-filter-group="summary">
   ${metric('active','В работе',workspace.counts.active,'Закупки и заказы компании',workspace.filter)}
   ${metric('attention','Требуют решения',workspace.counts.attention,workspace.counts.attention?'Проверьте условия или документы':'Все текущие решения обработаны',workspace.filter)}
   <a class="wb-metric wb-metric--cost" href="#purchases/mine"><span>Текущая стоимость</span><strong>${money(total)}</strong><small>По закупкам в работе · доставка и сбор включены</small>${icon('arrow',16)}</a>
  </section>
  <div class="wb-workspace" data-motion="desk-workspace">
   ${queueView(workspace,ui)}
   ${item?selectedView(item,workspace,panel,s):emptyView(workspace)}
  </div>
  ${planningView(s)}
  <p class="sr-only" role="status" aria-live="polite">${item?'Выбрана закупка: '+esc(item.offer.name)+'. '+esc(item.step.title):'В выбранном списке нет закупок.'}</p>
 </div>`;
}

function metric(id,label,value,caption,selected) {
 return `<button class="wb-metric ${id==='attention'?'wb-metric--attention':''}" data-action="home-filter" data-filter="${id}" aria-pressed="${selected===id}"><span>${label}</span><strong>${value}</strong><small>${caption}</small>${icon('arrow',16)}</button>`;
}

function queueView(w,ui) {
 return `<aside class="wb-queue" id="home-queue" aria-label="Закупки компании">
  <header><div><h2>Мои закупки</h2><span>${w.counts.all}</span></div><a href="#purchases/offers" class="wb-queue-add" aria-label="Найти новую закупку">${icon('plus',17)}</a></header>
  <label class="wb-search">${icon('search',16)}<input id="home-search" aria-label="Найти свою закупку" value="${esc(ui.homeSearch||'')}" placeholder="Название или поставщик">${ui.homeSearch?btn(icon('close',14),'home-clear-search','quiet','aria-label="Очистить поиск закупок"'):''}</label>
  <nav class="wb-filters" data-home-filter-group="queue" aria-label="Состояние закупок">${filters.map(([id,label])=>`<button data-action="home-filter" data-filter="${id}" aria-pressed="${w.filter===id}">${label}<span>${w.counts[id]}</span></button>`).join('')}</nav>
  <div class="wb-order-list" aria-label="Выбор закупки">${w.rows.length?w.rows.map(i=>queueRow(i,w.selected?.id)).join(''):`<div class="wb-list-empty">${icon(ui.homeSearch?'search':'check',23)}<strong>${ui.homeSearch?'Совпадений нет':w.filter==='attention'?'Нет открытых решений':w.filter==='complete'?'Пока нет завершённых заказов':'Список пока пуст'}</strong><p>${ui.homeSearch?'Попробуйте другое название или поставщика.':'Выберите другой список или найдите новое предложение.'}</p>${ui.homeSearch?btn('Очистить поиск','home-clear-search','text'):''}</div>`}</div>
  <a class="wb-queue-discover" href="#purchases/offers"><span>${icon('bag',18)}</span><div><strong>Новая закупка</strong><small>Предложения поставщиков</small></div>${icon('arrow',16)}</a>
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
  ${journeyView(i)}
  <nav class="wb-panels" aria-label="Детали выбранной закупки">${panelNames.map(([id,label])=>`<button data-action="home-panel" data-panel="${id}" aria-pressed="${panel===id}" ${panel===id?'aria-current="page"':''}>${icon(id==='action'?'arrow':id==='calculation'?'chart':'clock',16)}${label}${id==='action'&&i.attention?'<i></i>':''}</button>`).join('')}${w.items.length>1?btn('Все закупки '+icon('down',14),'home-show-queue','wb-mobile-switch','aria-label="Выбрать другую закупку"'):''}</nav>
  <div class="wb-panel-content" data-motion-content>
   ${panel==='calculation'?calculationPanel(i):panel==='activity'?activityPanel(i,s):actionPanel(i)}
  </div>
 </section>`;
}

function journeyView(i) {
 const current = i.stages.findIndex(([,done])=>!done);
 return `<ol class="wb-journey" aria-label="Этапы выбранного заказа">${i.stages.map(([name,done],index)=>`<li class="${done?'done':index===current?'current':''}" ${index===current?'aria-current="step"':''}><span>${done?icon('check',13):index+1}</span><strong>${name}</strong>${index<3?icon('arrow',12):''}</li>`).join('')}</ol>`;
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
 </div><div class="wb-context-grid">${deliveryView(i)}${conversationView(i)}</div>`;
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
  <dl class="wb-cost"><div><dt>Товар</dt><dd>${money(q.goods)}</dd></div><div><dt>Доставка</dt><dd>${money(i.offer.delivery)}</dd></div><div><dt>Комиссия · 3% экономии</dt><dd>${money(q.fee)}</dd></div></dl>
  <div class="wb-saving ${negative?'negative':''}"><span>${uncertain?'Экономия требует уточнения':negative?'Дороже отдельной покупки':'Экономия с группой'}</span><strong>${uncertain?'—':money(Math.abs(q.saving))}</strong>${!uncertain?`<small>${negative?'+':'−'}${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Math.abs(q.percent))}%</small>`:''}</div>
  ${btn('Полный расчёт '+icon('arrow',16),'home-panel','wb-money-link','data-panel="calculation"')}
  ${i.pending?`<p class="wb-version-note">${icon('info',14)} Новая версия ещё не принята. Здесь действуют условия v${i.version}.</p>`:''}
 </aside>`;
}

function deliveryView(i) {
 const shipping=dateParts(i.deliveryDate);
 return `<section class="wb-delivery"><header><h3>Поставка</h3>${icon('pin',17)}</header><div class="wb-shipping"><time><strong>${shipping.day}</strong><span>${shipping.month}</span></time><div><strong>${esc(i.offer.region||'Москва и область')}</strong><p>${i.received?'Получение подтверждено':i.accepted?'По согласованным условиям':'По текущим условиям участия'}</p>${routeLink('Детали получения '+icon('arrow',14),i.route)}</div></div>${!i.accepted?`<div class="wb-deadline"><span>Набор группы</span><strong>${deadlineLabel(i.deadlineDate)}</strong></div>`:''}</section>`;
}

function conversationView(i) {
 const last=i.messages.at(-1),side=last?.side||last?.role,name=last?.name||(side==='buyer'?'Ваша компания':'Поставщик');
 return `<section class="wb-discussion"><header><h3>Обсуждение закупки</h3>${i.unread?`<span class="wb-unread">${i.unread}</span>`:icon('chat',17)}</header>${last?`<div class="wb-message-person" data-preview-author>${avatar(last.initials||name.slice(0,1),'blue')}<div><strong>${esc(name)}</strong><span>${esc(last.company||(side==='buyer'?'Покупатель':'Поставщик'))} · ${esc(last.time||'')}</span></div></div><p>${esc(last.text)}</p>`:'<p class="wb-discussion-empty">Уточните характеристики, сроки или комплектность в общем разговоре закупки.</p>'}${routeLink((last?'Открыть разговор':'Задать вопрос')+' '+icon('arrow',14),i.discussionRoute)}</section>`;
}

function calculationPanel(i) {
 return `<div class="wb-calculation"><div class="wb-calculation-main"><header><span>Ваш объём · ${number(i.quantity)} ${esc(i.offer.unit)}</span>${tag('Условия v'+i.version,'blue')}</header>${calculationView(i.offer,i.quantity)}</div><aside class="wb-calculation-note"><span>${icon('lock',22)}</span><h3>Свой заказ. Полная стоимость.</h3><p>Товар, доставка и сервисный сбор рассчитаны для вашей компании. Обязательства других участников не входят в эту сумму.</p>${i.pending?`<div class="wb-note-warning">Есть новая версия условий. Пока вы её не приняли, расчёт сохраняется по версии ${i.version}.</div>`:''}<dl><div><dt>Поставщик</dt><dd>${esc(i.offer.supplier)}</dd></div><div><dt>Поставка</dt><dd>${dateParts(i.deliveryDate).full}</dd></div><div><dt>Состояние</dt><dd>${i.accepted?'Условия зафиксированы':'Предварительное участие'}</dd></div></dl>${routeLink('Открыть '+(i.accepted?'заказ':'закупку')+' '+icon('arrow',16),i.route,'button secondary')}</aside></div>`;
}

function activityPanel(i,s) {
 const history=i.id==='paper'?s.events:s.deals.find(d=>d.id===i.id)?.history||[];
 return `<section class="wb-history"><header><div><span>Только выбранная закупка</span><h3>История вашей компании</h3></div>${routeLink('Открыть '+(i.accepted?'заказ':'закупку')+' '+icon('arrow',15),i.route)}</header>${history.length?`<ol>${history.map((event,index)=>`<li><span>${index===0?icon('check',13):''}</span><div><strong>${esc(event.title)}</strong>${event.detail?`<p>${esc(event.detail)}</p>`:''}</div><time>${esc(event.time||'')}</time></li>`).join('')}</ol>`:'<div class="wb-history-empty">'+icon('clock',27)+'<h4>История начнётся с первого действия</h4><p>Здесь будут сохранены изменения участия, согласование и этапы вашего заказа.</p></div>'}<footer>${icon('lock',15)} Личные адреса и переписка не публикуются в общей группе</footer></section>`;
}

function emptyView(w) {
 return `<section class="wb-detail wb-detail-empty"><span>${icon(w.filter==='attention'?'check':'bag',30)}</span><h2>${w.items.length?'В этом списке нет закупок':'Начнём с вашей первой закупки'}</h2><p>${w.items.length?'Смените фильтр или очистите поиск в списке закупок.':'Выберите предложение поставщика и укажите свой объём. Условия, расчёт и следующий шаг появятся здесь.'}</p>${w.items.length?(w.query?btn('Очистить поиск','home-clear-search','secondary'):btn('Все закупки','home-filter','secondary','data-filter="all"')):routeLink('Найти предложение '+icon('arrow',16),'purchases/offers','button primary')}</section>`;
}

function planningView(s) {
 const tasks=s.tasks.filter(t=>t.status!=='Выполнена');
 return `<section class="wb-planning" aria-label="Планирование компании"><a href="#needs"><span>${icon('grid',21)}</span><div><strong>Потребности компании <b>${s.needs.length}</b></strong><p>${s.needs.length?esc(s.needs[0].name):'Товары, объёмы и сроки для следующих закупок'}</p></div>${icon('arrow',17)}</a><a href="#tasks"><span>${icon('check',21)}</span><div><strong>Задачи команды <b>${tasks.length}</b></strong><p>${tasks.length?esc(tasks[0].comment||'Проверка условий закупки'):'Проверка условий и документов внутри компании'}</p></div>${icon('arrow',17)}</a></section>`;
}
