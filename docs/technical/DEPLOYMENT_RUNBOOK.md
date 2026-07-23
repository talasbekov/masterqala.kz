# Развёртывание и эксплуатация бесплатного пилота

Документ описывает переход от текущего development-запуска к первой публичной версии `FREE_PILOT`.

## 1. Текущее состояние репозитория

Монорепозиторий использует `pnpm`:

- `apps/api` — NestJS API;
- `apps/web` — Vite + React PWA;
- PostgreSQL + PostGIS;
- pg-boss использует ту же PostgreSQL-базу;
- файлы сохраняются на локальный диск;
- `docker-compose.yml` поднимает только development и test базы;
- production Dockerfile, reverse proxy, production compose/manifest и полноценные readiness probes пока не зафиксированы.

Development-порты:

- API: `3000`;
- Vite: `5173`;
- PostgreSQL: `5432`;
- test PostgreSQL: `5433`.

## 2. Рекомендуемая архитектура пилота

Для первого города допустима single-node схема:

```text
Internet
   │
   ▼
Reverse proxy / TLS
   ├── /api + Socket.IO ──► NestJS API :3000
   └── /                ──► статическая сборка React PWA
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          PostgreSQL + PostGIS          private upload volume
          + schema pgboss
```

Ограничения single-node:

- один API-инстанс;
- локальное файловое хранилище;
- downtime при некоторых обновлениях;
- сервер является единой точкой отказа.

Для пилота это допустимо только при наличии ежедневных резервных копий и проверенной процедуры восстановления.

## 3. Окружения

Минимум три независимых окружения:

| Окружение | Назначение | Данные |
|---|---|---|
| local | разработка | синтетические |
| staging | приёмка релиза | синтетические/обезличенные |
| production | бесплатный пилот | реальные |

Запрещено:

- использовать production-БД для разработки;
- копировать документы мастеров в local/staging;
- использовать одинаковые JWT/SMS/DB секреты;
- запускать seed, создающий тестовых пользователей, без явного контроля в production.

## 4. Требования к серверу

Перед развёртыванием:

- Linux с поддерживаемой версией и обновлениями безопасности;
- Node.js-версия зафиксирована в `.nvmrc` или container image;
- `pnpm` зафиксированной версии;
- PostgreSQL 16 + PostGIS 3.4 или совместимая проверенная версия;
- reverse proxy с WebSocket proxying;
- домен и TLS;
- отдельный непривилегированный системный пользователь;
- persistent volume для PostgreSQL;
- persistent private volume для uploads;
- внешний backup target;
- синхронизация времени;
- firewall.

Минимальные открытые порты:

- `80/tcp` — только для redirect/ACME;
- `443/tcp` — приложение;
- SSH — только с доверенных адресов или через VPN.

PostgreSQL `5432` не публикуется в интернет.

## 5. Production-переменные окружения

Текущие и необходимые переменные:

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
JWT_SECRET=<strong-random-secret>
OPERATOR_PHONE=<controlled-operator-phone>
UPLOAD_DIR=/var/lib/masterqala/uploads
PGBOSS_DISABLED=0
COMMERCIAL_MODE=FREE_PILOT
CORS_ORIGINS=https://masterqala.kz
```

Параметры будущей тарификации могут оставаться заданными для аналитического расчёта:

```env
PRICING_BASE_FARE=...
PRICING_PER_KM=...
SERVICE_FEE_RATE=...
SERVICE_FEE_MIN=...
```

Они не должны приводить к списанию денег в `FREE_PILOT`.

Дополнительно потребуются настройки реального SMS-провайдера. Dev-реализация, печатающая код в лог, запрещена в production.

## 6. Подготовка репозитория к production

До первой выкладки необходимо добавить:

1. конфигурационную schema-валидацию;
2. реализацию `COMMERCIAL_MODE`;
3. production build/release script;
4. systemd unit либо Dockerfile/compose;
5. reverse proxy config с WebSocket;
6. migration job;
7. liveness/readiness checks;
8. backup scripts;
9. log rotation;
10. CI pipeline.

## 7. Сборка

Рекомендуемая последовательность в CI или release-каталоге:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter web build
```

