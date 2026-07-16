# Этап 5 «Споры и отмены» — технический дизайн

> Основание: бизнес-спека `docs/project-spec.md` (§3.9 Отмена, §3.10 Спор/жалоба/некачественная работа, §6 числа/лимиты, §5 таблицы переходов статусов). Строится поверх этапов 2–4 — переиспользует `gate()`, `PAYMENT_PROVIDER`, атомарные `updateMany`-гейты, `FileStorage`, паттерн `emitOrderStatus`/`emitPlannedStatus`, админ-списочные страницы (`AdminWithdrawalsPage` как ближайший прецедент).

## 1. Скоуп

**Входит:**
- Санкция мастеру за отмену срочной заявки после `ПРИНЯТА` (−2 кредита + понижение приоритета на 24ч) — сейчас **отсутствует полностью** в `orders.service.ts:cancelByMaster` (код явно откладывал это на этап 5); санкция за отмену плановой уже реализована в этапе 3, здесь только добавляется формальный учёт.
- Формальный трекинг отмен мастера — скользящее окно 30 дней, 3-я отмена (срочная или плановая, в сумме) → временная блокировка на 7 дней (`MasterProfile.blockedUntil`), исключение из матчинга/ленты.
- Спор (`Dispute`) — открытие клиентом или мастером на заявке в `ВЫПОЛНЕНА`/`В_РАБОТЕ`/`ЗАКРЫТА` (в пределах 48ч от закрытия), приложение фото-доказательств, пояснение второй стороны, разбор оператором (возврат сервисного сбора / штраф мастеру — независимые чекбоксы), закрытие спора.
- Заморозка авто-закрытия (24ч job) заявки, пока по ней открыт спор.
- Исправление бэклог-находки этапа 3: `LeadCreditTxType.PENALTY` вместо переиспользования `SPEND` для штрафов (штраф неотличим от траты на ставку в истории транзакций).

**Не входит:**
- Полноценный тред сообщений по спору (спека описывает один раунд «открыл → пояснение второй стороны → решение», не переписку) — одно текстовое поле `counterStatement`, не отдельная таблица сообщений.
- Видео-доказательства — только фото (`image/jpeg`/`image/png`, тот же `FileStorage`, что и документы мастера).
- Эскалация «старший оператор/тимлид» (альт. ветка §3.10) — в MVP нет ролевой иерархии внутри `OPERATOR`, не блокирует архитектуру.
- Гарантийный фонд/эскроу — прямо исключено бизнес-спекой для MVP (§3.10, компенсация ограничена возвратом сервисного сбора).
- Реальный возврат денег через Kaspi — как и весь платёжный слой этапов 2-4, `PAYMENT_PROVIDER.refund()` в MVP мок-уровня.
- Отзывы (§7, окно 7 дней) — фаза 2, отдельно от этого этапа.

## 2. Архитектурные решения

| Область | Решение |
|---|---|
| Статус заявки при споре | **Не вводим** новый статус `СПОР` в `OrderStatus`/`PlannedOrderStatus` — отдельная таблица `Dispute` со своим `status: OPEN\|RESOLVED`. Заявка остаётся в своём текущем статусе (`ВЫПОЛНЕНА`/`В_РАБОТЕ`/`ЗАКРЫТА`); единственный эффект открытого спора на state machine заявки — блокировка авто-закрытия. Избегает дублирования статусной логики в двух местах и не ломает существующие гейты. |
| Связь спора с заявкой | `Dispute.orderId String?` + `Dispute.plannedOrderId String?` — ровно одно из двух заполнено (проверка на уровне сервиса, как и в остальных местах кодовой базы, где нет CHECK-констрейнтов на уровне Prisma-схемы). |
| Скользящее окно отмен | Отдельная append-only таблица `MasterCancellation` (масштаб — по образцу `Accrual`/`WithdrawalRequest`), а не счётчик-поле на `MasterProfile`: «3-я за 30 дней» — окно от текущего момента, не календарный месяц, посчитать можно только по таймстемпам записей. |
| Блокировка мастера | Новое поле `MasterProfile.blockedUntil DateTime?` — не новый `MasterStatus`. Проверяется в тех же местах, что уже проверяют `priorityPenaltyUntil` (`PricingService.findNearestFreeMaster`, `MatchingService.findCandidates`, лента плановых заявок), просто исключает полностью (не понижает приоритет, а убирает из выдачи). Мастер не блокируется в уже назначенной активной заявке — блокировка не отзывает уже принятую работу. |
| Штраф за отмену vs штраф за спор | Оба используют один и тот же путь (`LeadCreditTransaction(PENALTY, -2)` + `priorityPenaltyUntil += 24ч`), но только штраф за **отмену** пишется в `MasterCancellation` (для окна блокировки). Санкция по итогам спора — отдельное нарушение, не считается в «3 отмены за 30 дней» (§3.9 и §3.10 — разные основания). |
| Тип транзакции штрафа | Новое значение `LeadCreditTxType.PENALTY` (было `SPEND` для планового этапа 3 — фиксим по ходу, раз трогаем тот же код). Исторические `SPEND`-записи от прошлых штрафов не мигрируются. |
| Возврат сервисного сбора | Новый метод `PAYMENT_PROVIDER.refund(orderId, amount): Promise<{status, providerRef}>` — по прецеденту `charge()`/`payout()` (этапы 3-4, подтверждённый как корректный уровень абстракции финальным ревью этапа 4). Мок всегда `SUCCEEDED`. |
| Доказательства спора | Переиспользуем `FILE_STORAGE`/`FileStorage` и multer-конфиг мастерских документов (`image/jpeg`, `image/png`, тот же лимит размера) — новый эндпоинт загрузки, привязанный к `Dispute` вместо `MasterProfile`. |
| Доступ оператора к спорам | `DisputesService` с методом `listAll()`/`getById()`, контроллер `AdminDisputesController` вызывает сервис, не `PrismaService` напрямую — сразу по правильному паттерну (в отличие от `AdminWithdrawalsController` этапа 4, где это было находкой финального ревью). |

