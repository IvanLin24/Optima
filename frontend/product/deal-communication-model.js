export const issueReasons=['Не хватает товара','Повреждение товара или упаковки','Не совпадают характеристики','Нарушен срок поставки','Другой вопрос по заказу'];
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const validId=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
export const defaultDealCommunication=()=>({messages:{group:[],private:[]},drafts:{buyer:{group:'',private:''},supplier:{group:'',private:''}},read:{buyer:{group:null,private:null},supplier:{group:null,private:null}},issues:[]});
export const openDealIssues=d=>(d.issues||[]).filter(i=>i.status!=='resolved');
export function hydrateDealCommunication(raw,quantity){
 const result=defaultDealCommunication();
 for(const channel of ['group','private']){
  const seen=new Set();
  result.messages[channel]=(Array.isArray(raw.messages?.[channel])?raw.messages[channel]:[]).filter(m=>m&&validId(m.id)&&!seen.has(m.id)&&seen.add(m.id)&&['buyer','supplier'].includes(m.side)&&clean(m.text,4000)).slice(-200).map(m=>({id:m.id,side:m.side,text:clean(m.text,4000),time:clean(m.time,40),replyTo:validId(m.replyTo)?m.replyTo:null}));
  const ids=new Set(result.messages[channel].map(m=>m.id));
  result.messages[channel].forEach(m=>{if(!ids.has(m.replyTo))m.replyTo=null;});
  for(const role of ['buyer','supplier']){
   result.drafts[role][channel]=typeof raw.drafts?.[role]?.[channel]==='string'?raw.drafts[role][channel].slice(0,4000):'';
   const read=raw.read?.[role]?.[channel];result.read[role][channel]=ids.has(read)?read:null;
  }
 }
 const seenIssues=new Set();
 result.issues=(Array.isArray(raw.issues)?raw.issues:[]).filter(i=>i&&validId(i.id)&&!seenIssues.has(i.id)&&seenIssues.add(i.id)&&issueReasons.includes(i.reason)&&clean(i.description,2000)).slice(0,100).map((i,index)=>{
  const response=clean(i.response?.text,2000)?{text:clean(i.response.text,2000),time:clean(i.response.time,40)}:null;
  return {id:i.id,number:Number.isSafeInteger(i.number)&&i.number>0?i.number:index+1,reason:i.reason,description:clean(i.description,2000),actualQuantity:Number.isSafeInteger(i.actualQuantity)&&i.actualQuantity>=0&&i.actualQuantity<=quantity?i.actualQuantity:null,time:clean(i.time,40),response,status:response?i.status==='resolved'?'resolved':'answered':'open',resolvedAt:response&&i.status==='resolved'?clean(i.resolvedAt,40):''};
 });
 return result;
}
export function unreadDealMessages(d,role,channel){
 const rows=d.messages?.[channel]||[],last=d.read?.[role]?.[channel],index=rows.findIndex(m=>m.id===last);
 return rows.slice(index+1).filter(m=>m.side!==role).length;
}
export function communicationTransition(d,role,a,stamp){
 if(!['deal-message','deal-draft','deal-read','deal-issue','deal-issue-response','deal-issue-resolve'].includes(a.type))return false;
 if(!d.messages)Object.assign(d,defaultDealCommunication());
 if(['deal-message','deal-draft','deal-read'].includes(a.type)){
  if(!['group','private'].includes(a.channel))throw Error('Выберите разговор.');
  const rows=d.messages[a.channel];
  if(a.type==='deal-read'){d.read[role][a.channel]=rows.at(-1)?.id||null;return true;}
  if(a.type==='deal-draft'){d.drafts[role][a.channel]=typeof a.text==='string'?a.text.slice(0,4000):'';return true;}
  const body=clean(a.text,4000);if(!body)throw Error('Напишите сообщение.');
  if(typeof a.text!=='string'||a.text.length>4000)throw Error('Сообщение должно быть не длиннее 4 000 символов.');
  if(a.replyTo&&!rows.some(m=>m.id===a.replyTo))throw Error('Сообщение для ответа не найдено в этом разговоре.');
  rows.push({id:'msg-'+crypto.randomUUID(),side:role,text:body,time:stamp(),replyTo:a.replyTo||null});
  d.messages[a.channel]=rows.slice(-200);d.drafts[role][a.channel]='';d.read[role][a.channel]=rows.at(-1).id;return true;
 }
 if(!d.accepted)throw Error('Обращение создаётся по оформленному заказу.');
 if(a.type==='deal-issue'){
  if(role!=='buyer')throw Error('Обращение создаёт покупатель.');
  if(d.issues.length>=100)throw Error('В демоверсии доступно до 100 обращений по заказу.');
  if(!issueReasons.includes(a.value?.reason))throw Error('Выберите причину обращения.');
  if(!clean(a.value.description,2000))throw Error('Опишите, что произошло.');
  const actual=a.value.actualQuantity===''||a.value.actualQuantity==null?null:Number(a.value.actualQuantity);
  if(a.value.reason==='Не хватает товара'&&(actual===null||!Number.isSafeInteger(actual)||actual<0||actual>=d.quantity))throw Error('Укажите фактически полученное количество от 0 до '+(d.quantity-1)+'.');
  d.issues.unshift({id:'issue-'+crypto.randomUUID(),number:d.issues.length+1,reason:a.value.reason,description:clean(a.value.description,2000),actualQuantity:a.value.reason==='Не хватает товара'?actual:null,time:stamp(),response:null,status:'open',resolvedAt:''});
  d.history.unshift({title:'Создано обращение: '+a.value.reason,time:stamp()});return true;
 }
 const issue=d.issues.find(i=>i.id===a.issueId);if(!issue||issue.status==='resolved')throw Error('Открытое обращение не найдено.');
 if(a.type==='deal-issue-response'){
  if(role!=='supplier')throw Error('Решение предлагает поставщик.');
  if(!clean(a.text,2000))throw Error('Опишите предлагаемое решение.');
  issue.response={text:clean(a.text,2000),time:stamp()};issue.status='answered';d.history.unshift({title:'Поставщик предложил решение по обращению №'+issue.number,time:stamp()});return true;
 }
 if(role!=='buyer')throw Error('Урегулирование подтверждает покупатель.');
 if(!issue.response)throw Error('Сначала дождитесь ответа поставщика.');
 issue.status='resolved';issue.resolvedAt=stamp();d.history.unshift({title:'Обращение №'+issue.number+' урегулировано покупателем',time:stamp()});return true;
}
