import { cleanProduct, productError, cleanOffer, offerError, safeProductImage } from './supplier-model.js';
import { productFormBody, offerFormBody, offerPreviewBody } from './supplier-pages.js';
import { esc, btn, productMedia } from './ui.js';
import { revisionForm, supplierRevisionPreview } from './revision-views.js';
import { offerVersion, revisionChanges } from './offer-revision.js';

export function createSupplierController({getState,dispatch,render,redrawView,go,openModal,notify,ui}){
 const $=selector=>document.querySelector(selector);
 let productId,offerId,photo='',revisionDraft;
 const error=text=>{const el=$('#vendor-form-error');if(el){el.textContent=text;el.scrollIntoView({block:'nearest'});}};
 function productForm(id){
  const product=getState().vendorProducts.find(p=>p.id===id);productId=id;photo=product?.image||'';
  openModal(id?'Карточка товара':'Новый товар',productFormBody(product),'supplier-editor');
  const form=$('#vendor-product-form');let photoRequest=0;
  $('#vendor-clear-photo').onclick=()=>{photoRequest++;photo='';$('#product-photo-preview').innerHTML=productMedia({size:'large'});$('#vendor-clear-photo').hidden=true;$('#vendor-photo-file').value='';};
  $('#vendor-photo-file').onchange=e=>{
   const file=e.target.files[0];if(!file)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>512000){error('Выберите JPG, PNG или WebP размером до 500 КБ.');e.target.value='';return;}
   const request=++photoRequest,reader=new FileReader();reader.onload=()=>{if(!form.isConnected||request!==photoRequest)return;const next=safeProductImage(reader.result);if(!next){error('Не удалось прочитать фотографию.');return;}photo=next;$('#product-photo-preview').innerHTML=productMedia({src:photo,size:'large'});$('#vendor-clear-photo').hidden=false;$('#vendor-form-error').textContent='';};reader.onerror=()=>{if(form.isConnected&&request===photoRequest)error('Не удалось прочитать файл. Попробуйте другую фотографию.');};reader.readAsDataURL(file);
  };
  $('#vendor-product-form').onsubmit=e=>{e.preventDefault();const value=cleanProduct({...Object.fromEntries(new FormData(e.target)),image:photo}),problem=productError(value);if(problem){error(problem);return;}
   if(dispatch({type:'vendor-product',id:productId,value},false)){$('#modal').close();ui.productFilter='active';ui.productSearch='';go('products');notify('Товар сохранён. Теперь можно подготовить предложение.');}
  };
 }
 function offerForm(id,selectedProduct){
  const s=getState(),offer=s.vendorOffers.find(o=>o.id===id);
  if(!s.vendorProducts.some(p=>p.status!=='archived')){openModal('Сначала добавьте товар',`<p class="modal-description">Для предложения нужна карточка с характеристиками и единицей измерения.</p>${btn('Добавить товар','vendor-add-product')}`);return;}
  if(id&&(!offer||offer.status!=='draft')){notify('Изменить можно только черновик.',true);return;}
  offerId=id;openModal(id?'Условия предложения':'Новое предложение',offerFormBody(s,offer,selectedProduct),'supplier-editor supplier-offer-editor');
  $('#vendor-offer-form').onsubmit=e=>{e.preventDefault();saveOffer(true);};
 }
 function saveOffer(preview=false){
  const form=$('#vendor-offer-form');if(!form)return;
  const value=cleanOffer(Object.fromEntries(new FormData(form))),problem=offerError(value,getState().vendorProducts,{complete:preview});if(problem){error(problem);return;}
  if(!dispatch({type:'vendor-offer',id:offerId,value},false))return;
  const id=offerId||getState().vendorOffers[0].id;
  if(preview)showPreview(id);else{$('#modal').close();ui.sellerOfferFilter='draft';go('offers');notify('Черновик сохранён. Покупатель его не видит.');}
 }
 function showPreview(id){
  const s=getState(),o=s.vendorOffers.find(o=>o.id===id);if(!o)return;
  if(o.status!=='published'){const problem=offerError(o,s.vendorProducts);if(problem){offerForm(id);error(problem);return;}}
  openModal(o.status==='published'?'Опубликованное предложение':'Предпросмотр предложения',offerPreviewBody(s,o),'supplier-editor supplier-preview');
 }
 function editRevision(id,resume=false){
  const s=getState(),o=s.vendorOffers.find(o=>o.id===id);
  if(!o||o.status!=='published'){notify('Откройте опубликованное предложение.',true);return;}
  if(!resume||revisionDraft?.offerId!==id)revisionDraft={offerId:id,baseVersion:offerVersion(o),value:cleanOffer(o),reason:''};
  if(revisionDraft.baseVersion!==offerVersion(o)){notify('Предложение уже изменилось. Откройте актуальную версию.',true);return;}
  openModal('Изменение условий',revisionForm(s,o,revisionDraft),'supplier-editor revision-editor');
  $('#vendor-revision-form').onsubmit=e=>{
   e.preventDefault();const fields=Object.fromEntries(new FormData(e.target)),value=cleanOffer({...o,...fields}),reason=String(fields.reason||'').trim();
   const problem=offerError(value,[{...o.snapshot,id:o.productId,status:'active'}]);
   if(problem){error(problem);return;}if(!reason){error('Объясните покупателю причину изменения.');return;}
   if(!revisionChanges(o,value).length){error('Условия не изменились. Исправьте нужные поля перед публикацией.');return;}
   revisionDraft={...revisionDraft,value,reason};openModal('Проверка изменений',supplierRevisionPreview(getState(),o,revisionDraft),'supplier-editor revision-preview');
  };
 }
 function handle(action,control){
  const s=getState(),id=control.dataset.id;
  switch(action){
   case 'vendor-product-filter':ui.productFilter=control.dataset.filter;redrawView();document.querySelector(`[data-action="vendor-product-filter"][data-filter="${ui.productFilter}"]`)?.focus({preventScroll:true});return;
   case 'vendor-offer-filter':ui.sellerOfferFilter=control.dataset.filter;redrawView();document.querySelector(`[data-action="vendor-offer-filter"][data-filter="${ui.sellerOfferFilter}"]`)?.focus({preventScroll:true});return;
   case 'vendor-add-product':productForm();return;
   case 'vendor-edit-product':productForm(id);return;
   case 'vendor-add-offer':offerForm(undefined,control.dataset.product);return;
   case 'vendor-edit-offer':offerForm(id);return;
   case 'vendor-save-draft':saveOffer();return;
   case 'vendor-preview':showPreview(id);return;
   case 'vendor-revise-offer':editRevision(id);return;
   case 'vendor-revise-back':editRevision(id,true);return;
   case 'vendor-revise-publish':
    if(!revisionDraft||revisionDraft.offerId!==id)return;
    if(dispatch({type:'vendor-revise',id,baseVersion:revisionDraft.baseVersion,value:revisionDraft.value,reason:revisionDraft.reason},false)){$('#modal').close();revisionDraft=null;render();notify('Новая версия опубликована. Участники смогут проверить изменения.');}return;
   case 'vendor-publish':if(dispatch({type:'vendor-publish',id},false)){$('#modal').close();ui.sellerOfferFilter='published';go('offers');notify('Предложение опубликовано в локальном каталоге покупателя.');}return;
   case 'vendor-copy-offer':if(dispatch({type:'vendor-copy',id},false))offerForm(getState().vendorOffers[0].id);return;
   case 'vendor-archive-product':case 'vendor-archive-offer':{
    const product=action==='vendor-archive-product';
    openModal(product?'Перенести товар в архив?':'Убрать предложение из каталога?',`<p class="modal-description">${product?'Товар нельзя будет выбрать для нового предложения. Уже опубликованные условия останутся прежними.':'Покупатели перестанут видеть предложение. Его можно будет вернуть в черновики и опубликовать снова.'}</p><div class="modal-actions">${btn('Отмена','close-modal','secondary')}${btn('В архив','vendor-confirm-archive','primary',`data-id="${esc(id)}" data-kind="${product?'product':'offer'}"`)}</div>`);return;
   }
   case 'vendor-confirm-archive':if(dispatch({type:control.dataset.kind==='product'?'vendor-product-status':'vendor-offer-status',id,status:'archived'},false)){$('#modal').close();render();notify('Перенесено в архив.');}return;
   case 'vendor-restore-product':if(dispatch({type:'vendor-product-status',id,status:'active'}))notify('Товар восстановлен.');return;
   case 'vendor-restore-offer':if(dispatch({type:'vendor-offer-status',id,status:'draft'}))notify('Предложение возвращено в черновики.');return;
  }
 }
 function bindFields(){
  document.querySelectorAll('.publication-menu').forEach(menu=>{
   menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.publication-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});});
   menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();e.stopPropagation();}});
   menu.addEventListener('focusout',e=>{if(!menu.contains(e.relatedTarget))menu.open=false;});
  });
  $('#seller-offer-search')?.addEventListener('input',e=>{const caret=e.target.selectionStart;ui.sellerOfferSearch=e.target.value;redrawView();$('#seller-offer-search').focus();$('#seller-offer-search').setSelectionRange(caret,caret);});
  $('#seller-offer-sort')?.addEventListener('change',e=>{ui.sellerOfferSort=e.target.value;redrawView();$('#seller-offer-sort').focus();});
  $('#product-search')?.addEventListener('input',e=>{const caret=e.target.selectionStart;ui.productSearch=e.target.value;redrawView();$('#product-search').focus();$('#product-search').setSelectionRange(caret,caret);});
 }
 return {handle,bindFields};
}
