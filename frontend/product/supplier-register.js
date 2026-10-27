import { offerError } from './supplier-model.js';

export function offerProduct(o,s){return o.status==='published'?o.snapshot:s.vendorProducts.find(p=>p.id===o.productId);}
export function offerReadiness(o,s){return o.status==='draft'?offerError(o,s.vendorProducts):'';}
export function supplierRegister(ui,s){
 const query=(ui.sellerOfferSearch||'').trim().toLocaleLowerCase('ru');
 const matches=(o)=>{const p=offerProduct(o,s);return `${p?.name||''} ${p?.sku||''} ${o.region||''}`.toLocaleLowerCase('ru').includes(query);};
 const rows=s.vendorOffers.filter(matches).slice();
 rows.sort(ui.sellerOfferSort==='name'?(a,b)=>(offerProduct(a,s)?.name||'').localeCompare(offerProduct(b,s)?.name||'','ru'):(a,b)=>(a.deadlineDate||'9999').localeCompare(b.deadlineDate||'9999'));
 const seed=['all','published',undefined].includes(ui.sellerOfferFilter)&&'бумага для офиса a4 москва и область a4-80-500'.includes(query);
 const groups=['draft','published','archived'].filter(status=>!ui.sellerOfferFilter||ui.sellerOfferFilter==='all'||ui.sellerOfferFilter===status).map(status=>({status,rows:rows.filter(o=>o.status===status),seed:status==='published'&&seed})).filter(g=>g.rows.length||g.seed);
 return {groups,count:groups.reduce((n,g)=>n+g.rows.length+(g.seed?1:0),0)};
}
