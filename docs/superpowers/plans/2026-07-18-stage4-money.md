# Этап 4 «Деньги» — план реализации

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используйте superpowers:subagent-driven-development (рекомендовано) или superpowers:executing-plans для выполнения плана по задачам. Шаги используют чекбоксы (`- [ ]`) для отслеживания.

**Цель:** Денежный кошелёк мастера (баланс, наполняемый компенсациями выезда), вывод средств через мок-Kaspi (`PAYMENT_PROVIDER.payout()`), минимальная админ-панель заявок на вывод; плюс фикс расхождения фильтров `PricingService`/`MatchingService` из бэклога этапа 2.

**Архитектура:** Новый модуль `wallet` (баланс + вывод + админ-эндпоинт), правка существующего `OrdersService.accrueCompensation` (этап 2) для атомарного зачисления на баланс, третий метод `payout()` в уже существующем `PAYMENT_PROVIDER`.

**Tech Stack:** NestJS, Prisma/PostgreSQL, class-validator, Jest+supertest (e2e), React+Vite+Tailwind.

**Ветка:** продолжение `stage3-planned` в той же рабочей копии `.worktrees/stage3-planned` — новой ветки/worktree не создаём (этап 4 не имеет отдельной ветки-предшественника, стартует сразу после реализации этапа 3 на той же копии; финальное разделение веток — решение пользователя при завершении, как и с этапами 1–3).

## Global Constraints

- Минимальная сумма вывода: **5 000 ₸** (§6).
- Комиссия за вывод: **0** (§6).
- Реквизиты выплаты — `User.phone` напрямую, без отдельной модели.
- Списание с баланса — сразу при запросе вывода (одно число, не available/frozen), возврат — при неуспехе.
- `PAYMENT_PROVIDER.payout()` — мок всегда `SUCCEEDED`, без записи в `PaymentTransaction` (не привязано к заявке), как и `charge()`.
- Транзакции БД — `prisma.$transaction`; атомарное списание баланса — `updateMany({ where: { balance: { gte: amount } } })`, `count===0` → 422, тот же паттерн, что `LeadCreditAccount` в этапе 3.
- Видимость оператору — маскированный телефон (последние 4 цифры), read-only.
- Один коммит на задачу, трейлер `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- e2e: `cd apps/api && npm run test:e2e` (тестовая БД `localhost:5433`, docker-контейнеры должны быть подняты).

## Карта файлов

| Файл | Ответственность |
|---|---|
| `apps/api/prisma/schema.prisma` | +`WithdrawalStatus`, `MasterWalletAccount`, `WithdrawalRequest`, relations в `User` |
| `apps/api/src/orders/orders.service.ts` | Правка `accrueCompensation` — атомарное зачисление на баланс кошелька |
| `apps/api/src/payments/payment.interface.ts` | +`payout()` |
| `apps/api/src/payments/mock-payment.provider.ts` | Реализация `payout()` |
| `apps/api/src/wallet/wallet.constants.ts` | `MIN_WITHDRAWAL_TENGE` |
| `apps/api/src/wallet/dto.ts` | `CreateWithdrawalDto` |
| `apps/api/src/wallet/wallet.service.ts` | Баланс, история, `request()` |
| `apps/api/src/wallet/wallet.controller.ts` | `GET /wallet/balance`, `GET /wallet/withdrawals`, `POST /wallet/withdrawals` |
| `apps/api/src/wallet/admin-withdrawals.controller.ts` | `GET /admin/withdrawals` (только `OPERATOR`) |
| `apps/api/src/wallet/wallet.module.ts` | Регистрация модуля |
| `apps/api/src/pricing/pricing.service.ts` | Исключение клиента из поиска, общая константа статусов |
| `apps/api/src/orders/orders.controller.ts` | `preview()` получает `@CurrentUser()` |
| `apps/api/src/app.module.ts` | Импорт `WalletModule` |
| `apps/api/test/helpers.ts` | Обновлённый `resetDb` |
| `apps/web/src/pages/WalletPage.tsx` | Экран кошелька мастера |
| `apps/web/src/pages/AdminWithdrawalsPage.tsx` | Экран оператора |
| `apps/web/src/pages/ProfilePage.tsx` | Ссылка на кошелёк |
| `apps/web/src/pages/AdminListPage.tsx` | Ссылка на вывод |
| `apps/web/src/App.tsx` | +2 маршрута |

---

### Task 1: Схема данных и миграция

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/test/helpers.ts`

