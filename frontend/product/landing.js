import { themeButton } from './theme.js';
import { brandMark } from './brand.js';
import { icon } from './ui.js';

const brand = `<a class="app-brand landing-brand" href="/" aria-label="Оптима — на главную">${brandMark()}<strong>оптима</strong></a>`;
const action = (label, mode='create', extra='') => `<button class="landing-button ${extra}" data-action="virtual-${mode}">${label}${icon('arrow',19)}</button>`;

export function landingPage(){
 return `<main id="main" class="optima-landing" tabindex="-1">
 <header class="landing-nav">${brand}<div class="landing-nav-links"><nav aria-label="О проекте"><button data-action="virtual-scroll" data-target="landing-how">Как работает</button><button data-action="virtual-scroll" data-target="landing-questions">Вопросы</button></nav><div class="landing-auth">${themeButton()}<button class="landing-login" data-action="virtual-login">Войти</button>${action('Регистрация','create','small')}</div></div></header>
 <section class="landing-hero" aria-labelledby="landing-title">
  <div class="landing-hero-copy"><p class="landing-eyebrow"><span></span>Совместные закупки для бизнеса</p><h1 tabindex="-1" id="landing-title" aria-label="Ваш объём — оптовая цена">Ваш объём<br><em>Оптовая цена</em></h1><p class="landing-lead">Заказывайте нужное количество — объединённый объём помогает получить оптовые условия</p><div class="landing-hero-actions">${action('Начать закупку')}<button class="landing-how-link" data-action="virtual-scroll" data-target="landing-how">Как работает ${icon('down',16)}</button></div></div>
  <div class="landing-art"><div class="landing-sculpture"><img src="/brand/optima-weave-sculpture.png" width="1254" height="1254" alt="Переплетение — знак объединения компаний" fetchpriority="high" decoding="async"></div></div>
 </section>
 <section id="landing-how" class="landing-process" aria-labelledby="landing-process-title"><header class="process-intro"><p class="section-kicker">КАК РАБОТАЕТ ОПТИМА</p><h2 id="landing-process-title">Закупаете вместе.<br>Решаете за себя.</h2><p class="process-lead">Общий объём помогает получить оптовые условия. Заказ, документы и обязательства остаются у каждой компании своими.</p></header><ol class="process-path">${[
 ['Находите подходящее предложение','Выберите товар и нужное количество. Если предложения пока нет — сохраните свою потребность.'],
 ['Присоединяетесь к общей закупке','Объёмы участников складываются для достижения оптового порога поставщика.'],
 ['Оформляете только свой заказ','Проверяете стоимость и условия своей части. Общие вопросы обсуждаете в группе, детали заказа — с поставщиком.']
 ].map(([title,text])=>`<li><h3>${title}</h3><p>${text}</p></li>`).join('')}</ol></section>
 <section id="landing-questions" class="landing-questions"><div class="questions-heading"><h2>Вопросы об Оптиме</h2></div><div class="questions-list">${[
 ['Кому подойдёт Оптима?','Компаниям, которым нужны небольшие партии на оптовых условиях. Покупатели объединяют совместимые потребности, а поставщики предлагают условия для общего объёма.'],
 ['Можно ли и закупать, и продавать?','Да. Одна почта даёт доступ к двум бизнес-профилям — для закупок и продаж. У каждой компании свои название, реквизиты, контакты и данные кабинета.'],
 ['Нужно ли выкупать всю партию?','Вы указываете только свой объём с учётом минимального заказа и шага количества поставщика. Для достижения оптового порога учитываются объёмы участников группы.'],
 ['Как рассчитывается комиссия?','Комиссия Оптимы — 3% положительной экономии. Исходная цена и состав расчёта должны быть известны: без них нельзя подтвердить экономию. Расчёт доступен до согласования заказа.'],
 ['У всех участников будут общие документы?','Нет. У каждой компании свой заказ, реквизиты и документы. Общими остаются условия закупки и обсуждение группы.']
 ].map(([q,a])=>`<details><summary>${q}<span>${icon('down',17)}</span></summary><p>${a}</p></details>`).join('')}</div></section>
 <section class="landing-closing"><div><h2>Начните со своего объёма</h2></div><div>${action('Создать компанию')}${action('Войти','login','landing-button-outline')}</div></section>
 <footer class="landing-footer">${brand}<nav aria-label="Навигация в подвале"><button data-action="virtual-scroll" data-target="landing-how">Как работает</button><button data-action="virtual-scroll" data-target="landing-questions">Вопросы</button></nav></footer>
 </main>`;
}
