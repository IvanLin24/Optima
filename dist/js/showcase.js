/* Product frontage of Optima. Bank-inspired art direction, no third-party visuals. */
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderShowcase(m){
 const sample=m.OFFERS.find(o=>o.id==='bags')||m.OFFERS[0];
 const categories=[
  {id:'Для офиса',label:'Всё для офиса',copy:'Бумага, кофе, расходные материалы',kind:'paper',code:'01'},
  {id:'Упаковка',label:'Упаковка и логистика',copy:'Пакеты, этикетки, стрейч-плёнка',kind:'bag',code:'02'},
  {id:'Хозтовары',label:'Для ежедневной работы',copy:'Перчатки и хозяйственные товары',kind:'gloves',code:'03'}
 ];
 return \`<div class="s-front">
 <div class="s-topline"><span>ВТБ <i>/</i> Бизнес <i>/</i> Сервисы</span><span>ОПТИМА <b>•</b> КОНЦЕПТ СЕРВИСА</span></div>
 <section class="s-hero" aria-label="Оптима — совместные закупки">
  <header class="x-page-heading s-hero-copy">
   <div class="s-hero-content"><span class="s-hero-label"><i></i> ФИНТЕХ-СЕРВИС ДЛЯ БИЗНЕСА</span>
    <h1>Масштаб<br>большого бизнеса.<br><span>Заказ — ваш.</span></h1>
    <p>Объединяйте закупки с другими компаниями и получайте оптовую цену. Заказывайте только то, что нужно именно вам.</p>
    <div class="s-hero-actions"><button class="s-cta" data-action="browse-offers">Выбрать закупку <span>\${m.icon('arrow','sm')}</span></button><button class="s-cta-link" data-action="help">Как работает Оптима \${m.icon('arrow','sm')}</button></div>
    <div class="s-hero-foot"><span>\${m.icon('shield','sm')} Отдельный заказ и документы</span><span>\${m.icon('users','sm')} Единый объём спроса</span></div>
   </div>
  </header>
  <div class="s-illustration" aria-label="Схема объединения заказов разных компаний в одну партию">
   <div class="s-illustration-label"><span>ПРИНЦИП СОВМЕСТНОГО СПРОСА</span><b>01 / 03</b></div>
   <svg class="s-sculpture" viewBox="0 0 620 410" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
    <defs>
     <linearGradient id="s-box-front" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#b9d9ff"/></linearGradient>
     <linearGradient id="s-box-side" x1="0" y1="0" x2="1" y2=".9"><stop stop-color="#70b4fa"/><stop offset="1" stop-color="#1a59b9"/></linearGradient>
     <linearGradient id="s-box-top" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#f5fbff"/><stop offset="1" stop-color="#a6d1ff"/></linearGradient>
     <linearGradient id="s-surface" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#73b6ff" stop-opacity=".7"/><stop offset="1" stop-color="#063eab" stop-opacity=".13"/></linearGradient>
     <filter id="s-shadow" x="-40%" y="-60%" width="190%" height="240%"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <ellipse cx="322" cy="344" rx="225" ry="35" fill="#062867" opacity=".45" filter="url(#s-shadow)"/>
    <path d="M80 296 307 169 554 302 328 406Z" fill="url(#s-surface)" stroke="#9ed4ff" stroke-opacity=".36"/>
    <path d="M89 299 325 422 554 302" stroke="#def3ff" stroke-opacity=".34" stroke-width="2"/>
    <g opacity=".45" stroke="#9fd3ff"><path d="M130 274 367 395M186 243 420 366M242 211 478 335M169 345 394 219M240 384 463 258"/></g>
    <g transform="translate(142 142)">
     <path d="M8 54 104 5 202 58 109 110Z" fill="url(#s-box-top)"/>
     <path d="M8 54 109 110 109 208 8 151Z" fill="url(#s-box-front)"/>
     <path d="M109 110 202 58 202 156 109 208Z" fill="url(#s-box-side)"/>
     <path d="M55 29 153 83M55 29 55 125" stroke="#eaf8ff" stroke-width="13" opacity=".65"/>
     <path d="M37 92 81 116M37 110 71 129" stroke="#6999c7" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    </g>
    <g transform="translate(278 45)">
     <path d="M3 53 89 10 177 59 91 107Z" fill="url(#s-box-top)"/>
     <path d="M3 53 91 107 91 224 3 172Z" fill="url(#s-box-front)"/>
     <path d="M91 107 177 59 177 177 91 224Z" fill="url(#s-box-side)"/>
     <path d="M46 32 133 81" stroke="#f0faff" stroke-width="15" opacity=".55"/>
     <path d="M27 103 62 123M27 117 50 132" stroke="#6c9bc5" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    </g>
    <g transform="translate(315 246)">
     <path d="M3 30 86 0 157 37 74 76Z" fill="url(#s-box-top)"/>
     <path d="M3 30 74 76 74 141 3 96Z" fill="url(#s-box-front)"/>
     <path d="M74 76 157 37 157 102 74 141Z" fill="url(#s-box-side)"/>
     <path d="M40 18 112 57" stroke="#e9faff" stroke-width="10" opacity=".6"/>
    </g>
    <circle cx="106" cy="152" r="4" fill="#c0e7ff"/>
    <path d="M106 152 177 192" stroke="#c0e7ff" stroke-dasharray="5 9" stroke-width="2" opacity=".65"/>
    <circle cx="510" cy="189" r="4" fill="#c0e7ff"/>
    <path d="M510 189 447 231" stroke="#c0e7ff" stroke-dasharray="5 9" stroke-width="2" opacity=".65"/>
   </svg>
   <div class="s-figure-stat"><small>ПРИМЕР ОБЩЕЙ ПАРТИИ</small><strong>\${m.number(sample.threshold)}</strong><span>\${e(sample.unit)} <i>в единой закупке</i></span></div>
   <div class="s-figure-pill"><span>ВАШ ЗАКАЗ</span><strong>\${m.number(sample.quantity)} \${e(sample.unit)}</strong></div>
   <div class="s-illustration-bottom"><span><i></i> ОБЪЁМ ОБЪЕДИНЯЕТСЯ</span><span>ЗАКАЗЫ ОСТАЮТСЯ ОТДЕЛЬНЫМИ</span></div>
  </div>
 </section>
 <section class="s-directions" aria-label="Направления закупок">
  <div class="s-directions-top"><div><span>НАПРАВЛЕНИЯ</span><h2>Что закупают вместе</h2></div><p>Выберите категорию, чтобы сразу увидеть предложения поставщиков.</p></div>
  <div class="s-category-grid">\${categories.map((cat,i)=>\`<button class="s-category" data-action="category-jump" data-category="\${e(cat.id)}" aria-label="\${e(cat.label)}: перейти к предложениям">
   <span class="s-category-id">\${cat.code} <i>/\${m.number(m.OFFERS.filter(o=>o.category===cat.id).length)} предложения</i></span>
   <span class="s-category-image s-category-image-\${i}">\${m.product(cat.kind)}</span>
   <span class="s-category-bottom"><span><strong>\${e(cat.label)}</strong><small>\${e(cat.copy)}</small></span>\${m.icon('arrow','sm')}</span>
  </button>\`).join('')}</div>
 </section></div>\`;
}
