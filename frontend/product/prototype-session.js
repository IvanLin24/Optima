// AI: не открывать кабинет до подтверждения почтового кода; секреты сервера здесь запрещены.
import { request, getToken, setToken } from '../backend/api.js';
import { esc, icon, btn } from './ui.js';
import { company, demoDirectory } from './data.js';
import { mountDistrict } from './district.js';
import { parseEmailCodeLink } from './email-code-link.js';

const mailLink=parseEmailCodeLink(location.hash);
// AI: remove credentials from the address bar before routing; no automatic POST/login.
if(location.hash.startsWith('#email-code?'))history.replaceState(null,'',location.pathname+location.search);
let mailCode=mailLink?.code||'';

let cfg, identity=null, revision=0, challenge=null, mode='login', email='', pending=false;
let saveTimer, queued=Promise.resolve(), saveStatus='', saveEpoch=0;
function decorate(){
  if(!cfg)return;
  const footer=document.querySelector('.application-footer');
  if(footer&&!document.querySelector('.prototype-userbar'))footer.insertAdjacentHTML('afterend',
    `<section class="prototype-userbar" aria-label="Виртуальная компания">${identity?`<div><strong>${esc(identity.company.name)}</strong><small>${esc(identity.company.email)} · <span class="server-save-state" role="status">${esc(saveStatus||'Сохранено на сервере')}</span></small></div><div class="prototype-auth-buttons">${btn('Профиль компании','virtual-profile','secondary')}${btn('Выйти','virtual-logout','quiet')}</div>`:`<div><strong>Попробуйте со своей виртуальной компанией</strong><small>Тестовые закупки, документы и участники. Вход — кодом из письма.</small></div><div class="prototype-auth-buttons">${btn('Войти по коду','virtual-login','secondary')}${btn('Создать виртуальную компанию','virtual-create','primary')}</div>`}</section>`);
  document.querySelectorAll('.server-save-state').forEach(el=>el.textContent=saveStatus||'Сохранено на сервере');
  if(identity){
    const marker=document.querySelector('.sample-marker');if(marker)marker.innerHTML='<i></i> Виртуальная компания · сервер';
    if(document.querySelector('#scene-root'))mountDistrict(cfg,identity.company.id);
  }
}
function status(text){saveStatus=text;document.querySelectorAll('.server-save-state').forEach(el=>el.textContent=text);}
function modalError(error){
  const body=document.querySelector('.prototype-gate-card')||document.querySelector('#modal[open] .modal-body');
  if(body){body.querySelector('.prototype-auth-error')?.remove();const el=document.createElement('p');el.className='prototype-auth-error';el.setAttribute('role','alert');el.textContent=error.message;body.prepend(el);}
  else cfg.notify(error.message,true);
}
function open(next='login'){
  mode=next;challenge=null;mailCode='';
  const creating=mode==='create';
  if(!identity){gate();return;}
  cfg.modal(creating?'Создать виртуальную компанию':'Вход по коду',
    `<p class="modal-description">${creating?'Укажите постоянную почту и пароль. Компания и тестовые данные появятся только после подтверждения кода.':'Введите почту своей виртуальной компании. Для входа пришлём одноразовый код.'}</p><form id="virtual-auth-form" class="form-grid"><label>Электронная почта<input type="email" name="email" required autocomplete="email" value="${esc(email)}" placeholder="you@company.ru" autofocus></label>${creating?'<label>Пароль<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Не менее 12 символов"></label><label class="prototype-checkbox"><input name="accepted" type="checkbox" required><span>Создать тестовую компанию и её демонстрационные данные. Реальные платежи и юридическое подписание не выполняются.</span></label>':''}<button class="button primary">Получить код</button></form><div class="prototype-auth-switch">${btn(creating?'Уже есть компания? Войти':'Создать виртуальную компанию',creating?'virtual-login':'virtual-create','text')}</div><p class="fine-print">Одноразовые адреса почты не принимаются. ${creating?'Пароль сохраняется защищённо; последующий вход выполняется только по коду из почты.':'Пароль для входа не требуется.'}</p>`);
}
function showCode(){
  if(!identity){gate();return;}
  cfg.modal('Введите код из письма',`<p class="modal-description">Письмо отправлено на <strong>${esc(email)}</strong> с адреса noreply@optima.casa. Код действует 10 минут.</p><form id="virtual-code-form" class="form-grid"><label>Код подтверждения<input name="code" class="prototype-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="000000" value="${esc(mailCode)}" required autofocus></label><button class="button primary">Подтвердить и войти</button></form><div class="prototype-auth-switch">${btn('Запросить новый код','virtual-new-code','text')}</div><p class="fine-print">Повторная отправка — не чаще раза в минуту. Не более пяти попыток ввода.</p>`);
}
function apply(value){
  identity=value;revision=value.revision;
  Object.assign(company,{name:value.company.name,short:value.company.name.replace(/^ООО «|»$/g,''),initials:'ИЛ'});
  demoDirectory.splice(0,demoDirectory.length,...value.companies);
  cfg.store.replace(value.state,value.company.id);
  status('Сохранено на сервере');cfg.render();
}
async function restore(){apply(await request('/prototype/state'));}
function save(state){
  if(!identity)return;
  status('Сохраняем…');clearTimeout(saveTimer);
  const snapshot=structuredClone(state);
  const epoch=saveEpoch;
  saveTimer=setTimeout(()=>{queued=queued.then(async()=>{
    if(epoch!==saveEpoch)return;
    try{const value=await request('/prototype/state',{method:'PUT',body:{revision,state:snapshot}});revision=value.revision;status('Сохранено на сервере');}
    catch(error){saveEpoch++;clearTimeout(saveTimer);status('Не сохранено');cfg.notify(error.message,true);if(error.status===401){setToken('');identity=null;open('login');}else{try{await restore();}catch{/* Keep explicit unsaved status. */}}}
  });},350);
}
function profile(){
  if(!identity){open('login');return;}
  cfg.modal('Виртуальная компания',`<dl class="modal-facts"><div><dt>Компания</dt><dd>${esc(identity.company.name)}</dd></div><div><dt>Почта</dt><dd>${esc(identity.company.email)}</dd></div><div><dt>ИНН</dt><dd>${esc(identity.company.inn)} · тестовый</dd></div><div><dt>Хранение</dt><dd>На сервере, отдельно от других пользователей</dd></div></dl><div class="modal-callout">Для проверки обеих сторон сделки можно переключаться между покупателем и тестовым поставщиком. Это роли внутри вашей демонстрации.</div><div class="modal-actions">${btn('Покупатель','virtual-buyer','secondary')}${btn('Поставщик','virtual-supplier','secondary')}${btn('Выйти','virtual-logout','quiet')}</div>`);
}
document.addEventListener('click',e=>{
  const control=e.target.closest('[data-action]');if(!control||!cfg)return;
  const action=control.dataset.action;
  if(!action.startsWith('virtual-')&&action!=='account')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(action==='virtual-create')open('create');
  if(action==='virtual-login')open('login');
  if(action==='virtual-new-code'){
    if(pending)return;pending=true;
    request('/auth/resend-code',{method:'POST',body:{email,challenge_id:challenge.challenge_id},token:''})
      .then(value=>{challenge=value;mailCode='';showCode();cfg.notify('Новый код отправлен. Предыдущий больше не действует.');})
      .catch(modalError).finally(()=>{pending=false;});
  }
  if(action==='virtual-profile'||action==='account')profile();
  if(action==='virtual-buyer'||action==='virtual-supplier'){
    cfg.dispatch({type:'role',value:action==='virtual-buyer'?'buyer':'supplier'});document.querySelector('#modal').close();cfg.go(action==='virtual-buyer'?'overview':'supplier');
  }
  if(action==='virtual-logout'){
    (async()=>{clearTimeout(saveTimer);await queued;if(identity)await request('/prototype/state',{method:'PUT',body:{revision,state:cfg.store.get()}});await request('/auth/logout',{method:'POST'});setToken('');identity=null;demoDirectory.splice(0);cfg.store.replace(null,'anonymous');Object.assign(company,{name:'ООО «Линия»',short:'Линия'});document.querySelector('#modal').close();cfg.go('overview');cfg.render();})().catch(modalError);
  }
},true);
document.addEventListener('submit',e=>{
  const form=e.target.closest('#virtual-auth-form,#virtual-code-form');if(!form)return;
  e.preventDefault();e.stopImmediatePropagation();if(pending)return;pending=true;
  const submit=form.querySelector('button[type="submit"],button');submit.disabled=true;
  (async()=>{
    const data=new FormData(form);
    if(form.id==='virtual-auth-form'){
      email=String(data.get('email')).trim();
      const body=mode==='create'?{email,password:data.get('password')}:{email};
      challenge=await request(mode==='create'?'/auth/virtual-company':'/auth/login',{method:'POST',body,token:''});
      showCode();
    }else{
      const value=await request('/auth/verify-code',{method:'POST',body:{email,challenge_id:challenge.challenge_id,code:data.get('code')},token:''});
      setToken(value.access_token);mailCode='';challenge=null;document.querySelector('#modal').close();await restore();cfg.go('overview');cfg.notify('Почта подтверждена. Виртуальная компания готова.');
    }
  })().catch(modalError).finally(()=>{pending=false;submit.disabled=false;});
},true);

