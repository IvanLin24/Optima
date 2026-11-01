const KEY='optima.appearance.v1';
let switching=false;
const dark=()=>document.documentElement?.dataset?.theme==='dark';
const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.1A8.4 8.4 0 0 1 9.9 4a8.4 8.4 0 1 0 10.1 10.1Z"/></svg>';
function apply(theme){
 document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#151618':'#f3f5f8');
 document.querySelectorAll('.theme-toggle').forEach(button=>{button.setAttribute('aria-checked',String(theme==='dark'));button.setAttribute('aria-label',theme==='dark'?'Тёмная тема':'Светлая тема');});
}
export function initTheme(){let theme='light';try{if(localStorage.getItem(KEY)==='dark')theme='dark';}catch{}apply(theme);}
export function themeButton(){return `<button class="theme-toggle" type="button" role="switch" data-action="theme-toggle" aria-label="${dark()?'Тёмная тема':'Светлая тема'}" aria-checked="${dark()}"><span class="theme-knob"></span><span class="theme-sun">${sun}</span><span class="theme-moon">${moon}</span></button>`;}
export async function toggleTheme(event){
 if(switching)return;
 const theme=dark()?'light':'dark';
 const commit=()=>{apply(theme);try{localStorage.setItem(KEY,theme);}catch{}};
 if(!document.startViewTransition||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){commit();return;}
 switching=true;document.documentElement.dataset.themeTransition='true';
 const rect=event?.target?.closest('.theme-toggle')?.getBoundingClientRect();
 const x=rect?rect.x+rect.width/2:innerWidth-40,y=rect?rect.y+rect.height/2:35;
 const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
 let committed=false;
 const update=()=>{if(!committed){committed=true;commit();}};
 try{
  const transition=document.startViewTransition(update);
  await transition.ready;
  const animation=document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},{duration:520,easing:'cubic-bezier(.22,.7,.2,1)',pseudoElement:'::view-transition-new(root)'});
  await animation.finished.catch(()=>{});await transition.finished.catch(()=>{});
 }catch{update();}finally{switching=false;delete document.documentElement.dataset.themeTransition;}
}
