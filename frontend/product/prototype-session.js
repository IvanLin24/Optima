import { brandMark } from './brand.js';
// AI: регистрация требует код; вход — пароль подтверждённого аккаунта. Секреты сервера запрещены.
import { request, getToken, setToken, setProfile } from '../backend/api.js';
import { esc, icon, btn } from './ui.js';
import { company, demoDirectory } from './data.js';

import { parseEmailCodeLink } from './email-code-link.js';
import { landingPage } from './landing.js';
import { createEntryMotion } from './entry-motion.js';
const entryMotion=createEntryMotion();

const mailLink=parseEmailCodeLink(location.hash);
// AI: remove credentials from the address bar before routing; no automatic POST/login.
if(location.hash.startsWith('#email-code?'))history.replaceState(null,'',location.pathname+location.search);
let mailCode=mailLink?.code||'';

let cfg, identity=null, revision=0, challenge=null, mode='welcome', email='', pending=false;
let saveTimer, queued=Promise.resolve(), saveStatus='', saveEpoch=0;
let resendAt=0, resendTimer, pendingKind='';
function passwordField(creating){
  return `<div class="auth-password-field"><label for="auth-password">Пароль</label><span class="auth-password-wrap"><input id="auth-password" type="password" name="password" required minlength="${creating?6:1}" maxlength="128" autocomplete="${creating?'new-password':'current-password'}" ${creating?'aria-describedby="auth-password-help"':''} placeholder="${creating?'Придумайте пароль':'Введите пароль'}"><button type="button" data-action="virtual-password" aria-controls="auth-password" aria-pressed="false">Показать</button></span>${creating?'<span id="auth-password-help" class="auth-field-help">От 6 символов</span>':''}</div>`;
}
async function finishLogin(value,confirmed=false){
  setToken(value.access_token);mailCode='';challenge=null;stopResendTimer();
  document.querySelector('#modal')?.close();
  try{await restore();}catch(error){setToken('');identity=null;throw error;}
  cfg.go('overview');cfg.notify(confirmed?'Почта подтверждена. Компания готова.':'Вход выполнен');
}
let authMotionId=0, authLeaving=false;
function switchAuthContent(card,html,creating){
  const content=card.querySelector('.auth-content');
  const ticket=++authMotionId;
  const reduced=typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const direction=creating?1:-1;
  content.getAnimations().forEach(animation=>animation.cancel());
  card.dataset.mode=creating?'create':'login';
  document.querySelector('.auth-wheel')?.style.setProperty('--auth-turn',creating?'90deg':'0deg');
  card.querySelectorAll('.prototype-gate-tabs button').forEach(button=>{
    const selected=button.dataset.action===(creating?'virtual-create':'virtual-login');
    button.classList.toggle('selected',selected);
    if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  const replace=()=>{
    if(ticket!==authMotionId||!content.isConnected)return;
    const before=content.getBoundingClientRect().height;
    content.innerHTML=html;content.inert=false;authLeaving=false;
    if(!reduced){
      const after=content.getBoundingClientRect().height;
      content.animate([{height:`${before}px`},{height:`${after}px`}],{duration:360,easing:'cubic-bezier(.22,.7,.2,1)'});
      content.animate([{opacity:0,transform:`translateX(${direction*10}px)`},{opacity:1,transform:'translateX(0)'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
    syncAuthControls();
  };
  if(reduced){replace();return;}
  authLeaving=true;content.inert=true;
  content.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-direction*8}px)`}],{duration:140,easing:'ease-in',fill:'forwards'}).finished.then(()=>{
    if(ticket!==authMotionId)return;
    content.getAnimations().forEach(animation=>animation.cancel());replace();
  }).catch(()=>{});
}
function stopResendTimer(){clearInterval(resendTimer);resendTimer=null;}
function syncAuthControls(){
  document.querySelectorAll('#virtual-auth-form,#virtual-code-form').forEach(form=>{
    form.setAttribute('aria-busy',String(pending));
    form.querySelectorAll('input,button').forEach(el=>el.disabled=pending);
    const submit=form.querySelector('[type="submit"]');
    if(submit?.dataset.label)submit.textContent=pending&&pendingKind!=='resend'?(form.id==='virtual-code-form'?'Проверяем код…':mode==='create'?'Отправляем код…':'Входим…'):submit.dataset.label;
  });
  document.querySelectorAll('.prototype-gate [data-action]').forEach(el=>{
    el.disabled=pending;
    if(el.dataset.action==='virtual-new-code'){
      const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));
      el.disabled=pending||seconds>0;
      el.textContent=pending&&pendingKind==='resend'?'Отправляем код…':seconds?`Новый код через ${seconds} с`:'Отправить код повторно';
    }
  });
}
function receivedChallenge(value){
  challenge=value;mailCode='';resendAt=Date.now()+Math.max(0,Number(value.resend_after)||0)*1000;
  stopResendTimer();
  if(resendAt>Date.now())resendTimer=setInterval(()=>{syncAuthControls();if(Date.now()>=resendAt)stopResendTimer();},1000);
}
function decorate(){
  if(!cfg)return;
  document.querySelectorAll('.server-save-state').forEach(el=>el.textContent=saveStatus||'Сохранено');
}
function status(text){saveStatus=text;document.querySelectorAll('.server-save-state').forEach(el=>el.textContent=text);}
function modalError(error){
  const body=document.querySelector('.prototype-gate-card')||document.querySelector('#modal[open] .modal-body');
  if(body){body.querySelector('.prototype-auth-error')?.remove();const el=document.createElement('p');el.className='prototype-auth-error';el.setAttribute('role','alert');el.setAttribute('tabindex','-1');el.textContent=error.message;const form=body.querySelector('form');if(form)form.before(el);else body.prepend(el);el.focus();}
  else cfg.notify(error.message,true);
}
function open(next='login'){
  if(pending||entryMotion.busy())return;
  if(next===mode&&!challenge&&document.querySelector('.auth-content'))return;
  const previous=mode;
  const emailInput=document.querySelector('#virtual-auth-form [name="email"]');
  if(emailInput)email=emailInput.value.trim();
  stopResendTimer();resendAt=0;
  mode=next;challenge=null;mailCode='';
  const creating=mode==='create';
  if(!identity){
    if(previous==='welcome')entryMotion.navigate(()=>gate(previous),()=>document.querySelector('.prototype-gate-card input')?.focus({preventScroll:true})).catch(modalError);
    else gate(previous);
    return;
  }
  cfg.modal(creating?'Создать виртуальную компанию':'Вход в компанию',
    `<p class="modal-description">${creating?'Укажите постоянную почту и пароль. Компания и тестовые данные появятся только после подтверждения кода.':'Введите почту и пароль своей компании.'}</p><form id="virtual-auth-form" class="form-grid"><label>Электронная почта<input type="email" name="email" required autocomplete="email" value="${esc(email)}" placeholder="you@company.ru" autofocus></label>${passwordField(creating)}${creating?'<label class="prototype-checkbox"><input name="accepted" type="checkbox" required><span>Создать тестовую компанию и её демонстрационные данные. Реальные платежи и юридическое подписание не выполняются.</span></label>':''}<button type="submit" class="button primary" data-label="${creating?'Получить код':'Войти'}">${creating?'Получить код':'Войти'}</button></form><div class="prototype-auth-switch">${btn(creating?'Уже есть компания? Войти':'Создать виртуальную компанию',creating?'virtual-login':'virtual-create','text')}</div><p class="fine-print">Одноразовые адреса почты не принимаются. ${creating?'Пароль сохраняется защищённо; последующий вход выполняется по паролю.':'Используйте пароль, заданный при регистрации.'}</p>`);
}
function showCode(){
  if(!identity){gate();return;}
  cfg.modal('Введите код из письма',`<p class="modal-description">Письмо отправлено на <strong>${esc(email)}</strong> с адреса noreply@optima.casa. Код действует 10 минут.</p><form id="virtual-code-form" class="form-grid"><label>Код подтверждения<input name="code" class="prototype-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="000000" value="${esc(mailCode)}" required autofocus></label><button class="button primary">Подтвердить и войти</button></form><div class="prototype-auth-switch">${btn('Запросить новый код','virtual-new-code','text')}</div><p class="fine-print">Повторная отправка — не чаще раза в минуту. Не более пяти попыток ввода.</p>`);
}
function apply(value,redraw=true){
  identity=value;revision=value.revision;
  Object.assign(company,{id:value.company.id,name:value.company.name,short:value.company.name.replace(/^ООО «|»$/g,''),initials:value.company.name.slice(0,1)});
  demoDirectory.splice(0,demoDirectory.length,...value.companies);
  cfg.store.replace(value.state,value.company.id);
  status('Сохранено на сервере');if(redraw){cfg.resolveRoute?.();cfg.render();}
}
async function restore(){apply(await request('/prototype/state'));}
function save(state){
  if(!identity)return;
  status('Сохраняем…');clearTimeout(saveTimer);
  const snapshot=structuredClone(state);
  const companyId=identity.company.id;
  const epoch=saveEpoch;
  saveTimer=setTimeout(()=>{queued=queued.then(async()=>{
    if(epoch!==saveEpoch)return;
    try{const value=await request('/prototype/state',{method:'PUT',body:{revision,state:snapshot},companyId});revision=value.revision;status('Сохранено на сервере');}
    catch(error){saveEpoch++;clearTimeout(saveTimer);status('Не сохранено');cfg.notify(error.message,true);if(error.status===401){setToken('');identity=null;open('login');}else{try{await restore();}catch{/* Keep explicit unsaved status. */}}}
  });},350);
}
function profile(){
  if(!identity){open('login');return;}
  cfg.go('settings');
}
document.addEventListener('click',e=>{
  const control=e.target.closest('[data-action]');if(!control||!cfg)return;
  const action=control.dataset.action;
  if(!action.startsWith('virtual-')&&action!=='account')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(action==='virtual-scroll'){
    if(['landing-how','landing-questions'].includes(control.dataset.target))document.getElementById(control.dataset.target)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    return;
  }
  if(action==='virtual-home'){
    if(pending||entryMotion.busy())return;stopResendTimer();mode='welcome';challenge=null;mailCode='';
    entryMotion.navigate(()=>{gate();window.scrollTo(0,0);},()=>document.querySelector('.landing-hero h1')?.focus({preventScroll:true})).catch(modalError);return;
  }
  if(action==='virtual-change-email'){open(mode==='create'?'create':'login');return;}
  if(action==='virtual-password'){
    if(pending)return;
    const input=document.querySelector('#virtual-auth-form [name="password"]');if(!input)return;
    const visible=input.type==='password';input.type=visible?'text':'password';
    control.textContent=visible?'Скрыть':'Показать';control.setAttribute('aria-pressed',String(visible));return;
  }
  if(action==='virtual-create')open('create');
  if(action==='virtual-login')open('login');
  if(action==='virtual-new-code'){
    if(pending||!challenge||Date.now()<resendAt)return;pending=true;pendingKind='resend';syncAuthControls();
    request('/auth/resend-code',{method:'POST',body:{email,challenge_id:challenge.challenge_id},token:''})
      .then(value=>{receivedChallenge(value);showCode();cfg.notify('Новый код отправлен. Предыдущий больше не действует.');})
      .catch(modalError).finally(()=>{pending=false;syncAuthControls();});
  }
  if(action==='virtual-profile')profile();
  if(action==='account')void cfg.openProfiles();
  if(action==='virtual-buyer'||action==='virtual-supplier'){
    void cfg.switchRole(action==='virtual-buyer'?'buyer':'supplier');
  }
  if(action==='virtual-logout'){
    (async()=>{clearTimeout(saveTimer);await queued;if(identity)await request('/prototype/state',{method:'PUT',body:{revision,state:cfg.store.get()}});await request('/auth/logout',{method:'POST'});setToken('');identity=null;demoDirectory.splice(0);cfg.store.replace(null,'anonymous');Object.assign(company,{name:'',short:'',initials:''});document.querySelector('#modal').close();cfg.go('overview');cfg.render();})().catch(modalError);
  }
},true);
document.addEventListener('submit',e=>{
  const form=e.target.closest('#virtual-auth-form,#virtual-code-form');if(!form)return;
  e.preventDefault();e.stopImmediatePropagation();if(pending||authLeaving||entryMotion.busy())return;pending=true;pendingKind='submit';
  const data=new FormData(form);
  form.querySelector('.prototype-auth-error')?.remove();
  document.querySelector('.prototype-gate-card .prototype-auth-error')?.remove();
  syncAuthControls();
  (async()=>{
    if(form.id==='virtual-auth-form'){
      email=String(data.get('email')).trim();
      const body={email,password:data.get('password')};
      const value=await request(mode==='create'?'/auth/virtual-company':'/auth/login',{method:'POST',body,token:''});
      if(mode==='create'){receivedChallenge(value);showCode();}else await finishLogin(value);
    }else{
      const value=await request('/auth/verify-code',{method:'POST',body:{email,challenge_id:challenge.challenge_id,code:data.get('code')},token:''});
      await finishLogin(value,true);
    }
  })().catch(modalError).finally(()=>{pending=false;syncAuthControls();if(form.id==='virtual-auth-form'&&challenge)document.querySelector('#auth-code')?.focus({preventScroll:true});});
},true);

export const prototypeSession={
  decorate,open,gate,gated:()=>!identity,
  profiles:()=>request('/account/profiles'),
  async prepareProfile(role,create=false){
    clearTimeout(saveTimer);await queued;
    await request('/prototype/state',{method:'PUT',companyId:identity.company.id,body:{revision,state:cfg.store.get()}}).then(value=>{revision=value.revision;});
    const {profiles}=await request('/account/profiles');
    let profile=profiles.find(item=>item.role===role);
    if(!profile){if(!create)throw Error('Сначала создайте бизнес-профиль');profile=await request('/account/profiles',{method:'POST',body:{role}});}
    const value=await request('/prototype/state',{companyId:profile.company_id});
    return ()=>{++saveEpoch;setProfile(profile.company_id);apply(value,false);};
  },
  companyId:()=>identity?.company.id,
  updateCompany(profile){
    if(identity?.company.id!==profile.id)return;
    Object.assign(identity.company,{name:profile.name,inn:profile.inn});
    Object.assign(company,{id:profile.id,name:profile.name,short:profile.name.replace(/^ООО «|»$/g,''),initials:profile.name.slice(0,1)});
  },
  canDispatch(action){return Boolean(identity)||['read-messages','read-notifications','deal-read','role'].includes(action.type);},
  async init(options){cfg=options;cfg.store.subscribe(save);if(mailLink){email=mailLink.email;challenge={challenge_id:mailLink.challenge_id};cfg.render();return;}decorate();if(getToken()){try{await restore();}catch(error){setToken('');identity=null;cfg.render();if(error.status!==401)cfg.notify(error.message,true);}}},
};

function gate(previous){
  if(mode==='welcome'&&!challenge){document.querySelector('#app').innerHTML=landingPage();document.title='Оптима — ваш объём, оптовая цена';entryMotion.landing(document.querySelector('.optima-landing'));return;}
  const creating=mode==='create';
  const brand=`<a class="app-brand" href="/" aria-label="Оптима — на главную">${brandMark()}<strong>оптима</strong></a>`;
  const submit=label=>`<button type="submit" class="button primary full" data-label="${label}">${label}</button>`;
  const steps=`<ol class="auth-steps" aria-label="Этапы ${creating?'регистрации':'входа'}"><li class="${challenge?'complete':'current'}" ${challenge?'':'aria-current="step"'}><span>${challenge?icon('check',12):'1'}</span>${creating?'Данные':'Почта'}</li><li class="${challenge?'current':''}" ${challenge?'aria-current="step"':''}><span>2</span>Подтверждение</li></ol>`;
  const form=challenge?`${steps}<h1>Проверьте почту</h1><p class="prototype-gate-description">Код подтверждения отправлен на<br><strong>${esc(email)}</strong></p><button type="button" class="auth-change-email" data-action="virtual-change-email">Изменить почту</button><form id="virtual-code-form" class="form-grid"><label for="auth-code">Код из письма</label><input id="auth-code" name="code" class="prototype-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="000000" value="${esc(mailCode)}" aria-describedby="auth-code-help" required><p id="auth-code-help" class="auth-field-help">6 цифр · код действует 10 минут</p>${submit('Подтвердить и войти')}</form><div class="auth-resend">${btn('Отправить код повторно','virtual-new-code','text')}<p>Нет письма? Проверьте папку «Спам»</p></div>`:
    `<nav class="prototype-gate-tabs" aria-label="Доступ к компании"><button type="button" data-action="virtual-login" ${creating?'':'aria-current="page"'} class="${creating?'':'selected'}">Вход</button><button type="button" data-action="virtual-create" ${creating?'aria-current="page"':''} class="${creating?'selected':''}">Регистрация</button></nav><h1>${creating?'Регистрация':'С возвращением'}</h1><p class="prototype-gate-description">${creating?'Пришлём код подтверждения на почту':'Введите почту и пароль своей компании'}</p><form id="virtual-auth-form" class="form-grid"><label for="auth-email">Электронная почта<input id="auth-email" type="email" name="email" required autocomplete="email" value="${esc(email)}" placeholder="you@company.ru" spellcheck="false" autocapitalize="none"></label>${passwordField(creating)}${creating?'<label class="prototype-checkbox"><input name="accepted" type="checkbox" required><span>Создать демокомпанию без реальных платежей и юридической подписи</span></label>':''}${submit(creating?'Получить код':'Войти')}</form>`;
  const split=challenge?0:form.indexOf('</nav>')+6;
  const tabs=form.slice(0,split),content=form.slice(split);
  const existing=document.querySelector('.prototype-gate-card:has(.auth-content)');
  if(!challenge&&['login','create'].includes(previous)&&existing?.querySelector('.prototype-gate-tabs')){
    existing.setAttribute('aria-label',creating?'Регистрация компании':'Вход в компанию');
    switchAuthContent(existing,content,creating);
    document.title=(creating?'Регистрация':'Вход')+' · Оптима';return;
  }
  ++authMotionId;authLeaving=false;
  document.querySelector('#app').innerHTML=`<main id="main" tabindex="-1" class="prototype-gate ${entryMotion.busy()?'entry-arriving':''}"><header class="prototype-gate-header">${brand}${btn(icon('back',16)+' На главную','virtual-home','prototype-gate-back')}</header><div class="auth-layout"><aside class="auth-story" aria-label="Совместные закупки в Оптиме"><div class="auth-art"><div class="auth-wheel" style="--auth-turn:${creating?'90deg':'0deg'}"><img src="/brand/optima-weave-sculpture.png" alt="" width="1254" height="1254" decoding="async"></div></div></aside><section class="prototype-gate-card" data-mode="${creating?'create':'login'}" aria-label="${challenge?'Подтверждение почты':creating?'Регистрация компании':'Вход в компанию'}"><div class="auth-card-inner">${tabs}<div class="auth-content">${content}</div></div></section></div><footer class="auth-footer"><span>Оптима</span><span>Совместные закупки для бизнеса</span></footer></main>`;
  document.title=(challenge?'Подтверждение почты':creating?'Регистрация':'Вход')+' · Оптима';
  window.scrollTo(0,0);syncAuthControls();
  if(!pending&&!entryMotion.busy())document.querySelector('.prototype-gate-card input')?.focus({preventScroll:true});
}
