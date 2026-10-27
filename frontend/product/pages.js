import { dealScreen } from './deal-pages.js';
import { productsScreen, supplierOffersScreen } from './supplier-pages.js';
import { chat } from './conversations.js';
import { documentReader } from './document-reader.js';
export { contractPaper } from './contract.js';
import { tasksScreen, conditionsScreen, participantsScreen, analyticsScreen } from './workspace-pages.js';
import { orderScreen, needsScreen, supplierScreen } from './workflow-pages.js';
import { documentRegister } from './documents.js';
import { catalog } from './procurement.js';
import { groupHeader, groupChange, groupSpace } from './group-space.js';
import { esc, icon, btn, pageHead } from './ui.js';
import { overview } from './overview.js';
import { districtPage } from './district.js';
export function renderPage(page,ui,s){
 if(page==='district')return districtPage();
 switch(page){case'deal':return dealScreen(ui,s);case'overview':return overview(ui,s);case'group':return group(ui,s);case'purchases':return catalog(ui,s);case'needs':return needsScreen(ui,s);case'messages':return messages(ui,s);case'documents':return documentRegister(ui,s);case'document':return documentReader(ui,s);case'order':return orderScreen(ui,s);case'analytics':return analyticsScreen(ui,s);case'tasks':return tasksScreen(ui,s);case'products':return productsScreen(ui,s);case'offers':return supplierOffersScreen(ui,s);case'supplier':return supplierScreen(ui,s);default:return overview(ui,s);}
}
export function group(ui,s){
 return groupHeader(s,ui.tab)+`<div class="journey-content" data-motion-content>${ui.tab!=='conditions'?groupChange(s):''}${ui.tab==='overview'?groupSpace(s,activity(s)):ui.tab==='discussion'?chat(ui,s,false):ui.tab==='conditions'?conditionsScreen(s):ui.tab==='documents'?documentRegister({...ui,docFilter:'all'},s,true):participantsScreen(s)}</div>`;
}
function activity(s){return `<section class="surface activity-section"><div class="section-heading"><h2>Последние события</h2>${btn('Открыть обсуждение','open-discussion','text')}</div><div class="activity-list">${[...s.events.slice(0,3),{title:'Поставщик обновил условия',detail:'Дата доставки 27 → 29 октября',time:'10:32'},{title:'Вы подтвердили предварительное участие',detail:'100 пачек · свой заказ и документы',time:'10:26'}].slice(0,4).map((e,i)=>`<div><span class="activity-point ${i===0?'blue':''}"></span><div><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div><time>${esc(e.time)}</time></div>`).join('')}</div></section>`;}
function messages(ui,s){return `${pageHead('Сообщения','Общие вопросы — в группе. Личные детали — '+(s.role==='buyer'?'с поставщиком.':'с покупателем.'))}${chat(ui,s,true)}`;}