**Interfaces:**
- Produces: модели `MasterWalletAccount`, `WithdrawalRequest`, enum `WithdrawalStatus`.

- [ ] **Step 1: Добавить relations в `User`**

В `apps/api/prisma/schema.prisma` заменить блок `model User { ... }` (текущее содержимое заканчивается на `leadCreditPurchases LeadCreditPurchase[]`):

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
}
```

- [ ] **Step 2: Добавить enum и модели в конец файла**

В конец `apps/api/prisma/schema.prisma` добавить:

```prisma
enum WithdrawalStatus {
  PENDING
  PAID
  FAILED
}

model MasterWalletAccount {
  masterUserId String @id
  master       User   @relation(fields: [masterUserId], references: [id])
  balance      Int    @default(0)
}

model WithdrawalRequest {
  id           String           @id @default(uuid())
  masterUserId String
  master       User             @relation(fields: [masterUserId], references: [id])
  amount       Int
  status       WithdrawalStatus @default(PENDING)
  providerRef  String?
  requestedAt  DateTime         @default(now())
  paidAt       DateTime?
}
```

- [ ] **Step 3: Сгенерировать и применить миграцию**

Run: `cd apps/api && npx prisma migrate dev --name stage4_wallet_withdrawals`
Expected: миграция создана и применена без ошибок; Prisma Client перегенерирован. Проверить сгенерированный `migration.sql` — он не должен содержать `DROP INDEX` (прецедент: в этапе 3 Prisma один раз молча дропнул несвязанные GIST-индексы из-за дрифт-детекции по `Unsupported`-колонкам geo-полей — если увидите `DROP INDEX` на `Order_location_idx` или `MasterPresence_location_idx`, удалите эти строки из файла миграции вручную и примените их обратно через `CREATE INDEX ... USING GIST (...)`, как было сделано в этапе 3).

- [ ] **Step 4: Обновить `resetDb`**

В `apps/api/test/helpers.ts` заменить строку `TRUNCATE` в `resetDb`:

```typescript
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual","PlannedOrder","PlannedOrderBid","LeadCreditAccount","LeadCreditTransaction","LeadCreditPurchase","MasterWalletAccount","WithdrawalRequest" CASCADE',
  );
}
```

- [ ] **Step 5: Прогнать существующий e2e-набор — регрессии быть не должно**

Run: `cd apps/api && npm run test:e2e`
Expected: все существующие тесты (27 suites / 103 теста по состоянию после этапа 3) — PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/helpers.ts
git commit -m "$(cat <<'EOF'
feat(db): схема кошелька мастера и заявок на вывод

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Зачисление на баланс кошелька

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`
- Test: `apps/api/test/wallet-accrual.e2e-spec.ts`

