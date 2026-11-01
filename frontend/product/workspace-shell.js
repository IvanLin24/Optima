// Retain the shell across renders so navigation and the header never blink.
export function commitWorkspace(root,html){
 if(!root.querySelector('.application')){root.innerHTML=html;return;}
 const template=document.createElement('template');template.innerHTML=html;
 for(const selector of ['.app-sidebar','.application-header','#main','.application-footer','.mobile-navigation']){
  const current=root.querySelector(selector),next=template.content.querySelector(selector);
  if(!current||!next)continue;
  if(selector==='#main')current.replaceWith(next);
  else if(current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;
 }
}
