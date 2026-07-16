# Этап 3 «Плановый режим» — технический дизайн

> Основание: бизнес-спека `docs/project-spec.md` (§3.4 плановая заявка, §3.6 механика ставок, §3.7.б lead-кредиты и пополнение, §3.9 отмена (плановый режим), §5.2 state machine, §6 числа). Строится поверх этапа 2 («Срочный режим») — переиспользует паттерны `gate()`, pg-boss, `RealtimeGateway`, `PAYMENT_PROVIDER`, но заводит собственные таблицы данных.

## 1. Скоуп

**Входит:** публикация плановой заявки (категория, описание, адрес, дата/слот); лента заявок для мастера по категории; ставки мастеров (цена + срок + комментарий) со списанием lead-кредита за отклик, лимит 5 мастеров на заявку; выбор мастера клиентом; подтверждение мастером с таймаутом 2ч (авто-возврат в ленту); статусы до закрытия; двустороннее подтверждение выполнения с авто-закрытием через 24ч (переиспользуем `AUTO_CLOSE`-паттерн этапа 2); базовая отмена обеими сторонами по §3.9 (плановый режим) — возврат/невозврат кредита, штраф мастеру −2 кредита + понижение приоритета 24ч; покупка пакетов lead-кредитов через мок `PAYMENT_PROVIDER`; раскрытие адреса/контакта клиента только выбранному мастеру.

**Не входит:** формализованный трекинг «3-я отмена за 30 дней → блокировка» и споры (§3.10) — этап 5; реальный Kaspi и денежный кошелёк мастера — этап 4 (кредитный баланс — не денежный, выводу не подлежит, живёт здесь); рейтинги и сортировка ленты по рейтингу (§3.11, фаза 2); фото при создании заявки — как и в этапе 2, поле в схему не выносится (то же решение, что и для срочной заявки); геозона/район как фильтр ленты — MVP фильтрует только по категории (см. §2).

## 2. Архитектурные решения (приняты 2026-07-16)

| Область | Решение |
|---|---|
| Модель данных | Отдельная таблица `PlannedOrder` + `PlannedOrderBid`, не переиспользует `Order` из этапа 2 (там срочно-специфичные обязательные поля) — общие только справочники (User, Category, MasterProfile) и паттерны сервисов |
| Лента для мастера | Фильтр только по категории (`category IN masterCategories`, ACTIVE-мастер); `district` — просто текст в карточке, не фильтр (свободный текст без геокоординат, риск опечаток) |
| Выбор мастера | `PlannedOrder.masterId` + `selectedBidId` (nullable), без отдельного enum-статуса на бид — при таймауте оба поля обнуляются, статус возвращается в `PUBLISHED`, остальные биды не трогаются |
| Раскрытие адреса | Контроллер отдаёт `address`/контакт клиента мастеру только если `order.masterId === currentMasterId` (после `MASTER_SELECTED`); в ленте и при первом просмотре — только категория/район/описание/дата |
| Lead-кредиты | Новые таблицы `LeadCreditAccount` (баланс) + `LeadCreditTransaction` (журнал PURCHASE/SPEND/REFUND); списание за отклик — атомарный `UPDATE ... WHERE balance >= 1` (гейт-паттерн), не через `PAYMENT_PROVIDER` (это не денежная операция) |
| Оплата пакетов кредитов | Расширяем `PAYMENT_PROVIDER` методом `charge(referenceId, amount)`; `MockPaymentProvider` всегда успешен; результат пишется в `LeadCreditPurchase.status`, не в `PaymentTransaction` (та таблица жёстко привязана к `Order.orderId`) |
| Таймеры | pg-boss, новые джобы `PLANNED_EXPIRY` (на момент `scheduledAt`, только если ставок нет) и `PLANNED_CONFIRM_TIMEOUT` (2ч от `MASTER_SELECTED`) |
| Realtime | Переиспользуем `RealtimeGateway`, комнаты `user:{userId}`; новые события `bid:new`, `bid:selected`, `bid:closed`, `planned:status` |
| Штраф мастеру | Новое поле `MasterProfile.priorityPenaltyUntil` (DateTime?) — резервируется здесь для правила отмены §3.9; потребитель (сортировка по приоритету) — вне скоупа этапа 3 |