## 3. Модель данных

```prisma
enum DisputeStatus {
  OPEN
  RESOLVED
}

enum DisputeTargetRole {
  CLIENT
  MASTER
}

model Dispute {
  id               String            @id @default(uuid())
  orderId          String?
  order            Order?            @relation(fields: [orderId], references: [id])
  plannedOrderId   String?
  plannedOrder     PlannedOrder?     @relation(fields: [plannedOrderId], references: [id])
  openedByUserId   String
  openedByUser     User              @relation("DisputesOpened", fields: [openedByUserId], references: [id])
  openedByRole     DisputeTargetRole
  reason           String
  evidenceDocIds   String[]          @default([])
  counterStatement String?
  status           DisputeStatus     @default(OPEN)
  refundServiceFee Boolean?
  penalizeMaster   Boolean?
  resolutionNote   String?
  resolvedByUserId String?
  resolvedByUser   User?             @relation("DisputesResolved", fields: [resolvedByUserId], references: [id])
  resolvedAt       DateTime?
  createdAt        DateTime          @default(now())

  @@index([orderId])
  @@index([plannedOrderId])
  @@index([status])
}

enum CancelledOrderType {
  URGENT
  PLANNED
}

model MasterCancellation {
  id           String             @id @default(uuid())
  masterUserId String
  master       User               @relation(fields: [masterUserId], references: [id])
  orderType    CancelledOrderType
  orderId      String
  createdAt    DateTime           @default(now())

  @@index([masterUserId, createdAt])
}
```

`MasterProfile` получает `blockedUntil DateTime?`. `LeadCreditTxType` получает значение `PENALTY`.

**Миграция:** дополняет схему, не трогает существующие данные (все новые поля — nullable/со значением по умолчанию, `PENALTY` — аддитивное значение enum). GIST-индексы гео-полей этой миграцией не затрагиваются (прецедент бага этапа 3 — здесь новых raw-SQL geography-колонок нет).

## 4. Отмена мастером — санкция и счётчик

Общий сервис `MasterPenaltyService` (кандидат — `src/common/master-penalty.service.ts`, инжектится в модули orders/planned-orders и disputes — по прецеденту того, как `PAYMENT_PROVIDER` инжектится в несколько модулей) с двумя методами: узким ядром (переиспользуется и разбором споров, §6) и обёрткой для отмен (логирует в окно блокировки):

```ts
/** Ядро: −2 кредита + понижение приоритета. Не знает про отмены/споры. */
async applyPenalty(tx: Tx, masterUserId: string): Promise<void> {
  await tx.leadCreditAccount.update({ where: { masterUserId }, data: { balance: { decrement: 2 } } });
  await tx.leadCreditTransaction.create({ data: { masterUserId, type: 'PENALTY', amount: -2 } });
  await tx.masterProfile.updateMany({ where: { userId: masterUserId }, data: { priorityPenaltyUntil: new Date(Date.now() + 24*3600*1000) } });
}

/** Отмена мастером: штраф + запись в окно блокировки + проверка 3-й за 30 дней. */
async penalizeForCancellation(tx: Tx, masterUserId: string, orderType: CancelledOrderType, orderId: string): Promise<void> {
  await this.applyPenalty(tx, masterUserId);
  await tx.masterCancellation.create({ data: { masterUserId, orderType, orderId } });

  const since = new Date(Date.now() - 30*24*3600*1000);
  const count = await tx.masterCancellation.count({ where: { masterUserId, createdAt: { gte: since } } });
  if (count >= 3) {
    await tx.masterProfile.updateMany({ where: { userId: masterUserId }, data: { blockedUntil: new Date(Date.now() + 7*24*3600*1000) } });
  }
}
```