**Interfaces:**
- Consumes: `MasterWalletAccount` (Task 1).
- Produces: `accrueCompensation()` теперь также инкрементирует `MasterWalletAccount.balance`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/wallet-accrual.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Зачисление компенсации на баланс кошелька (e2e)', () => {
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
    client = await loginAs(app, '+77100000001');
    master = await createActiveMaster(app, '+77100000002', plumbingId);
  });

  it('закрытие заявки начисляет компенсацию на баланс кошелька', async () => {
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
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });

    await post(client.token, order.id, 'confirm-completion').expect(201);

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(fresh.calloutPrice - fresh.serviceFee);
  });

  it('повторный вызов авто-закрытия на уже закрытой заявке не задваивает баланс', async () => {
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
    await post(client.token, order.id, 'confirm-completion').expect(201);

    await orders.handleAutoClose({ orderId: order.id }); // заявка уже CLOSED — должен быть no-op

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(account.balance).toBe(fresh.calloutPrice - fresh.serviceFee);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- wallet-accrual.e2e-spec`
Expected: FAIL — `prisma.masterWalletAccount` не существует как записываемая сущность с ненулевым балансом (баланс не создаётся, `findUniqueOrThrow` бросает).

- [ ] **Step 3: Править `accrueCompensation`**

В `apps/api/src/orders/orders.service.ts` заменить метод `accrueCompensation`:

```typescript
  /** Начисление компенсации мастеру; идемпотентно за счёт unique(orderId). */
  async accrueCompensation(tx: Tx, order: Order): Promise<void> {
    if (!order.masterId) return;
    const amount = order.calloutPrice - order.serviceFee;
    const res = await tx.accrual.createMany({
      data: [
        {
          masterUserId: order.masterId,
          orderId: order.id,
          type: 'CALLOUT_COMPENSATION',
          amount,
        },
      ],
      skipDuplicates: true,
    });
    if (res.count > 0) {
      await tx.masterWalletAccount.upsert({
        where: { masterUserId: order.masterId },
        create: { masterUserId: order.masterId, balance: amount },
        update: { balance: { increment: amount } },
      });
    }
  }
```

- [ ] **Step 4: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- wallet-accrual.e2e-spec`
Expected: PASS, оба теста зелёные.

- [ ] **Step 5: Прогнать весь набор e2e — без регрессий**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites PASS, включая существующие `orders-*`/`matching-waves` (компенсация теперь ещё и наполняет баланс, но сама логика начисления не изменилась).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/orders/orders.service.ts apps/api/test/wallet-accrual.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(orders): атомарное зачисление компенсации на баланс кошелька

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `PaymentProvider.payout()`

**Files:**
- Modify: `apps/api/src/payments/payment.interface.ts`
- Modify: `apps/api/src/payments/mock-payment.provider.ts`
- Test: `apps/api/test/payments.e2e-spec.ts` (добавить кейс)

**Interfaces:**
- Produces: `PaymentProvider.payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>`.

- [ ] **Step 1: Дописать тест в `payments.e2e-spec.ts`**

Добавить `it`-блок в конец `describe`:

```typescript
  it('payout всегда успешен и не создаёт PaymentTransaction (не привязан к заявке)', async () => {
    const result = await payments.payout('withdrawal-1', 6000);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerRef).toMatch(/^mock-/);
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- payments.e2e-spec`
Expected: FAIL — `payments.payout is not a function`.

- [ ] **Step 3: Расширить интерфейс**

`apps/api/src/payments/payment.interface.ts`:

```typescript
import { PaymentStatus, PaymentTransaction } from '@prisma/client';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
  payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
}
```

- [ ] **Step 4: Реализовать в моке**

В `apps/api/src/payments/mock-payment.provider.ts` добавить метод в класс (после `charge`):

```typescript
  async payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    void referenceId;
    void amount;
    return { status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` };
  }
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- payments.e2e-spec`
Expected: PASS, все тесты файла зелёные.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/payments apps/api/test/payments.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(payments): метод payout() для выплат вне заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Модуль кошелька — баланс, история, вывод

**Files:**
- Create: `apps/api/src/wallet/wallet.constants.ts`
- Create: `apps/api/src/wallet/dto.ts`
- Create: `apps/api/src/wallet/wallet.service.ts`
- Create: `apps/api/src/wallet/wallet.controller.ts`
- Create: `apps/api/src/wallet/wallet.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/wallet-withdrawals.e2e-spec.ts`

**Interfaces:**
- Consumes: `PAYMENT_PROVIDER.payout()` (Task 3), `MasterWalletAccount`/`WithdrawalRequest` (Task 1).
- Produces: `WalletService.getBalance(masterUserId)`, `.listMine(masterUserId)`, `.request(masterUserId, amount)`; HTTP `GET /wallet/balance`, `GET /wallet/withdrawals`, `POST /wallet/withdrawals`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/wallet-withdrawals.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Вывод средств (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let master: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    master = await loginAs(app, '+77110000001');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 20000 } });
  });

  it('баланс отдаётся, история изначально пуста', async () => {
    const balance = await request(app.getHttpServer())
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(balance.body).toEqual({ balance: 20000 });

    const history = await request(app.getHttpServer())
      .get('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(history.body).toEqual([]);
  });

  it('успешный вывод списывает баланс и помечает PAID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 8000 })
      .expect(201);
    expect(res.body).toMatchObject({ amount: 8000, status: 'PAID' });
    expect(res.body.paidAt).toBeTruthy();

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(12000);

    const history = await request(app.getHttpServer())
      .get('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });

  it('недостаточно средств — 422, баланс не тронут', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 50000 })
      .expect(422);
    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(20000);
  });

  it('сумма меньше минимума — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 1000 })
      .expect(400);
  });

  it('у мастера без кошелька — 422 (баланс 0)', async () => {
    const fresh = await loginAs(app, '+77110000002');
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${fresh.token}`)
      .send({ amount: 5000 })
      .expect(422);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- wallet-withdrawals.e2e-spec`
Expected: FAIL — 404 (маршрутов ещё нет).

- [ ] **Step 3: Константы**

Создать `apps/api/src/wallet/wallet.constants.ts`:

```typescript
export const MIN_WITHDRAWAL_TENGE = 5000;
```

- [ ] **Step 4: DTO**

Создать `apps/api/src/wallet/dto.ts`:

```typescript
import { IsInt, Min } from 'class-validator';
import { MIN_WITHDRAWAL_TENGE } from './wallet.constants';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(MIN_WITHDRAWAL_TENGE)
  amount!: number;
}
```

- [ ] **Step 5: Сервис**

Создать `apps/api/src/wallet/wallet.service.ts`:

```typescript
import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async getBalance(masterUserId: string): Promise<number> {
    const acc = await this.prisma.masterWalletAccount.findUnique({ where: { masterUserId } });
    return acc?.balance ?? 0;
  }

  listMine(masterUserId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { masterUserId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async request(masterUserId: string, amount: number) {
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const spent = await tx.masterWalletAccount.updateMany({
        where: { masterUserId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (spent.count === 0) throw new UnprocessableEntityException('Недостаточно средств на балансе');
      return tx.withdrawalRequest.create({ data: { masterUserId, amount, status: 'PENDING' } });
    });

    const result = await this.payments.payout(withdrawal.id, amount);

    return this.prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: result.status === 'SUCCEEDED' ? 'PAID' : 'FAILED',
          providerRef: result.providerRef,
          paidAt: result.status === 'SUCCEEDED' ? new Date() : null,
        },
      });
      if (result.status !== 'SUCCEEDED') {
        await tx.masterWalletAccount.update({
          where: { masterUserId },
          data: { balance: { increment: amount } },
        });
      }
      return tx.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });
    });
  }
}
```

- [ ] **Step 6: Контроллер**

Создать `apps/api/src/wallet/wallet.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletService } from './wallet.service';
import { CreateWithdrawalDto } from './dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  async balance(@CurrentUser() user: User) {
    return { balance: await this.wallet.getBalance(user.id) };
  }

  @Get('withdrawals')
  listMine(@CurrentUser() user: User) {
    return this.wallet.listMine(user.id);
  }

  @Post('withdrawals')
  request(@CurrentUser() user: User, @Body() dto: CreateWithdrawalDto) {
    return this.wallet.request(user.id, dto.amount);
  }
}
```

- [ ] **Step 7: Модуль и регистрация**

Создать `apps/api/src/wallet/wallet.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [PaymentsModule],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
```

В `apps/api/src/app.module.ts` добавить импорт и в массив `imports` (после `LeadCreditsModule`):

```typescript
import { WalletModule } from './wallet/wallet.module';
// ...
    WalletModule,
