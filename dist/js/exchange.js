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
 <div class="x-focus-copy"><span>${safe(o.category)}</span><h2>${safe(o.name)}</h2><p>${safe(o.spec)}</p><small>${safe(o.supplier)} · Сбор до ${m.date(o.deadline)}</small></div></div>
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
