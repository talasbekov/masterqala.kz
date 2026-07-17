# Этап 5 «Споры и отмены» — план реализации

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используйте superpowers:subagent-driven-development (рекомендовано) или superpowers:executing-plans для выполнения плана по задачам. Шаги используют чекбоксы (`- [ ]`) для отслеживания.

**Цель:** Санкция мастеру за отмену срочной заявки после `ПРИНЯТА` (сейчас отсутствует полностью), формальный трекинг отмен (скользящее окно 30 дней, 3-я → блокировка на 7 дней), спор (`Dispute`) с фото-доказательствами и разбором оператора (возврат сервисного сбора / штраф — независимые чекбоксы), заморозка авто-закрытия при открытом споре.

**Архитектура:** Общий сервис `MasterPenaltyService` (ядро штрафа + окно блокировки), переиспользуется отменой мастера в срочном и плановом режимах и разбором спора. Новый модуль `disputes` — `Dispute` как отдельная таблица (без нового статуса заявки, хотя `DISPUTE` уже существует неиспользуемым в `OrderStatus`/`PlannedOrderStatus` с этапов 2-3). Новый метод `PAYMENT_PROVIDER.refund()` по прецеденту `charge()`/`payout()`.

**Tech Stack:** NestJS, Prisma/PostgreSQL, class-validator, multer (загрузка фото), Jest+supertest (e2e), React+Vite+Tailwind.

**Ветка:** продолжение `stage2-urgent` в той же рабочей копии `.worktrees/stage2-urgent` — новой ветки/worktree не создаём (та же практика, что и с этапами 3-4).

## Global Constraints

- Окно скользящей блокировки: **3-я отмена мастером за 30 дней → блокировка на 7 дней** (§3.9, §6).
- Штраф за отмену/спор: **−2 кредита + понижение приоритета на 24ч** (§3.9).
- Окно открытия спора: **48ч после `closedAt`** (§6); на `ВЫПОЛНЕНА`/`В_РАБОТЕ` — без ограничения по времени, но заявка ещё не терминальна.
- Компенсация по спору в MVP — **только возврат сервисного сбора + санкции мастеру**, без гарантийного фонда/эскроу (§3.10).
- `DISPUTE` в `OrderStatus`/`PlannedOrderStatus` — существующее неиспользуемое enum-значение, **не используем** как переход статуса заявки; статус заявки при споре не меняется.
- Доказательства спора — только фото (`image/jpeg`, `image/png`), тот же `FileStorage`/лимит размера, что и документы мастера.
- `PAYMENT_PROVIDER.refund()` — мок всегда `SUCCEEDED`, без записи в `PaymentTransaction` (не привязано к заявке), как `charge()`/`payout()`.
- Атомарные гейты — `updateMany({ where: {...} }); count===0 → 409`, тот же паттерн, что и везде в кодовой базе.
- Один коммит на задачу, трейлер `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- e2e: `cd apps/api && npm run test:e2e` (тестовая БД `localhost:5433`, docker-контейнеры должны быть подняты).

## Карта файлов

| Файл | Ответственность |
|---|---|
| `apps/api/prisma/schema.prisma` | +`Dispute`, `MasterCancellation`, `DisputeStatus`, `DisputeTargetRole`, `CancelledOrderType`; `MasterProfile.blockedUntil`; `LeadCreditTxType.PENALTY` |
| `apps/api/src/payments/payment.interface.ts` | +`refund()` |
| `apps/api/src/payments/mock-payment.provider.ts` | Реализация `refund()` |
| `apps/api/src/common/master-penalty.service.ts` | Новый: `applyPenalty()`, `penalizeForCancellation()` |
| `apps/api/src/common/common.module.ts` | Новый: регистрация `MasterPenaltyService` |
| `apps/api/src/orders/orders.service.ts` | `cancelByMaster` — подключить штраф; `handleAutoClose` — проверка открытого спора |
| `apps/api/src/planned-orders/planned-orders.service.ts` | `cancelByMaster` — рефакторинг на общий сервис; `handleAutoClose` — проверка спора; `placeBid` — гейт по `blockedUntil` |
| `apps/api/src/pricing/pricing.service.ts` | `findNearestFreeMaster` — исключение заблокированных |
| `apps/api/src/orders/matching.service.ts` | `findCandidates` — исключение заблокированных |
| `apps/api/src/disputes/disputes.service.ts` | Новый: открытие/пояснение/доказательства/список/деталь/разрешение |
| `apps/api/src/disputes/disputes.controller.ts` | Новый: эндпоинты на заявках (`/orders/:id/disputes/...`, `/planned-orders/:id/disputes/...`) |
| `apps/api/src/disputes/admin-disputes.controller.ts` | Новый: `/admin/disputes` (только `OPERATOR`) |
| `apps/api/src/disputes/dto.ts` | Новый: DTO |
| `apps/api/src/disputes/disputes.module.ts` | Новый: регистрация модуля |
| `apps/api/src/app.module.ts` | Импорт `CommonModule`, `DisputesModule` |
| `apps/api/test/helpers.ts` | Обновлённый `resetDb` |
| `apps/web/src/pages/OrderPage.tsx` | Кнопка/карточка спора |
| `apps/web/src/pages/PlannedOrderPage.tsx` | Кнопка/карточка спора |
| `apps/web/src/pages/AdminDisputesPage.tsx` | Новый: список споров |
| `apps/web/src/pages/AdminDisputeDetailPage.tsx` | Новый: деталь + форма решения |
| `apps/web/src/pages/AdminListPage.tsx` | Ссылка на споры |
| `apps/web/src/pages/ProfilePage.tsx` | Баннер блокировки |
| `apps/web/src/orderStatus.ts` | Без изменений (лейбл `DISPUTE` уже есть, не используется) |
| `apps/web/src/App.tsx` | +2 маршрута |

---

### Task 1: Схема данных и миграция

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/test/helpers.ts`

**Interfaces:**
- Produces: модели `Dispute`, `MasterCancellation`, enum `DisputeStatus`, `DisputeTargetRole`, `CancelledOrderType`; `MasterProfile.blockedUntil: DateTime?`; `LeadCreditTxType.PENALTY`.

- [ ] **Step 1: Добавить `blockedUntil` в `MasterProfile`**

В `apps/api/prisma/schema.prisma` в блоке `model MasterProfile { ... }` после строки `priorityPenaltyUntil DateTime?` добавить:

```prisma
  blockedUntil    DateTime?
```

- [ ] **Step 2: Добавить значение `PENALTY` в `LeadCreditTxType`**

Заменить:
```prisma
enum LeadCreditTxType {
  PURCHASE
  SPEND
  REFUND
}
```
на:
```prisma
enum LeadCreditTxType {
  PURCHASE
  SPEND
  REFUND
  PENALTY
}
```

- [ ] **Step 3: Добавить relations в `User`**

Заменить блок `model User { ... }` (текущее содержимое заканчивается на `withdrawalRequests WithdrawalRequest[]`):

```prisma
model User {
  id             String         @id @default(uuid())
  phone          String         @unique
  name           String?
  defaultAddress String?
  role           UserRole       @default(CLIENT)
  createdAt      DateTime       @default(now())
  masterProfile  MasterProfile?
  decisions      VerificationDecision[]
  clientOrders   Order[]        @relation("ClientOrders")
  masterOrders   Order[]        @relation("MasterOrders")
  offers         OrderOffer[]
  presence       MasterPresence?
  accruals       Accrual[]
  clientPlannedOrders    PlannedOrder[]          @relation("ClientPlannedOrders")
  masterPlannedOrders    PlannedOrder[]          @relation("MasterPlannedOrders")
  plannedOrderBids       PlannedOrderBid[]
  leadCreditAccount      LeadCreditAccount?
  leadCreditTransactions LeadCreditTransaction[]
  leadCreditPurchases    LeadCreditPurchase[]
  masterWalletAccount    MasterWalletAccount?
  withdrawalRequests     WithdrawalRequest[]
  cancellations          MasterCancellation[]
  disputesOpened         Dispute[]               @relation("DisputesOpened")
  disputesResolved       Dispute[]               @relation("DisputesResolved")
}
```

- [ ] **Step 4: Добавить enum и модели в конец файла**

В конец `apps/api/prisma/schema.prisma` добавить:

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

