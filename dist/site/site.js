import {OFFERS} from '../js/data.js';
import {calculate,money,number,percent} from '../js/domain.js';

const offer=OFFERS.find(x=>x.id==='bags');
const qty=document.querySelector('#qty');
const label=document.querySelector('#qty-label');
const separate=document.querySelector('#separate');
const group=document.querySelector('#group');
const saving=document.querySelector('#save');
const savingPercent=document.querySelector('#save-percent');
const pool=document.querySelector('#pool-label');
const othersFill=document.querySelector('#other-fill');
const ownFill=document.querySelector('#own-fill');
const minus=document.querySelector('#decrease');
const plus=document.querySelector('#increase');

function renderCalc(){
 const quantity=Number(qty.value);
 const c=calculate(offer,quantity);
 label.textContent=number(quantity)+' '+offer.unit;
 separate.textContent=money(c.standaloneTotal);
 group.textContent=money(c.groupTotal);
 saving.textContent=money(c.saving);
 savingPercent.textContent='−'+percent(c.savingPercent);
 pool.textContent=number(c.totalQuantity)+' / '+number(offer.threshold)+' '+offer.unit;
 const other=Math.min(100,offer.otherQuantity/offer.threshold*100);
 const own=Math.min(100-other,quantity/offer.threshold*100);
 othersFill.style.width=other+'%';
 ownFill.style.width=own+'%';
 qty.style.setProperty('--range',((quantity-Number(qty.min))/(Number(qty.max)-Number(qty.min))*100)+'%');
 qty.setAttribute('aria-valuetext',number(quantity)+' '+offer.unit);
 document.querySelector('.calc-benefit').dataset.ready=String(c.ready);
}
qty?.addEventListener('input',renderCalc);
minus?.addEventListener('click',()=>{qty.value=Math.max(Number(qty.min),Number(qty.value)-100);renderCalc()});
plus?.addEventListener('click',()=>{qty.value=Math.min(Number(qty.max),Number(qty.value)+100);renderCalc()});
if(qty&&offer){renderCalc();document.documentElement.dataset.calculator='ready';}

const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#site-nav');
toggle?.addEventListener('click',()=>{
 const open=nav.classList.toggle('open');
 toggle.setAttribute('aria-expanded',String(open));
 toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
 nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Открыть меню');
}));
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&nav.classList.contains('open')){
 nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');
 toggle?.focus();
 }
});
const mql=window.matchMedia('(min-width:821px)');
mql.addEventListener?.('change',e=>{if(e.matches){nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}});

// Make the investor demo visible as an interaction, not a fictional bank offer.
const reveal=new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(entry.isIntersecting){entry.target.classList.add('shown');reveal.unobserve(entry.target);}
 }
},{rootMargin:'0px 0px -40px 0px',threshold:.09});
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
 document.querySelectorAll('.process-row,.benefit-cell,.s-hero-copy').forEach(el=>{el.classList.add('to-reveal');reveal.observe(el)});
}
