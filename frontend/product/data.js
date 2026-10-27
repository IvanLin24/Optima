import { defaultProducts } from './supplier-model.js';
import { offers, calculate, money, quantityError } from '../domain.js';
export { offers, calculate, money, quantityError };
export const company = { name: 'ООО «Линия»', short: 'Линия', initials: 'ИЛ' };
export const supplier = { name: 'ООО «Бумага и дело»', short: 'Бумага и дело', initials: 'АБ' };
export const demoDirectory = [];
export const seedMessages = [
 {id:'m1',side:'member',name:'Мария К.',company:'Участник группы',initials:'МК',time:'10:14',text:'Подскажите, вся бумага будет одного артикула? Для нас важно, чтобы пачки не отличались по характеристикам.'},
 {id:'m2',side:'supplier',name:'Алексей Б.',company:'Поставщик',initials:'АБ',time:'10:18',text:'Да, один артикул и одна партия: A4, 80 г/м², по 500 листов в пачке. Приложил спецификацию.',attachment:'Спецификация_A4.pdf'},
 {id:'m3',side:'buyer',name:'Иван Л.',company:'Линия',initials:'ИЛ',time:'10:26',text:'Наш объём — 100 пачек. Сможем получить 29 октября? Адрес и контакт получателя передам отдельно.'},
 {id:'m4',side:'supplier',name:'Алексей Б.',company:'Поставщик',initials:'АБ',time:'10:32',text:'Согласовали поставку на 29 октября. Цена и характеристики остаются прежними. Обновил условия — проверьте, пожалуйста, новую дату.'},
 {id:'e1',event:true,text:'Обновлены условия закупки',detail:'Версия 2 · поставка 27 → 29 октября',action:'conditions'},
];
export const baseState = () => ({
 schema:3, role:'buyer', ownQuantity:100, joined:true, accepted:false, signatures:{buyer:false,supplier:false}, paid:false, received:false,
 saved:[], needs:[], messages:{group:[],private:[]}, drafts:{group:'',private:''}, comments:[], issues:[], tasks:[], readMessages:false,
 vendorProducts:defaultProducts(), vendorOffers:[], deals:[], notificationsRead:false, delivery:{city:'Москва',address:'',contact:'',interval:'09:00–18:00'}, events:[],
});
export const quote = state => calculate(offers[0], state.ownQuantity);
export const groupVolume = state => offers[0].others + (state.joined ? state.ownQuantity : 0);
export function canAccept(state){return state.joined && !quantityError(offers[0],state.ownQuantity) && groupVolume(state)>=offers[0].target;}
export const documentStatus = state => !state.accepted?'На согласовании':state.signatures.buyer&&state.signatures.supplier?'Подписан сторонами':state.signatures[state.role]?'Ожидается другая сторона':'Требуется подпись';
export const orderStatus = state => state.issues.some(i=>i.status!=='Урегулировано')?'Есть обращение':state.received?'Получен':state.paid?'Ожидается поставка':state.accepted?'Оформлен':'Проверка условий';