Также добавить обратные связи в `Order` и `PlannedOrder`: в `model Order { ... }` после строки `accruals Accrual[]` добавить `disputes Dispute[]`; в `model PlannedOrder { ... }` после строки `bids PlannedOrderBid[] @relation("OrderBids")` добавить `disputes Dispute[]`.

- [ ] **Step 5: Сгенерировать миграцию БЕЗ применения**

Run: `cd apps/api && npx prisma migrate dev --name stage5_disputes_and_cancellations --create-only`
Expected: файл `apps/api/prisma/migrations/<timestamp>_stage5_disputes_and_cancellations/migration.sql` создан, но не применён (нужно для ручной правки ниже — применённую миграцию редактировать нельзя, Prisma засечёт расхождение чек-суммы). Проверить файл на `DROP INDEX` GIST-полей (`Order_location_idx`, `MasterPresence_location_idx`) — прецедент бага этапа 3 из-за дрифт-детекции по `Unsupported`-колонкам. Если есть — удалить эти строки (индексы должны остаться нетронутыми).

- [ ] **Step 6: Добавить частичные уникальные индексы вручную**

В конец файла `apps/api/prisma/migrations/<timestamp>_stage5_disputes_and_cancellations/migration.sql` (созданного, но ещё не применённого на Step 5) дописать:

```sql
CREATE UNIQUE INDEX "Dispute_open_order_unique" ON "Dispute" ("orderId") WHERE status = 'OPEN' AND "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "Dispute_open_planned_order_unique" ON "Dispute" ("plannedOrderId") WHERE status = 'OPEN' AND "plannedOrderId" IS NOT NULL;
```

Run: `cd apps/api && npx prisma migrate dev`
Expected: Prisma обнаруживает неприменённую (и уже отредактированную) миграцию и применяет её как есть, без повторной генерации; Prisma Client перегенерирован.

- [ ] **Step 7: Обновить `resetDb`**

В `apps/api/test/helpers.ts` заменить строку `TRUNCATE` в `resetDb`:

```typescript
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual","PlannedOrder","PlannedOrderBid","LeadCreditAccount","LeadCreditTransaction","LeadCreditPurchase","MasterWalletAccount","WithdrawalRequest","Dispute","MasterCancellation" CASCADE',
  );
}
```

- [ ] **Step 8: Прогнать существующий e2e-набор — регрессии быть не должно**

Run: `cd apps/api && npm run test:e2e`
Expected: все существующие тесты (30 suites / 114 тестов по состоянию после этапа 4) — PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/helpers.ts
git commit -m "$(cat <<'EOF'
feat(db): схема споров, лога отмен мастера и блокировки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `PAYMENT_PROVIDER.refund()`

**Files:**
- Modify: `apps/api/src/payments/payment.interface.ts`
- Modify: `apps/api/src/payments/mock-payment.provider.ts`

**Interfaces:**
- Produces: `PaymentProvider.refund(orderId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>`.

- [ ] **Step 1: Добавить метод в интерфейс**

В `apps/api/src/payments/payment.interface.ts` добавить в `PaymentProvider`:

```typescript
export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
  payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
  refund(orderId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
}
```

- [ ] **Step 2: Реализовать в моке**

В `apps/api/src/payments/mock-payment.provider.ts` добавить после `payout()`:

```typescript
  async refund(orderId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    void orderId;
    void amount;
    return { status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` };
  }
```

- [ ] **Step 3: Прогнать билд — интерфейс должен требовать реализацию во всех местах**

Run: `cd apps/api && npm run build`
Expected: билд зелёный (единственный имплементер `MockPaymentProvider` обновлён).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/payments/payment.interface.ts apps/api/src/payments/mock-payment.provider.ts
git commit -m "$(cat <<'EOF'
feat(payments): метод refund() для возврата сервисного сбора по спору

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `MasterPenaltyService`

**Files:**
- Create: `apps/api/src/common/master-penalty.service.ts`
- Create: `apps/api/src/common/common.module.ts`
- Test: `apps/api/src/common/master-penalty.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `Prisma.TransactionClient` (`Tx`, тип из `orders.service.ts`/`planned-orders.service.ts`).
- Produces: `MasterPenaltyService.applyPenalty(tx, masterUserId): Promise<void>`; `MasterPenaltyService.penalizeForCancellation(tx, masterUserId, orderType: 'URGENT'|'PLANNED', orderId): Promise<void>`.

- [ ] **Step 1: Написать unit-тест на скользящее окно**

Создать `apps/api/src/common/master-penalty.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPenaltyService } from './master-penalty.service';

describe('MasterPenaltyService — скользящее окно 30 дней', () => {
  let service: MasterPenaltyService;
  let countMock: jest.Mock;
  let updateManyProfileMock: jest.Mock;

  function makeTx(cancellationsInWindow: number) {
    countMock = jest.fn().mockResolvedValue(cancellationsInWindow);
    updateManyProfileMock = jest.fn().mockResolvedValue({ count: 1 });
    return {
      leadCreditAccount: { update: jest.fn().mockResolvedValue({}) },
      leadCreditTransaction: { create: jest.fn().mockResolvedValue({}) },
      masterProfile: { updateMany: updateManyProfileMock },
      masterCancellation: { create: jest.fn().mockResolvedValue({}), count: countMock },
    } as any;
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [MasterPenaltyService, { provide: PrismaService, useValue: {} }],
    }).compile();
    service = moduleRef.get(MasterPenaltyService);
  });

  it('2-я отмена в окне не блокирует', async () => {
    const tx = makeTx(2);
    await service.penalizeForCancellation(tx, 'master-1', 'URGENT', 'order-1');
    const blockCall = updateManyProfileMock.mock.calls.find((c) => 'blockedUntil' in c[0].data);
    expect(blockCall).toBeUndefined();
  });

  it('3-я отмена в окне блокирует на 7 дней', async () => {
    const tx = makeTx(3);
    await service.penalizeForCancellation(tx, 'master-1', 'URGENT', 'order-1');
    const blockCall = updateManyProfileMock.mock.calls.find((c) => 'blockedUntil' in c[0].data);
    expect(blockCall).toBeDefined();
    const blockedUntil: Date = blockCall![0].data.blockedUntil;
    const expectedMs = Date.now() + 7 * 24 * 3600 * 1000;
    expect(Math.abs(blockedUntil.getTime() - expectedMs)).toBeLessThan(5000);
  });

  it('applyPenalty не создаёт запись MasterCancellation и не блокирует', async () => {
    const tx = makeTx(0);
    await service.applyPenalty(tx, 'master-1');
    expect(tx.masterCancellation.create).not.toHaveBeenCalled();
    expect(updateManyProfileMock.mock.calls.some((c) => 'blockedUntil' in c[0].data)).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать тест — должен упасть (модуль не существует)**

Run: `cd apps/api && npx jest src/common/master-penalty.service.spec.ts`
Expected: FAIL — `Cannot find module './master-penalty.service'`.

- [ ] **Step 3: Реализовать сервис**

Создать `apps/api/src/common/master-penalty.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

const PENALTY_CREDITS = 2;
const PRIORITY_PENALTY_MS = 24 * 3600 * 1000;
const CANCELLATION_WINDOW_MS = 30 * 24 * 3600 * 1000;
const CANCELLATION_BLOCK_THRESHOLD = 3;
const BLOCK_DURATION_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class MasterPenaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ядро: −2 кредита + понижение приоритета. Не знает про отмены/окно блокировки. */
  async applyPenalty(tx: Tx, masterUserId: string): Promise<void> {
    await tx.leadCreditAccount.update({
      where: { masterUserId },
      data: { balance: { decrement: PENALTY_CREDITS } },
    });
    await tx.leadCreditTransaction.create({
      data: { masterUserId, type: 'PENALTY', amount: -PENALTY_CREDITS },
    });
    await tx.masterProfile.updateMany({
      where: { userId: masterUserId },
      data: { priorityPenaltyUntil: new Date(Date.now() + PRIORITY_PENALTY_MS) },
    });
  }

  /** Отмена мастером: штраф + запись в окно блокировки + проверка 3-й за 30 дней. */
  async penalizeForCancellation(
    tx: Tx,
    masterUserId: string,
    orderType: 'URGENT' | 'PLANNED',
    orderId: string,
  ): Promise<void> {
    await this.applyPenalty(tx, masterUserId);
    await tx.masterCancellation.create({ data: { masterUserId, orderType, orderId } });

    const since = new Date(Date.now() - CANCELLATION_WINDOW_MS);
    const count = await tx.masterCancellation.count({
      where: { masterUserId, createdAt: { gte: since } },
    });
    if (count >= CANCELLATION_BLOCK_THRESHOLD) {
      await tx.masterProfile.updateMany({
        where: { userId: masterUserId },
        data: { blockedUntil: new Date(Date.now() + BLOCK_DURATION_MS) },
      });
    }
  }
}
```

- [ ] **Step 4: Прогнать тест — должен пройти**

Run: `cd apps/api && npx jest src/common/master-penalty.service.spec.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Создать `CommonModule` и зарегистрировать**