```

- [ ] **Step 8: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- wallet-withdrawals.e2e-spec`
Expected: PASS, все 5 тестов зелёные.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/wallet apps/api/src/app.module.ts apps/api/test/wallet-withdrawals.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(wallet): баланс, история и вывод средств мастера

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Ветка `FAILED` вывода — unit-тест со стабом провайдера

**Files:**
- Test: `apps/api/src/wallet/wallet.service.spec.ts`

**Interfaces:**
- Consumes: `WalletService.request()` (Task 4).

Мок `PAYMENT_PROVIDER` всегда отвечает `SUCCEEDED`, поэтому ветка `FAILED` (возврат средств на баланс) не воспроизводима через HTTP/e2e. Проверяется точечным unit-тестом с подменённым провайдером через `Test.createTestingModule` + `overrideProvider`.

- [ ] **Step 1: Написать падающий unit-тест**

Создать `apps/api/src/wallet/wallet.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { WalletService } from './wallet.service';

describe('WalletService — ветка FAILED', () => {
  let service: WalletService;
  let prisma: {
    masterWalletAccount: { updateMany: jest.Mock; update: jest.Mock };
    withdrawalRequest: { create: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let payments: jest.Mocked<Pick<PaymentProvider, 'payout'>>;

  beforeEach(async () => {
    prisma = {
      masterWalletAccount: { updateMany: jest.fn(), update: jest.fn() },
      withdrawalRequest: { create: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    payments = { payout: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: payments },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('при FAILED от провайдера возвращает сумму на баланс и помечает FAILED', async () => {
    prisma.masterWalletAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawalRequest.create.mockResolvedValue({ id: 'w1', masterUserId: 'm1', amount: 7000, status: 'PENDING' });
    payments.payout.mockResolvedValue({ status: 'FAILED', providerRef: 'mock-fail-1' });
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue({ id: 'w1', status: 'FAILED' });

    await service.request('m1', 7000);

    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { status: 'FAILED', providerRef: 'mock-fail-1', paidAt: null },
    });
    expect(prisma.masterWalletAccount.update).toHaveBeenCalledWith({
      where: { masterUserId: 'm1' },
      data: { balance: { increment: 7000 } },
    });
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd apps/api && npx jest wallet.service.spec.ts`
Expected: PASS. Это не red-green цикл для новой функциональности — `WalletService.request()` уже полностью реализован в Task 4, этот unit-тест лишь добавляет точечное покрытие ветки `FAILED`, которую e2e/HTTP-тесты не могут воспроизвести (мок `PAYMENT_PROVIDER` всегда отвечает `SUCCEEDED`). Тест должен пройти сразу, так как написан под уже существующий, согласованный код Task 4.

