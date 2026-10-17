export const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:Number.isInteger(n)?0:2}).format(n);
export const number = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export const percent = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n)+'%';
const round = n => Math.round((n + Number.EPSILON)*100)/100;
export function calculate(offer, quantity = offer.quantity, otherQuantity = offer.otherQuantity) {
 if(!Number.isFinite(quantity)||quantity<=0||!Number.isInteger(quantity)) throw new Error('Укажите целое положительное количество');
 const standaloneGoods=round(quantity*offer.price),groupGoods=round(quantity*offer.groupPrice);
 const standaloneTotal=round(standaloneGoods+offer.delivery),groupTotal=round(groupGoods+offer.groupDelivery);
 const saving=round(standaloneTotal-groupTotal),totalQuantity=otherQuantity+quantity;
 return {quantity,standaloneGoods,groupGoods,standaloneTotal,groupTotal,saving,savingPercent:standaloneTotal>0?saving/standaloneTotal*100:0,totalQuantity,missing:Math.max(0,offer.threshold-totalQuantity),progress:Math.min(100,totalQuantity/offer.threshold*100),ready:totalQuantity>=offer.threshold,beneficial:saving>0};
}
export function validateNeed(row){
 const errors=[];
 if(!row.name?.trim())errors.push('Укажите название товара');
 if(!row.spec?.trim())errors.push('Укажите характеристики товара');
 if(!Number.isFinite(Number(row.quantity))||Number(row.quantity)<=0||!Number.isInteger(Number(row.quantity)))errors.push('Количество должно быть целым положительным числом');
 if(!Number.isFinite(Number(row.price))||Number(row.price)<=0)errors.push('Цена должна быть больше нуля');
 if(!row.deadline||!/^\d{4}-\d{2}-\d{2}$/.test(row.deadline)||Number.isNaN(Date.parse(row.deadline))||new Date(row.deadline).toISOString().slice(0,10)!==row.deadline)errors.push('Укажите дату в формате ГГГГ-ММ-ДД');
 return errors;
}
export function parseNeeds(text, filename='data.csv'){
 let rows;
 if(filename.toLowerCase().endsWith('.json')){rows=JSON.parse(text);if(!Array.isArray(rows))rows=rows.needs;}
 else {
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const sep=lines[0].includes(';')?';':',';
  const parse=line=>{const values=[];let field='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){values.push(field.trim());field='';}else field+=c;}values.push(field.trim());return values;};
  const headers=parse(lines.shift());rows=lines.filter(l=>l.trim()).map(l=>Object.fromEntries(parse(l).map((v,i)=>[headers[i],v])));
 }
 if(!Array.isArray(rows)||!rows.length)throw new Error('В файле не найдено позиций');
 if(rows.length>100)throw new Error('Можно загрузить до 100 позиций за один раз');
 return rows.map((r,i)=>{const row={...r,name:String(r.name??r['Товар']??''),spec:String(r.spec??r['Характеристики']??''),quantity:Number(r.quantity??r['Количество']),price:Number(String(r.price??r['Цена']??'').replace(',','.')),deadline:r.deadline??r['Срок'],unit:r.unit??r['Единица']??'шт.'};const e=validateNeed(row);if(e.length)throw new Error(`Строка ${i+1}: ${e.join('. ')}`);return row;});
}
export function matchNeed(need,offers){return offers.find(o=>o.name.toLocaleLowerCase('ru')===need.name.toLocaleLowerCase('ru')&&o.spec.toLocaleLowerCase('ru')===need.spec.toLocaleLowerCase('ru')&&(!need.unit||need.unit===o.unit)&&o.deliveryDate<=need.deadline)||null;}