Создать `apps/api/src/common/common.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MasterPenaltyService } from './master-penalty.service';

@Module({
  providers: [MasterPenaltyService],
  exports: [MasterPenaltyService],
})
export class CommonModule {}
```

В `apps/api/src/app.module.ts` добавить импорт `import { CommonModule } from './common/common.module';` и добавить `CommonModule` в массив `imports` (после `PrismaModule`).

- [ ] **Step 6: Прогнать билд**

Run: `cd apps/api && npm run build`
Expected: билд зелёный.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/master-penalty.service.ts apps/api/src/common/common.module.ts apps/api/src/common/master-penalty.service.spec.ts apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(common): MasterPenaltyService — штраф мастера и окно блокировки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Санкция мастеру за отмену срочной заявки

**Files:**
- Modify: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/orders/orders.service.ts:427-439` (`cancelByMaster`)
- Test: `apps/api/test/orders-cancel.e2e-spec.ts`

**Interfaces:**
- Consumes: `MasterPenaltyService.penalizeForCancellation(tx, masterUserId, 'URGENT', orderId)` (Task 3).

- [ ] **Step 1: Дописать существующий e2e-тест на отмену мастером**

В `apps/api/test/orders-cancel.e2e-spec.ts` заменить тест `'мастер отменяет после принятия: заявка снова в поиске, отменивший исключён'`:

```typescript
  it('мастер отменяет после принятия: заявка снова в поиске, отменивший исключён, штраф применён', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(m1.token, order.id, 'cancel').expect(201);

    let o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o).toMatchObject({ status: 'SEARCHING', masterId: null, searchAttempt: 2, wave: 0 });

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: m1.userId } });
    expect(account.balance).toBe(-2); // штраф применяется даже при нулевом стартовом балансе
    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: m1.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: m1.userId } });
    expect(profile.priorityPenaltyUntil).toBeTruthy();
    expect(await prisma.masterCancellation.count({ where: { masterUserId: m1.userId, orderType: 'URGENT' } })).toBe(1);

    await matching.handleWave({ orderId: order.id, wave: 1 });
    const offers2 = await prisma.orderOffer.findMany({ where: { orderId: order.id, attempt: 2 } });
    expect(offers2.map((x) => x.masterUserId)).toEqual([m2.userId]); // m1 исключён

    await post(m2.token, order.id, 'accept').expect(201);
    o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.masterId).toBe(m2.userId);
    // capture был при первом принятии и не дублируется
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(1);
  });

  it('3-я отмена мастером за 30 дней блокирует его на 7 дней', async () => {
    for (let i = 0; i < 3; i++) {
      const order = await createOrderViaApi(app, client.token, plumbingId);
      await matching.handleWave({ orderId: order.id, wave: 1 });
      await post(m1.token, order.id, 'accept').expect(201);
      await post(m1.token, order.id, 'cancel').expect(201);
    }
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: m1.userId } });
    expect(profile.blockedUntil).toBeTruthy();
    expect(profile.blockedUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });
```

- [ ] **Step 2: Прогнать тесты — новые упадут**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand orders-cancel`
Expected: FAIL на новых ассертах (баланс/PENALTY/blockedUntil не выставляются — штраф ещё не подключён).

- [ ] **Step 3: Подключить `MasterPenaltyService` в `OrdersModule`**

В `apps/api/src/orders/orders.module.ts` добавить импорт `import { CommonModule } from '../common/common.module';` и добавить `CommonModule` в массив `imports`.

- [ ] **Step 4: Подключить штраф в `cancelByMaster`**

В `apps/api/src/orders/orders.service.ts` добавить импорт `import { MasterPenaltyService } from '../common/master-penalty.service';`, добавить в конструктор `private readonly penalties: MasterPenaltyService,`. Заменить метод `cancelByMaster`:

```typescript
  private async cancelByMaster(order: Order): Promise<void> {
    // §3.9 + дизайн-дока §4: перезапуск поиска с волны 1, отменивший исключён
    // (его OrderOffer.outcome === 'ACCEPTED'); санкция мастеру — §3.9/этап 5.
    const masterUserId = order.masterId!;
    await this.prisma.$transaction(async (tx) => {
      await this.gate(
        order.id,
        ['ACCEPTED', 'MASTER_ON_WAY'],
        { status: 'SEARCHING', masterId: null, acceptedAt: null, wave: 0, searchAttempt: { increment: 1 } },
        tx,
      );
      await this.penalties.penalizeForCancellation(tx, masterUserId, 'URGENT', order.id);
    });
    await this.queue.send(JOBS.WAVE, { orderId: order.id, wave: 1 });
    await this.emitOrderStatus(order.id);
  }
```

- [ ] **Step 5: Прогнать тесты — должны пройти**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand orders-cancel`
Expected: PASS, все тесты файла.

- [ ] **Step 6: Прогнать полный e2e-набор — регрессии быть не должно**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites — PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/orders/orders.module.ts apps/api/src/orders/orders.service.ts apps/api/test/orders-cancel.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(orders): санкция мастеру за отмену срочной заявки после принятия

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Рефакторинг отмены мастером плановой заявки

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.module.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts:338-362` (`cancelByMaster`)
- Test: `apps/api/test/planned-orders-cancel.e2e-spec.ts`

**Interfaces:**
- Consumes: `MasterPenaltyService.penalizeForCancellation(tx, masterUserId, 'PLANNED', orderId)` (Task 3).

- [ ] **Step 1: Дописать существующий e2e-тест**

В `apps/api/test/planned-orders-cancel.e2e-spec.ts` заменить тест `'мастер отменяет после подтверждения: −2 кредита, штраф приоритета, заявка снова PUBLISHED'`:

```typescript
  it('мастер отменяет после подтверждения: −2 кредита (PENALTY), штраф приоритета, заявка снова PUBLISHED', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(2); // 5 - 1(ставка) - 2(штраф)
    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: master.userId } });
    expect(profile.priorityPenaltyUntil).toBeTruthy();
    expect(await prisma.masterCancellation.count({ where: { masterUserId: master.userId, orderType: 'PLANNED' } })).toBe(1);
  });

  it('3-я отмена мастером плановых заявок за 30 дней блокирует его на 7 дней', async () => {
    for (let i = 0; i < 3; i++) {
      const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
      await bidAndSelect(order.id, 7000 + i);
      await request(app.getHttpServer())
        .post(`/api/v1/planned-orders/${order.id}/confirm`)
        .set('Authorization', `Bearer ${master.token}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/planned-orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${master.token}`)
        .expect(201);
    }
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: master.userId } });
    expect(profile.blockedUntil).toBeTruthy();
  });
```

- [ ] **Step 2: Прогнать тесты — новые ассерты на `PENALTY`/`MasterCancellation` упадут**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand planned-orders-cancel`
Expected: FAIL на `type: 'PENALTY'` (сейчас пишется `SPEND`) и `masterCancellation.count` (таблица не заполняется).

- [ ] **Step 3: Подключить `CommonModule` в `PlannedOrdersModule`**

В `apps/api/src/planned-orders/planned-orders.module.ts` добавить импорт `import { CommonModule } from '../common/common.module';` и добавить `CommonModule` в `imports`.

- [ ] **Step 4: Рефакторинг `cancelByMaster`**

В `apps/api/src/planned-orders/planned-orders.service.ts` добавить импорт `import { MasterPenaltyService } from '../common/master-penalty.service';`, добавить в конструктор `private readonly penalties: MasterPenaltyService,`. Заменить метод `cancelByMaster`:

```typescript
  private async cancelByMaster(order: PlannedOrder): Promise<void> {
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(order.status)) {
      throw new ConflictException('На этом этапе отмена недоступна');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.gate(
        order.id,
        ['CONFIRMED', 'IN_PROGRESS'],
        { status: 'PUBLISHED', masterId: null, selectedBidId: null, selectedAt: null, confirmedAt: null },
        tx,
      );
      await this.penalties.penalizeForCancellation(tx, order.masterId!, 'PLANNED', order.id);
    });
    await this.emitPlannedStatus(order.id);
  }