Если тест не проходит — это означает реальный баг в `WalletService.request()` из Task 4 (расхождение с ожидаемым поведением из §5 дизайн-дока: возврат средств на баланс и статус `FAILED` при неуспешном `payout()`), а не ошибку в тесте. Исправьте `wallet.service.ts`, а не тест.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/wallet/wallet.service.spec.ts
git commit -m "$(cat <<'EOF'
test(wallet): покрыть ветку FAILED у вывода средств стабом провайдера

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Админ-список заявок на вывод

**Files:**
- Create: `apps/api/src/wallet/admin-withdrawals.controller.ts`
- Modify: `apps/api/src/wallet/wallet.module.ts`
- Test: `apps/api/test/admin-withdrawals.e2e-spec.ts`

**Interfaces:**
- Consumes: `WithdrawalRequest` (Task 1).
- Produces: HTTP `GET /admin/withdrawals`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/admin-withdrawals.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin: заявки на вывод (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => { await resetDb(app); });

  it('клиенту доступ запрещён → 403', async () => {
    const { token } = await loginAs(app, '+77120000001');
    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('оператор видит список с маскированным телефоном', async () => {
    const master = await loginAs(app, '+77120000002');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 20000 } });
    const withdrawal = await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 8000, status: 'PAID', paidAt: new Date() },
    });

    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: withdrawal.id, amount: 8000, status: 'PAID' });
    expect(list.body[0].master.phone).toBe('0002'); // последние 4 цифры +77120000002
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- admin-withdrawals.e2e-spec`
Expected: FAIL — 404.

- [ ] **Step 3: Контроллер**

Создать `apps/api/src/wallet/admin-withdrawals.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminWithdrawalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.withdrawalRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: { master: { select: { phone: true } } },
    });
    return rows.map((r) => ({
      ...r,
      master: { phone: r.master.phone.slice(-4) },
    }));
  }
}
```

- [ ] **Step 4: Зарегистрировать контроллер в модуле**

В `apps/api/src/wallet/wallet.module.ts` добавить импорт и контроллер:

```typescript
import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';

@Module({
  imports: [PaymentsModule],
  providers: [WalletService],
  controllers: [WalletController, AdminWithdrawalsController],
  exports: [WalletService],
})
export class WalletModule {}
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- admin-withdrawals.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/wallet apps/api/test/admin-withdrawals.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(wallet): read-only список заявок на вывод для оператора

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Фикс `PricingService`/`MatchingService`

