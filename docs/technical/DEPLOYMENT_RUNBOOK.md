# Развёртывание и эксплуатация бесплатного пилота

Документ описывает безопасную сборку, миграцию, запуск и откат первой публичной версии MasterQala.kz в режиме `FREE_PILOT`.

Фактическая реализация находится в PR #4. Специализированные smoke/SQL-проверки дополнительно описаны в `docs/pilot/FREE_PILOT_ROLLOUT.md` этого PR.

## 1. Текущее состояние

Монорепозиторий:

- `apps/api` — NestJS API;
- `apps/web` — React/Vite PWA;
- PostgreSQL 16 + PostGIS 3.4;
- pg-boss использует PostgreSQL;
- Socket.IO работает внутри API;
- Prisma управляет основной схемой;
- файлы сохраняются через storage abstraction, текущая реализация — local disk;
- `docker-compose.yml` поднимает development/test базы;
- production Dockerfile/compose/systemd unit и reverse proxy config пока не добавлены.

Порты разработки:

- API: `3000`;
- Vite: `5173`;
- development PostgreSQL: `5432`;
- test PostgreSQL: `5433`.

## 2. Статус готовности компонентов

| Компонент | Статус |
|---|---|
| `COMMERCIAL_MODE=FREE_PILOT` | реализован в PR #4 |
| неизменяемый режим заявки | реализован |
| миграция `CommercialMode` | реализована |
| public config endpoint | реализован |
| финансовые блокировки пилота | реализованы |
| HTTP/Socket.IO маскирование цены | реализовано |
| CI workflow | добавлен в PR #4 |
| подтверждённый успешный CI run | пока не подтверждён доступным connector |
| production container/systemd | не зафиксирован |
| CORS allowlist | не реализован |
| обязательный production JWT secret | не реализован |
| readiness зависимостей | не реализован |
| общий rate limit | не реализован |
| файловый security pipeline | не реализован |
| backup/restore automation | не добавлена в репозиторий |

PR #4 должен оставаться draft до подтверждённого CI и ручного smoke.

## 3. Рекомендуемая топология первого пилота

Для ограниченного запуска в одном городе допустима single-node схема:

```text
Internet
   │
   ▼
Reverse proxy / TLS
   ├── /api/*       ─────► NestJS API :3000
   ├── /socket.io/* ─────► NestJS API :3000 (Upgrade)
   └── /*            ─────► React static build
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          PostgreSQL + PostGIS          private upload volume
          + pgboss schema
```

Ограничения:

- один API-инстанс;
- сервер — единая точка отказа;
- локальные uploads не поддерживают горизонтальное масштабирование;
- часть обновлений требует короткого downtime;
- БД, API и файлы могут находиться на одном физическом сервере только для ограниченного пилота.

Single-node допустим только при:

- внешнем backup;
- проверенном restore;
- мониторинге диска;
- доступе по SSH-ключам;
- закрытой БД;
- понятном владельце инцидента.

## 4. Окружения

Минимум три независимых окружения:

| Окружение | Назначение | Данные |
|---|---|---|
| local | разработка | синтетические |
| staging | миграции и приёмка | синтетические/обезличенные |
| production | реальный `FREE_PILOT` | реальные |

Запрещено:

- использовать production-БД для разработки;
- копировать ИИН, документы, адреса и фото в staging;
- использовать одинаковые JWT/SMS/DB secrets;
- подключать staging к production SMS без allowlist;
- запускать seed на production без явной проверки;
- переносить mock-финансовые записи как реальные обязательства.

## 5. Версии runtime

CI PR #4 фиксирует:

```text
Node.js 22.12.0
pnpm 9.15.0
PostGIS image 16-3.4
```

Production должен использовать те же major/minor версии до отдельного тестирования обновления.

В репозитории пока нет `.nvmrc` и production image. До эксплуатации желательно зафиксировать runtime одним из способов:

- `.nvmrc` + systemd;
- multi-stage Dockerfile;
- immutable VM image.

Нельзя устанавливать произвольный latest Node/pnpm при каждом deploy.

## 6. Production-переменные окружения

Минимальный набор:

```env
NODE_ENV=production
COMMERCIAL_MODE=FREE_PILOT
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
JWT_SECRET=<strong-random-secret>
OPERATOR_PHONE=<controlled-operator-phone>
UPLOAD_DIR=/var/lib/masterqala/uploads
PGBOSS_DISABLED=0
CORS_ORIGINS=https://masterqala.kz
```

Тарификация может оставаться заданной для номинального расчёта:

```env
PRICING_BASE_FARE=...
PRICING_PER_KM=...
SERVICE_FEE_RATE=...
SERVICE_FEE_MIN=...
```

