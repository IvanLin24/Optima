import { calculate, money } from './data.js';
import { esc, icon, btn } from './ui.js';

const count = n => new Intl.NumberFormat('ru-RU').format(n);

export function quantityPresets(o) {
 const threshold = Math.max(o.min, Math.ceil((o.target-o.others)/o.step)*o.step);
 return [...new Set([o.min, threshold, Math.min(o.max, threshold*2)])]
  .filter(n=>n<=o.max && n%o.step===0);
}

export function calculatorBody(o, quantity, { edit=false, saved=false }={}) {
 const inputId=edit?'quantity-input':'offer-quantity';
 const errorId=edit?'quantity-error':'offer-quantity-error';
 return `<form id="${edit?'quantity-form':'offer-calculator-form'}" class="calc-form">
 <div class="calc-layout"><div class="calc-inputs"><p class="calc-description">${esc(o.detail)}</p>
 <div class="calc-field"><label for="${inputId}">Ваш объём <span>${esc(o.unit)}</span></label>
 <div class="calc-stepper"><button type="button" data-calc-step="-1" aria-label="Уменьшить на ${o.step}">−</button><input id="${inputId}" type="number" min="${o.min}" max="${o.max}" step="${o.step}" value="${quantity}" aria-describedby="calc-quantity-hint ${errorId}" required autofocus><button type="button" data-calc-step="1" aria-label="Увеличить на ${o.step}">+</button></div>
 <p id="calc-quantity-hint">От ${count(o.min)} до ${count(o.max)} · шаг ${count(o.step)}</p>
 <div class="calc-presets" aria-label="Варианты объёма">${quantityPresets(o).map(n=>`<button type="button" data-calc-quantity="${n}" aria-pressed="${n===quantity}">${count(n)} ${esc(o.unit)}</button>`).join('')}</div>
 <p id="${errorId}" class="calc-error" role="status"></p></div>
 <div class="calc-context"><span>Поставщик</span><strong>${esc(o.supplier)}</strong><p>${icon('clock',15)} Набор до ${esc(o.deadline)}</p><p>${icon('pin',15)} ${esc(o.region||'Москва и область')}${o.deliveryDate?` · поставка ${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date(o.deliveryDate+'T12:00:00+03:00'))}`:''}</p></div>
 <p class="calc-separate">${edit?'Изменится только ваш объём. Условия закупки вы согласуете отдельно.':'Расчёт предварительный. Участие сохраняет ваш объём. Условия личного заказа вы согласуете отдельно.'}</p>
 </div><div id="${edit?'quantity-preview':'offer-quote-preview'}" class="calc-result">${calculationView(o,quantity)}</div></div>
 <footer class="calc-footer"><p>Свой договор, оплата и адрес получения.</p><div>${btn('Отмена','close-modal','secondary','type="button"')}${edit?'<button type="submit" class="button primary" id="save-quantity">Применить объём</button>':btn(saved?'Убрать из сохранённых':'Сохранить','save-offer','secondary',`type="button" data-id="${o.id}" id="save-offer-quote"`)+btn('Участвовать в закупке','join-calculation','primary','type="button" id="join-offer-quote"')}</div></footer>
 </form>`;
}

export function calculationView(o, quantity) {
 const c=calculate(o,quantity);
 if(c.error)return `<div class="calc-unavailable"><span>Расчёт вашей части</span><h3>Уточните количество</h3><p>Укажите допустимый объём — покажем цену, доставку и сбор.</p></div>`;
 const reached=c.projected>=o.target, negative=c.saving<0, maximum=Math.max(c.total,c.baseline);
 return `<div class="calc-total"><span>Итого за ${count(quantity)} ${esc(o.unit)}</span><strong>${money(c.total)}</strong><small>${money(c.price)} за ${esc(o.priceUnit)} · доставка и сбор включены</small></div>
 <dl class="calc-cost"><div><dt>Товар · ${count(quantity)} × ${money(c.price)}</dt><dd>${money(c.goods)}</dd></div><div><dt>Доставка</dt><dd>${money(o.delivery)}</dd></div><div><dt>Комиссия · 3% экономии</dt><dd>${money(c.fee)}</dd></div></dl>
 <div class="calc-comparison ${negative?'is-negative':''}"><div><span>${negative?'Дороже отдельной покупки':'Экономия с группой'}</span><strong>${money(Math.abs(c.saving))}</strong></div><div class="calc-price-bar"><span>Отдельно</span><strong>${money(c.baseline)}</strong><i style="--bar-width:${c.baseline/maximum*100}%"></i></div><div class="calc-price-bar group"><span>С группой</span><strong>${money(c.total)}</strong><i style="--bar-width:${c.total/maximum*100}%"></i></div><p>Оба расчёта включают доставку. В групповой также включён сбор сервиса.</p></div>
 <div class="calc-threshold ${reached?'is-reached':''}">${icon(reached?'check':'info',16)}<p><strong>${reached?'Оптовый порог достигнут':'До оптовой цены ещё '+count(o.target-c.projected)+' '+esc(o.unit)}</strong><span>${count(c.projected)} из ${count(o.target)} с вашим объёмом · ${money(c.price)} за ${esc(o.priceUnit)}</span></p></div>
 <span class="sr-only" role="status">Итого ${money(c.total)}, цена ${money(c.price)} за ${esc(o.priceUnit)}.</span>`;
}
