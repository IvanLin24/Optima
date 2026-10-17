/* Optima Exchange: a distinct DOM for the shared-purchasing market. */
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderExchangeRows(m){
 if(!m.rows.length)return '<div class="x-empty"><strong>Ничего не найдено</strong><span>Измените фильтры или добавьте свою потребность.</span><button data-action="clear-filter">Сбросить фильтры →</button></div>';
 return m.rows.map((o,i)=>{
  const c=m.calculate(o),active=m.selectedId===o.id,joined=m.joinedFor(o.id),liked=m.favorites.includes(o.id);
  return `<article class="x-row opportunity-row ${active?'selected':''}">
   <button class="x-row-main" data-action="select-offer" data-id="${o.id}" aria-pressed="${active}" aria-label="Рассчитать ${safe(o.name)}. Цена ${m.money(c.groupTotal)}, экономия ${m.money(c.saving)}">
    <span class="x-row-index">${String(i+1).padStart(2,'0')}</span>
    <span class="x-row-art">${m.product(o.kind)}</span>
    <span class="x-row-name"><strong>${safe(o.name)}</strong><small>${safe(o.spec)}</small><em>${safe(o.supplier)}${joined?' · Ваша заявка':''}</em></span>
    <span class="x-row-progress"><small>${c.ready?'Объём набран':'Идёт сбор'}</small><strong>${m.number(c.totalQuantity)} <i>/ ${m.number(o.threshold)}</i></strong><span class="x-mini-meter"><i style="width:${c.progress}%"></i></span></span>
    <span class="x-row-price"><strong>${m.money(c.groupTotal)}</strong><small>−${m.percent(c.savingPercent)} с доставкой</small></span>
    <span class="proposal-cta x-row-arrow">${m.icon(active?'check':'arrow','sm')}</span>
   </button>
   <button class="x-row-fav ${liked?'active':''}" data-action="favorite" data-id="${o.id}" aria-pressed="${liked}" aria-label="${liked?'Убрать из избранного':'В избранное'}: ${safe(o.name)}">${m.icon('heart','sm')}</button>
  </article>`;
 }).join('');
}
export function renderExchangeFocus(m){
 const o=m.selected;
 if(!o)return '<div class="x-no-selection">Выберите позицию в списке слева, чтобы рассчитать заказ и увидеть общий объём.</div>';
 const joined=m.joinedFor(o.id),q=joined?.quantity||m.quantity,c=joined?.calculation||m.calculate(o,q);
 const base=Math.min(100,o.otherQuantity/o.threshold*100),own=Math.max(0,Math.min(100-base,q/o.threshold*100));
 return `<div class="x-focus-meta"><span class="x-index">02 / ПРЕДЛОЖЕНИЕ</span><span>${safe(o.sku)}</span></div>
 <div class="x-focus-product"><div class="x-focus-art">${m.product(o.kind)}</div>
 <div class="x-focus-copy"><span>${safe(o.category)}</span><h2>${safe(o.name)}</h2><p>${safe(o.spec)}</p><small>${safe(o.supplier)} · Сбор до ${m.date(o.deadline)}</small><div class="x-focus-finance"><strong>${m.money(c.groupTotal)}</strong><span>Выгода ${m.money(c.saving)}</span></div></div></div>
 <div class="x-demand" id="group-brief">
  <div class="x-demand-line"><span>СОВМЕСТНЫЙ ОБЪЁМ</span><strong>${c.ready?'Порог набран':'Сбор продолжается'}</strong></div>
  <div class="x-demand-value"><strong>${m.number(c.totalQuantity)}</strong><span>/ ${m.number(o.threshold)} ${safe(o.unit)}</span><em>${Math.round(c.progress)}%</em></div>
  <div class="x-volume-track" role="progressbar" aria-label="Собранный объём совместной закупки" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.progress)}"><span style="width:${base}%"></span><span style="width:${own}%"></span></div>
  <div class="x-demand-parts"><span><i></i>Другие компании <b>${m.number(o.otherQuantity)}</b></span><span><i></i>Вы <b>${m.number(q)}</b></span></div>
  <div class="x-demand-bottom"><span>${c.ready?'Порог достигается с вашим заказом':'До порога '+m.number(c.missing)+' '+o.unit}</span><span>${o.participants+1} участников с вами</span></div>
 </div>`;
}
export function renderExchange(m){
 const potential=m.OFFERS.reduce((sum,o)=>sum+m.calculate(o).saving,0);
 return `<div class="exchange-scene">
  <div class="x-topline"><div class="x-index">OPTIMA <span>/</span> EXCHANGE <span>/</span> БИЗНЕС-ЗАКУПКИ</div><div class="x-top-actions"><button data-action="upload">${m.icon('upload','sm')} Импорт списка</button><button class="x-button-primary" data-action="new-need">${m.icon('plus','sm')} Добавить потребность</button></div></div>
  <section class="x-intro" aria-labelledby="x-title"><div class="x-intro-main"><div class="x-index">01 / СОВМЕСТНЫЙ СПРОС</div><h1 id="x-title">Спрос — общий.<br><span>Заказ — ваш.</span></h1><p>Оптовая цена для небольшого заказа. Объединяйте объёмы с другими компаниями, не объединяя платежи и документы.</p><button data-action="browse-offers">Перейти к предложениям ${m.icon('arrow','sm')}</button></div>
  <div class="x-summary"><div class="x-summary-top"><span>СВОДКА ВОЗМОЖНОСТЕЙ</span><span><i></i>DEMO / 2026</span></div><div class="x-summary-value">${m.money(potential)}<small>ПОТЕНЦИАЛЬНАЯ ЭКОНОМИЯ ПО КАТАЛОГУ</small></div><div class="x-summary-stats"><div><strong>${String(m.OFFERS.length).padStart(2,'0')}</strong><small>ПРЕДЛОЖЕНИЙ</small></div><div><strong>${String(m.activeOrders.length).padStart(2,'0')}</strong><small>ВАШИХ ЗАЯВОК</small></div><div><strong>${String(m.matched.size).padStart(2,'0')}</strong><small>СОВПАДЕНИЙ</small></div></div><div class="x-summary-note">Вычислено на демонстрационных объёмах и ценах.</div></div></section>
  <section class="x-desk" id="catalog-start" aria-label="Каталог и выбранная закупка"><div class="x-market">
  <div class="x-market-heading"><div class="x-index">01 / КАТАЛОГ ПРЕДЛОЖЕНИЙ</div><div class="x-market-heading-line"><h2>Рынок закупок <small id="offers-count">${m.rows.length}</small></h2><span>ОБЪЁМ / ЦЕНА / ЭКОНОМИЯ</span></div></div>
  <div id="scope-tabs" class="scope-tabs" role="group" aria-label="Подборка предложений">${m.scopes()}</div>
  <div class="x-controls"><label class="x-search">${m.icon('search','sm')}<input type="search" id="offer-search" placeholder="Товар, поставщик, характеристики" aria-label="Найти товар" value="${safe(m.query)}"></label>
   <label class="x-select"><span class="sr-only">Категория</span><select id="category" aria-label="Категория товаров">${['Все','Упаковка','Для офиса','Хозтовары'].map(cat=>`<option value="${cat}" ${m.category===cat?'selected':''}>${cat==='Все'?'Все категории':cat}</option>`).join('')}</select>${m.icon('down','sm')}</label>
   <label class="x-select"><span class="sr-only">Сортировка</span><select id="sort" aria-label="Сортировка"><option value="saving" ${m.sort==='saving'?'selected':''}>По выгоде</option><option value="deadline" ${m.sort==='deadline'?'selected':''}>По сроку</option><option value="ready" ${m.sort==='ready'?'selected':''}>По готовности</option></select>${m.icon('down','sm')}</label></div>
  <div class="x-cols"><span>ПОЗИЦИЯ / ПОСТАВЩИК</span><span>СБОР ОБЪЁМА</span><span>ЦЕНА ДЛЯ ВАС</span></div>
  <div class="x-rows" id="offers-grid" data-layout="exchange">${renderExchangeRows(m)}</div>
  <div class="x-market-tail"><span>Все цены указаны с доставкой по исходным объёмам.</span><button data-action="new-need">Не нашли товар? Добавьте потребность →</button></div></div>
  <div class="x-right"><div class="x-right-top"><span class="x-index">ВЫБРАННАЯ ЗАКУПКА</span><span>${m.icon('shield','sm')} Отдельные платежи и документы</span></div>
   <div id="exchange-focus">${renderExchangeFocus(m)}</div>
   <aside class="quote-panel x-quote" id="purchase-preview" data-offer-id="${m.selectedId||''}" aria-label="Расчёт выбранной закупки">${m.quote()}</aside>
  </div></section>
 </div>`;
}