## 3. Модель данных (Prisma)

```prisma
enum PlannedOrderStatus {
  CREATED
  PUBLISHED
  MASTER_SELECTED
  CONFIRMED
  IN_PROGRESS
  DONE
  CLOSED
  EXPIRED
  CANCELLED_BY_CLIENT
  CANCELLED_BY_MASTER
  DISPUTE
}

model PlannedOrder {
  id             String   @id @default(uuid())
  clientId       String
  client         User     @relation("ClientPlannedOrders", fields: [clientId], references: [id])
  categoryId     String
  category       Category @relation(fields: [categoryId], references: [id])
  description    String
  address        String
  district       String
  scheduledAt    DateTime
  status         PlannedOrderStatus @default(CREATED)
  masterId       String?
  master         User?    @relation("MasterPlannedOrders", fields: [masterId], references: [id])
  selectedBidId  String?  @unique
  selectedBid    PlannedOrderBid? @relation("SelectedBid", fields: [selectedBidId], references: [id])
  workPrice      Int?
  cancelReason   String?
  publishedAt    DateTime?
  selectedAt     DateTime?
  confirmedAt    DateTime?
  completedAt    DateTime?
  closedAt       DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  bids           PlannedOrderBid[] @relation("OrderBids")

  @@index([clientId, status])
  @@index([masterId, status])
  @@index([categoryId, status])
}

model PlannedOrderBid {
  id             String   @id @default(uuid())
  plannedOrderId String
  order          PlannedOrder @relation("OrderBids", fields: [plannedOrderId], references: [id], onDelete: Cascade)
  masterUserId   String
  master         User     @relation(fields: [masterUserId], references: [id])
  price          Int
  term           String
  comment        String?
  createdAt      DateTime @default(now())
  selectedFor    PlannedOrder? @relation("SelectedBid")

  @@unique([plannedOrderId, masterUserId])
  @@index([plannedOrderId])
}

enum LeadCreditTxType {
  PURCHASE
  SPEND
  REFUND
}

model LeadCreditAccount {
  masterUserId String @id
  master       User   @relation(fields: [masterUserId], references: [id])
  balance      Int    @default(0)
}

model LeadCreditTransaction {
  id           String   @id @default(uuid())
  masterUserId String
  type         LeadCreditTxType
  amount       Int
  bidId        String?
  purchaseId   String?
  createdAt    DateTime @default(now())

  @@index([masterUserId, createdAt])
}

model LeadCreditPurchase {
  id           String        @id @default(uuid())
  masterUserId String
  credits      Int
  priceTenge   Int
  status       PaymentStatus
  providerRef  String
  createdAt    DateTime @default(now())
}
```

Дополнение к существующей модели: `MasterProfile.priorityPenaltyUntil DateTime?`.

Пакеты кредитов — константы в `lead-credits.config.ts` (не в БД, по прецеденту `pricing.config.ts` этапа 2): 1 кредит/500₸, 10/5000₸, 25/11000₸, 60/24000₸.

## 4. State machine (`PlannedOrdersService`)

Тот же паттерн, что в этапе 2: транзакция → `gate(id, from, data)` = `updateMany({id, status: from})`, `count===0` → 409 → побочные эффекты → WS после коммита.