**Files:**
- Modify: `apps/api/src/pricing/pricing.service.ts`
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/orders/orders.controller.ts`
- Test: `apps/api/test/pricing-quote.e2e-spec.ts` (добавить кейс)

**Interfaces:**
- Consumes: `ACTIVE_MASTER_STATUSES` (существующая константа, `apps/api/src/orders/order.constants.ts`).
- Produces: `PricingService.quote(categoryId, to, clientId, now?)` — новая сигнатура с обязательным `clientId`.

- [ ] **Step 1: Обновить существующий тестовый файл и добавить падающий тест**

`apps/api/test/pricing-quote.e2e-spec.ts` сейчас вызывает `pricing.quote(categoryId, point)` напрямую (без HTTP) в двух существующих тестах — с новой обязательной сигнатурой `quote(categoryId, to, clientId, now?)` они перестанут компилироваться/пройдут неверно, если их не поправить. Заменить содержимое файла целиком:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  resetDb,
  seedCategories,
  createActiveMaster,
  setMasterOffline,
  ALMATY,
  pointAtKm,
} from './helpers';
import {
  PricingService,
  calcPrices,
  computeTimeCoefficient,
} from '../src/pricing/pricing.service';

const NO_CLIENT = '00000000-0000-0000-0000-000000000000';

describe('PricingService.quote (e2e)', () => {
  let app: INestApplication;
  let pricing: PricingService;
  let plumbingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    pricing = app.get(PricingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
  });

  it('считает цену от ближайшего онлайн-мастера (прямая × 1.3)', async () => {
    await createActiveMaster(app, '+77020000001', plumbingId, pointAtKm(2));
    await createActiveMaster(app, '+77020000002', plumbingId, pointAtKm(5));
    const q = await pricing.quote(plumbingId, ALMATY, NO_CLIENT);
    expect(q).not.toBeNull();
    expect(q!.distanceKm).toBeGreaterThan(2.4); // ~2 км × 1.3
    expect(q!.distanceKm).toBeLessThan(2.8);
    const expected = calcPrices(
      { baseFare: 2000, perKm: 150, feeRate: 0.4, feeMin: 1000 },
      q!.distanceKm,
      computeTimeCoefficient(new Date()),
    );
    expect(q!.calloutPrice).toBe(expected.calloutPrice);
    expect(q!.serviceFee).toBe(expected.serviceFee);
  });

  it('null, если мастера офлайн или дальше 10 км', async () => {
    const far = await createActiveMaster(
      app,
      '+77020000003',
      plumbingId,
      pointAtKm(12),
    );
    expect(await pricing.quote(plumbingId, ALMATY, NO_CLIENT)).toBeNull();
    const near = await createActiveMaster(
      app,
      '+77020000004',
      plumbingId,
      pointAtKm(1),
    );
    await setMasterOffline(app, near.userId);
    expect(await pricing.quote(plumbingId, ALMATY, NO_CLIENT)).toBeNull();
    void far;
  });

  it('мастер не находит себя как ближайшего свободного мастера в превью для себя', async () => {
    const selfMaster = await createActiveMaster(app, '+77130000001', plumbingId);
    const empty = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${selfMaster.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(empty.body).toEqual({ available: false });
  });
});
```

Изменения относительно текущего файла: добавлен импорт `supertest`, константа `NO_CLIENT` (заглушка для тестов, которым конкретная личность клиента не важна), третий аргумент `NO_CLIENT` в двух существующих вызовах `pricing.quote(...)`, и новый третий тест — единственный, что реально нужен через HTTP (`/orders/preview`), так как проверяет заодно и `OrdersController.preview()` с `@CurrentUser()` из Step 5 этой задачи.

- [ ] **Step 2: Запустить — убедиться, что новый тест падает**

Run: `cd apps/api && npm run test:e2e -- pricing-quote.e2e-spec`
Expected: первые два теста — FAIL на компиляции/типах (`quote()` пока принимает 2 аргумента, а не 3 — TypeScript ошибка вида "Expected 2 arguments, but got 3" либо, если строгая проверка аргументов не блокирует лишний параметр, тесты просто продолжат обращаться к старой сигнатуре и это нормально после Step 3, когда сигнатура станет 3-аргументной); третий тест — FAIL по существу: `available: true` вместо `false` (мастер находит сам себя, `findNearestFreeMaster` ещё не исключает `clientId`).

- [ ] **Step 3: Править `PricingService`**

