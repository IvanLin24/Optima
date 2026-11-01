import { esc, icon, btn, pageHead } from './ui.js';

const fields=['name','inn','kpp','legal_address','contact_name','contact_phone','contact_email'];
export function profileDraft(value){
 const draft=Object.fromEntries(fields.map(key=>[key,value[key]??'']));
 if(value.needs_setup){draft.name='';draft.inn='';}
 return draft;
}
export function profilePayload(draft,revision){
 return {profile_revision:revision,...Object.fromEntries(fields.map(key=>[key,key==='name'?String(draft[key]??'').trim():String(draft[key]??'').trim()||null]))};
}

export function companySettingsScreen(model,role='buyer'){
 const heading=pageHead('Настройки',role==='buyer'?'Компания покупателя и контакты':'Компания поставщика и контакты');
 if(!model||model.phase==='loading'||model.phase==='idle')return heading+'<div class="company-settings-loading" role="status" aria-live="polite">Загружаем данные компании…</div>';
 if(model.phase==='error')return heading+`<section class="company-settings-error" role="alert"><h2>Не удалось загрузить настройки</h2><p>${esc(model.error)}</p>${btn('Повторить','settings-retry','secondary')}</section>`;
 const value=model.draft,locked=!model.profile.can_edit_requisites;
 const field=(name,label,{type='text',max=200,full=false,pattern='',placeholder='',autocomplete='',hint=''}={})=>`<div class="company-field ${full?'company-field--full':''}"><label for="company-${name}">${label}${name==='name'?' <span aria-hidden="true">*</span>':''}</label><input id="company-${name}" name="${name}" type="${type}" value="${esc(value[name])}" ${name==='name'?'required minlength="2"':''} maxlength="${max}" ${pattern?`pattern="${pattern}"`:''} ${locked&&['name','inn','kpp','legal_address'].includes(name)?'readonly':''} ${placeholder?`placeholder="${esc(placeholder)}"`:''} ${autocomplete?`autocomplete="${autocomplete}"`:''} ${hint?`aria-describedby="company-${name}-hint"`:''}>${hint?`<small id="company-${name}-hint">${hint}</small>`:''}</div>`;
 return heading+`<div class="company-settings" data-motion="company-settings" data-motion-content><form id="company-settings-form" aria-busy="${model.saving}" class="company-settings-form">
 <section class="company-settings-section"><header><span>01</span><div><h2>Компания</h2><p>Название и реквизиты этого бизнес-профиля</p></div></header>
 ${locked?'<p class="company-settings-notice">Реквизиты уже используются в закупках и доступны для просмотра. Контактные данные можно обновить.</p>':''}
 <div class="company-fields">${field('name','Название компании',{full:true,autocomplete:'organization',placeholder:'Как называется ваша компания'})}${field('inn','ИНН',{max:12,pattern:'[0-9]{10}([0-9]{2})?',hint:'10 или 12 цифр'})}${field('kpp','КПП',{max:9,pattern:'[0-9]{9}',hint:'Для ИП можно оставить пустым'})}${field('legal_address','Юридический адрес',{full:true,max:500,autocomplete:'street-address',placeholder:'Город, улица, дом, офис'})}</div></section>
 <section class="company-settings-section"><header><span>02</span><div><h2>Контакт для связи</h2><p>К кому обращаться по вопросам закупки</p></div></header><div class="company-fields">${field('contact_name','Контактное лицо',{full:true,max:120,autocomplete:'name',placeholder:'Имя и фамилия'})}${field('contact_phone','Телефон',{type:'tel',max:40,autocomplete:'tel',placeholder:'+7'})}${field('contact_email','Почта для связи',{type:'email',max:254,autocomplete:'email',placeholder:'name@company.ru'})}</div></section>
 <div class="company-settings-actions"><div class="company-settings-feedback" role="status" aria-live="polite">${model.saving?'Сохраняем…':model.saved?'Изменения сохранены':model.dirty?'Есть несохранённые изменения':'Заполняйте остальные поля по мере необходимости'}</div><button type="submit" class="button primary" ${model.saving?'disabled':''}>${model.saving?'Сохраняем…':'Сохранить изменения'}</button></div>
 <p class="company-settings-save-error" role="alert" ${model.error?'':'hidden'}>${esc(model.error)}${model.errorCode==='PROFILE_CONFLICT'?btn('Загрузить актуальные данные','settings-retry','text'):''}</p></form>
 <section class="company-account" aria-labelledby="company-account-title"><header><h2 id="company-account-title">Аккаунт</h2></header><div class="account-setting-row"><div><span>Почта для входа</span><strong>${esc(model.profile.login_email)}</strong></div>${btn('Выйти из аккаунта','virtual-logout','secondary')}</div><div class="account-setting-row"><div><span>Рабочее пространство</span><strong>${role==='buyer'?'Закупки':'Продажи'}</strong></div>${btn('Сменить профиль','account','secondary')}</div></section></div>`;
}

export function createCompanySettings({request,render,notify,onSaved}){
 let owner=null,epoch=0;
 let model={phase:'idle',profile:null,draft:{},saving:false,dirty:false,saved:false,error:''};
 async function load(){
  const token=++epoch;model.phase='loading';model.error='';
  try{
   const value=await request('/company/profile');
   if(token!==epoch)return;
   if(value.id!==owner)throw Error('Данные компании не совпадают с текущим аккаунтом');
   Object.assign(model,{phase:'ready',profile:value,draft:profileDraft(value),dirty:false,saved:false});
  }catch(error){if(token!==epoch)return;model.phase='error';model.error=error.message;}
  if(token===epoch)render();
 }
 function activate(companyId){
  if(owner!==companyId){owner=companyId;++epoch;model={phase:'idle',profile:null,draft:{},saving:false,dirty:false,saved:false,error:''};}
  if(model.phase==='idle')void load();
  return model;
 }
 function bind(form){
  if(!form)return;
  form.addEventListener('input',()=>{
   model.draft=Object.fromEntries(fields.map(key=>[key,form.elements.namedItem(key).value]));
   model.dirty=true;model.saved=false;
   const feedback=form.querySelector('.company-settings-feedback');if(feedback)feedback.textContent='Есть несохранённые изменения';
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(model.saving)return;
   model.draft=Object.fromEntries(fields.map(key=>[key,form.elements.namedItem(key).value]));
   const token=epoch;const snapshot=profilePayload(model.draft,model.profile.profile_revision);
   model.saving=true;model.error='';model.saved=false;
   model.errorCode='';
   form.querySelectorAll('input,button').forEach(el=>el.disabled=true);
   const submit=form.querySelector('[type=submit]');submit.textContent='Сохраняем…';
   form.querySelector('.company-settings-feedback').textContent='Сохраняем…';
   form.setAttribute('aria-busy','true');
   try{
    const value=await request('/company/profile',{method:'PUT',body:snapshot});
    if(token!==epoch)return;
    if(value.id!==owner)throw Error('Не удалось подтвердить сохранение компании');
    Object.assign(model,{profile:value,draft:profileDraft(value),dirty:false,saved:true});
    onSaved(value);notify('Данные компании сохранены');
   }catch(error){if(token===epoch){model.error=error.message;model.errorCode=error.code||'';}}
   finally{if(token===epoch){model.saving=false;render();}}
  });
 }
 return {activate,bind,getModel:()=>model,deactivate(){if(owner!==null){owner=null;++epoch;model={phase:'idle',profile:null,draft:{},saving:false,dirty:false,saved:false,error:''};}},retry(){if(!model.saving){void load();render();}}};
}