| Из статуса | Событие | В статус | Побочные эффекты |
|---|---|---|---|
| — | клиент публикует (создание и публикация — одна операция, черновика нет) | `CREATED`→`PUBLISHED` | `publishedAt=now`; джоба `PLANNED_EXPIRY` на момент `scheduledAt` |
| `PUBLISHED` | мастер делает ставку | `PUBLISHED` (без смены) | атомарное списание 1 кредита + `PlannedOrderBid` + `LeadCreditTransaction(SPEND)`; лимит 5 бидов — 422 до списания |
| `PUBLISHED` | клиент выбирает бид | `MASTER_SELECTED` | `masterId`, `selectedBidId`, `selectedAt`; джоба `PLANNED_CONFIRM_TIMEOUT` (2ч); WS `bid:selected` / `bid:closed` |
| `MASTER_SELECTED` | мастер подтверждает | `CONFIRMED` | `confirmedAt`, `workPrice = bid.price`; клиенту открывается адрес/контакт |
| `MASTER_SELECTED` | мастер отклоняет явно **или** таймаут 2ч | `PUBLISHED` | `masterId=null`, `selectedBidId=null`; остальные биды сохраняются; без штрафа (штраф — только «после подтверждения», §3.9) |
| `PUBLISHED` | нет ставок к `scheduledAt` (джоба `PLANNED_EXPIRY`) | `EXPIRED` | только если `bids.count === 0`, иначе no-op |
| `CONFIRMED` | мастер «на месте» | `IN_PROGRESS` | — |
| `IN_PROGRESS` | мастер «выполнено» | `DONE` | джоба `AUTO_CLOSE` (24ч) |
| `DONE` | клиент подтвердил / авто | `CLOSED` | — |
| `DONE`/`IN_PROGRESS`/`CLOSED`* | открыт спор | `DISPUTE` | зарезервировано, обработка — этап 5 |

**Отмена (§3.9, плановый режим):**

| Кто | Когда | Действие |
|---|---|---|
| Клиент | `CREATED`/`PUBLISHED` (до выбора) | → `CANCELLED_BY_CLIENT`; кредиты уже откликнувшихся масterов **не** возвращаются |
| Клиент | `MASTER_SELECTED`/`CONFIRMED`/`IN_PROGRESS` | → `CANCELLED_BY_CLIENT`; кредит **возвращается полностью** выбранному мастеру: `balance += 1`, `LeadCreditTransaction(REFUND)` |
| Мастер | после `CONFIRMED` | → `CANCELLED_BY_MASTER`; штраф −2 кредита (баланс может уйти в минус) + `priorityPenaltyUntil = now+24ч`; заявка возвращается в `PUBLISHED`, `masterId`/`selectedBidId` сброшены, остальные биды сохраняются |

## 5. Лента и ставки (`PlannedOrdersService` / feed)

`GET /planned-orders/feed`: `WHERE status='PUBLISHED' AND categoryId IN (SELECT categoryId FROM MasterCategory WHERE masterProfileId=?)`, редактированный DTO (без `address`, без контакта клиента), сортировка по `scheduledAt` (ближайшие первые).

`POST /planned-orders/:id/bids`: в одной транзакции — 1) `PlannedOrder.status === PUBLISHED` иначе 404/409; 2) `bids.count < 5` иначе 422 «Достигнут лимит откликов»; 3) `UPDATE LeadCreditAccount SET balance = balance - 1 WHERE masterUserId=? AND balance>=1` — 0 строк ⇒ 422 «Недостаточно кредитов»; 4) `INSERT PlannedOrderBid` (уникальность `(plannedOrderId, masterUserId)` — повторный отклик того же мастера → 409); 5) `LeadCreditTransaction(SPEND)`; 6) WS `bid:new` клиенту.

## 6. Lead-кредиты и оплата (`LeadCreditsService`)

Расширение `PaymentProvider` (`payment.interface.ts`, этап 2):

```typescript
export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
}
```

`MockPaymentProvider.charge()` — синхронный успех, без hold/capture-пары (единомоментное списание, как в реальном Kaspi Pay при разовой оплате).

Флоу покупки: `POST /lead-credits/purchase {package}` → создать `LeadCreditPurchase(status=PENDING)` → `paymentProvider.charge(purchase.id, priceTenge)` → в одной транзакции `purchase.status=SUCCEEDED`, `LeadCreditAccount.balance += credits` (upsert), `LeadCreditTransaction(PURCHASE)`.

## 7. Realtime (`RealtimeGateway`, расширение)

