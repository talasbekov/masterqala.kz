# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте

MasterQala.kz — платформа вызова мастеров на дом (Казахстан, пилот — Астана). Два режима:
**«Сейчас»** — срочный вызов с волновым подбором ближайшего мастера, и **«Запланировать»** —
плановая заявка со ставками мастеров. Мастер оставляет себе 100% стоимости работ; платформа
зарабатывает на сервисном сборе с выезда и lead-кредитах за отклик.

Язык проекта — русский: документация, коммиты и UI-тексты пишутся по-русски.

## Структура

pnpm-монорепозиторий:

- `apps/api` — NestJS 10 + Prisma 5 + PostgreSQL/PostGIS + pg-boss + Socket.IO; HTTP-префикс `/api/v1`
- `apps/web` — React 19 + Vite PWA; клиент, мастер и оператор в одном приложении (экраны зависят от JWT, наличия `MasterProfile` и роли)
- `packages/ui` — дизайн-система `@masterqala/ui` (tsup + Tailwind 4); `web build` собирает её через prebuild
- `apps/MasterQala/design_handoff_masterqala` — дизайн-артефакты, не код
- `docs/` — документация; карта — `docs/README.md`

## Команды

```bash
docker compose up -d                  # PostGIS :5432 (dev) и :5433 (test); образ postgis обязателен — на обычном postgres гео-запросы матчинга падают
pnpm install
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ../..

pnpm --filter api start:dev           # API на :3000
pnpm --filter web dev                 # Web на :5173
```

Тесты:

```bash
pnpm --filter api test                     # unit
pnpm --filter api test -- orders.service   # один файл/паттерн (jest)
pnpm --filter api test:e2e                 # e2e; нужна db_test на :5433
```

Перед первым прогоном e2e накатить схему на тестовую базу:

```bash
cd apps/api && DATABASE_URL=postgresql://masterqala:masterqala@localhost:5433/masterqala_test \
  pnpm prisma migrate deploy
```

E2E идут последовательно (`--runInBand`) и делят состояние БД. Очередь в них выключена
(`PGBOSS_DISABLED=1`), поэтому тесты таймаутов вызывают обработчики джоб напрямую.

Линт и сборка:

```bash
pnpm --filter api lint                # eslint --fix
pnpm --filter web lint                # oxlint
pnpm --filter api build
pnpm --filter web build               # tsc -b + vite; prebuild собирает @masterqala/ui
```

CI (`.github/workflows/ci.yml`): migrate deploy → build api → unit → e2e → build web.

**Вход в dev.** Реального SMS-шлюза нет: код пишется в лог API строкой `SMS → +7…`.
Оператор — телефон из `OPERATOR_PHONE` (создаётся сидами, админка на `/admin`).
Лимиты настоящие и в dev: код живёт 5 минут, ≤3 отправок за 10 минут, 5 попыток ввода.

## Архитектура

Подробно — `docs/technical/CURRENT_ARCHITECTURE.md`. Главное:

**Гонки и идемпотентность** — центральная тема backend:

- Переходы статусов — атомарный гейт: `updateMany` с проверкой текущего статуса в `WHERE`;
  0 обновлённых строк → `409`. Метод `gate()` в `apps/api/src/orders/orders.service.ts`.
  `409` — не баг, а сигнал перечитать заявку и повторить от актуального состояния.
- Волны матчинга — монотонный гейт `wave: { lt: wave }` против двойной доставки pg-boss.
- Лимит SMS — advisory-lock; начисления и ставки — уникальные индексы
  (`Accrual.orderId`, `OrderOffer(orderId, masterUserId, attempt)`, `PlannedOrderBid(plannedOrderId, masterUserId)`);
  списание lead-кредита — условный декремент `balance: { gte: 1 }`.

**Срочный режим**: `CREATED → SEARCHING → ACCEPTED → MASTER_ON_WAY → INSPECTION →
AWAITING_PRICE_CONFIRM → IN_PROGRESS → DONE → CLOSED`. Матчинг — три волны
(3/6/10 км, `ST_DWithin`), первый принявший мастер выигрывает. Тайминги и радиусы —
`apps/api/src/orders/order.constants.ts`.

**Плановый режим**: `CREATED → PUBLISHED → MASTER_SELECTED → CONFIRMED → IN_PROGRESS →
DONE → CLOSED`; ставка стоит один lead-кредит. Константы —
`apps/api/src/planned-orders/planned-order.constants.ts`. Все отложенные таймауты
(волны, истечение офферов, автозакрытия) — джобы pg-boss.

**Роли**: в Prisma только `CLIENT` и `OPERATOR`. Мастер — не роль: возможности мастера
определяются наличием и статусом `MasterProfile`.

**Деньги и коммерческие режимы**: суммы — целые числа в тенге. `MockPaymentProvider`
(`PAID_MOCK`) имитирует банк, но создаёт реальные записи `HOLD`/`CAPTURE`/`VOID`;
`FREE_PILOT` финансовых записей не создаёт. Режим хранится в поле `commercialMode`
самой заявки, а не берётся из текущего env.

**Файлы**: локальный `UPLOAD_DIR`, в БД только путь и метаданные. Отдаются не статикой,
а через контроллеры с проверкой прав; загрузка проходит fail-closed карантин
(сигнатура + антивирус) — до успешной проверки файл не отдаётся.

**Realtime**: Socket.IO, JWT проверяется в handshake, пользователь входит в комнату
`user:<userId>`. Каталог событий — `docs/technical/WEBSOCKET_EVENTS.md`.

**Env-инвариант**: `SERVICE_FEE_MIN < PRICING_BASE_FARE`, проверяется на старте и роняет
приложение с внятной ошибкой.

## Документация и правила

- Источники истины при расхождении (по убыванию приоритета): `apps/api/prisma/schema.prisma`
  и миграции → контроллеры/сервисы `apps/api/src/**` → `order.constants.ts` и
  `planned-order.constants.ts` → realtime gateway/matching → `apps/web/src/**` → CI →
  `docs/product/spec.md` как продуктовая целевая модель.
- Правило актуализации: изменение Prisma-схемы, эндпоинта, Socket.IO payload, статуса,
  таймаута, коммерческого поведения, privacy-правила или production-конфигурации считается
  незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий
  документ в `docs/`.
- `docs/STATUS.md` — что реализовано и где код расходится со спекой.

## Правила работы

- Минимальный законченный diff; без функций «на будущее», рефакторинга соседнего кода
  и массового обновления зависимостей.
- Гонки: не полагаться на «проверил → обновил»; использовать существующие гейты
  (`gate()`, монотонные условия, уникальные индексы, условный декремент).
- Realtime-событие — только после фиксации состояния в БД.
- Джобы идемпотентны: проверка текущего состояния перед изменением; payload — id, не копии сущностей.
- Авторизация на backend: аутентификация → роль/MasterProfile → доступ к ресурсу → допустимость в текущем статусе.
- Raw SQL — только параметризованный. `data: dto` напрямую в Prisma — запрещено, поля явно.
- Не ослаблять тесты (`.skip`, удаление assertions, мокирование проверяемой логики).
- Не заявлять «тесты прошли», если не запускались — писать «Не запускалась: причина».
- Опасные миграции (drop, смена типа, nullable→required, unique на существующих данных) —
  только с планом миграции данных и отката.