В `FREE_PILOT` эти значения не должны создавать платёжные операции.

Дополнительно необходимы настройки реального SMS-провайдера. Провайдер, печатающий код в stdout, запрещён в production.

### 6.1 Незакрытый риск конфигурации

Сейчас централизованно валидируется `COMMERCIAL_MODE`, включая fail-fast `PAID_LIVE`. Остальные переменные ещё не объединены в startup schema.

До запуска API должен завершаться с ошибкой при:

- отсутствии/слабости `JWT_SECRET`;
- отсутствии `DATABASE_URL`;
- пустом `UPLOAD_DIR`;
- неизвестном origin;
- production dev-SMS режиме;
- недоступной директории uploads.

## 7. CI

PR #4 добавляет `.github/workflows/ci.yml`.

Job использует:

- checkout;
- pnpm 9.15.0;
- Node 22.12.0;
- PostGIS service;
- `pnpm install --frozen-lockfile`;
- `prisma migrate deploy`;
- API build;
- API unit tests;
- API e2e tests;
- web build.

Workflow запускается:

- на push ветки;
- на pull request в `main`.

На момент обновления документа успешный run доступным connector не подтверждён. Наличие YAML не равно успешному CI.

Минимальный merge gate:

```text
install = success
migration = success
api build = success
unit = success
e2e = success
web build = success
```

