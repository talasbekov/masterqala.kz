# Этап 6 «Оператор (desktop)» — Цикл A: бэкенд-расширения

## Контекст

Прототип `apps/MasterQala/design_handoff_masterqala/Этап 6 - Оператор (desktop).dc.html` (hi-fi, 8 разделов панели оператора: Обзор, Верификация, Пользователи, Мастера, Заказы, Споры, Вывод средств, Журнал) должен быть воссоздан в `apps/web` как desktop-панель. Три раздела (Верификация, Споры, Вывод средств) уже полностью покрыты существующим API (`/admin/applications`, `/admin/disputes`, `/admin/withdrawals`) — их переиспользует Цикл B без изменений бэкенда. Пять разделов (Обзор/метрики, Пользователи, Мастера, Заказы+ручное назначение, Журнал) требуют новых бэкенд-эндпоинтов, которых сейчас нет.

Решение через `AskUserQuestion` в начале брейнсторминга: разбить работу на **два цикла**, по прецеденту клиента v2 (Цикл 1 бэкенд → Цикл 2 фронтенд) — этот документ описывает только **Цикл A (бэкенд)**. Цикл B (визуальный редизайн панели, включая пересборку разделов Верификация/Споры/Вывод под новый desktop-shell) получит свой отдельный spec→plan→SDD цикл после того, как Цикл A будет реализован и смержен.

Технический контекст собран через Explore-агента: полные enum'ы `OrderStatus`/`PlannedOrderStatus`, поля `Order`/`PlannedOrder`, wave-based matching (`matching.service.ts`), `OrdersService.accept()` (единственный существующий атомарный переход в ACCEPTED — нет force-assign обхода offer-flow), `MasterPresence` (онлайн+геолокация), события `RealtimeGateway` (`order:status`, `offer:new/closed`, `master:location`, `planned:status`, `bid:*`), существующие admin-страницы (только верификация/споры/вывод), примитивы `packages/ui` (Button/Card/Avatar/StatusPill/CategoryTile/EmptyState — без desktop-layout примитивов), `App.tsx` `RequireOperator`-гейт, и подтверждение, что `JwtAuthGuard` уже делает свежий `findUnique(User)` на каждый запрос (что делает полную блокировку входа дешёвой в реализации).

## Скоуп Цикла A

**В скоупе:** новые бэкенд-эндпоинты для разделов Заказы (список/деталь/кандидаты/ручное назначение), Пользователи (список/блокировка), Мастера (список), Метрики (дашборд), Журнал (`AuditLog` + точки записи во всех существующих admin-действиях и системных авто-событиях), проверка `isBlocked` в `JwtAuthGuard` и `AuthService.verifyCode`.

**Вне скоупа:** сам UI панели оператора (Цикл B); push/email-уведомления о блокировке; изменения в клиентском/мастерском бизнес-flow кроме проверки `isBlocked` на вход; real-time уведомление оператора о новых событиях (панель будет поллить/рефетчить, WS для оператора — не в этом цикле).

## Схема данных

### `AuditLog` (новая модель)

```prisma
enum AuditActorType { OPERATOR SYSTEM }
enum AuditTargetType { MASTER_PROFILE USER ORDER PLANNED_ORDER DISPUTE }

model AuditLog {
  id         String          @id @default(uuid())
  actorType  AuditActorType
  actorId    String?
  actor      User?           @relation(fields: [actorId], references: [id])
  action     String
  targetType AuditTargetType
  targetId   String
  comment    String?
  createdAt  DateTime        @default(now())

  @@index([createdAt])
}
```

`action` — свободная строка (не enum), т.к. набор действий будет расти вместе с продуктом без миграций схемы: `MASTER_APPROVED`, `MASTER_NEEDS_INFO`, `MASTER_REJECTED`, `DISPUTE_RESOLVED`, `USER_BLOCKED`, `USER_UNBLOCKED`, `ORDER_MANUALLY_ASSIGNED`, `AUTO_CLOSED`, `MASTER_AUTO_BLOCKED`.

### `User` — новые поля

```prisma
model User {
  ...
  isBlocked     Boolean   @default(false)
  blockedAt     DateTime?
  blockedReason String?
}
```

