import { offers, quantityError } from './data.js';

export const unresolvedIssues = s => s.issues.filter(i=>i.status!=='Урегулировано');
const isCalendarDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export const formatNeedDate=v=>isCalendarDate(v)?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date(v+'T12:00:00Z')):'Срок не указан';
export function validateNeed(n) {
 if(!String(n.name||'').trim())return 'Укажите товар и его характеристики.';
 if(!Number.isSafeInteger(Number(n.quantity))||Number(n.quantity)<1||Number(n.quantity)>1000000)return 'Количество — целое число от 1 до 1 000 000.';
 if(!['пачек','штук','канистр','рулонов','кг'].includes(n.unit))return 'Выберите единицу измерения.';
 if(!String(n.city||'').trim())return 'Укажите город получения.';
 if(!isCalendarDate(n.date))return 'Укажите корректную дату получения.';
 return '';
}

// A deliberately limited comparison against the available A4 group, not a search service.
export function matchPaperNeed(n) {
 const name=String(n.name||'').toLowerCase(),city=String(n.city||'').trim().toLowerCase();
 const format=name.match(/[aа]\s*[-–]?\s*([0-9])\b/iu);
 const density=name.match(/(\d{2,3})\s*г\s*(?:\/|на)\s*м[²2]/iu);
 const sheets=name.match(/(\d+)\s*лист/iu);
 const quantity=Number(n.quantity),error=quantityError(offers[0],quantity);
 const checks=[
  {label:'Товар и формат',value:format?'A'+format[1]:'Нужен формат A4',ok:format?format[1]==='4':null},
  {label:'Плотность',value:density?density[1]+' г/м²':'Уточните: 80 г/м²',ok:density?Number(density[1])===80:null},
  {label:'Листов в пачке',value:sheets?sheets[1]+' листов':'Уточните: 500 листов',ok:sheets?Number(sheets[1])===500:null},
  {label:'Количество',value:n.unit!=='пачек'?'Единица группы — пачки':error||quantity+' пачек',ok:n.unit==='пачек'&&!error},
  {label:'Получение',value:n.city||'Укажите город',ok:city?['москва','мск','московская область','москва и область'].includes(city):null},
  {label:'Срок',value:formatNeedDate(n.date),ok:n.date?isCalendarDate(n.date)&&n.date>='2026-10-29':null},
 ];
 if(!/бумаг|[aа]\s*[-–]?\s*[0-9]/iu.test(name))checks[0]={label:'Товар и формат',value:'Текущая группа закупает офисную бумагу A4',ok:false};
 const state=checks.some(c=>c.ok===false)?'incompatible':checks.some(c=>c.ok===null)?'review':'ready';
 return {state,checks};
}