## 8. Локальная проверка перед release

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build
pnpm --filter api test -- --runInBand
pnpm --filter api test:e2e
pnpm --filter web build
```

Для e2e используется отдельная test-БД с PostGIS.

Нельзя запускать тесты, очищающие данные, против staging/production URL.

## 9. Артефакты release

Release должен быть immutable и содержать:

- commit SHA;
- API build `apps/api/dist`;
- web build `apps/web/dist`;
- Prisma schema;
- все migrations;
- `package.json`/workspace metadata;
- `pnpm-lock.yaml`;
- deployment manifests;
- checksum артефакта;
- release notes с миграциями и rollback-ограничениями.

Сервер не должен собирать произвольную ветку непосредственно из рабочего Git checkout без фиксации SHA.

## 10. Миграции

Production-команда:

```bash
pnpm --filter api exec prisma migrate deploy
```

Запрещено:

```bash
prisma migrate dev
prisma db push
```

### 10.1 Миграция `CommercialMode`

Миграция:

- создаёт enum `CommercialMode`;
- добавляет обязательные поля в `Order` и `PlannedOrder`;
- относит исторические строки к `PAID_MOCK`;
- создаёт индексы `(commercialMode, createdAt)`.

Порядок rollout:

1. backup;
2. остановить создание новых заявок или включить maintenance;
3. применить миграцию;
4. развернуть API с `COMMERCIAL_MODE=FREE_PILOT`;
5. проверить `/config/public`;
6. открыть создание новых заявок;
7. проверить, что новые записи получают `FREE_PILOT`;
8. проверить отсутствие финансовых side effects.

Нельзя запустить новый Prisma Client до применения миграции: код ожидает новые обязательные поля.

### 10.2 Общие правила миграций

- сначала staging;
- backup перед изменением;
- backward-compatible DDL;
- destructive migration — отдельный approved plan;
- schema migration выполняется один раз отдельным release step;
- несколько API-инстансов не должны одновременно выполнять migration;
- rollback приложения не означает автоматический rollback БД;
- предпочтителен forward-fix.

## 11. Первичная установка single-node

1. создать системного пользователя `masterqala`;
2. создать release/shared/uploads/log directories;
3. настроить владельца и права;
4. установить/подключить PostgreSQL 16 + PostGIS;
5. создать отдельного DB-пользователя приложения;
6. закрыть PostgreSQL firewall/security group;
7. записать secrets вне репозитория с правами `600` или через secret manager;
8. развернуть immutable release;
9. проверить checksum;
10. выполнить migrations;
11. выполнить контролируемое создание категорий и оператора;
12. запустить API без внешнего трафика;
13. проверить public config, health и storage;
14. разместить web build;
15. настроить reverse proxy/TLS/Socket.IO;
16. выполнить smoke;
17. включить monitoring и backup;
18. только после этого открыть внешний доступ.

## 12. Reverse proxy

Требования:

- HTTPS termination;
- HTTP/2/3 по поддержке;
- WebSocket Upgrade;
- корректные `X-Forwarded-*`;
- request body limit;
- connect/read timeout для Socket.IO;
- compression для static assets;
- SPA fallback;
- security headers;
- access log без Authorization и body;
- rate limiting.

Маршрутизация:

```text
/api/*       → API :3000
/socket.io/* → API :3000 с Upgrade
/*           → apps/web/dist
```

Рекомендуемые headers:

- HSTS после проверки TLS;
- `X-Content-Type-Options: nosniff`;
- CSP, адаптированная под frontend/maps;
- `Referrer-Policy`;
- `Permissions-Policy` для geolocation;
- запрет framing.

CORS должен ограничиваться production origin. Текущее `origin: true` в коде необходимо изменить до публичного запуска.

## 13. Запуск API

Предпочтительная команда из workspace:

```bash
pnpm --filter api start:prod
```

Либо эквивалентный запуск собранного `dist/main.js`.

Process manager должен обеспечивать:

- restart при crash;
- restart rate limit;
- graceful shutdown;
- лимиты памяти/CPU;
- stdout/stderr collection;
- environment injection;
- startup/readiness timeout;
- остановку старого процесса только после готовности нового, если топология позволяет.

Текущий API слушает `3000`. Поддержка `PORT`/bind address ещё не формализована.

## 14. Проверки до открытия трафика

### 14.1 Технические

- API процесс запущен;
- `/api/v1/health` отвечает;
- `/api/v1/config/public` показывает `FREE_PILOT`;
- migrations применены;
- PostgreSQL/PostGIS доступны;
- pg-boss зарегистрировал jobs;
- uploads доступны на запись;
- web build загружается;
- Socket.IO проходит через reverse proxy;
- SMS доставляется allowlisted тестовому номеру;
- production CORS отклоняет неизвестный browser origin;
- логи не содержат SMS-код/JWT/ИИН/адрес.

### 14.2 Срочная заявка

1. клиент входит;
2. активный мастер входит;
3. мастер становится онлайн;
4. клиент создаёт заявку;
5. мастер получает `offer:new` без точного адреса;
6. `offer:new.freePilot=true` и `compensation=0`;
7. мастер принимает;
8. проходит state machine до закрытия;
9. HTTP и `order:status` показывают нулевой выезд/сбор;
10. БД не содержит `PaymentTransaction`/`Accrual` по заявке;
11. расчёт за работу обозначен как прямой между сторонами.

### 14.3 Плановая заявка

1. создать `FREE_PILOT` запись;
2. мастер с нулевым балансом откликается;
3. `LeadCreditTransaction` не создаётся;
4. выбрать и подтвердить мастера;
5. завершить заявку;
6. отдельную заявку отменить после выбора;
7. убедиться, что `REFUND` не создаётся.

### 14.4 Отключённые операции

- покупка кредитов возвращает `403`;
- вывод средств возвращает `403`;
- packages пусты;
- wallet balance равен 0;
- withdrawal history пуста.

### 14.5 Доступ к данным

- посторонний пользователь не получает заявку;
- точный адрес отсутствует в оффере;
- неназначенный мастер не получает плановые детали;
- защищённые фото/документы недоступны без прав;
- оператор видит только разрешённый административный контур.

## 15. SQL-контроль пилота

Проверка режима новых записей:

```sql
SELECT "commercialMode", COUNT(*)
FROM "Order"
GROUP BY "commercialMode";
```

Проверка запрещённых финансовых записей:

```sql
SELECT o.id
FROM "Order" o
WHERE o."commercialMode" = 'FREE_PILOT'
  AND (
    EXISTS (SELECT 1 FROM "PaymentTransaction" p WHERE p."orderId" = o.id)
    OR EXISTS (SELECT 1 FROM "Accrual" a WHERE a."orderId" = o.id)
  );
```

Ожидается 0 строк.

Эта проверка должна стать автоматическим alert/query, а не только ручным smoke.

## 16. Backup

Backup состоит минимум из:

1. PostgreSQL;
2. upload volume;
3. deployment configuration без plaintext secrets;
4. release metadata/commit SHA.

Пример PostgreSQL:

```bash
pg_dump --format=custom --file=masterqala-YYYYMMDD-HHMM.dump "$DATABASE_URL"
```

Требования:

- ежедневный backup;
- дополнительный backup перед миграцией;
- шифрование;
- копия вне основного сервера;
- ограниченный доступ;
- контроль успешности;
- retention дневных/недельных/месячных точек;
- регулярный restore-test.

`pg_dump` и копия uploads должны представлять согласованный временной срез либо процедура должна учитывать рассинхронизацию.

## 17. Restore

Проверяемая процедура:

1. развернуть чистый PostgreSQL/PostGIS;
2. восстановить dump;
3. восстановить uploads;
4. проверить владельцев/права файлов;
5. развернуть соответствующий release SHA;
6. проверить migration state;
7. запустить API без внешнего трафика;
8. проверить пользователей, заявки, документы, споры и queue;
9. выполнить smoke;
10. переключить трафик.

RPO/RTO утверждаются владельцем продукта до работы с реальными пользователями.

Backup без успешного restore-test не считается рабочим.

## 18. Наблюдаемость

### API

- availability;
- p50/p95/p99 latency;
- 4xx/5xx;
- auth failures;
- active Socket.IO connections;
- reconnect rate;
- memory/CPU;
- crash/restart count.

### PostgreSQL/pg-boss

- connections;
- disk usage;
- slow queries;
- locks/deadlocks;
- long transactions;
- queue lag;
- failed/retried jobs;
- backup status;
- size основной и `pgboss` schemas.

### Файлы

- свободное место;
- write errors;
- orphan files;
- backup age;
- restore-test age.

### Бизнес

- заявки по `commercialMode`;
- `NO_MASTERS`;
- время до оффера/принятия;
- отмены;
- зависшие статусы;
- открытые споры;
- SMS delivery errors;
- realtime desync;
- любые финансовые строки для `FREE_PILOT`.

## 19. Алерты

Обязательные:

- API unavailable;
- readiness failed;
- 5xx выше порога;
- PostgreSQL connections/disk критичны;
- pg-boss queue lag/failed jobs;
- uploads заполнены или read-only;
- backup просрочен/упал;
- SMS provider unavailable;
- резкий рост 401/403/429;
- TLS скоро истекает;
- появились `PaymentTransaction`, `Accrual`, `SPEND` или `REFUND` для `FREE_PILOT`.

Последний alert — критический инвариант продукта.

## 20. Обновление приложения

1. сформировать immutable release;
2. получить успешный CI;
3. проверить release notes и migrations;
4. выполнить backup;
5. включить maintenance для несовместимого изменения;
6. применить migrations;
7. запустить новый API без трафика;
8. проверить config/health/readiness;
9. переключить трафик;
10. выполнить smoke;
11. наблюдать метрики;
12. сохранить предыдущий release для rollback.

Новые и старые процессы не должны одновременно работать на несовместимых версиях схемы/payload.

## 21. Rollback

### Приложение

- закрыть создание новых заявок;
- вернуть предыдущий release;
- перезапустить процесс;
- проверить HTTP/Socket.IO;
- вручную сверить активные заявки.

### База

- не откатывать Prisma migration автоматически;
- для additive `CommercialMode` оставить enum/columns/indexes;
- использовать forward-fix;
- destructive rollback — только по отдельному плану/backup.

Предыдущая версия приложения может не понимать новые обязательные поля/режим. Совместимость rollback должна быть проверена на staging до rollout.

## 22. Инцидентный режим

1. включить maintenance/остановить новые заявки;
2. не терять связь с участниками уже назначенных работ;
3. получить список активных срочных и плановых заявок;
4. сохранить логи, queue state и временную шкалу;
5. отозвать затронутые secrets при необходимости;
6. выполнить fix или rollback;
7. сверить зависшие состояния и финансовые инварианты;
8. уведомить ответственных;
9. оформить postmortem;
10. добавить автоматический контроль против повторения.

Frontend должен иметь управляемое сообщение о maintenance, а оператор — инструкцию ручной связи с активными пользователями.

## 23. Gate запуска

### Реализовано кодом

- [x] `COMMERCIAL_MODE=FREE_PILOT`;
- [x] режим заявки сохраняется в БД;
- [x] исторические записи мигрируют в `PAID_MOCK`;
- [x] финансовые side effects пилота заблокированы;
- [x] HTTP/Socket.IO маскируют выезд и сбор;
- [x] CI workflow добавлен;
- [x] rollout и SQL smoke документированы.

### Требует подтверждения/реализации

- [ ] CI workflow успешно завершён;
- [ ] production secrets валидируются;
- [ ] CORS ограничен;
- [ ] реальный SMS provider подключён;
- [ ] production process/container manifest создан;
- [ ] reverse proxy/TLS проверены;
- [ ] uploads persistent/private;
- [ ] file signature/EXIF/PDF security реализованы;
- [ ] global rate limit включён;
- [ ] backup автоматизирован;
- [ ] restore-test успешен;
- [ ] monitoring/alerts включены;
- [ ] ручной security review пройден;
- [ ] полный smoke выполнен;
- [ ] назначен ответственный за инцидент.

Публичный доступ нельзя открывать только на основании merge PR: обязательны инфраструктурный gate, security gate и smoke на production-подобном staging.