```

- [ ] **Step 5: Прогнать тесты — должны пройти**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand planned-orders-cancel`
Expected: PASS, все тесты файла.

- [ ] **Step 6: Прогнать полный e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites — PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/planned-orders/planned-orders.module.ts apps/api/src/planned-orders/planned-orders.service.ts apps/api/test/planned-orders-cancel.e2e-spec.ts
git commit -m "$(cat <<'EOF'
refactor(planned-orders): переиспользовать MasterPenaltyService в отмене мастером

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Блокировка в матчинге срочных заявок

**Files:**
- Modify: `apps/api/src/pricing/pricing.service.ts:74-93` (`findNearestFreeMaster`)
- Modify: `apps/api/src/orders/matching.service.ts:114-145` (`findCandidates`)
- Test: `apps/api/test/pricing-quote.e2e-spec.ts`
- Test: `apps/api/test/matching-waves.e2e-spec.ts`

**Interfaces:**
- Consumes: `MasterProfile.blockedUntil` (Task 1).

- [ ] **Step 1: Написать падающий e2e-тест на матчинг**

В `apps/api/test/matching-waves.e2e-spec.ts` добавить тест (использовать существующие `beforeEach`-фикстуры файла — свериться с актуальным содержимым файла перед вставкой, паттерн `createActiveMaster`/`createOrderViaApi` идентичен `orders-cancel.e2e-spec.ts`):

```typescript
  it('заблокированный мастер (blockedUntil в будущем) не попадает в волну матчинга', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: m1.userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id, wave: 1 } });
    expect(offers.map((o) => o.masterUserId)).not.toContain(m1.userId);
    expect(offers.map((o) => o.masterUserId)).toContain(m2.userId);
  });
```

- [ ] **Step 2: Написать падающий e2e-тест на превью цены**

В `apps/api/test/pricing-quote.e2e-spec.ts` добавить тест по образцу существующего теста «мастер сам себе клиент» в этом файле:

```typescript
  it('заблокированный мастер не учитывается в превью цены', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: master.userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const quote = await pricing.quote(plumbingId, ALMATY, NO_CLIENT);
    expect(quote).toBeNull(); // единственный мастер в фикстуре заблокирован
  });
```

- [ ] **Step 3: Прогнать тесты — оба упадут**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand matching-waves pricing-quote`
Expected: FAIL (заблокированный мастер всё ещё попадает в кандидаты).

- [ ] **Step 4: Исключить заблокированных из `findNearestFreeMaster`**

В `apps/api/src/pricing/pricing.service.ts` в SQL-запросе `findNearestFreeMaster` добавить условие после строки `AND mp."masterUserId" <> ${clientId}`:

```sql
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
```

Полный обновлённый запрос (для точной вставки — весь `WHERE`-блок):

```sql
      WHERE mp."isOnline" = true AND mp.location IS NOT NULL
        AND mp."masterUserId" <> ${clientId}
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
        AND ST_DWithin(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography, ${MAX_SEARCH_RADIUS_M})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = mp."masterUserId"
            AND ao.status IN (${activeStatuses})
        )
```

- [ ] **Step 5: Исключить заблокированных из `findCandidates`**

В `apps/api/src/orders/matching.service.ts` в SQL-запросе `findCandidates` добавить условие после `WHERE mp."isOnline" = true`:

```sql
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
```

Полный обновлённый `WHERE`-блок (для точной вставки):

```sql
      WHERE mp."isOnline" = true
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
        AND mp.location IS NOT NULL
        AND o.location IS NOT NULL
        AND u.id <> ${clientId}
        AND ST_DWithin(mp.location, o.location, ${radiusM})
```

- [ ] **Step 6: Прогнать тесты — должны пройти**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand matching-waves pricing-quote`
Expected: PASS.

- [ ] **Step 7: Прогнать полный e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites — PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/pricing/pricing.service.ts apps/api/src/orders/matching.service.ts apps/api/test/matching-waves.e2e-spec.ts apps/api/test/pricing-quote.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(orders): исключить заблокированных мастеров из матчинга срочных заявок

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Блокировка ставок на плановые заявки

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts:129-167` (`placeBid`)
- Test: `apps/api/test/planned-orders-bids.e2e-spec.ts`

**Interfaces:**
- Consumes: `MasterProfile.blockedUntil` (Task 1).

- [ ] **Step 1: Написать падающий e2e-тест**

В `apps/api/test/planned-orders-bids.e2e-spec.ts` добавить (свериться с актуальными фикстурами файла — паттерн `master`/`plumbingId`/`grantLeadCredits` идентичен `planned-orders-cancel.e2e-spec.ts`):

```typescript
  it('заблокированный мастер не может сделать ставку (422)', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: master.userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(422);
  });

  it('мастер с истёкшей блокировкой снова может делать ставки', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: master.userId },
      data: { blockedUntil: new Date(Date.now() - 1000) },
    });
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);
  });
```

- [ ] **Step 2: Прогнать тесты — первый упадёт**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand planned-orders-bids`
Expected: FAIL (заблокированный мастер сейчас может ставить).

- [ ] **Step 3: Добавить гейт в `placeBid`**

В `apps/api/src/planned-orders/planned-orders.service.ts` в начале транзакции метода `placeBid` (сразу после `if (order.status !== 'PUBLISHED') throw new ConflictException(...)`) добавить:

```typescript
        const profile = await tx.masterProfile.findUnique({ where: { userId: masterUserId } });
        if (profile?.blockedUntil && profile.blockedUntil > new Date()) {
          throw new UnprocessableEntityException('Доступ к новым заявкам временно ограничен');
        }
```

- [ ] **Step 4: Прогнать тесты — должны пройти**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand planned-orders-bids`
Expected: PASS.

- [ ] **Step 5: Прогнать полный e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites — PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/planned-orders/planned-orders.service.ts apps/api/test/planned-orders-bids.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): запретить ставки заблокированному мастеру

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `DisputesService` — открытие спора и заморозка авто-закрытия

**Files:**
- Create: `apps/api/src/disputes/disputes.service.ts`
- Create: `apps/api/src/disputes/dto.ts`
- Create: `apps/api/src/disputes/disputes.module.ts`
- Modify: `apps/api/src/orders/orders.service.ts:358-362` (`handleAutoClose`)
- Modify: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts:255-259` (`handleAutoClose`)
- Modify: `apps/api/src/planned-orders/planned-orders.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/disputes-open.e2e-spec.ts`

**Interfaces:**
- Produces: `DisputesService.openForOrder(user, orderId, dto): Promise<Dispute>`; `DisputesService.openForPlannedOrder(user, plannedOrderId, dto): Promise<Dispute>`; `DisputesService.hasOpenDispute(orderId?, plannedOrderId?): Promise<boolean>`.
- Consumes: `Prisma.PrismaClientKnownRequestError` (код `P2002` для гонки на partial unique index, Task 1).

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/disputes-open.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Открытие спора по срочной заявке (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let orders: OrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  const post = (token: string, orderId: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77120000001');
    master = await createActiveMaster(app, '+77120000002', plumbingId);
  });

  async function toDone(): Promise<string> {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(master.token, order.id, 'accept').expect(201);
    await post(master.token, order.id, 'on-way').expect(201);
    await post(master.token, order.id, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, order.id, 'confirm-price').expect(201);
    await post(master.token, order.id, 'complete').expect(201);
    return order.id;
  }

  it('клиент открывает спор на заявке DONE', async () => {
    const orderId = await toDone();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп после ремонта' })
      .expect(201);
    expect(res.body).toMatchObject({ orderId, openedByRole: 'CLIENT', status: 'OPEN', reason: 'Потоп после ремонта' });
    expect(await prisma.dispute.count({ where: { orderId } })).toBe(1);
  });

  it('повторное открытие спора на той же заявке — 409', async () => {
    const orderId = await toDone();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Причина 1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ reason: 'Причина 2' })
      .expect(409);
  });

  it('посторонний не может открыть спор (403)', async () => {
    const orderId = await toDone();
    const stranger = await loginAs(app, '+77120000099');
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ reason: 'Причина' })
      .expect(403);
  });

  it('открытый спор замораживает авто-закрытие: handleAutoClose не закрывает заявку', async () => {
    const orderId = await toDone();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Причина' })
      .expect(201);

    await orders.handleAutoClose({ orderId });

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('DONE'); // не CLOSED — спор открыт
  });

  it('без открытого спора handleAutoClose закрывает заявку как обычно', async () => {
    const orderId = await toDone();
    await orders.handleAutoClose({ orderId });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('CLOSED');
  });
});
```

- [ ] **Step 2: Прогнать тест — упадёт (нет эндпоинта/модуля)**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand disputes-open`
Expected: FAIL — `Cannot POST /api/v1/orders/:id/disputes`.