`OrdersService.cancelByMaster` и `PlannedOrdersService.cancelByMaster` вызывают `penalizeForCancellation` внутри уже существующей `$transaction`, вместо своего инлайн-кода (плановый модуль — рефакторинг существующих 3 строк в вызов общего метода). Разбор спора (§6) вызывает только `applyPenalty` — без записи в `MasterCancellation`, санкция за спор не считается в окно блокировки за отмены (разные основания по §3.9 vs §3.10).

Баланс лид-кредитов не гейтится на достаточность (как и сейчас в этапе 3) — штраф применяется всегда, баланс может уйти в минус; это уже принятое поведение, не меняем.

## 5. Открытие спора

`POST /orders/:id/disputes` и `POST /planned-orders/:id/disputes` — `{ reason: string }`:
- Предусловие: заявка в допустимом статусе (`DONE`/`IN_PROGRESS`/`CLOSED` для срочной; аналогично для плановой) — при `CLOSED` дополнительно `closedAt >= now - 48h`.
- Гейт идемпотентности от гонки одновременных открытий: частичный уникальный индекс через raw SQL в миграции — `CREATE UNIQUE INDEX "Dispute_open_unique" ON "Dispute" (COALESCE("orderId",'')||COALESCE("plannedOrderId",'')) WHERE status = 'OPEN'`. По прецеденту PostGIS GIST-индексов этапа 2 (миграции этой кодовой базы уже содержат raw SQL). `create()` при нарушении уникальности бросает Prisma `P2002` → конвертируется в `ConflictException` (409), как и остальные гейты в кодовой базе.
- `openedByUserId`/`openedByRole` — из `@CurrentUser()`, роль определяется по тому, кто из участников заявки (`clientId`/`masterId`) сделал запрос.

`POST /orders/:id/disputes/:disputeId/evidence` (аналогично для планового) — загрузка фото, переиспользует контроллер-паттерн `masters.controller.ts` (multer + `FileStorage`), пишет `id` документа в `Dispute.evidenceDocIds`.

`PATCH /orders/:id/disputes/:disputeId { counterStatement }` (аналогично для планового) — только вторая сторона (не открывший), только пока `status: OPEN`.

**Заморозка авто-закрытия:** `OrdersService.handleAutoClose` и `PlannedOrdersService.handleAutoClose` в начале проверяют `Dispute.findFirst({ where: { orderId, status: 'OPEN' } })` (аналогично для планового) — если найден, no-op без ошибки (job просто не делает ничего; повторно не перепланируется, т.к. закрытие спора само переводит заявку в `ЗАКРЫТА`, если она такой ещё не была).

## 6. Разбор оператором

- `GET /admin/disputes?status=OPEN|RESOLVED` — список через `DisputesService.listAll()`: id, тип заявки, кто открыл, дата, статус.
- `GET /admin/disputes/:id` — деталь: причина, `evidenceDocIds` (скачивание — по прецеденту `admin/applications/:id/documents/:docId`), `counterStatement`, вложенная заявка целиком (статусы/цена/таймстемпы) для контекста.
- `POST /admin/disputes/:id/resolve { refundServiceFee: boolean, penalizeMaster: boolean, resolutionNote: string }`:
  1. Гейт: `Dispute.status === 'OPEN'` → иначе 409.
  2. Транзакция:
     - `refundServiceFee` → `PAYMENT_PROVIDER.refund(orderId, order.serviceFee)`, статус фиксируется (мок — всегда успешен, как `charge()`/`payout()`).
     - `penalizeMaster` → `MasterPenaltyService.applyPenalty(tx, order.masterId)` (без записи в `MasterCancellation` — спор не считается в окно блокировки за отмены, §3.9 и §3.10 разные основания).
     - `Dispute.status = 'RESOLVED'`, `resolvedByUserId`, `resolvedAt`, `resolutionNote`.
     - Если заявка была `DONE` (ждала авто-закрытия, которое было заморожено спором) → перевод в `CLOSED` здесь же (спор был единственной причиной не закрыть).
  3. Идемпотентность — гейт на `status: 'OPEN'` в самом UPDATE (как и везде в кодовой базе).

## 7. HTTP API

