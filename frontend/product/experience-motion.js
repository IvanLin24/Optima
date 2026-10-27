// Motion follows an actual context change. Field edits and searches stay still.
export function createMotionDirector() {
 const preference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const views=new Set(),dialogs=new Map(),feedbacks=new Map();
 let disposed=false;
 const reduced=()=>disposed||preference?.matches;
 const ease='cubic-bezier(.2,.75,.25,1)';

 function animate(element,keyframes,options,onSettled=()=>{}) {
  if(!element?.isConnected||typeof element.animate!=='function'||reduced())return null;
  let animation;
  try{animation=element.animate(keyframes,{easing:ease,fill:'none',...options});}catch{return null;}
  let settled=false;
  const finish=()=>{if(settled)return;settled=true;animation.onfinish=null;animation.oncancel=null;onSettled();};
  animation.onfinish=finish;
  animation.oncancel=finish;
  return {stop(){animation.cancel();finish();}};
 }

 function beforeViewChange() {
  for(const running of [...views])running.stop();
  views.clear();
 }

 function enter(element,keyframes,duration,delay=0) {
  let running;
  running=animate(element,keyframes,{duration,delay,fill:'backwards'},()=>views.delete(running));
  if(running)views.add(running);
 }

 function regions(elements) {
  const selected=[];
  // querySelectorAll returns parents before children. Stop after four regions so
  // entering a large register never measures or animates every individual row.
  for(const element of elements){
   if(!element.isConnected||selected.some(parent=>parent.contains(element))||element.getClientRects&&!element.getClientRects().length)continue;
   selected.push(element);if(selected.length===4)break;
  }
  return selected;
 }

 function pageRegions(main) {
  const marked=regions(main.querySelectorAll('[data-motion]'));
  if(marked.length)return marked;
  return regions([...main.children].filter(element=>!element.matches('nav,.sr-only,[role="status"],.space-back,.space-mobile-action,.review-mobile-decision,.reader-mobile-action')));
 }

 function afterViewChange({pageChanged=false,tabChanged=false,selectionChanged=false}={}) {
  beforeViewChange();
  if(reduced())return;
  const main=document.querySelector('#main');
  if(!main)return;
  if(pageChanged){
   const blocks=pageRegions(main);
   for(const [index,element] of (blocks.length?blocks:[main]).entries()){
    enter(element,[{opacity:.74,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],190,index*24);
   }
  }else if(tabChanged){
   const blocks=regions(main.querySelectorAll('[data-motion-content],[data-motion="conversation"]'));
   for(const [index,element] of blocks.entries()){
    enter(element,[{opacity:.65,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],170,index*16);
   }
  }else if(selectionChanged){
   for(const element of main.querySelectorAll('.home-focus,.home-finance,.wb-order-heading,.wb-panel-content')){
    enter(element,[{opacity:.6,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],160);
   }
  }
 }

 // Call after the actual operation has succeeded and its live-region text changed.
 // Feedback survives route changes; replacing the same toast cancels only its old effect.
 function afterFeedback(element,{kind='saved'}={}) {
  feedbacks.get(element)?.stop();
  if(!element||reduced())return;
  let running;
  running=animate(element,[{opacity:kind==='error'?.78:.58},{opacity:1}],{duration:180},()=>feedbacks.delete(element));
  if(running)feedbacks.set(element,running);
 }

 // Call before replacing a dialog's content: an older close callback must finish
 // while that older dialog is still the one being closed.
 function finishModal(dialog) {
  const record=dialogs.get(dialog);
  if(record)record.finish();
 }

 function modalMotion(dialog,closing,callback=()=>{}) {
  finishModal(dialog);
  if(!dialog?.open||!dialog.isConnected||reduced()){
   try{callback();return Promise.resolve();}catch(error){return Promise.reject(error);}
  }
  let resolve,reject;
  const completed=new Promise((yes,no)=>{resolve=yes;reject=no;});
  let running,finished=false;
  const finish=()=>{
   if(finished)return;
   finished=true;
   dialogs.delete(dialog);
   running?.stop();
   dialog.removeAttribute('data-motion-stage');
   dialog.removeEventListener('close',finish);
   try{callback();resolve();}catch(error){reject(error);}
  };
  dialogs.set(dialog,{closing,completed,finish});
  dialog.setAttribute('data-motion-stage',closing?'closing':'opening');
  dialog.addEventListener('close',finish,{once:true});
  running=animate(dialog,closing?
   [{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(5px) scale(.985)'}]:
   [{opacity:0,transform:'translateY(8px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],
   {duration:closing?130:190,easing:closing?'cubic-bezier(.4,0,1,1)':ease},finish);
  if(!running)finish();
  return completed;
 }

 function afterModalOpen(dialog) {return modalMotion(dialog,false);}
 function beforeModalClose(dialog,callback) {
  const current=dialogs.get(dialog);
  if(current?.closing)return current.completed;
  return modalMotion(dialog,true,callback);
 }
 function stopAll() {
  beforeViewChange();
  for(const running of [...feedbacks.values()])running.stop();
  feedbacks.clear();
  for(const dialog of [...dialogs.keys()])finishModal(dialog);
 }
 const onPreferenceChange=()=>{if(preference.matches)stopAll();};
 preference?.addEventListener?.('change',onPreferenceChange);

 return {
  beforeViewChange,afterViewChange,afterModalOpen,beforeModalClose,finishModal,afterFeedback,
  destroy(){disposed=true;stopAll();preference?.removeEventListener?.('change',onPreferenceChange);}
 };
}
