// Public pages only. Rendering and authentication remain owned by the session.
export function createEntryMotion(){
  let navigating=false, observer=null, observedRoot=null;
  const animations=new Set();
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches!==false;
  const ease='cubic-bezier(.22,.75,.2,1)';
  function animate(element,frames,options){
    if(!element?.isConnected||!element.animate||reduced())return null;
    const animation=element.animate(frames,{easing:ease,...options});
    animations.add(animation);
    animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
    return animation;
  }
  function reveal(element,delay=0){
    element.classList.remove('entry-reveal-pending');
    animate(element,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:620,delay,fill:'backwards'});
  }
  function focusReveal(event){
    const region=event.target.closest('.entry-reveal-pending');
    if(region){observer?.unobserve(region);region.classList.remove('entry-reveal-pending');}
  }
  function cleanup(){
    observer?.disconnect();observer=null;
    observedRoot?.removeEventListener('focusin',focusReveal);
    observedRoot?.querySelectorAll('.entry-reveal-pending').forEach(el=>el.classList.remove('entry-reveal-pending'));
    observedRoot=null;
    for(const animation of animations)animation.cancel();
    animations.clear();
  }
  function landing(root){
    cleanup();if(!root||reduced())return;
    if(!navigating){
      const selectors=['.landing-nav','.landing-eyebrow','.landing-hero h1','.landing-lead','.landing-hero-actions','.landing-art'];
      selectors.forEach((selector,i)=>{
        const element=root.querySelector(selector);
        if(element)animate(element,[{opacity:0,transform:`translateY(${i===5?24:12}px)`},{opacity:1,transform:'translateY(0)'}],{duration:i===5?850:620,delay:Math.min(i*65,260),fill:'backwards'});
      });
    }
    if(typeof IntersectionObserver!=='function')return;
    observedRoot=root;root.addEventListener('focusin',focusReveal);
    observer=new IntersectionObserver(entries=>{
      let delay=0;
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        observer.unobserve(entry.target);reveal(entry.target,delay);delay+=55;
      }
    },{threshold:.08});
    root.querySelectorAll('.landing-process h2,.landing-process li,.landing-separate,.landing-questions>div,.landing-closing,.landing-footer').forEach(element=>{
      // The content is visible by default; only offscreen regions wait for scrolling.
      if(element.getBoundingClientRect().top>=window.innerHeight)element.classList.add('entry-reveal-pending');
      observer.observe(element);
    });
  }
  async function navigate(render,after=()=>{}){
    if(navigating)return;
    const old=document.querySelector('#main');
    if(!old||reduced()){cleanup();render();after();return;}
    navigating=true;cleanup();old.inert=true;
    let rendered=false;
    const update=()=>{if(rendered)return;rendered=true;render();};
    try{
      if(typeof document.startViewTransition==='function'){
        const hero=old.querySelector?.('.landing-hero');
        if(hero&&hero.getBoundingClientRect().bottom<=0)old.classList.add('entry-scrolled-source');
        const transition=document.startViewTransition(update);
        await transition.finished.catch(()=>{});
        // A skipped snapshot must still leave the selected screen rendered.
        update();
      }else{
        await animate(old,[{opacity:1},{opacity:0,transform:'translateY(-8px)'}],{duration:160,fill:'forwards'})?.finished.catch(()=>{});
        update();
        await animate(document.querySelector('#main'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:420})?.finished.catch(()=>{});
      }
    }finally{
      if(old.isConnected)old.inert=false;
      old.classList?.remove('entry-scrolled-source');
      navigating=false;after();
    }
  }
  return {landing,navigate,busy:()=>navigating};
}