/* Remaining routes are independently composed Exchange workspaces. */
export function renderExchangeOrders(m){
 const all=m.state.orders,shown=all.filter(o=>m.orderFilter==='all'||(m.orderFilter==='active'?o.status!=='cancelled':o.status==='cancelled'));
 const active=all.filter(o=>o.status!=='cancelled'),volume=active.reduce((s,o)=>s+o.calculation.groupTotal,0),saving=active.reduce((s,o)=>s+o.calculation.saving,0);
 return `<section class="x-section x-records">
 <div class="x-section-head"><div><span class="x-index">02 / УЧАСТИЕ</span><h1>Мои закупки<span>${String(all.length).padStart(2,'0')}</span></h1><p>Ваши самостоятельные заявки в групповых закупках.</p></div><button class="x-section-action" data-action="go-offers">Найти закупку ${m.icon('arrow','sm')}</button></div>
 <div class="x-ledger-summary"><div><small>АКТИВНЫХ ЗАЯВОК</small><strong>${String(active.length).padStart(2,'0')}</strong></div><div><small>ОБЪЁМ ЗАКАЗОВ</small><strong>${m.money(volume)}</strong></div><div><small>ОЖИДАЕМАЯ ЭКОНОМИЯ</small><strong class="positive">${m.money(saving)}</strong></div></div>
 <div class="x-ledger-filter"><span class="x-index">ЖУРНАЛ ЗАКУПОК</span><div class="x-filter-chips">${[['all','Все'],['active','Активные'],['cancelled','Отменённые']].map(([id,label])=>`<button data-action="order-filter" data-filter="${id}" aria-pressed="${m.orderFilter===id}" class="${m.orderFilter===id?'active':''}">${label}</button>`).join('')}</div></div>
 ${shown.length?`<div class="x-ledger"><div class="x-ledger-cols"><span>ПОЗИЦИЯ / ЗАЯВКА</span><span>СТАТУС</span><span>СТОИМОСТЬ</span><span></span></div>${shown.map(o=>{const offer=m.OFFERS.find(item=>item.id===o.offerId);if(!offer)return '';return `<div class="x-ledger-entry"><div class="x-ledger-name"><span class="x-ledger-code">${safe(o.number)}</span><strong>${safe(offer.name)}</strong><small>${m.number(o.quantity)} ${safe(offer.unit)} · ${safe(offer.supplier)}</small></div><span class="x-ledger-status ${o.status}">${m.statusLabel(o)}</span><div class="x-ledger-amount"><strong>${m.money(o.calculation.groupTotal)}</strong><small>${o.status==='cancelled'?'Участие отменено':'Выгода '+m.money(o.calculation.saving)}</small></div><button data-action="order-detail" data-id="${o.id}" aria-label="Открыть заявку ${safe(o.number)}">${m.icon('arrow','sm')}</button></div>`;}).join('')}</div>`:`<div class="x-records-empty"><strong>${m.orderFilter==='cancelled'?'Отменённых заявок нет':'Пока нет заявок'}</strong><p>Подберите предложение, укажите свой объём и согласуйте условия.</p><button data-action="go-offers">Открыть каталог →</button></div>`}
 </section>`;
}
export function renderExchangeNeeds(m){
 const matched=m.state.needs.filter(n=>m.matchNeed(n,m.OFFERS)).length;
 return `<section class="x-section x-needs"><div class="x-section-head"><div><span class="x-index">03 / СПРОС ВАШЕЙ КОМПАНИИ</span><h1>Потребности бизнеса<span>${String(m.state.needs.length).padStart(2,'0')}</span></h1><p>Соберите перечень товаров. Мы сопоставим его с групповыми предложениями.</p></div><div class="x-head-controls"><button class="x-secondary-action" data-action="upload">${m.icon('upload','sm')} Импорт CSV / JSON</button><button class="x-section-action" data-action="new-need">${m.icon('plus','sm')} Новая позиция</button></div></div>
 <div class="x-ledger-summary"><div><small>ПОЗИЦИЙ В СПИСКЕ</small><strong>${String(m.state.needs.length).padStart(2,'0')}</strong></div><div><small>НАЙДЕНО СОВПАДЕНИЙ</small><strong>${String(matched).padStart(2,'0')}</strong></div><div><small>ОЖИДАЮТ ПОДБОРА</small><strong>${String(m.state.needs.length-matched).padStart(2,'0')}</strong></div></div>
 <div class="x-ledger-filter"><span class="x-index">РЕЕСТР ПОТРЕБНОСТЕЙ</span><span class="x-ledger-hint">Данные хранятся в вашем браузере</span></div>
 ${m.state.needs.length?`<div class="x-ledger"><div class="x-needs-cols"><span>ТОВАР И ХАРАКТЕРИСТИКИ</span><span>КОЛИЧЕСТВО</span><span>СРОК</span><span>СОВПАДЕНИЕ</span><span></span></div>
 ${m.state.needs.map(n=>{const o=m.matchNeed(n,m.OFFERS);return `<div class="x-needs-entry"><div class="x-need-name"><strong>${safe(n.name)}</strong><small>${safe(n.spec)}</small></div><strong class="x-need-quantity">${m.number(n.quantity)} ${safe(n.unit)}</strong><span class="x-need-date">${m.date(n.deadline)}</span><div>${o?`<button class="x-need-match" data-action="offer" data-id="${o.id}" data-quantity="${n.quantity}" data-price="${n.price}">Открыть предложение ${m.icon('arrow','sm')}</button>`:'<span class="x-need-search">Ищем предложение</span>'}</div><button class="x-need-remove" data-action="delete-need" data-id="${safe(n.id)}" aria-label="Удалить потребность ${safe(n.name)}">${m.icon('close','sm')}</button></div>`;}).join('')}</div>`:`<div class="x-records-empty"><strong>Добавьте первую потребность</strong><p>Укажите характеристики, нужный объём и срок поставки.</p><button data-action="new-need">Добавить позицию →</button></div>`}
 </section>`;
}
export function renderExchangeAnalytics(m){
 const sums=m.OFFERS.map(o=>({o,c:m.calculate(o)})),separate=sums.reduce((n,x)=>n+x.c.standaloneTotal,0),group=sums.reduce((n,x)=>n+x.c.groupTotal,0),saving=separate-group;
 const expected=m.activeOrders.reduce((sum,o)=>sum+o.calculation.saving,0),max=Math.max(...sums.map(x=>x.c.saving));
 const categories=['Упаковка','Для офиса','Хозтовары'].map(name=>({name,value:sums.filter(x=>x.o.category===name).reduce((sum,x)=>sum+x.c.saving,0)}));
 return `<section class="x-section x-analytics"><div class="x-section-head"><div><span class="x-index">04 / ФИНАНСОВАЯ КАРТИНА</span><h1>Экономика закупок</h1><p>Прозрачное сравнение цен с учётом доставки по демонстрационным объёмам.</p></div><button class="x-section-action" data-action="export">${m.icon('download','sm')} Экспорт CSV</button></div>
 <div class="x-analytics-summary"><div><small>ПОТЕНЦИАЛ СОВМЕСТНОЙ ЗАКУПКИ</small><strong>${m.money(saving)}</strong><p>Экономия возможна после достижения порога группы, а не гарантирована заранее.</p></div><div class="x-compare"><div><span>Самостоятельная закупка</span><strong>${m.money(separate)}</strong><i><b style="width:100%"></b></i></div><div><span>Общий оптовый объём</span><strong>${m.money(group)}</strong><i><b style="width:${group/separate*100}%"></b></i></div><span class="x-saving-rate">−${m.percent(saving/separate*100)} от отдельной закупки</span></div></div>
 <div class="x-analytics-body"><div class="x-breakdown"><span class="x-index">ПОЗИЦИИ / СРАВНЕНИЕ</span><h2>Где формируется выгода</h2><div class="x-bars">${sums.map(({o,c})=>`<div class="x-bar-entry"><span>${safe(o.name)}</span><div><i style="width:${c.saving/max*100}%"></i></div><strong>${m.money(c.saving)}</strong></div>`).join('')}</div></div>
 <div class="x-breakdown x-categories"><span class="x-index">СТРУКТУРА ЭКОНОМИИ</span><h2>По категориям</h2><div class="x-categories-list">${categories.map((c,i)=>`<div><span><i class="x-cat-color x-cat-${i}"></i>${c.name}</span><strong>${m.money(c.value)}</strong></div>`).join('')}</div><div class="x-actual-note"><span>ПО АКТИВНЫМ ЗАЯВКАМ</span><strong>${m.money(expected)}</strong><small>Ожидаемая, не фактическая экономия.</small></div></div></div>
 <div class="x-analytics-table"><div class="x-ledger-filter"><span class="x-index">ПОЗИЦИОННАЯ ЭКОНОМИКА</span><span class="x-ledger-hint">Полная стоимость, включая доставку</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Товар</th><th>Объём</th><th>Отдельно</th><th>В группе</th><th>Разница</th></tr></thead><tbody>${sums.map(({o,c})=>`<tr><td><strong>${safe(o.name)}</strong></td><td>${m.number(o.quantity)} ${safe(o.unit)}</td><td>${m.money(c.standaloneTotal)}</td><td>${m.money(c.groupTotal)}</td><td class="x-positive">${m.money(c.saving)}</td></tr>`).join('')}</tbody></table></div></div></section>`;
}
