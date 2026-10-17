/**
 * Single adapter seam. Default: deterministic in-browser mock.
 * To switch to a real backend, set window.OPTIMA_API_BASE='/api/v1' before this module loads.
 * Server owns identity, quote price, offer version and all order mutations.
 */
import {mockApi} from './mock-api.js';
const base=window.OPTIMA_API_BASE;
const idempotency=()=>crypto.randomUUID?.()||('ui-'+Date.now()+'-'+Math.random());
async function request(path,{method='GET',data,idempotent=false}={}){
 const response=await fetch(base+path,{method,credentials:'same-origin',headers:{'Accept':'application/json',...(data?{'Content-Type':'application/json'}:{}),...(idempotent?{'Idempotency-Key':idempotency()}: {})},body:data?JSON.stringify(data):undefined});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(payload.message||payload.detail||'Ошибка сервиса. Попробуйте позже.'),{status:response.status});
 return payload;
}
const httpApi={
 async bootstrap(){return request('/bootstrap')},
 async previewQuote(data){return request('/quotes',{method:'POST',data})},
 async createOrder(data){return request('/orders',{method:'POST',data,idempotent:true})},
 async cancelOrder(id){return request(`/orders/${encodeURIComponent(id)}/cancel`,{method:'POST',idempotent:true})},
 async createNeed(data){return request('/needs',{method:'POST',data,idempotent:true})},
 async importNeeds(rows){return request('/needs/import',{method:'POST',data:{needs:rows},idempotent:true})},
 async deleteNeed(id){return request(`/needs/${encodeURIComponent(id)}`,{method:'DELETE'})}
};
export const api=base?httpApi:mockApi;
export const apiMode=base?'http':'mock';