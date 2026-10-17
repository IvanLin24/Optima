/** Backend seam. Frontend never calls business endpoints directly. */
import {getState,dispatch,resetDemo,subscribe} from './store.js';
const base=(document.querySelector('meta[name="optima-api"]')?.content||'').replace(/\/$/,'');
const workspaceEndpoint=document.documentElement.dataset.mode==='supplier'?'/api/v1/supplier/workspace':'/api/v1/buyer/workspace';
export const mode=base?'http':'demo';
async function request(path,method='GET',body){
 const res=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'include',body:body===undefined?undefined:JSON.stringify(body)});
 if(!res.ok){let msg=`HTTP ${res.status}`;try{msg=(await res.json()).message||msg;}catch{}throw Error(msg);}
 return res.status===204?null:res.json();
}
export const api={
 subscribe:fn=>mode==='demo'?subscribe(fn):()=>{},
 getSnapshot:()=>mode==='demo'?Promise.resolve(getState()):request(workspaceEndpoint),
 answerQuestion:(id,decision)=>mode==='demo'?Promise.resolve(dispatch('answerQuestion',{id,decision})):request(`/api/v1/questions/${encodeURIComponent(id)}/answer`,'POST',{decision}),
 confirmContract:id=>mode==='demo'?Promise.resolve(dispatch('confirmContract',{id})):request(`/api/v1/contracts/${encodeURIComponent(id)}/confirm`,'POST',{acknowledged:true}),
 declineContract:id=>mode==='demo'?Promise.resolve(dispatch('declineContract',{id})):request(`/api/v1/contracts/${encodeURIComponent(id)}/decline`,'POST',{}),
 createNeed:need=>mode==='demo'?Promise.resolve(dispatch('addNeed',need)):request('/api/v1/needs','POST',need),
 deleteNeed:id=>mode==='demo'?Promise.resolve(dispatch('removeNeed',{id})):request(`/api/v1/needs/${encodeURIComponent(id)}`,'DELETE'),
 readNotifications:id=>mode==='demo'?Promise.resolve(dispatch('readNotification',{id})):request('/api/v1/notifications/read','POST',{id}),
 updateSettings:data=>mode==='demo'?Promise.resolve(dispatch('settings',data)):request('/api/v1/buyer/settings','PATCH',data),
 createOffer:data=>mode==='demo'?Promise.resolve(dispatch('createOffer',data)):request('/api/v1/supplier/offers','POST',data),
 promoteOffer:id=>mode==='demo'?Promise.resolve(dispatch('togglePromotion',{id})):request(`/api/v1/supplier/offers/${encodeURIComponent(id)}/promotion`,'POST',{}),
 reset:()=>mode==='demo'?Promise.resolve(resetDemo()):Promise.reject(Error('Reset запрещён для серверных данных'))
};