- Сервер → клиент: `bid:new {plannedOrderId, bidsCount}` при новой ставке; `planned:status {plannedOrderId, status, master?, workPrice?}` на каждый переход.
- Сервер → мастер: `bid:selected {plannedOrderId}` выбранному; `bid:closed {plannedOrderId, reason}` остальным при выборе/отмене/истечении.
- Комнаты и авторизация — без изменений (JWT в handshake, `user:{userId}`); live-геолокация мастеров для планового режима не нужна (не завязан на presence/wave).

## 8. HTTP API

- Клиент: `POST /planned-orders` (создать+опубликовать), `GET /planned-orders/mine`, `GET /planned-orders/:id`, `POST /planned-orders/:id/select {bidId}`, `POST /planned-orders/:id/confirm-completion`, `POST /planned-orders/:id/cancel`.
- Мастер: `GET /planned-orders/feed`, `GET /planned-orders/:id` (редактированный до выбора), `POST /planned-orders/:id/bids {price, term, comment}`, `POST /planned-orders/:id/confirm`, `POST /planned-orders/:id/decline` (явный отказ = досрочный таймаут), `POST /planned-orders/:id/on-site`, `POST /planned-orders/:id/complete`, `POST /planned-orders/:id/cancel`.
- Lead-кредиты: `GET /lead-credits/balance`, `GET /lead-credits/packages`, `POST /lead-credits/purchase {package}`.

## 9. Экраны (mobile-first, тексты по-русски)

**Клиент:**
- Форма заявки (`NewOrderPage`) получает переключатель «Сейчас / Запланировать»; при «Запланировать» — календарь с датами/слотами (горизонт 14 дней) вместо мгновенной публикации.
- Плановая заявка (детально): список ставок (цена, срок, комментарий мастера) в реальном времени, кнопка «Выбрать» на каждой; после выбора — статус ожидания подтверждения мастером; после подтверждения — контакт мастера и степпер (Подтверждена → На месте → Выполнено).
- «Мои заявки» — общий список с бейджем «Сейчас» / «Запланировать».

**Мастер («Работа»):** сегмент-контрол «Срочные / Плановые» внутри существующей страницы. Плановая лента — карточки (категория, район, описание, дата, баланс кредитов сверху с кнопкой «Пополнить»); отклик — форма (цена, срок, комментарий) с подтверждением списания кредита. Экран «Кредиты»: баланс, список пакетов, покупка (мок).

## 10. Обработка ошибок и крайние случаи

Недостаточно кредитов при отклике → 422 с текущим балансом и ссылкой на покупку; лимит 5 бидов исчерпан → 422 до попытки списания; повторный отклик того же мастера → 409 (уникальный индекс); гонка «клиент выбирает два бида одновременно» → второй вызов 409 через гейт; ручной `/decline` мастера одновременно с истечением `PLANNED_CONFIRM_TIMEOUT` → гейт решает атомарно, проигравший получает 409 «предложение уже неактуально»; `PLANNED_EXPIRY` срабатывает, но заявка уже продвинулась (есть биды/выбран мастер) → no-op; попытка мастера открыть `GET /planned-orders/:id` до выбора → редактированный ответ без адреса/контакта (не ошибка, а урезанные данные).

## 11. Тестирование

Unit: атомарное списание/недостаточно кредитов (`LeadCreditsService`), список пакетов (константы). E2e (supertest + test-БД): happy path публикация→3 ставки→выбор→подтверждение→выполнение→закрытие; лимит 5 бидов; недостаточно кредитов → покупка → повторный отклик успешен; таймаут подтверждения возвращает в `PUBLISHED` с сохранёнными бидами, повторный выбор работает; явный `/decline` без штрафа; отмена клиентом до/после выбора (проверка возврата/невозврата кредита); отмена мастером после подтверждения (−2 кредита, `priorityPenaltyUntil` выставлен); `PLANNED_EXPIRY` без ставок → `EXPIRED`, с ставками → no-op. WS: `bid:new`, `bid:selected`, `bid:closed`, `planned:status` доставляются в нужные комнаты. Web — build + ручной сквозной сценарий двумя окнами (клиент + мастер) до `CLOSED`, сверка с Postgres — по прецеденту Task 14/15 этапа 2.