В `apps/api/src/pricing/pricing.service.ts`:
- добавить импорт `{ ACTIVE_MASTER_STATUSES } from '../orders/order.constants'` и `{ Prisma } from '@prisma/client'`;
- заменить сигнатуру `quote` и `findNearestFreeMaster`:

```typescript
  async quote(
    categoryId: string,
    to: LatLng,
    clientId: string,
    now: Date = new Date(),
  ): Promise<PriceQuote | null> {
    const nearest = await this.findNearestFreeMaster(categoryId, to, clientId);
    if (!nearest) return null;
    const distanceKm = await this.routing.distanceKm(nearest, to);
    const coefficient = computeTimeCoefficient(now);
    return {
      ...calcPrices(this.cfg, distanceKm, coefficient),
      distanceKm,
      coefficient,
    };
  }

  private async findNearestFreeMaster(
    categoryId: string,
    to: LatLng,
    clientId: string,
  ): Promise<LatLng | null> {
    const activeStatuses = Prisma.join(
      ACTIVE_MASTER_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`),
    );
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(mp.location::geometry) AS lat, ST_X(mp.location::geometry) AS lng
      FROM "MasterPresence" mp
      JOIN "MasterProfile" pr ON pr."userId" = mp."masterUserId" AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${categoryId}
      WHERE mp."isOnline" = true AND mp.location IS NOT NULL
        AND mp."masterUserId" <> ${clientId}
        AND ST_DWithin(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography, ${MAX_SEARCH_RADIUS_M})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = mp."masterUserId"
            AND ao.status IN (${activeStatuses})
        )
      ORDER BY ST_Distance(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography)
      LIMIT 1`;
    return rows[0] ?? null;
  }
```

- [ ] **Step 4: Пробросить `clientId` из вызывающего кода**

В `apps/api/src/orders/orders.service.ts` заменить оба вызова `this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng })`:
- в `preview(clientId: string, dto: PreviewOrderDto)` (сигнатура метода тоже меняется — добавляется первый параметр `clientId`): `this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng }, clientId)`;
- в `create(clientId, dto)` (сигнатура не меняется, `clientId` уже есть): `this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng }, clientId)`.

Метод `preview` целиком:

```typescript
  async preview(clientId: string, dto: PreviewOrderDto) {
    const quote = await this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng }, clientId);
    return quote ? { available: true, ...quote } : { available: false };
  }
```

- [ ] **Step 5: Обновить контроллер**

В `apps/api/src/orders/orders.controller.ts` заменить:

```typescript
  @Post('orders/preview')
  preview(@CurrentUser() user: User, @Body() dto: PreviewOrderDto) {
    return this.orders.preview(user.id, dto);
  }
```

- [ ] **Step 6: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- pricing-quote.e2e-spec`
Expected: PASS.

- [ ] **Step 7: Прогнать весь набор e2e — без регрессий**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites PASS (сигнатура `preview`/`quote` изменилась, но поведение для обычного клиента, ищущего чужого мастера, не изменилось).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/pricing/pricing.service.ts apps/api/src/orders/orders.service.ts apps/api/src/orders/orders.controller.ts apps/api/test/pricing-quote.e2e-spec.ts
git commit -m "$(cat <<'EOF'
fix(pricing): исключить клиента из поиска ближайшего мастера в превью цены

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Веб — кошелёк мастера

**Files:**
- Create: `apps/web/src/pages/WalletPage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `api()` (`apps/web/src/api.ts`).
- Produces: маршрут `/wallet`.

- [ ] **Step 1: Создать экран кошелька**

