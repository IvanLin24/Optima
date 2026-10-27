# API Optima — текущая версия

Полное машинное описание всех методов: [openapi.json](openapi.json). На стенде: https://optima.casa/openapi.json, Swagger: https://optima.casa/docs. База `/api/v1`.

## Вход и виртуальная компания

1. `POST /auth/virtual-company` или `/auth/register`: `{email, password}`. Пароль 12–128 символов. Компания и её данные создаются **после кода**, не после первого запроса.
2. `POST /auth/login` или `/auth/request-code`: `{email}`. Вход по паролю отсутствует.
3. Ответ 202: `{challenge_id, expires_in: 600, resend_after: 60, message}`. Не раскрывает наличие аккаунта.
4. `POST /auth/verify-code`: `{email, challenge_id, code: "123456"}`. Ответ: `{access_token, token_type: "bearer", expires_in: 3600}`.
5. `POST /auth/resend-code`: `{email, challenge_id}`. Возвращает новое задание. Старый код недействителен. Работает и до создания компании.
6. `POST /auth/logout`: заголовок `Authorization: Bearer <access_token>`.

Код действует 10 минут, используется один раз, максимум 5 неверных попыток. Не отправлять код чаще раза в минуту; до 5 отправок одному адресу в час. На стенде глобальный предел 80 писем в сутки, чтобы оставаться в бесплатном лимите провайдера. Проверка известного одноразового домена и его поддоменов выполняется до отправки. Список: `app/data/disposable_domains.txt`, источник и лицензия — disposable-email-domains/disposable-email-domains. Неизвестные новые одноразовые домены список не гарантирует обнаружить.

API-ключ Resend хранится в приватном env на сервере и не передаётся браузеру. В БД хранится HMAC кода; для создания компании до подтверждения хранится только защищённый Argon2-хеш пароля. Письмо содержит код и кнопку открытия сайта с заполненным кодом. Данные передаются в URL fragment, удаляются из адресной строки при загрузке и не попадают в HTTP access log. Открытие ссылки не подтверждает код: нужен явный POST после нажатия «Подтвердить и войти». Старый `/auth/verify-email` и публичный `/demo/sessions` отвечают 410 CODE_REQUIRED.

## Исходный дизайн-прототип

Сайт работает на исходном интерфейсе Optima. Анонимный пользователь видит только вход/регистрацию. `/workspace` перенаправляется на главную; отдельного заменяющего кабинета нет.

- `GET /prototype/state`: `{company: {id,name,inn,email}, revision, state, companies, supplier, virtual, legally_binding}`.
- `PUT /prototype/state`: `{revision, state}` → `{revision, saved_at}`. `state.schema` = 3, role buyer/supplier. 409 STATE_CONFLICT при изменениях в другой вкладке. Размер состояния до 2 МБ.

Исходные сценарии потребностей, сообщений, согласования, смены роли, демо-оплаты и приёмки сохраняются в состоянии конкретной виртуальной компании. Показатель «Сохранено на сервере» подтверждает ответ API. Данные пользователей изолированы по company_id; идентификатор владельца сервер берёт из сессии.

## Район и базы бизнесов

`GET /prototype/scene` создаёт при первом открытии личный демонстрационный район и возвращает:

- `businesses`: 40 карточек с id, name, category, address, latitude, longitude, revision, operation_count, need_count, contract_count, balance_minor.
- `catalog`: товары paper, boxes, coffee, cups, soap с ценами в копейках, оптовыми минимумами и поставщиками.
- `totals`: число бизнесов, операций и открытых потребностей.
- `boundary`: GeoJSON Тверского района из OpenStreetMap/Nominatim; attribution указан в ответе.
- `deals`: совместные закупки и история их состояний.

При начальном заполнении: 40 бизнесов, 480 операций, 40 потребностей, 3 исторических закупки. Компании и операции синтетические, география района реальная. Набор каждого вошедшего пользователя независим от чужих демонстраций. Отдельный набор данных каждого бизнеса хранится в PostgreSQL, отдельный физический сервер/БД для каждой карточки не создаётся.

| Метод | Путь относительно `/prototype/scene` | Данные |
|---|---|---|
| GET | `/businesses/{id}` | Карточка + data: operations, needs, inventory, contacts, contracts, balance_minor |
| POST | `/businesses` | `{name,category,address,latitude,longitude}` |
| POST | `/businesses/{id}/needs` | `{sku,quantity,delivery_date}`; дата строго будущая |
| POST | `/businesses/{id}/operations` | `{sku,quantity}`; сумма по тестовой розничной цене, меняется демо-баланс |
| POST | `/deals` | `{sku,delivery_date}`; сервер собирает открытые потребности одного товара и даты |
| POST | `/deals/{id}/advance` | `{revision}`; переход ready → confirmed → paid → delivered |
| GET | `/deals/{id}/document` | Markdown-проект соглашения |

Совместная закупка требует минимум две компании и оптовый объём. После включения потребность становится matched и не используется повторно. Суммы и комиссия считаются на сервере: 3% положительной экономии, округление по каждой доле до копейки. На шаге paid создаются тестовые платежи в историях участников и меняются их демонстрационные балансы. Статусы и ревизии защищены от повторных/устаревших действий. Все эти действия моделируются и не выполняют банковских переводов или юридического подписания.

## Остальные методы

Импорт: `/consents/current`, `/consents`, `/statement-imports`, `/statement-imports/{id}`, `/transactions`. Импортируется 1С TXT UTF-8/Windows-1251 до 5 МБ с проверкой ИНН и устранением дублей; ошибки строк возвращаются отдельно.

Подробные операции существующего контрактного API: `/contracts`, `/contracts/{id}`, `/contracts/{id}/versions`, `/contracts/{id}/events`, `/contracts/{id}/documents`, `/documents/{id}/download`, `/questions`, `/questions/{id}`, `/questions/{id}/answers`, `/signature-tasks`, `/signature-tasks/{id}`, `/signature-tasks/{id}/sign`, `/signature-tasks/{id}/reject`, `/contracts/{id}/amendments`. Схемы запросов и ответов — в OpenAPI.

## Общие соглашения

Деньги — целые копейки, валюта RUB. Даты поставки в сцене — YYYY-MM-DD; окна контрактного API — ISO 8601 с часовым поясом. Unix seconds: created_at, expires_at, saved_at. Для списков контрактного API используется `{items,next_cursor}` и параметры limit/cursor.

Ошибка: `{error:{code,message,fields},request_id}`. 401 — нужен вход; 403 — согласие/доступ; 404 — нет ресурса или доступа; 409 — конфликт версии/состояния/оптового объёма; 413 — большой файл; 422 — ввод или одноразовая почта; 429 — лимит; 503 — отправка письма недоступна. В ответах об ошибках исходные коды, пароли и ключи не отражаются.
