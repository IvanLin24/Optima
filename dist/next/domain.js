/** Optima Core v2. All money is in integer kopecks; formatting only at the UI boundary. */
export const number = n => new Intl.NumberFormat('ru-RU').format(n);
export const rub = kopecks => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(kopecks/100);
export const day = iso => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(`${iso}T12:00:00`));
export const percent = value => `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value)}%`;
export const esc = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
export function roundStep(quantity,step,min=step){return Math.max(min,Math.round(Number(quantity)/step)*step)}
/**
 * These are provisional quote comparisons, not offers to pay.
 * Server has final authority for supplier terms, volumes and prices.
 */
export function quote(offer,requestedQuantity){
 const qty=roundStep(requestedQuantity,offer.step,offer.minQuantity);
 const solo=qty*offer.retailUnitKop+offer.retailDeliveryKop;
 const collective=qty*offer.groupUnitKop+offer.groupDeliveryKop;
 const progress=clamp((offer.groupQuantity+qty)/offer.threshold*100,0,100);
 const ready=(offer.groupQuantity+qty)>=offer.threshold;
 return {offerId:offer.id,quantity:qty,retailTotalKop:solo,groupTotalKop:collective,
   savingKop:Math.max(0,solo-collective),savingPercent:solo?Math.max(0,(solo-collective)/solo*100):0,
   progress,ready,groupQuantity:offer.groupQuantity+qty,missing:Math.max(0,offer.threshold-offer.groupQuantity-qty),
   retailUnitKop:offer.retailUnitKop,groupUnitKop:offer.groupUnitKop,
   comparisonOnly:!ready,termsVersion:offer.termsVersion};
}
export function sumQuotes(offers){return offers.reduce((acc,o)=>{const q=quote(o,o.defaultQuantity);acc.savingKop+=q.savingKop;acc.groupTotalKop+=q.groupTotalKop;return acc},{savingKop:0,groupTotalKop:0})}
export function matchingOffers(need,offers){
 const words=need.name.toLocaleLowerCase('ru').split(/\W+/).filter(x=>x.length>3);
 return offers.filter(o=>o.unit===need.unit&&(need.offerId===o.id||words.some(w=>(o.name+' '+o.spec).toLocaleLowerCase('ru').includes(w))));
}
export function parseNeeds(text,filename){
 const clean=String(text||'').replace(/^\uFEFF/,'').trim();if(!clean)throw new Error('Файл пустой');
 let records=[];
 if(filename.toLowerCase().endsWith('.json')){
  const parsed=JSON.parse(clean);records=Array.isArray(parsed)?parsed:parsed.needs;
  if(!Array.isArray(records))throw new Error('В JSON ожидается массив потребностей');
 }else{
  const lines=clean.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('В CSV ожидаются заголовок и строки');
  const separator=lines[0].includes(';')?';':',';
  const keys=lines[0].split(separator).map(x=>x.trim().replace(/^"|"$/g,''));
  const cells=line=>{const result=[];let value='',inside=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(inside&&line[i+1]==='"'){value+='"';i++}else inside=!inside}else if(char===separator&&!inside){result.push(value.trim());value=''}else value+=char;}result.push(value.trim());return result;};
  records=lines.slice(1).map(line=>Object.fromEntries(cells(line).map((value,i)=>[keys[i],value])));
 }
 if(records.length>100)throw new Error('Можно импортировать не более 100 позиций за раз');
 return records.map((r,i)=>{
   const name=String(r.name||r.товар||'').trim(),quantity=Number(r.quantity||r.количество),unit=String(r.unit||r.единица||'шт.').trim();
   if(!name||name.length>120||!Number.isFinite(quantity)||quantity<=0||quantity>1e7)throw new Error(`Ошибка в строке ${i+1}: нужны товар и положительное количество`);
   if(unit.length>20)throw new Error(`Слишком длинная единица в строке ${i+1}`);
   return {name,quantity,unit,spec:String(r.spec||r.характеристики||'').slice(0,180),deadline:String(r.deadline||r.срок||'').slice(0,10),source:'Импорт'};
 });
}
export function csvExport(rows){
 const cols=['number','name','quantity','unit','status','groupTotalRUB','savingRUB'];
 const escapeCSV=s=>`"${String(s??'').replace(/"/g,'""')}"`;
 return '\uFEFF'+[cols.join(';'),...rows.map(row=>cols.map(c=>escapeCSV(row[c])).join(';'))].join('\r\n');
}