Перед этим test PostgreSQL должен быть доступен, а e2e запускаются с отдельным `DATABASE_URL`.

Артефакты:

- API: `apps/api/dist`;
- frontend: `apps/web/dist`;
- Prisma schema и migrations;
- lockfile и production package metadata.

## 8. Миграции

Для production применяется:

```bash
pnpm --filter api prisma migrate deploy
```

Не использовать в production:

```bash
prisma migrate dev
prisma db push
```

Правила:

- backup выполняется до миграции;
- миграция сначала проверяется на staging-копии схемы;
- destructive migration требует отдельного плана;
- приложение не должно стартовать на несовместимой схеме;
- миграции и выкладка приложения должны иметь порядок, совместимый с rollback.

`pg-boss` создаёт собственную схему автоматически при запуске API. У пользователя БД должны быть необходимые права, но эти права не должны быть шире требуемого.

## 9. Первичная установка single-node

Пример логической последовательности:

1. создать системного пользователя `masterqala`;
2. создать каталоги release, shared uploads и logs;
3. установить PostgreSQL/PostGIS либо подключить managed database;
4. создать отдельного DB-пользователя приложения;
5. записать секреты вне репозитория с правами `600`;
6. развернуть release-артефакт;
7. выполнить `prisma migrate deploy`;
8. выполнить контролируемое заполнение справочника категорий и оператора;
9. запустить API;
10. разместить frontend build;
11. включить reverse proxy и TLS;
12. выполнить smoke test;
13. включить мониторинг и backup;
14. только после этого открыть внешний доступ.

## 10. Reverse proxy

Proxy должен поддерживать:

- HTTPS termination;
- HTTP/2 для web;
- WebSocket upgrade для Socket.IO;
- передачу корректных `X-Forwarded-*`;
- разумные timeout для realtime;
- ограничение размера request body;
- security headers;
- access log без токенов и персональных payload.

Маршрутизация:

```text
/api/*       → API :3000
/socket.io/* → API :3000 с Upgrade
/*           → apps/web/dist с SPA fallback
```

## 11. Запуск API

Production-команда после сборки:

```bash
node apps/api/dist/main.js
```

Процесс должен управляться systemd, container runtime или process supervisor.

Требования:

- автоматический restart при crash;
- graceful shutdown;
- ограничение памяти;
- журналирование stdout/stderr;
- restart rate limit;
- health monitoring.

Текущий код слушает порт `3000` без env-переменной. До production рекомендуется добавить `PORT` и bind address.

## 12. Smoke test после выкладки

### Технический

- `GET /api/v1/health` возвращает `200`;
- API подключается к БД;
- migrations применены;
- pg-boss стартовал без ошибок;
- upload volume доступен на запись;
- frontend загружается;
- PWA assets доступны;
- Socket.IO подключается через публичный домен;
- SMS доставляется тестовому номеру.

### Бизнесовый

1. клиент входит;
2. мастер входит и имеет `ACTIVE` профиль;
3. мастер становится онлайн;
4. клиент создаёт срочную заявку;
5. мастер получает и принимает оффер;
6. проходят статусы до закрытия;
7. в `FREE_PILOT` отсутствуют `PaymentTransaction` и `Accrual`;
8. мастер с нулевыми lead-кредитами оставляет плановый отклик;
9. покупка кредитов и вывод заблокированы;
10. оператор видит анкету и спор;
11. файлы недоступны постороннему пользователю.

## 13. Резервное копирование

Backup состоит минимум из двух согласованных частей:

1. PostgreSQL;
2. upload volume.

Пример backup БД:

```bash
pg_dump --format=custom --file=masterqala-YYYYMMDD-HHMM.dump "$DATABASE_URL"
```

Upload backup выполняется через snapshot, rsync или архивирование на внешний storage.

Рекомендуемая политика пилота:

- ежедневный полный backup;
- дополнительный backup перед каждой миграцией;
- хранение минимум нескольких дневных и недельных точек;
- шифрование backup;
- копия вне основного сервера;
- ежемесячная проверка восстановления.

Backup, который ни разу не восстанавливался, не считается рабочим.

## 14. Восстановление

Проверяемый сценарий:

1. поднять чистую PostgreSQL/PostGIS;
2. восстановить dump;
3. восстановить uploads в ожидаемый `UPLOAD_DIR`;
4. проверить migrations/version;
5. запустить API с закрытым внешним доступом;
6. проверить пользователей, заявки, фото, документы, споры и pg-boss;
7. выполнить smoke test;
8. переключить трафик.

Цели RPO/RTO должны быть утверждены владельцем продукта. Для первого пилота их необходимо зафиксировать до начала работы с реальными пользователями.

## 15. Наблюдаемость

Минимальные метрики:

### API

- доступность;
- p50/p95/p99 latency;
- 4xx/5xx;
- число активных WebSocket connections;
- reconnect rate;
- память/CPU;
- crash/restart count.

### PostgreSQL

- connections;
- disk usage;
- slow queries;
- locks;
- replication/backup status, если применимо;
- размер основной и `pgboss` схем.

### Бизнес

- созданные срочные/плановые заявки;
- доля `NO_MASTERS`;
- время до первого оффера и принятия;
- доля отмен;
- зависшие статусы;
- открытые споры;
- SMS delivery errors;
- заявки без realtime-синхронизации.

### Инфраструктура

- свободное место uploads;
- срок действия TLS;
- backup success;
- время последнего успешного restore test.

## 16. Алерты

Обязательные:

- API недоступен;
- readiness БД не проходит;
- 5xx выше порога;
- pg-boss не обрабатывает jobs;
- диск или volume заполнен;
- backup не выполнен;
- SMS-провайдер недоступен;
- резкий рост 401/429;
- очередь таймаутов растёт;
- появились финансовые записи при `FREE_PILOT`.

Последний alert является критическим инвариантом режима.

## 17. Обновление приложения

Рекомендуемый release workflow:

1. создать immutable release;
2. пройти CI;
3. backup;
4. применить backward-compatible migrations;
5. запустить новый API;
6. проверить readiness;
7. переключить трафик/перезапустить процесс;
8. проверить smoke test;
9. сохранить предыдущий release для rollback;
10. наблюдать ключевые метрики.

## 18. Rollback

Rollback приложения:

- вернуть предыдущий release;
- перезапустить процесс;
- проверить API и Socket.IO.

Rollback БД:

- Prisma migrations не следует автоматически откатывать в production;
- предпочтительны forward-fix и backward-compatible изменения;
- destructive migration восстанавливается только по отдельному плану или из backup;
- при несовместимости остановить трафик до восстановления согласованного состояния.

## 19. Инцидентный режим

При критической ошибке бесплатного пилота:

1. отключить создание новых заявок через feature flag или maintenance mode;
2. не прерывать уже назначенные работы без связи с участниками;
3. сообщить оператору список активных заказов;
4. сохранить логи и состояние очереди;
5. исправить или выполнить rollback;
6. вручную сверить зависшие заявки;
7. оформить postmortem.

Нужен отдельный способ экстренно показать пользователям сообщение о недоступности сервиса.

## 20. Критерии готовности к запуску

- [ ] `COMMERCIAL_MODE=FREE_PILOT` реализован и проверен;
- [ ] production secrets валидируются;
- [ ] CORS ограничен;
- [ ] HTTPS и WebSocket работают через домен;
- [ ] migrations выполняются через `deploy`;
- [ ] production и staging разделены;
- [ ] реальный SMS-провайдер подключён;
- [ ] uploads persistent и закрыты от прямого доступа;
- [ ] backup БД и файлов автоматизирован;
- [ ] restore test успешен;
- [ ] мониторинг и алерты включены;
- [ ] операторский smoke test пройден;
- [ ] ни один бесплатный сценарий не создаёт финансовые записи;
- [ ] есть rollback и контакт ответственного за инцидент.
