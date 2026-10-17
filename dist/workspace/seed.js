/** Demo data is fictional; no connected bank accounts, documents or transactions. */
export function seed(){return {
 version:1,nextId:110,company:{name:'ООО «Север»',contact:'Анна Смирнова',email:'finance@sever.example',role:'Администратор',inn:'7700000000'},
 purchases:[
 {id:'PR-2401',title:'Вода питьевая, 19 л',description:'Для офиса · еженедельная поставка',supplier:'АкваРегион',category:'Для офиса',sku:'WTR-19L',unit:'бут.',quantity:120,collectedQty:310,thresholdQty:400,participants:8,singlePriceKop:48000,groupPriceKop:39000,deliveryKop:75000,delivery:'2026-10-21',created:'2026-10-11',status:'negotiating',icon:'water'},
 {id:'PR-2402',title:'Бумага офисная A4',description:'80 г/м² · 500 листов',supplier:'ОфисСнаб',category:'Канцелярия',sku:'A4-500',unit:'пач.',quantity:20,collectedQty:86,thresholdQty:100,participants:6,singlePriceKop:53000,groupPriceKop:40000,deliveryKop:35000,delivery:'2026-10-25',created:'2026-10-13',status:'collecting',icon:'paper'},
 {id:'PR-2403',title:'Курьерские пакеты',description:'250 × 350 мм, 50 мкм',supplier:'ПакетПро',category:'Упаковка',sku:'PK-2535',unit:'шт.',quantity:1000,collectedQty:10000,thresholdQty:10000,participants:9,singlePriceKop:350,groupPriceKop:270,deliveryKop:35000,delivery:'2026-10-27',created:'2026-10-14',status:'contract',icon:'parcel'},
 {id:'PR-2404',title:'Перчатки нитриловые',description:'Размер M · коробка 100 шт.',supplier:'ПрофСнаб',category:'Хозяйственные товары',sku:'NT-M100',unit:'уп.',quantity:30,collectedQty:220,thresholdQty:200,participants:5,singlePriceKop:80000,groupPriceKop:65000,deliveryKop:45000,delivery:'2026-10-20',created:'2026-10-09',status:'fulfillment',icon:'gloves'},
 {id:'PR-2398',title:'Бумажные полотенца',description:'Двухслойные, 200 листов',supplier:'Чистый Дом',category:'Хозяйственные товары',sku:'TWL-200',unit:'уп.',quantity:80,collectedQty:420,thresholdQty:400,participants:7,singlePriceKop:23000,groupPriceKop:18000,deliveryKop:20000,delivery:'2026-10-09',created:'2026-10-01',status:'delivered',icon:'paper'},
 ],
 questions:[
 {id:'Q-101',purchaseId:'PR-2401',title:'Перенести поставку воды на четверг?',body:'Поставщик может привезти воду 22 октября одной машиной вместо поставки в среду. Цена и объём остаются прежними.',proposedDelivery:'2026-10-22',status:'pending',created:'2026-10-17',from:'АкваРегион',importance:'high'},
 {id:'Q-102',purchaseId:'PR-2402',title:'Подтвердите возможность замены упаковки',body:'Поставщик предлагает стандартную транспортную коробку вместо усиленной. Стоимость не меняется. Для изменения потребуется отдельное подтверждение условий.',proposedDelivery:null,status:'pending',created:'2026-10-16',from:'ОфисСнаб',importance:'normal'},
 {id:'Q-103',purchaseId:'PR-2404',title:'Удобно ли принять поставку после 14:00?',body:'Предварительное уточнение окна разгрузки. Это не меняет условия действующего контракта.',proposedDelivery:null,status:'accepted',created:'2026-10-15',from:'ПрофСнаб',importance:'normal'},
 ],
 contracts:[
 {id:'CT-501',number:'ОП-2026/501',purchaseId:'PR-2403',kind:'main',version:1,status:'review',title:'Поставка курьерских пакетов',description:'Товар, стоимость, сроки и условия поставки по общей партии.',proposedDelivery:null,oldDelivery:'2026-10-27',amountKop:305000,created:'2026-10-16',supplier:'ПакетПро'},
 {id:'CT-497',number:'ОП-2026/497',purchaseId:'PR-2404',kind:'main',version:1,status:'confirmed',title:'Поставка нитриловых перчаток',description:'Подтверждение условий демонстрационной поставки.',proposedDelivery:null,oldDelivery:'2026-10-20',amountKop:1995000,created:'2026-10-12',supplier:'ПрофСнаб',confirmedAt:'2026-10-13',confirmedBy:'Анна Смирнова'},
 ],
 payments:[
 {id:'TX-901',purchaseId:'PR-2404',title:'Оплата поставки перчаток',sumKop:1995000,status:'executed',date:'2026-10-13',reference:'ДЕМО-901'},
 {id:'TX-902',purchaseId:'PR-2403',title:'Платёж по курьерским пакетам',sumKop:305000,status:'scheduled',date:'2026-10-27',reference:'ДЕМО-902'},
 {id:'TX-903',purchaseId:'PR-2398',title:'Оплата бумажных полотенец',sumKop:1460000,status:'executed',date:'2026-10-07',reference:'ДЕМО-903'},
 ],
 needs:[
 {id:'NEED-1',title:'Бумага для принтера A4',quantity:20,unit:'пач.',deadline:'2026-10-25',status:'matched'},
 {id:'NEED-2',title:'Вода питьевая 19 л',quantity:120,unit:'бут.',deadline:'2026-10-22',status:'matched'},
 {id:'NEED-3',title:'Термобумага для чеков',quantity:60,unit:'рул.',deadline:'2026-11-05',status:'matching'},
 ],
 supplierOffers:[
 {id:'OFFER-12',title:'Курьерские пакеты',category:'Упаковка',thresholdQty:10000,collectedQty:10000,groupPriceKop:270,singlePriceKop:350,unit:'шт.',promoted:true,published:true},
 {id:'OFFER-13',title:'Стрейч-плёнка 500 мм',category:'Упаковка',thresholdQty:200,collectedQty:175,groupPriceKop:32000,singlePriceKop:43000,unit:'рул.',promoted:false,published:true},
 {id:'OFFER-14',title:'Клейкая упаковочная лента',category:'Упаковка',thresholdQty:400,collectedQty:410,groupPriceKop:9500,singlePriceKop:12900,unit:'рул.',promoted:false,published:true}
 ],
 notifications:[
 {id:'NT-20',title:'Новый вопрос от «АкваРегион»',description:'Предлагают изменить дату поставки воды.',target:'questions',unread:true},
 {id:'NT-21',title:'Контракт ожидает подтверждения',description:'Условия поставки курьерских пакетов готовы к проверке.',target:'contracts',unread:true},
 {id:'NT-22',title:'Группа для пакетов набрана',description:'Порог 10 000 шт. достигнут.',target:'purchases',unread:false},
 ],
 activity:[
 {id:'EV-23',date:'2026-10-17',verb:'Предложено изменение срока',details:'Поставка воды, 19 л'},
 {id:'EV-22',date:'2026-10-16',verb:'Подготовлен контракт',details:'Курьерские пакеты · ОП-2026/501'},
 {id:'EV-21',date:'2026-10-13',verb:'Добавлена закупка',details:'Бумага офисная А4'}
 ]
 }}
