# Размещение — 27 октября 2026

Основной адрес: https://optima.casa/. Исходный дизайн-прототип, вход по коду из почты и серверное сохранение. /workspace перенаправляется на главную. Swagger: /docs, все API: /openapi.json.

Ubuntu 22.04, Nginx, Docker, PostgreSQL 17. API слушает только 127.0.0.1:8000; БД наружу не опубликована. Сертификат домена Let's Encrypt, автоматическое продление. Резервные копии БД по таймеру.

Текущий релиз: /opt/procurement/current → releases/20261027-v5. Фронт: /var/www/optima/current. Секреты: /etc/procurement/backend.env, права 0600. При обновлении сохранять OTP_SECRET, БД и действующие конфигурации Nginx. Не заменять конфигурацию домена шаблоном без блока прокси.

Telegram WEB proxy размещён отдельно: /opt/telegram-webproxy, unit telegram-webproxy.service. Публичный путь /telegram/web/, служебные порты 19590–19592 доступны только через loopback. Выход напрямую с VPS. Программный лимит скорости не задан; действуют ресурсы и канал сервера. Приватная ссылка находится в /opt/telegram-webproxy/connection.txt (0600), не публиковать её в исходниках. Необходим клиент с поддержкой WEB proxy.

```bash
cd /opt/procurement/current
docker compose -p procurement -f compose.yaml -f deploy/compose.host.yaml ps
docker compose -p procurement -f compose.yaml -f deploy/compose.host.yaml logs --tail 80 api
docker compose -p procurement -f compose.yaml -f deploy/compose.host.yaml up --build -d
systemctl list-timers 'procurement-*'
```

Таймеры: `procurement-expiry.timer` проверяет срок согласований каждую минуту; `procurement-certificate.timer` проверяет продление HTTPS дважды в сутки; `procurement-backup.timer` сохраняет БД ежедневно в 03:15 Москвы. Архивы в `/var/backups/procurement`, доступны только root; автоматического удаления нет. Ручная копия: `systemctl start procurement-backup.service`.

Стенд работает в режиме `APP_ENV=demo`, `ENABLE_DEMO=true`. «Открыть демо без регистрации» создаёт отдельную синтетическую компанию. После отдельного принятия условий «Подготовить демонстрацию» импортирует три тестовые выписки и ответы двух вымышленных партнёров. Свой ответ и подтверждение выполняет пользователь; партнёры и поставщик моделируются явно подписанными тестовыми кнопками.

Настоящая почта пока не подключена: `MAIL_MODE=file`. Обычная регистрация требует подтверждения из письма, которое пока читает администратор в `/app/var/mail` API-контейнера. После получения домена и SMTP-реквизитов обновить MAIL_MODE, MAIL_FROM, SMTP_HOST/PORT/USERNAME/PASSWORD, FRONTEND_URL, CORS_ORIGINS в приватном env и пересоздать API. Электронной подписи и реальных платежей нет.

На Ubuntu собран Docker-образ, приложение и БД healthy, миграции соответствуют модели. На отдельной PostgreSQL-базе прошли 32 теста. Исправлен подсчёт повторов импорта через INSERT RETURNING вместо rowcount.

В браузере проверены исходный прототип, демо-вход, согласие, импорт, вопросы, документ, подтверждения всех сторон, активация, сохранение после перезагрузки, предложение новой даты и отказ от изменения с сохранением действующих условий. Desktop и mobile проверены; переполнения страницы нет. Резервное копирование выполнено успешно, проверка продления HTTPS через Certbot dry-run прошла.