- `POST /orders/:id/disputes`, `PATCH /orders/:id/disputes/:disputeId`, `POST /orders/:id/disputes/:disputeId/evidence`, `GET /orders/:id` (расширяется полем `dispute` в ответе).
- То же самое зеркально под `/planned-orders/:id/disputes/...`.
- `GET /admin/disputes`, `GET /admin/disputes/:id`, `POST /admin/disputes/:id/resolve`.
- `GET /admin/disputes/:id/evidence/:docId` — скачивание доказательства (по прецеденту документов мастера).

## 8. Экраны

- **`OrderPage.tsx`/`PlannedOrderPage.tsx`** (клиент и мастер): кнопка «Открыть спор», видна при допустимом статусе и в пределах окна; после открытия — карточка спора (причина, статус, поле для `counterStatement` у второй стороны, финальный исход после разрешения).
- **`AdminDisputesPage.tsx`** (оператор): список, по прецеденту `AdminWithdrawalsPage.tsx`. Роут `/admin/disputes`, ссылка из `AdminListPage.tsx`.
- **`AdminDisputeDetailPage.tsx`**: деталь + форма решения (два чекбокса + текстовое поле), по прецеденту `AdminDetailPage.tsx` (заявки на верификацию мастера).
- **`ProfilePage.tsx`/`WalletPage.tsx`** (мастер): баннер, если `blockedUntil > now` — «доступ к новым заявкам временно ограничен до {дата}».

## 9. Обработка ошибок и крайние случаи

- Повторное открытие спора при уже открытом на той же заявке → 409.
- Открытие спора вне окна (после 48ч от `closedAt`, или заявка в недопустимом статусе) → 409/400.
- `counterStatement` от третьего лица (не участник заявки) → 403 (уже есть `guardClient`/аналог для мастера, переиспользуется).
- Разрешение уже разрешённого спора → 409.
- Штраф мастеру за спор при недостаточном балансе лид-кредитов → тот же принцип, что и штраф за отмену: не блокируется, баланс может уйти в минус (последовательно с этапом 3).
- Блокировка (`blockedUntil`) не трогает уже назначенную мастеру активную заявку — доработать её можно, просто новые не назначаются/не видны в ленте.
- Возврат сервисного сбора на уже закрытой заявке, где сбор не был захвачен (гипотетически невозможно в текущей state machine — capture происходит при `ПРИНЯТА`, до `ВЫПОЛНЕНА` заявка не доходит без каптура) — не обрабатываем отдельно, инвариант гарантирован существующей state machine.
- 3-я отмена ровно на границе 30-дневного окна (запись создана 30 дней и несколько миллисекунд назад) → включается в окно, если `createdAt >= now - 30d` (граница inclusive, как и `ST_DWithin` в этапе 2).

## 10. Тестирование

Unit: `penalizeMasterForCancellation` — 3-я запись в окне триггерит `blockedUntil`, 2-я не триггерит, запись старше 30 дней не считается (граничные случаи по времени — мокать `Date` через переданный `now`, по прецеденту `computeTimeCoefficient` в `pricing.service.spec.ts`).

E2e (реальный HTTP + PostgreSQL, по прецеденту всех предыдущих этапов):
- Отмена мастером срочной заявки после `ПРИНЯТА` → −2 кредита (тип `PENALTY`), `priorityPenaltyUntil` выставлен, заявка вернулась в `ПОИСК_МАСТЕРА`.
- 3 отмены подряд (срочные и/или плановые вперемешку) за одним мастером → `blockedUntil` выставлен; заблокированный мастер не появляется в `findNearestFreeMaster`/`findCandidates`/ленте плановых заявок; уже назначенная ему активная заявка не отзывается.
- Открытие спора на `ВЫПОЛНЕНА` → джоба авто-закрытия по истечении 24ч не закрывает заявку (спор остаётся `OPEN`, заявка остаётся `ВЫПОЛНЕНА`).
- Полный цикл спора: клиент открывает → мастер добавляет `counterStatement` → оператор разрешает с `refundServiceFee: true, penalizeMaster: true` → заявка `CLOSED` (если была `DONE`), сервисный сбор возвращён (мок), штраф применён, повторный `resolve` → 409.
- Открытие спора после истечения 48ч-окна на `CLOSED` заявке → 400/409.
- Оператор видит список споров и деталь с доказательствами; недоступно без роли `OPERATOR`.

Ветка `refund()`-провайдера с реальным сбоем — как и `payout()` в этапе 4, не воспроизводима через HTTP-мок (всегда `SUCCEEDED`); не тестируем отдельно в этом этапе (тот же принцип, что и уже принятое ограничение этапа 4).