- [ ] **Step 3: Создать DTO**

Создать `apps/api/src/disputes/dto.ts`:

```typescript
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OpenDisputeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
```

- [ ] **Step 4: Реализовать `DisputesService`**

Создать `apps/api/src/disputes/disputes.service.ts`:

```typescript
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpenDisputeDto } from './dto';

const DISPUTE_WINDOW_AFTER_CLOSE_MS = 48 * 3600 * 1000;

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async openForOrder(user: User, orderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { orderId });
  }

  async openForPlannedOrder(user: User, plannedOrderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { plannedOrderId });
  }

  private resolveRole(user: User, clientId: string, masterId: string | null): 'CLIENT' | 'MASTER' {
    if (user.id === clientId) return 'CLIENT';
    if (user.id === masterId) return 'MASTER';
    throw new ForbiddenException('Нет доступа к заявке');
  }

  private assertWithinWindow(status: string, closedAt: Date | null): void {
    const allowed = ['DONE', 'IN_PROGRESS', 'CLOSED'];
    if (!allowed.includes(status)) {
      throw new ConflictException('Спор недоступен на этом этапе заявки');
    }
    if (status === 'CLOSED') {
      if (!closedAt || Date.now() - closedAt.getTime() > DISPUTE_WINDOW_AFTER_CLOSE_MS) {
        throw new ConflictException('Окно открытия спора истекло');
      }
    }
  }

  private async create(
    userId: string,
    role: 'CLIENT' | 'MASTER',
    reason: string,
    target: { orderId: string } | { plannedOrderId: string },
  ) {
    try {
      return await this.prisma.dispute.create({
        data: { openedByUserId: userId, openedByRole: role, reason, ...target },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('По заявке уже открыт спор');
      }
      throw e;
    }
  }

  async hasOpenDispute(target: { orderId?: string; plannedOrderId?: string }): Promise<boolean> {
    const count = await this.prisma.dispute.count({ where: { ...target, status: 'OPEN' } });
    return count > 0;
  }
}
```

- [ ] **Step 5: Создать контроллер и модуль**

Создать `apps/api/src/disputes/disputes.controller.ts`:

```typescript
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:id/disputes')
  openForOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForOrder(user, id, dto);
  }

  @Post('planned-orders/:id/disputes')
  openForPlannedOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForPlannedOrder(user, id, dto);
  }
}
```

Создать `apps/api/src/disputes/disputes.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  providers: [DisputesService],
  controllers: [DisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
```

В `apps/api/src/app.module.ts` добавить импорт `import { DisputesModule } from './disputes/disputes.module';` и добавить `DisputesModule` в `imports`.

- [ ] **Step 6: Заморозить авто-закрытие в `OrdersService`**

В `apps/api/src/orders/orders.service.ts` добавить импорт `import { DisputesService } from '../disputes/disputes.service';`, добавить в конструктор `private readonly disputes: DisputesService,`. Заменить `handleAutoClose`:

```typescript
  /** Джоба: клиент молчал 24 ч после «Выполнено». Заморожена, пока открыт спор. */
  async handleAutoClose({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'DONE') return;
    if (await this.disputes.hasOpenDispute({ orderId })) return;
    await this.closeOrder(orderId);
  }
```

В `apps/api/src/orders/orders.module.ts` добавить импорт `import { DisputesModule } from '../disputes/disputes.module';` и добавить `DisputesModule` в `imports`.

- [ ] **Step 7: Заморозить авто-закрытие в `PlannedOrdersService`**

В `apps/api/src/planned-orders/planned-orders.service.ts` добавить импорт `import { DisputesService } from '../disputes/disputes.service';`, добавить в конструктор `private readonly disputes: DisputesService,`. Заменить `handleAutoClose`:

```typescript
  /** Джоба: клиент молчал 24ч после «Выполнено». Заморожена, пока открыт спор. */
  async handleAutoClose({ plannedOrderId }: { plannedOrderId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order || order.status !== 'DONE') return;
    if (await this.disputes.hasOpenDispute({ plannedOrderId })) return;
    await this.closeOrder(plannedOrderId);
  }
```

В `apps/api/src/planned-orders/planned-orders.module.ts` добавить импорт `import { DisputesModule } from '../disputes/disputes.module';` и добавить `DisputesModule` в `imports`.

- [ ] **Step 8: Внимание — циклическая зависимость модулей**

`DisputesModule` не импортирует `OrdersModule`/`PlannedOrdersModule` (только они его) — циклической зависимости нет, `DisputesController` работает независимо от `OrdersService`/`PlannedOrdersService`. Проверить это при билде на следующем шаге.

- [ ] **Step 9: Прогнать тесты**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand disputes-open`
Expected: PASS, все 5 тестов.

- [ ] **Step 10: Прогнать полный e2e-набор и билд**

Run: `cd apps/api && npm run test:e2e && npm run build`
Expected: все suites PASS, билд зелёный.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/disputes apps/api/src/orders/orders.service.ts apps/api/src/orders/orders.module.ts apps/api/src/planned-orders/planned-orders.service.ts apps/api/src/planned-orders/planned-orders.module.ts apps/api/src/app.module.ts apps/api/test/disputes-open.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(disputes): открытие спора по срочной и плановой заявке, заморозка авто-закрытия

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Доказательства и пояснение второй стороны

**Files:**
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Modify: `apps/api/src/disputes/disputes.controller.ts`
- Modify: `apps/api/src/disputes/dto.ts`
- Modify: `apps/api/src/disputes/disputes.module.ts`
- Test: `apps/api/test/disputes-evidence.e2e-spec.ts`

**Interfaces:**
- Consumes: `FileStorage`/`FILE_STORAGE` (`apps/api/src/storage/storage.interface.ts`, существует с этапа 1).
- Produces: `DisputesService.addEvidence(user, disputeId, file): Promise<Dispute>`; `DisputesService.addCounterStatement(user, disputeId, text): Promise<Dispute>`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/disputes-evidence.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Доказательства и пояснение по спору (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;
  let disputeId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77130000001');
    master = await createActiveMaster(app, '+77130000002', plumbingId);

    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
    await post(master.token, orderId, 'accept').expect(201);
    await post(master.token, orderId, 'on-way').expect(201);
    await post(master.token, orderId, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, orderId, 'confirm-price').expect(201);
    await post(master.token, orderId, 'complete').expect(201);

    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
    disputeId = disputeRes.body.id;
  });

  it('открывший спор загружает фото-доказательство', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'proof.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body.evidenceDocIds).toHaveLength(1);
  });

  it('загрузка не-изображения отклоняется (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from('not an image'), { filename: 'proof.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('вторая сторона добавляет пояснение', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ counterStatement: 'Работа выполнена качественно, потоп не связан' })
      .expect(200);
    expect(res.body.counterStatement).toBe('Работа выполнена качественно, потоп не связан');
  });

  it('открывший спор не может добавить пояснение как вторая сторона (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ counterStatement: 'Сам себе возражаю' })
      .expect(403);
  });

  it('посторонний не может загрузить доказательство (403)', async () => {
    const stranger = await loginAs(app, '+77130000099');
    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'proof.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });
});
```

