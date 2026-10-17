# Optima Next — API contract для команды бэкенда

## Слой интеграции

Новый интерфейс **не зависит от прежнего frontend**. UI вызывает `api` из `dist/next/api.js` и не содержит прямых `fetch` к внешним ресурсам. Локально по умолчанию используется `mockApi` (localStorage), а для настоящего сервера перед подключением `app.js` необходимо установить:

```html
<script>window.OPTIMA_API_BASE = '/api/v1';</script>
<script type="module" src="app.js"></script>
```

Файлы `domain.js`, `api.js` и `mock-api.js` содержат только данные/логику и были взяты из независимой V2, визуальный код старой версии **не импортируется**.

Рекомендуемое подключение: единый origin, reverse proxy `/api/v1`, server-side сессия в `HttpOnly; Secure; SameSite` cookie. Нельзя передавать URL API через произвольный query parameter или хранить секреты в localStorage.

## Конечные точки

| HTTP | URI | Тело запроса | Ответ |
|---|---|---|---|
| GET | `/api/v1/bootstrap` | — | `{company,offers,orders,needs,history,serverTime,demo}` |
| POST | `/api/v1/quotes` | `{offerId,quantity}` | `Quote` |
| POST | `/api/v1/orders` | `{offerId,quantity,termsVersion,accepted}` | `Order` |
| POST | `/api/v1/orders/:id/cancel` | — | обновленный `Order` |
| POST | `/api/v1/needs` | `{name,spec,quantity,unit,deadline}` | `Need` |
| POST | `/api/v1/needs/import` | `{needs: NeedInput[]}` | ответ с импортированными позициями |
| DELETE | `/api/v1/needs/:id` | — | результат удаления |

Запись заказа и потребности сопровождается `Idempotency-Key` на стороне HTTP-клиента. Бэкенд должен дедуплицировать повторные запросы и реализовать защиту от CSRF.

## Типы данных

```ts
type Offer = {
  id:string; sku:string; name:string; spec:string;
  category:string; unit:string; supplier:string; supplierCode:string;
  minQuantity:number; step:number; defaultQuantity:number;
  retailUnitKop:number; groupUnitKop:number;
  retailDeliveryKop:number; groupDeliveryKop:number;
  groupQuantity:number; threshold:number; participants:number;
  deadline:string; deliveryDate:string; termsVersion:string;
  art:'paper'|'bags'|'labels'|'gloves'|'coffee'|'film';
}
type Quote = {
  offerId:string; quantity:number;
  retailTotalKop:number; groupTotalKop:number;
  savingKop:number; savingPercent:number; progress:number;
  ready:boolean; groupQuantity:number; missing:number;
  retailUnitKop:number; groupUnitKop:number;
  comparisonOnly:boolean; termsVersion:string;
}
type Order = {
  id:string; number:string; offerId:string; quantity:number;
  status:'collecting'|'threshold_reached'|'supplier_confirmed'|'cancelled';
  createdAt:string; quote:Quote; termsVersion:string;
}
type Need = {
  id:string; offerId?:string|null; name:string;
  spec:string; quantity:number; unit:string; deadline?:string; source:string;
}
```

### Принципы

1. **Суммы — целые копейки**, скидки и доставка считаются на сервере. `savingKop = max(0,retailTotalKop - groupTotalKop)` в демомодели; НДС, персональные условия поставщика и точность цены будущий сервер должен определить явно.
2. Состав участников закупки не раскрывается другим компаниям: только общие показатели. Не раскрывать идентификаторы компаний-участников.
3. Сведения каталога, остатки, пороги, доступность условий, `termsVersion`, статус заявки и подтверждение поставщика — **истина сервера**. Не доверять браузерной `quote` и `quantity`.
4. На изменение версии условий при записи заказа вернуть `409` с новой версией и инструкцией повторить quote. Для неточной/истекшей цены не проводить создание заявки.
5. Сначала реализовать **настоящий previewQuote и bootstrap**, затем подтверждение заявки и потребности. В V2 mock `threshold_reached` означает лишь модель достижения порога, а не фактическую закупку.
6. Проверять права текущей компании во всех запросах и использовать аудит заявок и отмен. Никаких реальных платежей этот frontend не запускает.
7. Импорт CSV/JSON ограничить объёмом, количеством строк и типами значений, а ответы ошибок стандартизировать как `{"code":"...","message":"..."}`.

## План совместной разработки

Этап A: `bootstrap`, каталог, данные компании, GET состояния групп. Этап B: валидируемые quote-снапшоты с фиксированной датой истечения и правами текущей компании. Этап C: POST/отмена orders, история и аудиторские события. Этап D: потребности, matching, импорт и аналитика. После интеграции можно убрать mock-режим и клиентское сохранение заявок.