Никаких изменений в `Order`/`PlannedOrder`/`MasterProfile` — все нужные для новых разделов данные (`wave`, `searchAttempt`, статусы, таймстемпы, `blockedUntil`, `priorityPenaltyUntil`) уже есть.

## API «Заказы» (`/admin/orders`)

- `GET /admin/orders?type=urgent|planned&status=&period=today|week|all&search=` — объединённый список. Реализация: два независимых Prisma-запроса (`order.findMany`/`plannedOrder.findMany`) с общими фильтрами, слияние и сортировка по `createdAt` в сервисе, пагинация страницами по 20 после слияния (не через SQL UNION — типы полей у Order/PlannedOrder расходятся). `search` — по `id` (префикс) или телефону клиента. Каждая строка: `id`, `type` (`urgent`/`planned`), `client.name`, `master.name|null`, `category.name`, `status`.
- `GET /admin/orders/:id?type=` — деталь: адрес, таймлайн (массив событий, собранный в сервисе из существующих таймстемпов заказа — `createdAt/acceptedAt/onSiteAt/priceProposedAt/completedAt/closedAt` — плюс запись открытия/разрешения `Dispute`, если связан), сводка платежей (текущий статус hold/capture из `Accrual`), `canAssign: boolean` = `status === 'SEARCHING' && wave === 3 && now - createdAt > 5 min` (только для urgent; planned заказы не участвуют в ручном назначении — там уже есть выбор мастера через ставки).
- `GET /admin/orders/:id/candidates` — список онлайн-мастеров подходящей категории поблизости для urgent-заказа: переиспользует SQL-запрос кандидатов из `matching.service.ts` (радиус/категория/`isOnline`/не заблокирован), но **без** фильтра «мастеру ещё не предлагался заказ в этой попытке» — ручное назначение обходит offer-историю осознанно. Возвращает `masterUserId`, имя, дистанцию, `isOnline`.
- `POST /admin/orders/:id/assign { masterUserId }` — новый метод `OrdersService.manualAssign(operatorId, orderId, masterUserId)`: атомарная транзакция — `updateMany` gate `WHERE status='SEARCHING'` → `ACCEPTED` с этим `masterId`/`acceptedAt`, отмена/игнор отложенной `WAVE_TIMEOUT`-джобы (job подтверждает статус перед действием — как и другие consumer'ы в проекте — так что явная отмена не обязательна, но добавляется явный `pgBoss.cancel()` там, где job ещё хранит id), `payments.capture()`, эмит `order:status` мастеру и клиенту (тот же payload, что у обычного `accept()`), запись `AuditLog(actorType=OPERATOR, action=ORDER_MANUALLY_ASSIGNED, targetType=ORDER, targetId, comment)`. Только для `type=urgent` — для planned-заказов эндпоинт возвращает 400 (нет сценария в прототипе).

Дашборд-таблица «поиск без мастера» в §«Метрики» — это фильтр `canAssign=true` поверх этого же списка заказов, отдельного endpoint не создаёт.

## API «Пользователи» и «Мастера»

- `GET /admin/users?search=&role=&status=blocked|active` — список `User` с `_count: { clientOrders, masterOrders }` (сумма — «заказов»), производной ролью-меткой (`клиент` / `клиент + мастер` если есть `masterProfile`), `isBlocked`.
- `POST /admin/users/:id/block { reason }` — устанавливает `isBlocked=true, blockedAt=now(), blockedReason=reason`, пишет `AuditLog(USER_BLOCKED)`. `reason` обязателен (как и комментарий в верификации/спорах — консистентно с существующим паттерном «обязательный комментарий для необратимых решений»).
- `POST /admin/users/:id/unblock` — сброс полей, `AuditLog(USER_UNBLOCKED)`.
- Enforcement: `JwtAuthGuard.canActivate()` после существующего `findUnique` добавляет `if (user.isBlocked) throw new ForbiddenException('Аккаунт заблокирован')`. `AuthService.verifyCode()` — та же проверка перед выдачей `accessToken` (иначе заблокированный пользователь с ещё не истёкшим локальным state не сможет разлогиниться понятным образом, но не получит новый токен повторным входом). Существующие активные заказы заблокированного клиента/мастера не трогаются — это осознанное решение, не автозакрытие.
- `GET /admin/masters?status=&category=&district=` — список `ACTIVE` `MasterProfile` с `MasterPresence.isOnline`, агрегированным рейтингом (переиспользует `ReviewsService.attachRating` по образцу существующего использования в `enrichBids`), числом закрытых заказов, и производным статусом в порядке приоритета: `блокирован до {blockedUntil}` (если `blockedUntil > now`) → `приоритет ↓ до {priorityPenaltyUntil}` (если `priorityPenaltyUntil > now`) → `активен · онлайн`/`активен · офлайн` (по `isOnline`).

## API «Метрики» (дашборд)

`GET /admin/metrics` — один сервисный метод `MetricsService.getDashboard()`. Прототип не специфицирует период фильтра для карточек метрик (кроме таблицы «поиск без мастера», которая всегда live) — берём скользящее окно 24ч для всех агрегатов ниже:
- `activeUrgentCount` — `Order.count()` где статус не в терминальном множестве (`DONE/CLOSED/NO_MASTERS/CANCELLED_*`)
- `publishedPlannedCount` — `PlannedOrder.count({status: 'PUBLISHED'})`
- `foundMasterRate` — за последние 24ч: `(count(acceptedAt != null) / count(acceptedAt != null OR status=NO_MASTERS)) * 100`, округление до целого
- `medianSearchSeconds` — `percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch from acceptedAt - createdAt))` raw SQL по заказам с `acceptedAt` за 24ч
- `openDisputesCount`, `pendingVerificationCount` (`PENDING_REVIEW`+`NEEDS_INFO`), `pendingWithdrawalsCount` (`PENDING`) — простые `count()` по существующим таблицам
- `stuckSearches` — те же строки, что `GET /admin/orders?status=SEARCHING`, отфильтрованные по `canAssign=true` из §«Заказы», лимит 20, для карточки «требует внимания»

## Журнал (`/admin/journal`) — точки записи AuditLog

`GET /admin/journal?page=` — пагинация по 30, `orderBy: createdAt desc`, `actor`/`target` разрешаются в читаемые метки на фронте (id остаются raw, маппинг меток — забота Цикла B).

Точки записи (все — в рамках уже существующих транзакций тех методов, новых side-effect-путей не создаётся):

| Метод | action |
|---|---|
| `AdminService.decide()` (верификация) | `MASTER_APPROVED` / `MASTER_NEEDS_INFO` / `MASTER_REJECTED` |
| `DisputesService.resolve()` | `DISPUTE_RESOLVED` |
| `UsersService.block()` / `unblock()` (новый) | `USER_BLOCKED` / `USER_UNBLOCKED` |
| `OrdersService.manualAssign()` (новый) | `ORDER_MANUALLY_ASSIGNED` |
| pg-boss `handleAutoClose` consumer | `AUTO_CLOSED`, `actorType=SYSTEM`, `actorId=null` |
| `MasterPenaltyService.penalizeForCancellation()` (3-я отмена/30 дней → блок) | `MASTER_AUTO_BLOCKED`, `actorType=SYSTEM` |

## Тестирование

TDD по прецеденту этапов 1-5 (RED→GREEN, `--runInBand`, очистка `/tmp/jest_rs` перед прогоном — см. известную причуду `ts-jest`/`AppModule`-компиляции из Цикла 1 клиента v2):
- Unit: `UsersService`, `OrdersService.manualAssign`, `MetricsService`, `AuditLogService` (мокнутый Prisma, по паттерну `wallet.service.spec.ts`/`disputes.service.spec.ts`)
- E2e: `admin-orders.e2e-spec.ts`, `admin-users.e2e-spec.ts`, `admin-masters.e2e-spec.ts`, `admin-metrics.e2e-spec.ts`, `admin-journal.e2e-spec.ts`
- Regression: `auth.e2e-spec.ts` — заблокированный пользователь получает 403 от защищённого эндпоинта и не может получить новый токен через `verify-code`
- Живая браузерная проверка не входит в этот цикл (нет UI) — сквозная проверка через `fetch()`/Postman-подобные вызовы в рамках e2e-тестов уже покрывает контракт для Цикла B.