- [ ] **Step 2: Прогнать тест — упадёт**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand disputes-evidence`
Expected: FAIL — эндпоинты не существуют.

- [ ] **Step 3: Добавить DTO**

В `apps/api/src/disputes/dto.ts` добавить:

```typescript
export class CounterStatementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  counterStatement!: string;
}
```

- [ ] **Step 4: Добавить методы в `DisputesService`**

В `apps/api/src/disputes/disputes.service.ts` добавить импорты `import { BadRequestException, Inject } from '@nestjs/common';` (дополнить существующий импорт из `@nestjs/common`) и `import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';`. Добавить в конструктор `@Inject(FILE_STORAGE) private readonly storage: FileStorage,`. Добавить константы и методы:

```typescript
const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ... внутри класса DisputesService:

  private async findOrThrow(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Спор не найден');
    return dispute;
  }

  /** Кто из участников заявки не является открывшим спор — та сторона может добавить доказательства/пояснение. */
  private async guardParticipant(userId: string, dispute: { orderId: string | null; plannedOrderId: string | null }) {
    if (dispute.orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: dispute.orderId } });
      if (userId !== order.clientId && userId !== order.masterId) throw new ForbiddenException('Нет доступа к спору');
      return;
    }
    const order = await this.prisma.plannedOrder.findUniqueOrThrow({ where: { id: dispute.plannedOrderId! } });
    if (userId !== order.clientId && userId !== order.masterId) throw new ForbiddenException('Нет доступа к спору');
  }

  async addEvidence(userId: string, disputeId: string, file: Express.Multer.File) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже закрыт');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Допустимы только JPEG и PNG');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Файл больше 10 МБ');
    const relPath = await this.storage.save(file.buffer, ext);
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { evidenceDocIds: { push: relPath } },
    });
  }

  async addCounterStatement(userId: string, disputeId: string, counterStatement: string) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже закрыт');
    if (userId === dispute.openedByUserId) throw new ForbiddenException('Пояснение добавляет только вторая сторона');
    return this.prisma.dispute.update({ where: { id: disputeId }, data: { counterStatement } });
  }
```

- [ ] **Step 5: Добавить эндпоинты в контроллер**

В `apps/api/src/disputes/disputes.controller.ts` заменить импорты и добавить методы:

```typescript
import { Body, Controller, Param, Patch, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto, CounterStatementDto } from './dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:id/disputes')
  openForOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForOrder(user, id, dto);
  }

  @Post('planned-orders/:id/disputes')
  openForPlannedOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForPlannedOrder(user, id, dto);
  }

  @Post('disputes/:id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  addEvidence(@CurrentUser() user: User, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    return this.disputes.addEvidence(user.id, id, file);
  }

  @Patch('disputes/:id')
  addCounterStatement(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CounterStatementDto) {
    return this.disputes.addCounterStatement(user.id, id, dto.counterStatement);
  }
}
```

- [ ] **Step 6: Подключить `StorageModule`**

В `apps/api/src/disputes/disputes.module.ts` добавить импорт `import { StorageModule } from '../storage/storage.module';` и добавить `imports: [StorageModule],` в `@Module`.

- [ ] **Step 7: Прогнать тесты**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand disputes-evidence`
Expected: PASS, все 5 тестов.

- [ ] **Step 8: Прогнать полный e2e-набор и билд**

Run: `cd apps/api && npm run test:e2e && npm run build`
Expected: все suites PASS, билд зелёный.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/disputes
git commit -m "$(cat <<'EOF'
feat(disputes): загрузка фото-доказательств и пояснение второй стороны

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Разбор оператором

**Files:**
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Create: `apps/api/src/disputes/admin-disputes.controller.ts`
- Modify: `apps/api/src/disputes/dto.ts`
- Modify: `apps/api/src/disputes/disputes.module.ts`
- Test: `apps/api/test/admin-disputes.e2e-spec.ts`

**Interfaces:**
- Consumes: `PAYMENT_PROVIDER.refund()` (Task 2), `MasterPenaltyService.applyPenalty()` (Task 3).
- Produces: `DisputesService.listAll(status?): Promise<Dispute[]>`; `DisputesService.getById(id): Promise<Dispute>`; `DisputesService.resolve(operatorId, disputeId, dto): Promise<Dispute>`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/admin-disputes.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Разбор спора оператором (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let orders: OrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let operator: { token: string; userId: string };
  let orderId: string;
  let disputeId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77140000001');
    master = await createActiveMaster(app, '+77140000002', plumbingId);
    operator = await loginAs(app, '+77140000003', 'OPERATOR');

    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
    await post(master.token, orderId, 'accept').expect(201);
    await post(master.token, orderId, 'on-way').expect(201);
    await post(master.token, orderId, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, orderId, 'confirm-price').expect(201);
    await post(master.token, orderId, 'complete').expect(201);

    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
    disputeId = disputeRes.body.id;
  });

  it('оператор видит список открытых споров', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/disputes?status=OPEN')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(disputeId);
  });

  it('оператор видит деталь спора', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(res.body.reason).toBe('Потоп');
  });

  it('не-оператор не имеет доступа к списку споров (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/disputes')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('оператор разрешает спор с возвратом сбора и штрафом мастеру: заявка DONE→CLOSED, сбор возвращён, штраф применён', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: true, penalizeMaster: true, resolutionNote: 'Подтверждено фото' })
      .expect(201);

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    expect(dispute).toMatchObject({ status: 'RESOLVED', refundServiceFee: true, penalizeMaster: true });
    expect(dispute.resolvedByUserId).toBe(operator.userId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED'); // была DONE, заморожена спором, спор закрыт здесь же

    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);
    // санкция за спор НЕ считается в окно блокировки за отмены (§3.9 vs §3.10 — разные основания)
    expect(await prisma.masterCancellation.count({ where: { masterUserId: master.userId } })).toBe(0);
  });

  it('оператор разрешает спор без санкций: заявка закрывается, штраф не применяется', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Не подтверждено' })
      .expect(201);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED');
    expect(await prisma.leadCreditTransaction.count({ where: { masterUserId: master.userId, type: 'PENALTY' } })).toBe(0);
  });

  it('повторное разрешение уже разрешённого спора — 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Первое решение' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Повтор' })
      .expect(409);
  });

  it('handleAutoClose после разрешения спора — идемпотентный no-op (заявка уже CLOSED)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'ok' })
      .expect(201);
    await orders.handleAutoClose({ orderId }); // не должен бросить и не должен ничего менять
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED');
  });
});
```

- [ ] **Step 2: Прогнать тест — упадёт**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand admin-disputes`
Expected: FAIL — эндпоинты не существуют.

- [ ] **Step 3: Добавить DTO**

В `apps/api/src/disputes/dto.ts` добавить:

```typescript
import { IsBoolean, IsOptional } from 'class-validator';

export class ResolveDisputeDto {
  @IsBoolean()
  refundServiceFee!: boolean;

  @IsBoolean()
  penalizeMaster!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNote!: string;
}
```

(добавить `IsBoolean` в существующий импорт из `class-validator` в начале файла, если он там уже есть — объединить в одну строку импорта).

- [ ] **Step 4: Добавить методы в `DisputesService`**

В `apps/api/src/disputes/disputes.service.ts` добавить импорты `import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';` и `import { MasterPenaltyService } from '../common/master-penalty.service';`. Добавить в конструктор:

```typescript
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly penalties: MasterPenaltyService,
```

Добавить методы:

```typescript
  async listAll(status?: 'OPEN' | 'RESOLVED') {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return this.findOrThrow(id);
  }

  async resolve(operatorId: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.findOrThrow(disputeId);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже разрешён');

    const orderId = dispute.orderId;
    const plannedOrderId = dispute.plannedOrderId;

    await this.prisma.$transaction(async (tx) => {
      const gated = await tx.dispute.updateMany({
        where: { id: disputeId, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          refundServiceFee: dto.refundServiceFee,
          penalizeMaster: dto.penalizeMaster,
          resolutionNote: dto.resolutionNote,
          resolvedByUserId: operatorId,
          resolvedAt: new Date(),
        },
      });
      if (gated.count === 0) throw new ConflictException('Спор уже разрешён');

      if (orderId) {
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
        if (dto.penalizeMaster && order.masterId) await this.penalties.applyPenalty(tx, order.masterId);
        if (order.status === 'DONE') {
          await tx.order.updateMany({ where: { id: orderId, status: 'DONE' }, data: { status: 'CLOSED', closedAt: new Date() } });
        }
      } else if (plannedOrderId) {
        const order = await tx.plannedOrder.findUniqueOrThrow({ where: { id: plannedOrderId } });
        if (dto.penalizeMaster && order.masterId) await this.penalties.applyPenalty(tx, order.masterId);
        if (order.status === 'DONE') {
          await tx.plannedOrder.updateMany({ where: { id: plannedOrderId, status: 'DONE' }, data: { status: 'CLOSED', closedAt: new Date() } });
        }
      }
    });

    if (dto.refundServiceFee && orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.payments.refund(orderId, order.serviceFee);
    }

    return this.findOrThrow(disputeId);
  }
```