Создать `apps/web/src/pages/WalletPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api('/wallet/balance').then((r) => setBalance(r.balance));
    api('/wallet/withdrawals').then(setHistory);
  }

  useEffect(load, []);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setAmount('');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Кошелёк</h1>
      <div className="rounded-xl bg-teal-50 p-4 text-center">
        <div className="text-3xl font-bold text-teal-700">{balance} ₸</div>
        <div className="text-sm text-gray-600">доступно к выводу</div>
      </div>
      <div className="space-y-2">
        <input
          type="number" min="5000" placeholder="Сумма вывода, ₸"
          className="w-full rounded border p-3" value={amount} onChange={(e) => setAmount(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : 'Вывести'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">История</h2>
        {history.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex justify-between rounded-xl border p-3">
            <span>{w.amount} ₸</span>
            <span className="text-sm text-gray-500">{STATUS_LABELS[w.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Добавить ссылку в профиль**

В `apps/web/src/pages/ProfilePage.tsx` заменить:

```tsx
      <Link to="/become-master" className="block text-center text-teal-700 underline">
        Стать мастером
      </Link>
      <Link to="/wallet" className="block text-center text-teal-700 underline">
        Кошелёк
      </Link>
      {user?.role === 'OPERATOR' && (
```

- [ ] **Step 3: Зарегистрировать маршрут**

В `apps/web/src/App.tsx` добавить импорт `import WalletPage from './pages/WalletPage';` и маршрут внутри `<Route element={<Layout />}>`, после `/lead-credits`:

```tsx
              <Route path="/wallet" element={<WalletPage />} />
```

- [ ] **Step 4: Собрать web**

Run: `cd apps/web && npm run build`
Expected: сборка без ошибок TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/WalletPage.tsx apps/web/src/pages/ProfilePage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): экран кошелька мастера и вывода средств

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Веб — админ-список заявок на вывод

**Files:**
- Create: `apps/web/src/pages/AdminWithdrawalsPage.tsx`
- Modify: `apps/web/src/pages/AdminListPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `api()`.
- Produces: маршрут `/admin/withdrawals` (только `OPERATOR`, внутри `RequireOperator`).

- [ ] **Step 1: Создать экран**

Создать `apps/web/src/pages/AdminWithdrawalsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

interface Row {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
  master: { phone: string };
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api('/admin/withdrawals').then(setRows);
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К заявкам мастеров</Link>
      <h1 className="text-2xl font-bold">Заявки на вывод</h1>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between p-3">
            <span>···{r.master.phone} · {r.amount} ₸</span>
            <span className="text-sm text-gray-500">
              {STATUS_LABELS[r.status]} · {new Date(r.requestedAt).toLocaleDateString('ru-RU')}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Добавить ссылку в список заявок мастеров**

В `apps/web/src/pages/AdminListPage.tsx` заменить заголовок:

```tsx
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Заявки мастеров</h1>
        <Link to="/admin/withdrawals" className="text-sm text-teal-700 underline">Заявки на вывод</Link>
      </div>
```

(заменяет прежнюю одиночную строку `<h1 className="text-2xl font-bold">Заявки мастеров</h1>`).

- [ ] **Step 3: Зарегистрировать маршрут**

В `apps/web/src/App.tsx` добавить импорт `import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';` и маршрут внутри `<Route element={<RequireOperator />}>`, после `/admin/:id`:

```tsx
              <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
```

- [ ] **Step 4: Собрать web**

Run: `cd apps/web && npm run build`
Expected: сборка без ошибок.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AdminWithdrawalsPage.tsx apps/web/src/pages/AdminListPage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): экран оператора для заявок на вывод

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Сквозная проверка

**Files:**
- Test: полный прогон существующего набора, оба билда.

**Interfaces:**
- Consumes: все методы из Tasks 1–9.

- [ ] **Step 1: Прогнать весь backend e2e-набор**

Run: `cd apps/api && npm run test:e2e`
Expected: все suites (этапы 1–4) — PASS, без регрессий.

- [ ] **Step 2: Прогнать unit-тесты**

Run: `cd apps/api && npx jest --testPathIgnorePatterns=test/`
Expected: `wallet.service.spec.ts` и существующие unit-тесты (`pricing.service.spec.ts` и т.п.) — PASS.

- [ ] **Step 3: Собрать оба приложения**

Run: `cd apps/api && npm run build && cd ../web && npm run build`
Expected: оба билда зелёные, без ошибок TypeScript.

- [ ] **Step 4: Ручная браузерная проверка**

Не кодовый шаг — выполняется после Step 3 в браузере (см. прецедент этапов 2–3): пройти сценарий «закрыть срочную заявку → баланс кошелька мастера вырос → вывести часть средств → статус PAID → баланс уменьшился → заявка видна в /admin/withdrawals оператору с маскированным телефоном», сверяя каждый шаг с Postgres напрямую. Задокументировать результат в `.superpowers/sdd/progress.md` (не в git).
