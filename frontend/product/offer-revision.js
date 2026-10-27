export const revisionFields={current:'Цена до порога',next:'Цена при пороге',delivery:'Доставка вашего заказа',deadlineDate:'Завершение набора',deliveryDate:'Дата поставки',region:'Регион поставки'};
export const offerVersion=o=>Number.isSafeInteger(o?.version)&&o.version>0&&o.version<1000000?o.version:1;
export const revisionChanges=(before,after)=>Object.keys(revisionFields).filter(key=>before[key]!==after[key]);
export const sameRevisionIdentity=(a,b)=>['id','name','detail','category','unit','priceUnit','supplier','min','max','step','others','target','retail','retailDelivery'].every(key=>a[key]===b[key]);
export const pendingRevision=d=>!d.accepted&&d.pendingRevision&&offerVersion(d.pendingRevision.offer)>offerVersion(d.offer)?d.pendingRevision:null;