- [ ] **Step 5: Создать `AdminDisputesController`**

Создать `apps/api/src/disputes/admin-disputes.controller.ts`:

```typescript
import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DisputeStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DisputesService } from './disputes.service';
import { ResolveDisputeDto } from './dto';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(DisputeStatus, { optional: true })) status?: DisputeStatus) {
    return this.disputes.listAll(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.disputes.getById(id);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve('', id, dto); // operatorId подставляется ниже через @CurrentUser
  }
}
```

Немедленно исправить последний метод — использовать `@CurrentUser()` (как и везде в кодовой базе), заменить весь класс на:

```typescript
import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DisputeStatus, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { ResolveDisputeDto } from './dto';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(DisputeStatus, { optional: true })) status?: DisputeStatus) {
    return this.disputes.listAll(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.disputes.getById(id);
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve(operator.id, id, dto);
  }
}
```

- [ ] **Step 6: Зарегистрировать контроллер и модули**

В `apps/api/src/disputes/disputes.module.ts` добавить импорты `import { PaymentsModule } from '../payments/payments.module';` и `import { CommonModule } from '../common/common.module';`, добавить их в `imports` (вместе с `StorageModule`), добавить `AdminDisputesController` в `controllers`.

- [ ] **Step 7: Прогнать тесты**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand admin-disputes`
Expected: PASS, все 7 тестов.

- [ ] **Step 8: Прогнать полный e2e-набор и билд**

Run: `cd apps/api && npm run test:e2e && npm run build`
Expected: все suites PASS, билд зелёный.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/disputes
git commit -m "$(cat <<'EOF'
feat(disputes): разбор оператором — список, деталь, решение

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Веб — спор на странице заявки

**Files:**
- Modify: `apps/web/src/pages/OrderPage.tsx`
- Modify: `apps/web/src/pages/PlannedOrderPage.tsx`

**Interfaces:**
- Consumes: `api()`/`apiUpload()` (`apps/web/src/api.ts`, существуют); `GET /orders/:id`/`GET /planned-orders/:id` теперь включают `dispute: Dispute | null` (Prisma-связь `disputes` уже подключена к `include` неявно через отдельный запрос — см. Step 1).

- [ ] **Step 1: Добавить `dispute` в ответ `GET /orders/:id` и `GET /planned-orders/:id`**

В `apps/api/src/orders/orders.service.ts` в методе `findOrThrow` заменить на подгрузку последнего спора (не через `include` в `ORDER_INCLUDE`, чтобы не тянуть спор во все остальные списочные запросы):

```typescript
  async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
    return { ...order, dispute };
  }
```

Аналогично в `apps/api/src/planned-orders/planned-orders.service.ts` в методе `findOrThrow`:

```typescript
  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { plannedOrderId: id }, orderBy: { createdAt: 'desc' } });
    return { ...order, dispute };
  }