export const prototypeSession={
  decorate,open,gate,gated:()=>!identity,
  canDispatch(action){return Boolean(identity)||['read-messages','read-notifications','deal-read','role'].includes(action.type);},
  async init(options){cfg=options;cfg.store.subscribe(save);if(mailLink){email=mailLink.email;challenge={challenge_id:mailLink.challenge_id};cfg.render();return;}decorate();if(getToken()){try{await restore();}catch(error){setToken('');identity=null;cfg.render();if(error.status!==401)cfg.notify(error.message,true);}}},
};

function gate(){
  const creating=mode==='create';
  const brand='<a class="app-brand" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span><strong>оптима</strong></a>';
  const form=challenge?`<h1>Проверьте почту</h1><p class="prototype-gate-description">Введите шестизначный код, отправленный на <strong>${esc(email)}</strong>.</p><form id="virtual-code-form" class="form-grid"><label>Код подтверждения<input name="code" class="prototype-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="000000" value="${esc(mailCode)}" required autofocus></label><button class="button primary full">Подтвердить и войти</button></form><div class="prototype-auth-switch">${btn('Отправить код повторно','virtual-new-code','text')}</div><p class="fine-print">Письмо от noreply@optima.casa. Код действует 10 минут, максимум пять попыток.</p>`:
    `<div class="prototype-gate-tabs"><button data-action="virtual-login" class="${creating?'':'selected'}">Вход</button><button data-action="virtual-create" class="${creating?'selected':''}">Регистрация</button></div><h1>${creating?'Создайте виртуальную компанию':'Вход в Оптима'}</h1><p class="prototype-gate-description">${creating?'После подтверждения почты подготовим компанию, закупки и восемь тестовых участников группы.':'Войдите по коду из письма, чтобы открыть закупки своей компании.'}</p><form id="virtual-auth-form" class="form-grid"><label>Электронная почта<input type="email" name="email" required autocomplete="email" value="${esc(email)}" placeholder="you@company.ru"></label>${creating?'<label>Пароль<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Не менее 12 символов"></label><label class="prototype-checkbox"><input name="accepted" type="checkbox" required><span>Создать виртуальную компанию и демонстрационные данные. Реальные платежи и юридическое подписание не выполняются.</span></label>':''}<button class="button primary full">Получить код</button></form><div class="prototype-auth-switch">${btn(creating?'Уже есть компания? Войти по коду':'Создать виртуальную компанию',creating?'virtual-login':'virtual-create','text')}</div><p class="fine-print">Одноразовая почта не принимается. Вход в приложение — только по коду.</p>`;
  document.querySelector('#app').innerHTML=`<main id="main" tabindex="-1" class="prototype-gate"><header class="prototype-gate-header">${brand}<span>Совместные закупки для бизнеса</span></header><section class="prototype-gate-card">${form}</section><footer>Оптима · рабочая демонстрация · Москва</footer></main>`;
}
