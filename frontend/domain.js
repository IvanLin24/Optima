// Synthetic scenario, not supplier quotes. All amounts in RUB, tax included.
export const offers = [
  { id: 'paper', name: 'Бумага для офиса A4', detail: '80 г/м² · 500 листов · белизна 146% CIE', category: 'Офис', unit: 'пачек', priceUnit: 'пачку', min: 5, step: 5, max: 500, others: 900, target: 1000, current: 320, next: 300, retail: 360, delivery: 600, retailDelivery: 1000, people: 8, days: 3, deadline: '21 октября, 18:00 МСК', supplier: 'ООО «Бумага и дело»', image: null, initial: 100, tag: 'Закупка для офиса' },
  { id: 'boxes', name: 'Коробки из гофрокартона', detail: '400 × 300 × 300 мм · Т-23 · бурые', category: 'Упаковка', unit: 'штук', priceUnit: 'штуку', min: 50, step: 50, max: 2000, others: 3500, target: 4000, current: 49, next: 43, retail: 58, delivery: 1200, retailDelivery: 1400, people: 6, days: 5, deadline: '23 октября, 18:00 МСК', supplier: 'ООО «Форма упаковки»', image: null, initial: 500, tag: '' },
  { id: 'soap', name: 'Жидкое мыло, 5 л', detail: 'Нейтральное · без красителей · канистра', category: 'Гигиена', unit: 'канистр', priceUnit: 'канистру', min: 4, step: 4, max: 200, others: 160, target: 200, current: 460, next: 410, retail: 540, delivery: 700, retailDelivery: 1000, people: 5, days: 4, deadline: '22 октября, 18:00 МСК', supplier: 'ООО «Чистая среда»', image: null, initial: 40, tag: '' },
  { id: 'tape', name: 'Упаковочная лента', detail: '48 мм × 66 м · прозрачная · 45 мкм', category: 'Упаковка', unit: 'рулонов', priceUnit: 'рулон', min: 6, step: 6, max: 600, others: 420, target: 600, current: 78, next: 66, retail: 93, delivery: 500, retailDelivery: 800, people: 4, days: 6, deadline: '24 октября, 18:00 МСК', supplier: 'ООО «Форма упаковки»', image: null, initial: 180, tag: '' },
];
export const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' ₽';
export function quantityError(offer, quantity) {
  if (!Number.isSafeInteger(quantity)) return 'Введите целое количество.';
  if (quantity < offer.min) return `Минимум — ${offer.min} ${offer.unit}.`;
  if (quantity > offer.max) return `Максимум — ${offer.max} ${offer.unit}.`;
  if (quantity % offer.step) return `Количество должно быть кратно ${offer.step}.`;
  return '';
}
export function calculate(offer, quantity) {
  const error = quantityError(offer, quantity);
  if (error) return { error };
  const projected = offer.others + quantity;
  const price = projected >= offer.target ? offer.next : offer.current;
  const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const goods = roundMoney(quantity * price);
  const baseline = roundMoney(quantity * offer.retail + offer.retailDelivery);
  const fee = roundMoney(Math.max(0,baseline-goods-offer.delivery) * 0.03);
  const total = roundMoney(goods + fee + offer.delivery);
  return { error: '', projected, price, goods, fee, total, baseline, saving: roundMoney(baseline - total), percent: (baseline - total) / baseline * 100 };
}
