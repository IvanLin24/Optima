/* OPTIMA / BANKING WORKSPACE. Distinct composition; shared finance and actions. */
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderExchangeRows(m){
 if(!m.rows.length)return `<div class="x-empty" role="status"><div class="x-empty-art">${m.icon('search')}</div><strong>Не нашли подходящих предложений</strong><p>Измените параметры или сохраните новую потребность: её можно будет сопоставить с закупками.</p><button data-action="clear-filter">Сбросить параметры ${m.icon('arrow','sm')}</button></div>`;
 return m.rows.map((o,i)=>{
  const c=m.calculate(o),active=m.selectedId===o.id,joined=m.joinedFor(o.id),matched=m.matched.has(o.id);
  const progress=Math.min(100,Math.round(o.otherQuantity/o.threshold*100));
  return `<article class="x-row opportunity-row ${active?'selected':''}" data-offer-id="${o.id}">
 <button class="x-row-main" data-action="select-offer" data-id="${o.id}" aria-pressed="${active}" aria-label="${o.name}. Цена ${m.money(c.groupTotal)}, экономия ${m.money(c.saving)}. Открыть расчёт">
 <span class="x-row-head"><span class="x-row-art">${m.product(o.kind)}</span><span class="x-row-name"><span class="x-product-label">${safe(o.sku)} / ${safe(o.category)}</span><strong>${safe(o.name)}</strong><small>${safe(o.spec)}</small><em>${safe(o.supplier)}</em></span></span>
 <span class="x-row-volume"><span class="x-row-meter"><i style="width:${progress}%"></i></span><strong>${progress}%</strong><small>Группа: ${m.number(o.otherQuantity)} / ${m.number(o.threshold)} ${safe(o.unit)}</small></span>
 <span class="x-row-finance"><strong>${m.money(c.groupTotal)}</strong><span>−${m.money(c.saving)}</span><small>Экономия при наборе группы</small></span>
 <span class="proposal-cta x-row-arrow">${m.icon(active?'check':'arrow','sm')}</span>
 </button>
 <button class="x-row-fav ${m.favorites.includes(o.id)?'active':''}" data-action="favorite" data-id="${o.id}" aria-pressed="${m.favorites.includes(o.id)}" aria-label="${m.favorites.includes(o.id)?'Убрать из избранного':'Добавить в избранное'}: ${safe(o.name)}">${m.icon('heart','sm')}</button>
 ${joined?'<span class="x-match-label joined">Участвуете</span>':matched?'<span class="x-match-label">Подходит вам</span>':''}
 </article>`;
 }).join('');
}
export function renderExchangeFocus(m){
 const o=m.selected;
 if(!o)return '<div class="x-no-selection">Выберите предложение в списке, чтобы открыть условия участия.</div>';
 const order=m.joinedFor(o.id),qty=order?.quantity||m.quantity,c=order?.calculation||m.calculate(o,qty);
 const pct=Math.round(c.progress),base=Math.min(100,o.otherQuantity/o.threshold*100),own=Math.max(0,Math.min(100-base,qty/o.threshold*100));
 const circle=2*Math.PI*62;
 return `<div class="x-focus-product">
   <div class="x-focus-head"><span class="x-detail-label">ВЫБРАННОЕ ПРЕДЛОЖЕНИЕ</span><span class="x-focus-sku">${safe(o.sku)}</span></div>
   <div class="x-product-info"><span class="x-category">${safe(o.category)}</span><h2>${safe(o.name)}</h2><p>${safe(o.spec)}</p><span class="x-supplier">${m.icon('briefcase','sm')}${safe(o.supplier)}</span></div>
 </div>
 <div class="x-demand" id="group-brief">
  <div class="x-demand-head"><div><small>ОБЪЕДИНЁННЫЙ СПРОС</small><h3>До оптовой цены</h3></div><span class="${c.ready?'x-state-ready':'x-state-collecting'}">${c.ready?'Порог достигнут':'Идёт сбор'}</span></div>
  <div class="x-demand-diagram">
   <div class="x-ring" aria-hidden="true"><svg viewBox="0 0 160 160"><circle class="x-ring-back" cx="80" cy="80" r="62"/><circle class="x-ring-fill" cx="80" cy="80" r="62" stroke-dasharray="${(pct/100*circle).toFixed(2)} ${circle.toFixed(2)}" transform="rotate(-90 80 80)"/><path class="x-ring-mark" d="M80 6v9 M80 145v9 M6 80h9 M145 80h9"/></svg><div class="x-ring-label"><strong>${pct}%</strong><small>ОБЪЁМА</small></div></div>
   <div class="x-pool-numbers"><div><small>Собрано с вами</small><strong>${m.number(c.totalQuantity)} <span>${safe(o.unit)}</span></strong></div><div><small>Необходимый объём</small><strong>${m.number(o.threshold)} <span>${safe(o.unit)}</span></strong></div><div class="x-pool-message">${c.ready?m.icon('check','sm'):m.icon('clock','sm')}<span>${c.ready?'Ваш объём позволяет достичь порога':'Не хватает '+m.number(c.missing)+' '+safe(o.unit)}</span></div></div>
  </div>
  <div class="x-demand-foot"><div class="x-contribution"><span><i class="x-contrib-other"></i>Другие компании</span><strong>${m.number(o.otherQuantity)} ${safe(o.unit)}</strong></div><div class="x-contribution"><span><i class="x-contrib-yours"></i>Ваш объём</span><strong>${m.number(qty)} ${safe(o.unit)}</strong></div><div class="x-demand-meter" aria-label="Объём группы с вашим заказом" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${base}%"></i><i style="width:${own}%"></i></div></div>
 </div>`;
}
export function renderExchange(m){
 const potential=m.OFFERS.reduce((n,o)=>n+m.calculate(o).saving,0),active=m.activeOrders.length;
 return `<div class="exchange-scene">
  <div class="x-location"><span class="x-location-root">Бизнес / Сервисы</span><span class="x-location-sep">/</span><strong>Совместные закупки</strong><span class="x-demo-label">ДЕМО-ПРОТОТИП</span></div>
  <header class="x-page-heading"><div class="x-title-block"><span class="x-overline">ОПТИМА / ФИНАНСОВЫЕ ИНСТРУМЕНТЫ</span><h1>Совместные закупки<span class="x-head-dot">.</span></h1><p>Объединяйте объёмы, сохраняйте независимость заказа.</p></div><div class="x-header-actions"><button class="x-upload-button" data-action="upload">${m.icon('upload','sm')} Загрузить список</button><button class="x-add-button" data-action="new-need">${m.icon('plus','sm')} Новая потребность</button></div></header>
  <section class="x-insights" aria-label="Сводка закупок">
   <div class="x-insight x-insight-lead"><span>ДОСТУПНО В КАТАЛОГЕ</span><div><strong>${String(m.OFFERS.length).padStart(2,'0')}</strong><small>предложений поставщиков</small></div></div>
   <div class="x-insight"><span>ПОТЕНЦИАЛ ЭКОНОМИИ</span><div><strong>${m.money(potential)}</strong><small>для демонстрационных объёмов</small></div></div>
   <div class="x-insight"><span>СОВПАДЕНИЯ ПО СПРОСУ</span><div><strong>${String(m.matched.size).padStart(2,'0')}</strong><small>подходящих позиций</small></div></div>
   <div class="x-insight x-insight-last"><span>ВАШЕ УЧАСТИЕ</span><div><strong>${String(active).padStart(2,'0')}</strong><small>${active?'активных заявок':'пока нет заявок'}</small></div></div>
  </section>
  <div class="x-space-heading"><div><span class="x-section-number">01 / РАБОЧЕЕ ПРОСТРАНСТВО</span><h2>Предложения поставщиков</h2></div><span class="x-space-note"><i></i>Актуальная демоподборка</span></div>
  <section class="x-desk" id="catalog-start" aria-label="Каталог предложений и расчёт заказа">
   <div class="x-market">
    <div class="x-market-tabs"><div id="scope-tabs" class="scope-tabs" role="group" aria-label="Подборка предложений">${m.scopes()}</div><span class="x-result-count"><b id="offers-count">${m.rows.length}</b> поз.</span></div>
    <div class="x-controls"><label class="x-search">${m.icon('search','sm')}<input id="offer-search" type="search" placeholder="Найти товар, поставщика или артикул" aria-label="Найти товар" value="${safe(m.query)}"><kbd>/</kbd></label><label class="x-select"><span class="sr-only">Категория товаров</span><select id="category" aria-label="Категория товаров">${['Все','Упаковка','Для офиса','Хозтовары'].map(cat=>`<option value="${cat}" ${m.category===cat?'selected':''}>${cat==='Все'?'Все категории':cat}</option>`).join('')}</select>${m.icon('down','sm')}</label><label class="x-select"><span class="sr-only">Сортировка</span><select id="sort" aria-label="Сортировка"><option value="saving" ${m.sort==='saving'?'selected':''}>По выгоде</option><option value="deadline" ${m.sort==='deadline'?'selected':''}>По сроку</option><option value="ready" ${m.sort==='ready'?'selected':''}>По готовности</option></select>${m.icon('down','sm')}</label></div>
    <div class="x-table-head"><span>ПРЕДЛОЖЕНИЕ</span><span>ОБЪЁМ ГРУППЫ</span><span>ДЛЯ ВАШЕЙ КОМПАНИИ</span></div>
    <div class="x-rows" id="offers-grid" data-layout="exchange">${renderExchangeRows(m)}</div>
    <div class="x-market-tail"><span>Расчётные цены с доставкой. Условия действуют при наборе общего объёма.</span><button data-action="help">Как устроена закупка? ${m.icon('arrow','sm')}</button></div>
   </div>
   <div class="x-right"><div id="exchange-focus">${renderExchangeFocus(m)}</div><aside class="quote-panel x-quote" id="purchase-preview" data-offer-id="${m.selectedId||''}" aria-label="Расчёт выбранной закупки">${m.quote()}</aside></div>
  </section>
  <footer class="x-process"><span>КАК РАБОТАЕТ ОПТИМА</span><div><strong>01</strong><p>Выбираете предложение</p></div><div><strong>02</strong><p>Добавляете свой объём</p></div><div><strong>03</strong><p>Создаёте отдельную заявку</p></div><button data-action="help" aria-label="Подробнее о процессе закупки">${m.icon('arrow','sm')}</button></footer>
  </div>`;
}
/* Remaining routes are independently composed Exchange workspaces. */
export function renderExchangeOrders(m){
 const all=m.state.orders,shown=all.filter(o=>m.orderFilter==='all'||(m.orderFilter==='active'?o.status!=='cancelled':o.status==='cancelled'));
 const active=all.filter(o=>o.status!=='cancelled'),volume=active.reduce((s,o)=>s+o.calculation.groupTotal,0),saving=active.reduce((s,o)=>s+o.calculation.saving,0);
 return `<section class="x-section x-records">
 <div class="x-section-head"><div><span class="x-index">Ваши заявки</span><h1>Мои закупки<span>${String(all.length)}</span></h1><p>Ваши самостоятельные заявки в групповых закупках.</p></div><button class="x-section-action" data-action="go-offers">Найти закупку ${m.icon('arrow','sm')}</button></div>
 <div class="x-ledger-summary"><div><small>АКТИВНЫХ ЗАЯВОК</small><strong>${String(active.length)}</strong></div><div><small>ОБЪЁМ ЗАКАЗОВ</small><strong>${m.money(volume)}</strong></div><div><small>ОЖИДАЕМАЯ ЭКОНОМИЯ</small><strong class="positive">${m.money(saving)}</strong></div></div>
 <div class="x-ledger-filter"><span class="x-index">Заявки</span><div class="x-filter-chips">${[['all','Все'],['active','Активные'],['cancelled','Отменённые']].map(([id,label])=>`<button data-action="order-filter" data-filter="${id}" aria-pressed="${m.orderFilter===id}" class="${m.orderFilter===id?'active':''}">${label}</button>`).join('')}</div></div>
 ${shown.length?`<div class="x-ledger"><div class="x-ledger-cols"><span>ПОЗИЦИЯ / ЗАЯВКА</span><span>СТАТУС</span><span>СТОИМОСТЬ</span><span></span></div>${shown.map(o=>{const offer=m.OFFERS.find(item=>item.id===o.offerId);if(!offer)return '';return `<div class="x-ledger-entry"><div class="x-ledger-name"><span class="x-ledger-code">${safe(o.number)}</span><strong>${safe(offer.name)}</strong><small>${m.number(o.quantity)} ${safe(offer.unit)} · ${safe(offer.supplier)}</small></div><span class="x-ledger-status ${o.status}">${m.statusLabel(o)}</span><div class="x-ledger-amount"><strong>${m.money(o.calculation.groupTotal)}</strong><small>${o.status==='cancelled'?'Участие отменено':'Выгода '+m.money(o.calculation.saving)}</small></div><button data-action="order-detail" data-id="${o.id}" aria-label="Открыть заявку ${safe(o.number)}">${m.icon('arrow','sm')}</button></div>`;}).join('')}</div>`:`<div class="x-records-empty"><strong>${m.orderFilter==='cancelled'?'Отменённых заявок нет':'Пока нет заявок'}</strong><p>Подберите предложение, укажите свой объём и согласуйте условия.</p><button data-action="go-offers">Открыть каталог →</button></div>`}
 </section>`;
}
export function renderExchangeNeeds(m){
 const matched=m.state.needs.filter(n=>m.matchNeed(n,m.OFFERS)).length;
 return `<section class="x-section x-needs"><div class="x-section-head"><div><span class="x-index">Закупочный список</span><h1>Потребности бизнеса<span>${String(m.state.needs.length)}</span></h1><p>Соберите перечень товаров. Мы сопоставим его с групповыми предложениями.</p></div><div class="x-head-controls"><button class="x-secondary-action" data-action="upload">${m.icon('upload','sm')} Импорт CSV / JSON</button><button class="x-section-action" data-action="new-need">${m.icon('plus','sm')} Новая позиция</button></div></div>
 <div class="x-ledger-summary"><div><small>ПОЗИЦИЙ В СПИСКЕ</small><strong>${String(m.state.needs.length)}</strong></div><div><small>НАЙДЕНО СОВПАДЕНИЙ</small><strong>${String(matched)}</strong></div><div><small>ОЖИДАЮТ ПОДБОРА</small><strong>${String(m.state.needs.length-matched)}</strong></div></div>
 <div class="x-ledger-filter"><span class="x-index">Потребности</span><span class="x-ledger-hint">Данные хранятся в вашем браузере</span></div>
 ${m.state.needs.length?`<div class="x-ledger"><div class="x-needs-cols"><span>ТОВАР И ХАРАКТЕРИСТИКИ</span><span>КОЛИЧЕСТВО</span><span>СРОК</span><span>СОВПАДЕНИЕ</span><span></span></div>
 ${m.state.needs.map(n=>{const o=m.matchNeed(n,m.OFFERS);return `<div class="x-needs-entry"><div class="x-need-name"><strong>${safe(n.name)}</strong><small>${safe(n.spec)}</small></div><strong class="x-need-quantity">${m.number(n.quantity)} ${safe(n.unit)}</strong><span class="x-need-date">${m.date(n.deadline)}</span><div>${o?`<button class="x-need-match" data-action="offer" data-id="${o.id}" data-quantity="${n.quantity}" data-price="${n.price}">Открыть предложение ${m.icon('arrow','sm')}</button>`:'<span class="x-need-search">Ищем предложение</span>'}</div><button class="x-need-remove" data-action="delete-need" data-id="${safe(n.id)}" aria-label="Удалить потребность ${safe(n.name)}">${m.icon('close','sm')}</button></div>`;}).join('')}</div>`:`<div class="x-records-empty"><strong>Добавьте первую потребность</strong><p>Укажите характеристики, нужный объём и срок поставки.</p><button data-action="new-need">Добавить позицию →</button></div>`}
 </section>`;
}
export function renderExchangeAnalytics(m){
 const sums=m.OFFERS.map(o=>({o,c:m.calculate(o)})),separate=sums.reduce((n,x)=>n+x.c.standaloneTotal,0),group=sums.reduce((n,x)=>n+x.c.groupTotal,0),saving=separate-group;
 const expected=m.activeOrders.reduce((sum,o)=>sum+o.calculation.saving,0),max=Math.max(...sums.map(x=>x.c.saving));
 const categories=['Упаковка','Для офиса','Хозтовары'].map(name=>({name,value:sums.filter(x=>x.o.category===name).reduce((sum,x)=>sum+x.c.saving,0)}));
 return `<section class="x-section x-analytics"><div class="x-section-head"><div><span class="x-index">Результат объединения</span><h1>Экономика закупок</h1><p>Прозрачное сравнение цен с учётом доставки по демонстрационным объёмам.</p></div><button class="x-section-action" data-action="export">${m.icon('download','sm')} Экспорт CSV</button></div>
 <div class="x-analytics-summary"><div><small>ПОТЕНЦИАЛ СОВМЕСТНОЙ ЗАКУПКИ</small><strong>${m.money(saving)}</strong><p>Экономия возможна после достижения порога группы, а не гарантирована заранее.</p></div><div class="x-compare"><div><span>Самостоятельная закупка</span><strong>${m.money(separate)}</strong><i><b style="width:100%"></b></i></div><div><span>Общий оптовый объём</span><strong>${m.money(group)}</strong><i><b style="width:${group/separate*100}%"></b></i></div><span class="x-saving-rate">−${m.percent(saving/separate*100)} от отдельной закупки</span></div></div>
 <div class="x-analytics-body"><div class="x-breakdown"><span class="x-index">Сравнение закупок</span><h2>Где формируется выгода</h2><div class="x-bars">${sums.map(({o,c})=>`<div class="x-bar-entry"><span>${safe(o.name)}</span><div><i style="width:${c.saving/max*100}%"></i></div><strong>${m.money(c.saving)}</strong></div>`).join('')}</div></div>
 <div class="x-breakdown x-categories"><span class="x-index">Источники выгоды</span><h2>По категориям</h2><div class="x-categories-list">${categories.map((c,i)=>`<div><span><i class="x-cat-color x-cat-${i}"></i>${c.name}</span><strong>${m.money(c.value)}</strong></div>`).join('')}</div><div class="x-actual-note"><span>ПО АКТИВНЫМ ЗАЯВКАМ</span><strong>${m.money(expected)}</strong><small>Ожидаемая, не фактическая экономия.</small></div></div></div>
 <div class="x-analytics-table"><div class="x-ledger-filter"><span class="x-index">Подробный расчёт</span><span class="x-ledger-hint">Полная стоимость, включая доставку</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Товар</th><th>Объём</th><th>Отдельно</th><th>В группе</th><th>Разница</th></tr></thead><tbody>${sums.map(({o,c})=>`<tr><td><strong>${safe(o.name)}</strong></td><td>${m.number(o.quantity)} ${safe(o.unit)}</td><td>${m.money(c.standaloneTotal)}</td><td>${m.money(c.groupTotal)}</td><td class="x-positive">${m.money(c.saving)}</td></tr>`).join('')}</tbody></table></div></div></section>`;
}