```

- [ ] **Step 2: Прогнать существующий e2e-набор — проверить, что расширение ответа не ломает существующие ассерты**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites PASS (существующие тесты используют `toMatchObject`, который допускает лишние поля).

- [ ] **Step 3: Добавить блок спора в `OrderPage.tsx`**

В `apps/web/src/pages/OrderPage.tsx` добавить импорт `import { apiUpload } from '../api';` (дополнить существующий импорт `api` из `'../api'` в одну строку: `import { api, apiUpload } from '../api';`). Добавить перед `return` основного JSX (после блока `if (isTerminalStatus(order.status))`, то есть в общей ветке рендера для `DONE`/`IN_PROGRESS`) новый компонент-блок и функции:

```typescript
  const [disputeReason, setDisputeReason] = useState('');
  const [counterStatement, setCounterStatement] = useState('');
  const canDispute = ['DONE', 'IN_PROGRESS', 'CLOSED'].includes(order.status) && !order.dispute;

  async function openDispute() {
    if (!disputeReason.trim()) return;
    try {
      await api(`/orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
      setDisputeReason('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submitCounterStatement() {
    if (!order.dispute || !counterStatement.trim()) return;
    try {
      await api(`/disputes/${order.dispute.id}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
      setCounterStatement('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function uploadEvidence(file: File) {
    if (!order.dispute) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${order.dispute.id}/evidence`, fd);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }
```

Добавить рендер блока спора внутри `isTerminalStatus`-ветки (после `{order.cancelReason && ...}`) и в общей ветке (после `</ol>`, перед `<div className="fixed ...">`):

```tsx
      {order.dispute && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 space-y-2 text-left">
          <div className="font-semibold text-orange-800">Спор {order.dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
          <p className="text-sm text-gray-700">{order.dispute.reason}</p>
          {order.dispute.counterStatement && (
            <p className="text-sm text-gray-600">Пояснение: {order.dispute.counterStatement}</p>
          )}
          {order.dispute.status === 'RESOLVED' && (
            <p className="text-sm text-gray-600">
              Решение: {order.dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {order.dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
            </p>
          )}
          {order.dispute.status === 'OPEN' && (
            <div className="space-y-2">
              <input
                type="file" accept="image/jpeg,image/png"
                onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
              />
              <textarea
                className="w-full rounded border p-2 text-sm"
                placeholder="Пояснение (для второй стороны)"
                value={counterStatement}
                onChange={(e) => setCounterStatement(e.target.value)}
              />
              <button className="rounded border px-3 py-1 text-sm" onClick={submitCounterStatement}>Отправить пояснение</button>
            </div>
          )}
        </div>
      )}
      {canDispute && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded border p-2 text-sm"
            placeholder="Причина спора"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <button className="w-full rounded border border-orange-300 p-2 text-sm text-orange-700" onClick={openDispute}>
            Открыть спор
          </button>
        </div>
      )}
```

- [ ] **Step 4: Повторить блок спора в `PlannedOrderPage.tsx`**

В `apps/web/src/pages/PlannedOrderPage.tsx` внести те же изменения (импорт `apiUpload`, стейты, функции `openDispute`/`submitCounterStatement`/`uploadEvidence` — идентичные, только эндпоинты `/planned-orders/${id}/disputes` вместо `/orders/${id}/disputes`), и тот же JSX-блок, вставленный после `{isPlannedTerminalStatus(order.status) && (...)}`.

- [ ] **Step 5: Собрать web**

Run: `cd apps/web && npm run build`
Expected: билд зелёный, без TS-ошибок.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/orders/orders.service.ts apps/api/src/planned-orders/planned-orders.service.ts apps/web/src/pages/OrderPage.tsx apps/web/src/pages/PlannedOrderPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): открытие спора, доказательства и пояснение на странице заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Веб — админка споров и баннер блокировки

**Files:**
- Create: `apps/web/src/pages/AdminDisputesPage.tsx`
- Create: `apps/web/src/pages/AdminDisputeDetailPage.tsx`
- Modify: `apps/web/src/pages/AdminListPage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/api/src/disputes/disputes.service.ts` (`getEvidenceStream`)
- Modify: `apps/api/src/disputes/disputes.controller.ts` (эндпоинт скачивания)
- Modify: `apps/api/src/users/users.service.ts` (или соответствующий метод `getMe`)

**Interfaces:**
- Consumes: `GET /admin/disputes`, `GET /admin/disputes/:id`, `POST /admin/disputes/:id/resolve` (Task 10); `GET /users/me` уже возвращает поля пользователя — для баннера блокировки нужен `masterProfile.blockedUntil`, добавляется в Step 1.
- Produces: `DisputesService.getEvidenceStream(disputeId, docPath): Promise<ReadStream>`.

- [ ] **Step 1: Добавить `blockedUntil` в ответ `GET /users/me` для мастеров**

Проверить `apps/api/src/users/users.service.ts` — найти метод, отдающий текущего пользователя (обычно `getMe`/аналог), и убедиться, что он включает `masterProfile: { select: { blockedUntil: true } }` в свой `include`/`select`. Если метод сейчас возвращает пользователя без профиля — добавить `include: { masterProfile: { select: { blockedUntil: true, status: true } } }` к соответствующему `prisma.user.findUnique`.

- [ ] **Step 2: Создать `AdminDisputesPage.tsx`**

Создать `apps/web/src/pages/AdminDisputesPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Открыт', RESOLVED: 'Разрешён' };

interface Row {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: string;
  status: string;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/disputes?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К заявкам мастеров</Link>
      <h1 className="text-2xl font-bold">Споры</h1>
      <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="OPEN">Открытые</option>
        <option value="RESOLVED">Разрешённые</option>
      </select>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/disputes/${r.id}`} className="block p-3 hover:bg-gray-50">
              <span className="font-semibold">{r.orderId ? 'Срочная' : 'Плановая'}</span> ·{' '}
              открыл {r.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'} ·{' '}
              <span className="text-sm text-gray-500">{STATUS_LABELS[r.status]} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Создать `AdminDisputeDetailPage.tsx`**

Создать `apps/web/src/pages/AdminDisputeDetailPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface Detail {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: string;
  reason: string;
  counterStatement: string | null;
  evidenceDocIds: string[];
  status: string;
}

export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [refundServiceFee, setRefundServiceFee] = useState(false);
  const [penalizeMaster, setPenalizeMaster] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/disputes/${id}`).then(setDetail);
  }, [id]);

  async function resolve() {
    setError('');
    try {
      await api(`/admin/disputes/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ refundServiceFee, penalizeMaster, resolutionNote }),
      });
      navigate('/admin/disputes');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openEvidence(relPath: string) {
    const res = await fetch(`${API}/disputes/${id}/evidence/${encodeURIComponent(relPath)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) return setError(`Не удалось открыть документ (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (!detail) return <p className="p-6">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin/disputes" className="text-sm text-gray-500">← К списку</Link>
      <h1 className="text-2xl font-bold">Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке</h1>
      <div className="rounded border p-4 space-y-1">
        <p>Открыл: {detail.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'}</p>
        <p>Причина: {detail.reason}</p>
        {detail.counterStatement && <p>Пояснение второй стороны: {detail.counterStatement}</p>}
      </div>
      {detail.evidenceDocIds.length > 0 && (
        <div className="rounded border p-4">
          <h2 className="font-semibold">Доказательства</h2>
          <ul>
            {detail.evidenceDocIds.map((docId) => (
              <li key={docId}>
                <button className="text-teal-700 underline" onClick={() => openEvidence(docId)}>Фото</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.status === 'OPEN' && (
        <div className="rounded border p-4 space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={refundServiceFee} onChange={(e) => setRefundServiceFee(e.target.checked)} />
            Вернуть сервисный сбор клиенту
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={penalizeMaster} onChange={(e) => setPenalizeMaster(e.target.checked)} />
            Оштрафовать мастера
          </label>
          <textarea
            className="w-full rounded border p-2"
            placeholder="Комментарий к решению"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
          <button className="rounded bg-teal-700 px-4 py-2 text-white" onClick={resolve}>Закрыть спор</button>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Эндпоинт скачивания доказательства**

Скачивание идёт через `DisputesService` (не напрямую `PrismaService` в контроллере — по прецеденту находки финального ревью этапа 4 про `AdminWithdrawalsController`, здесь сразу делаем правильно). В `apps/api/src/disputes/disputes.service.ts` добавить импорт `import { createReadStream } from 'fs';` и метод:

```typescript
  async getEvidenceStream(disputeId: string, docPath: string) {
    const dispute = await this.findOrThrow(disputeId);
    if (!dispute.evidenceDocIds.includes(docPath)) throw new NotFoundException('Документ не найден');
    return createReadStream(this.storage.absolutePath(docPath));
  }
```

В `apps/api/src/disputes/disputes.controller.ts` добавить импорты `import { Get, StreamableFile } from '@nestjs/common';` (объединить с существующим импортом из `@nestjs/common`) и добавить метод:

```typescript
  @Get('disputes/:id/evidence/:docPath')
  async evidence(@Param('id') id: string, @Param('docPath') docPath: string) {
    const stream = await this.disputes.getEvidenceStream(id, docPath);
    return new StreamableFile(stream, { type: 'image/jpeg', disposition: 'inline' });
  }
```

- [ ] **Step 5: Ссылка на споры в `AdminListPage.tsx`**

В `apps/web/src/pages/AdminListPage.tsx` заменить строку с существующей ссылкой на вывод:

```tsx
        <Link to="/admin/withdrawals" className="text-sm text-teal-700 underline">Заявки на вывод</Link>
```
на:
```tsx
        <Link to="/admin/withdrawals" className="text-sm text-teal-700 underline">Заявки на вывод</Link>
        <Link to="/admin/disputes" className="text-sm text-teal-700 underline">Споры</Link>
```

- [ ] **Step 6: Баннер блокировки в `ProfilePage.tsx`**

В `apps/web/src/pages/ProfilePage.tsx` добавить состояние и загрузку:

```typescript
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  useEffect(() => {
    api('/users/me').then((me) => {
      setName(me.name ?? '');
      setAddress(me.defaultAddress ?? '');
      setBlockedUntil(me.masterProfile?.blockedUntil ?? null);
    });
  }, []);
```

(заменить существующий `useEffect` с тем же телом плюс новая строка `setBlockedUntil`). Добавить рендер баннера перед строкой `<Link to="/become-master" ...>`:

```tsx
      {blockedUntil && new Date(blockedUntil) > new Date() && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Доступ к новым заявкам временно ограничен до {new Date(blockedUntil).toLocaleDateString('ru-RU')}
        </div>
      )}
```

- [ ] **Step 7: Маршруты**

В `apps/web/src/App.tsx` добавить импорты `import AdminDisputesPage from './pages/AdminDisputesPage';` и `import AdminDisputeDetailPage from './pages/AdminDisputeDetailPage';`. В блок `<Route element={<RequireOperator />}>` добавить:

```tsx
              <Route path="/admin/disputes" element={<AdminDisputesPage />} />
              <Route path="/admin/disputes/:id" element={<AdminDisputeDetailPage />} />
```

- [ ] **Step 8: Собрать оба приложения**

Run: `cd apps/api && npm run build && cd ../web && npm run build`
Expected: оба билда зелёные.

- [ ] **Step 9: Прогнать полный e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/disputes apps/web/src/pages/AdminDisputesPage.tsx apps/web/src/pages/AdminDisputeDetailPage.tsx apps/web/src/pages/AdminListPage.tsx apps/web/src/pages/ProfilePage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): админка споров и баннер блокировки мастера

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Сквозная проверка

**Files:**
- Test: полный прогон существующего набора, оба билда.

**Interfaces:**
- Consumes: все методы из Tasks 1–12.

- [ ] **Step 1: Прогнать весь backend e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites (этапы 1–5) — PASS, без регрессий.

- [ ] **Step 2: Прогнать unit-тесты**

Run: `cd apps/api && npx jest --testPathIgnorePatterns=test/`
Expected: `master-penalty.service.spec.ts` и все существующие unit-тесты — PASS.

- [ ] **Step 3: Собрать оба приложения**

Run: `cd apps/api && npm run build && cd ../web && npm run build`
Expected: оба билда зелёные, без ошибок TypeScript.

- [ ] **Step 4: Ручная браузерная проверка**

Не кодовый шаг — выполняется после Step 3 в браузере (см. прецедент этапов 2–4): пройти сценарий «мастер трижды отменяет срочные заявки подряд → на 3-й заблокирован на 7 дней → не получает новых офферов → клиент открывает спор на выполненной заявке другого мастера → прикладывает фото → второй мастер добавляет пояснение → оператор в `/admin/disputes` видит спор, доказательство открывается, разрешает с возвратом сбора и штрафом → заявка закрыта, штраф виден в истории мастера, баннер блокировки виден в профиле». Сверять каждый шаг с Postgres напрямую (`docker exec masterqalakz-db-1 psql -U masterqala -d masterqala`). Задокументировать результат в `.superpowers/sdd/progress.md` (не в git).
