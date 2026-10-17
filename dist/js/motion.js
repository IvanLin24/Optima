// Brief transitions for persistent application components.
// Timing and easing follow the public Admiral motion scale; see THIRD-PARTY.md.
export const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
export function enter(node,distance=8,duration=250){
 if(!node||reduceMotion()||typeof node.animate!=='function')return;
 const animation=node.animate([{opacity:0,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration,easing:'cubic-bezier(0.05,0.6,0.2,1)'});
 animation.finished.catch(()=>{});
 return animation;
}
export function exitLayer(layer){
 if(!layer||reduceMotion()||typeof layer.animate!=='function')return null;
 const panel=layer.querySelector('.drawer,.modal'),options={duration:180,easing:'cubic-bezier(0.4,0,1,1)',fill:'forwards'};
 const animations=[layer.animate([{opacity:1},{opacity:0}],options)];
 if(panel)animations.push(panel.animate(panel.classList.contains('drawer')?[{transform:'translateX(0)'},{transform:'translateX(100%)'}]:[{transform:'translateY(0) scale(1)'},{transform:'translateY(8px) scale(.985)'}],options));
 layer.style.pointerEvents='none';
 return Promise.allSettled(animations.map(a=>a.finished));
}
