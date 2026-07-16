# Этап 3 «Плановый режим» — план реализации

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используйте superpowers:subagent-driven-development (рекомендовано) или superpowers:executing-plans для выполнения плана по задачам. Шаги используют чекбоксы (`- [ ]`) для отслеживания.

**Цель:** Реализовать плановый режим «Запланировать» — публикация заявки, ставки мастеров, выбор, lead-кредиты, выполнение и базовая отмена — поверх этапа 2, не трогая срочный режим.

**Архитектура:** Отдельные NestJS-модули `planned-orders` и `lead-credits` рядом с `orders` из этапа 2; собственные таблицы `PlannedOrder`/`PlannedOrderBid`/`LeadCreditAccount`/`LeadCreditTransaction`/`LeadCreditPurchase`; переиспользуются `PrismaService`, `QueueService` (pg-boss), `RealtimeGateway`, `PAYMENT_PROVIDER` (с новым методом `charge()`), `JwtAuthGuard`/`CurrentUser`.

**Tech Stack:** NestJS, Prisma/PostgreSQL, pg-boss, socket.io, class-validator, Jest+supertest (e2e), React+Vite+Tailwind (web).

**Ветка:** `stage3-planned`, worktree `.worktrees/stage3-planned`, ответвление от `stage2-urgent` (создать через superpowers:using-git-worktrees перед началом выполнения).

## Global Constraints

- Горизонт планирования: заявку можно опубликовать на дату не позднее **14 дней** вперёд, дата должна быть в будущем.
- Лимит откликов на плановую заявку: **5 мастеров** (уникальных, один отклик на мастера).
- Стоимость лида (отклик): **1 кредит**; кредит невыбранным мастерам **не возвращается**.
- Таймаут подтверждения выбранным мастером: **2 часа** (7200 с) → авто-возврат в `PUBLISHED`.
- Таймаут авто-подтверждения выполнения клиентом: **24 часа** (86400 с), как в этапе 2.
- Пакеты lead-кредитов: `single` 1/500₸, `start` 10/5000₸, `standard` 25/11000₸, `pro` 60/24000₸.
- Штраф мастеру за отмену после `CONFIRMED`: **−2 кредита** (баланс может уйти в минус) + `priorityPenaltyUntil = now + 24ч`.
- Возврат кредита клиенту при отмене после выбора мастера: **полный**, только выбранному мастеру.
- Адрес и контакт клиента видны мастеру только если `order.masterId === currentMasterId`.
- Контакт (телефон) мастера виден клиенту только со статуса `CONFIRMED` и позже (не раньше — расходится с раскрытием адреса мастеру, см. выше).
- Все тексты в API-ошибках и UI — на русском, как в этапе 1–2.
- Транзакции БД — `prisma.$transaction`; атомарные переходы статуса — паттерн `gate()` (`updateMany({id, status: from})`, `count===0` → 409), как в `OrdersService` этапа 2.
- Один коммит на задачу, трейлер `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- e2e: `cd apps/api && npm run test:e2e` (тестовая БД на `localhost:5433`, поднимается docker-compose из этапа 1 — убедиться, что контейнеры запущены).

## Уточнения к спеке (решения этой реализации)

- Фото при создании плановой заявки — не реализуется, как и в этапе 2 для срочной (то же обоснованное упрощение).
- Лента мастера фильтруется **только по категории**; `district` — текстовое поле для отображения в карточке, не фильтр.
- Выбор мастера моделируется через `PlannedOrder.masterId` + `selectedBidId`, без отдельного enum-статуса на `PlannedOrderBid`.
- UI: вместо переключателя внутри одной формы (`NewOrderPage`) — два отдельных входа с `HomePage`: «Вызвать сейчас» (существующий `/order/new`, без изменений) и «Запланировать» (новый `/planned/new`, `PlannedNewOrderPage.tsx`). Функционально эквивалентно «переключателю» из дизайн-дока, но не трогает уже протестированный срочный флоу.
- Раскрытие данных асимметрично по сторонам: мастеру адрес/контакт клиента открывается сразу при `MASTER_SELECTED` (если он — выбранный), а клиенту контакт (телефон) мастера — только при `CONFIRMED` (§3.4 шаг 7 бизнес-спеки). Реализовано через `redactMasterContact()` в `PlannedOrdersService`.
- `AUTO_CLOSE` этапа 2 и плановый авто-close используют **разные** имена джоб pg-boss (`order-auto-close` vs `planned-order-auto-close`) — у `QueueService.register()` один хендлер на имя очереди, общий хендлер сломал бы диспетчеризацию.

## Карта файлов

| Файл | Ответственность |
|---|---|
| `apps/api/prisma/schema.prisma` | +5 моделей, 2 enum'а, поле `MasterProfile.priorityPenaltyUntil`, relations в `User`/`Category` |
| `apps/api/src/payments/payment.interface.ts` | + метод `charge()` |
| `apps/api/src/payments/mock-payment.provider.ts` | + реализация `charge()` |
| `apps/api/src/lead-credits/lead-credits.config.ts` | Константы пакетов кредитов |
| `apps/api/src/lead-credits/lead-credits.service.ts` | `getBalance`, `purchase` |
| `apps/api/src/lead-credits/dto.ts` | `PurchaseLeadCreditsDto` |
| `apps/api/src/lead-credits/lead-credits.controller.ts` | `GET balance/packages`, `POST purchase` |
| `apps/api/src/lead-credits/lead-credits.module.ts` | Регистрация модуля |
| `apps/api/src/planned-orders/planned-order.constants.ts` | Числа, `PLANNED_ORDER_INCLUDE`, `FEED_SELECT` |
| `apps/api/src/planned-orders/dto.ts` | `CreatePlannedOrderDto`, `PlaceBidDto`, `SelectBidDto` |
| `apps/api/src/planned-orders/planned-orders.service.ts` | State machine, лента, ставки, кредиты, realtime |
| `apps/api/src/planned-orders/planned-orders.controller.ts` | HTTP-эндпоинты |
| `apps/api/src/planned-orders/planned-orders.module.ts` | Регистрация модуля |
| `apps/api/src/queue/queue.constants.ts` | + 3 имени джоб |
| `apps/api/src/app.module.ts` | Импорт новых модулей |
| `apps/api/test/helpers.ts` | + `grantLeadCredits`, `createPlannedOrderViaApi`, обновлённый `resetDb` |
| `apps/api/test/*.e2e-spec.ts` | Новые файлы по задачам |
| `apps/web/src/orderStatus.ts` | + `PLANNED_STATUS_LABELS` |
| `apps/web/src/pages/HomePage.tsx` | + вторая CTA-кнопка |
| `apps/web/src/pages/PlannedNewOrderPage.tsx` | Форма публикации плановой заявки |
| `apps/web/src/pages/PlannedOrderPage.tsx` | Детально: статус, ставки, выбор |
| `apps/web/src/pages/MyOrdersPage.tsx` | Объединённый список (срочные+плановые) |
| `apps/web/src/pages/WorkPage.tsx` | + сегмент «Плановые»: лента, отклик |
| `apps/web/src/pages/LeadCreditsPage.tsx` | Баланс, покупка пакетов |
| `apps/web/src/App.tsx` | + маршруты |

---

### Task 1: Схема данных и миграция

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/test/helpers.ts`
- Test: запуск существующего e2e-набора после миграции (регрессия)

**Interfaces:**
- Produces: модели `PlannedOrder`, `PlannedOrderBid`, `LeadCreditAccount`, `LeadCreditTransaction`, `LeadCreditPurchase`, enum'ы `PlannedOrderStatus`, `LeadCreditTxType`, поле `MasterProfile.priorityPenaltyUntil`.

- [ ] **Step 1: Добавить relations в `User` и `Category`, поле в `MasterProfile`**

В `apps/api/prisma/schema.prisma` заменить блок `model User { ... }`:

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
}
```

Заменить блок `model Category { ... }`:

```prisma
model Category {
  id            String           @id @default(uuid())
  slug          String           @unique
  name          String
  masters       MasterCategory[]
  orders        Order[]
  plannedOrders PlannedOrder[]
}
```

В блоке `model MasterProfile { ... }` добавить поле после `rejectionReason`:

```prisma
  rejectionReason      String?
  priorityPenaltyUntil DateTime?
```

- [ ] **Step 2: Добавить новые enum'ы и модели в конец файла**

В конец `apps/api/prisma/schema.prisma` (после `model Accrual { ... }`) добавить:

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

enum LeadCreditTxType {
  PURCHASE
  SPEND
  REFUND
}

model PlannedOrder {
  id             String             @id @default(uuid())
  clientId       String
  client         User               @relation("ClientPlannedOrders", fields: [clientId], references: [id])
  categoryId     String
  category       Category           @relation(fields: [categoryId], references: [id])
  description    String
  address        String
  district       String
  scheduledAt    DateTime
  status         PlannedOrderStatus @default(CREATED)
  masterId       String?
  master         User?              @relation("MasterPlannedOrders", fields: [masterId], references: [id])
  selectedBidId  String?            @unique
  selectedBid    PlannedOrderBid?   @relation("SelectedBid", fields: [selectedBidId], references: [id])
  workPrice      Int?
  cancelReason   String?
  publishedAt    DateTime?
  selectedAt     DateTime?
  confirmedAt    DateTime?
  completedAt    DateTime?
  closedAt       DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  bids           PlannedOrderBid[]  @relation("OrderBids")

  @@index([clientId, status])
  @@index([masterId, status])
  @@index([categoryId, status])
}

model PlannedOrderBid {
  id             String        @id @default(uuid())
  plannedOrderId String
  order          PlannedOrder  @relation("OrderBids", fields: [plannedOrderId], references: [id], onDelete: Cascade)
  masterUserId   String
  master         User          @relation(fields: [masterUserId], references: [id])
  price          Int
  term           String
  comment        String?
  createdAt      DateTime      @default(now())
  selectedFor    PlannedOrder? @relation("SelectedBid")

  @@unique([plannedOrderId, masterUserId])
  @@index([plannedOrderId])
}

model LeadCreditAccount {
  masterUserId String @id
  master       User   @relation(fields: [masterUserId], references: [id])
  balance      Int    @default(0)
}

model LeadCreditTransaction {
  id           String           @id @default(uuid())
  masterUserId String
  master       User             @relation(fields: [masterUserId], references: [id])
  type         LeadCreditTxType
  amount       Int
  bidId        String?
  purchaseId   String?
  createdAt    DateTime         @default(now())

  @@index([masterUserId, createdAt])
}

model LeadCreditPurchase {
  id           String        @id @default(uuid())
  masterUserId String
  master       User          @relation(fields: [masterUserId], references: [id])
  credits      Int
  priceTenge   Int
  status       PaymentStatus
  providerRef  String
  createdAt    DateTime      @default(now())
}
```

- [ ] **Step 3: Сгенерировать и применить миграцию**

Run: `cd apps/api && npx prisma migrate dev --name stage3_planned_orders`
Expected: миграция создана в `apps/api/prisma/migrations/`, применена без ошибок, Prisma Client перегенерирован.

- [ ] **Step 4: Обновить `resetDb` в тестовых хелперах**

В `apps/api/test/helpers.ts` заменить строку `TRUNCATE` в `resetDb`:

```typescript
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual","PlannedOrder","PlannedOrderBid","LeadCreditAccount","LeadCreditTransaction","LeadCreditPurchase" CASCADE',
  );
}
```

- [ ] **Step 5: Прогнать существующий e2e-набор — регрессии быть не должно**

Run: `cd apps/api && npm run test:e2e`
Expected: все прежние тесты (`orders-*`, `matching-waves`, `payments`, `pricing-quote`, `realtime-*`, `queue`, `masters`, `admin*`, `auth`, `users`, `documents`, `health`) — PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/helpers.ts
git commit -m "$(cat <<'EOF'
feat(db): схема данных планового режима и lead-кредитов

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `PaymentProvider.charge()`

**Files:**
- Modify: `apps/api/src/payments/payment.interface.ts`
- Modify: `apps/api/src/payments/mock-payment.provider.ts`
- Test: `apps/api/test/payments.e2e-spec.ts` (добавить кейс)

**Interfaces:**
- Consumes: ничего нового (расширяет существующий `PAYMENT_PROVIDER` DI-токен).
- Produces: `PaymentProvider.charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>`.

- [ ] **Step 1: Дописать тест в `payments.e2e-spec.ts`**

Добавить `it`-блок в конец `describe`:

```typescript
  it('charge всегда успешен и не создаёт PaymentTransaction (не привязан к заявке)', async () => {
    const result = await payments.charge('purchase-1', 5000);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerRef).toMatch(/^mock-/);
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- payments.e2e-spec`
Expected: FAIL — `payments.charge is not a function`.

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
}
```

- [ ] **Step 4: Реализовать в моке**

В `apps/api/src/payments/mock-payment.provider.ts` добавить метод в класс:

```typescript
  async charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    void referenceId;
    void amount;
    return { status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` };
  }
```

(добавить `PaymentStatus` в существующий импорт `import { PaymentTransaction, PaymentType } from '@prisma/client';` → `import { PaymentStatus, PaymentTransaction, PaymentType } from '@prisma/client';`)

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- payments.e2e-spec`
Expected: PASS, все 4 теста файла зелёные.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/payments apps/api/test/payments.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(payments): метод charge() для разовых списаний вне заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Модуль lead-кредитов (баланс, пакеты, покупка)

**Files:**
- Create: `apps/api/src/lead-credits/lead-credits.config.ts`
- Create: `apps/api/src/lead-credits/lead-credits.service.ts`
- Create: `apps/api/src/lead-credits/dto.ts`
- Create: `apps/api/src/lead-credits/lead-credits.controller.ts`
- Create: `apps/api/src/lead-credits/lead-credits.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/lead-credits.e2e-spec.ts`

**Interfaces:**
- Consumes: `PAYMENT_PROVIDER.charge()` (Task 2).
- Produces: `LeadCreditsService.getBalance(masterUserId): Promise<number>`, `LeadCreditsService.purchase(masterUserId, packageId): Promise<{masterUserId, balance}>`; HTTP `GET /lead-credits/balance`, `GET /lead-credits/packages`, `POST /lead-credits/purchase`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/lead-credits.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Lead-кредиты (e2e)', () => {
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
    master = await loginAs(app, '+77050000001');
  });

  it('баланс изначально 0, список пакетов доступен', async () => {
    const balance = await request(app.getHttpServer())
      .get('/api/v1/lead-credits/balance')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(balance.body).toEqual({ balance: 0 });

    const packages = await request(app.getHttpServer())
      .get('/api/v1/lead-credits/packages')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(packages.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'start', credits: 10, priceTenge: 5000 })]),
    );
  });

  it('покупка пакета начисляет кредиты и пишет транзакцию PURCHASE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'start' })
      .expect(201);
    expect(res.body.balance).toBe(10);

    const purchase = await prisma.leadCreditPurchase.findFirstOrThrow({ where: { masterUserId: master.userId } });
    expect(purchase).toMatchObject({ credits: 10, priceTenge: 5000, status: 'SUCCEEDED' });
    const tx = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId } });
    expect(tx).toMatchObject({ type: 'PURCHASE', amount: 10 });

    const second = await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    expect(second.body.balance).toBe(11);
  });

  it('неизвестный пакет — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'unknown' })
      .expect(400);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- lead-credits.e2e-spec`
Expected: FAIL — `404` (маршрутов ещё нет).

- [ ] **Step 3: Константы пакетов**

Создать `apps/api/src/lead-credits/lead-credits.config.ts`:

```typescript
export interface LeadCreditPackage {
  id: string;
  credits: number;
  priceTenge: number;
}

export const LEAD_CREDIT_PACKAGES: LeadCreditPackage[] = [
  { id: 'single', credits: 1, priceTenge: 500 },
  { id: 'start', credits: 10, priceTenge: 5000 },
  { id: 'standard', credits: 25, priceTenge: 11000 },
  { id: 'pro', credits: 60, priceTenge: 24000 },
];
```

- [ ] **Step 4: DTO**

Создать `apps/api/src/lead-credits/dto.ts`:

```typescript
import { IsIn } from 'class-validator';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';

export class PurchaseLeadCreditsDto {
  @IsIn(LEAD_CREDIT_PACKAGES.map((p) => p.id))
  package!: string;
}
```

- [ ] **Step 5: Сервис**

Создать `apps/api/src/lead-credits/lead-credits.service.ts`:

```typescript
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';

@Injectable()
export class LeadCreditsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async getBalance(masterUserId: string): Promise<number> {
    const acc = await this.prisma.leadCreditAccount.findUnique({ where: { masterUserId } });
    return acc?.balance ?? 0;
  }

  async purchase(masterUserId: string, packageId: string): Promise<{ masterUserId: string; balance: number }> {
    const pkg = LEAD_CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException('Неизвестный пакет кредитов');

    const purchase = await this.prisma.leadCreditPurchase.create({
      data: { masterUserId, credits: pkg.credits, priceTenge: pkg.priceTenge, status: 'PENDING', providerRef: '' },
    });
    const result = await this.payments.charge(purchase.id, pkg.priceTenge);

    return this.prisma.$transaction(async (tx) => {
      await tx.leadCreditPurchase.update({
        where: { id: purchase.id },
        data: { status: result.status, providerRef: result.providerRef },
      });
      if (result.status === 'SUCCEEDED') {
        await tx.leadCreditAccount.upsert({
          where: { masterUserId },
          create: { masterUserId, balance: pkg.credits },
          update: { balance: { increment: pkg.credits } },
        });
        await tx.leadCreditTransaction.create({
          data: { masterUserId, type: 'PURCHASE', amount: pkg.credits, purchaseId: purchase.id },
        });
      }
      const acc = await tx.leadCreditAccount.findUnique({ where: { masterUserId } });
      return { masterUserId, balance: acc?.balance ?? 0 };
    });
  }
}
```

- [ ] **Step 6: Контроллер**

Создать `apps/api/src/lead-credits/lead-credits.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LeadCreditsService } from './lead-credits.service';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';
import { PurchaseLeadCreditsDto } from './dto';

@Controller('lead-credits')
@UseGuards(JwtAuthGuard)
export class LeadCreditsController {
  constructor(private readonly leadCredits: LeadCreditsService) {}

  @Get('balance')
  async balance(@CurrentUser() user: User) {
    return { balance: await this.leadCredits.getBalance(user.id) };
  }

  @Get('packages')
  packages() {
    return LEAD_CREDIT_PACKAGES;
  }

  @Post('purchase')
  purchase(@CurrentUser() user: User, @Body() dto: PurchaseLeadCreditsDto) {
    return this.leadCredits.purchase(user.id, dto.package);
  }
}
```

- [ ] **Step 7: Модуль и регистрация в `AppModule`**

Создать `apps/api/src/lead-credits/lead-credits.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { LeadCreditsService } from './lead-credits.service';
import { LeadCreditsController } from './lead-credits.controller';

@Module({
  imports: [PaymentsModule],
  providers: [LeadCreditsService],
  controllers: [LeadCreditsController],
  exports: [LeadCreditsService],
})
export class LeadCreditsModule {}
```

В `apps/api/src/app.module.ts` добавить импорт и в массив `imports`:

```typescript
import { LeadCreditsModule } from './lead-credits/lead-credits.module';
// ...
    LeadCreditsModule,
```

(строка перед `OrdersModule`).

- [ ] **Step 8: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- lead-credits.e2e-spec`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lead-credits apps/api/src/app.module.ts apps/api/test/lead-credits.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(lead-credits): баланс, пакеты и покупка кредитов через мок-Kaspi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Модуль плановых заявок — публикация

**Files:**
- Create: `apps/api/src/planned-orders/planned-order.constants.ts`
- Create: `apps/api/src/planned-orders/dto.ts`
- Create: `apps/api/src/planned-orders/planned-orders.service.ts`
- Create: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Create: `apps/api/src/planned-orders/planned-orders.module.ts`
- Modify: `apps/api/src/queue/queue.constants.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/test/helpers.ts` (добавить `createPlannedOrderViaApi`)
- Test: `apps/api/test/planned-orders-create.e2e-spec.ts`

**Interfaces:**
- Consumes: `QueueService.send/register` (этап 2), `RealtimeGateway.emitToUser` (этап 2).
- Produces: `PlannedOrdersService.create(clientId, dto)`, `.listMine(clientId)`, `.findOrThrow(id)`; HTTP `POST /planned-orders`, `GET /planned-orders/mine`, `GET /planned-orders/:id` (пока без редактирования — добавится в Task 5).

- [ ] **Step 1: Добавить хелпер и написать падающий e2e-тест**

В `apps/api/test/helpers.ts` добавить в конец файла:

```typescript
export async function createPlannedOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  overrides: Partial<{ description: string; address: string; district: string; scheduledAt: string }> = {},
) {
  const scheduledAt = overrides.scheduledAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post('/api/v1/planned-orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      categoryId,
      description: overrides.description ?? 'Установить новый смеситель',
      address: overrides.address ?? 'ул. Абая, 1',
      district: overrides.district ?? 'Алмалинский',
      scheduledAt,
    })
    .expect(201);
  return res.body;
}
```

Создать `apps/api/test/planned-orders-create.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Публикация плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77060000001');
  });

  it('создание сразу публикует заявку', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    expect(order.status).toBe('PUBLISHED');
    expect(order.publishedAt).toBeTruthy();
    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.clientId).toBe(client.userId);
  });

  it('дата в прошлом — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
      })
      .expect(400);
  });

  it('дата дальше 14 дней — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        scheduledAt: new Date(Date.now() + 20 * 24 * 3600_000).toISOString(),
      })
      .expect(400);
  });

  it('GET /planned-orders/mine возвращает заявки клиента', async () => {
    await createPlannedOrderViaApi(app, client.token, plumbingId);
    const mine = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/mine')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].status).toBe('PUBLISHED');
  });
});
```

(маршрут `GET /planned-orders/:id` и его редактирование по ролям тестируются отдельно в Task 5 — на этом шаге его ещё нет в контроллере.)

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-create.e2e-spec`
Expected: FAIL — 404 (модуля ещё нет).

- [ ] **Step 3: Имена джоб**

В `apps/api/src/queue/queue.constants.ts` заменить содержимое:

```typescript
export const JOBS = {
  WAVE: 'order-wave',
  WAVE_TIMEOUT: 'order-wave-timeout',
  PRICE_TIMEOUT: 'order-price-timeout',
  AUTO_CLOSE: 'order-auto-close',
  PRESENCE_SWEEP: 'presence-sweep',
  PLANNED_EXPIRY: 'planned-order-expiry',
  PLANNED_CONFIRM_TIMEOUT: 'planned-order-confirm-timeout',
  PLANNED_AUTO_CLOSE: 'planned-order-auto-close',
} as const;
```

- [ ] **Step 4: Константы модуля**

Создать `apps/api/src/planned-orders/planned-order.constants.ts`:

```typescript
import { Prisma } from '@prisma/client';

export const PLANNED_HORIZON_DAYS = 14;
export const PLANNED_MAX_BIDS = 5;
export const PLANNED_CONFIRM_TIMEOUT_S = 2 * 3600;
export const PLANNED_AUTO_CLOSE_S = 24 * 3600;

export const PLANNED_ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  bids: {
    include: { master: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlannedOrderInclude;

export const FEED_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  district: true,
  description: true,
  scheduledAt: true,
  status: true,
  createdAt: true,
  _count: { select: { bids: true } },
} satisfies Prisma.PlannedOrderSelect;
```

- [ ] **Step 5: DTO**

Создать `apps/api/src/planned-orders/dto.ts`:

```typescript
import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreatePlannedOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  district!: string;

  @IsISO8601()
  scheduledAt!: string;
}

export class PlaceBidDto {
  @IsInt()
  @Min(1)
  price!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  term!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SelectBidDto {
  @IsUUID()
  bidId!: string;
}
```

(`Max`, `Min` пока используются только в `PlaceBidDto`/будущих шагах — импорт оставить, понадобится в Task 6.)

- [ ] **Step 6: Сервис (базовые методы)**

Создать `apps/api/src/planned-orders/planned-orders.service.ts`:

```typescript
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PlannedOrder, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PLANNED_HORIZON_DAYS, PLANNED_ORDER_INCLUDE } from './planned-order.constants';
import { CreatePlannedOrderDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PlannedOrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    // Хендлеры джоб регистрируются по мере добавления в Task 7/8.
  }

  async create(clientId: string, dto: CreatePlannedOrderDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const scheduledAt = new Date(dto.scheduledAt);
    const now = new Date();
    const horizon = new Date(now.getTime() + PLANNED_HORIZON_DAYS * 24 * 3600 * 1000);
    if (scheduledAt <= now) throw new BadRequestException('Дата должна быть в будущем');
    if (scheduledAt > horizon) {
      throw new BadRequestException(`Дата должна быть не позднее ${PLANNED_HORIZON_DAYS} дней вперёд`);
    }

    const order = await this.prisma.plannedOrder.create({
      data: {
        clientId,
        categoryId: dto.categoryId,
        description: dto.description,
        address: dto.address,
        district: dto.district,
        scheduledAt,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    const delaySeconds = Math.max(0, Math.floor((scheduledAt.getTime() - Date.now()) / 1000));
    await this.queue.send(JOBS.PLANNED_EXPIRY, { plannedOrderId: order.id }, delaySeconds);
    return this.findOrThrow(order.id);
  }

  async listMine(clientId: string) {
    return this.prisma.plannedOrder.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: PLANNED_ORDER_INCLUDE,
    });
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    return order;
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    id: string,
    from: Prisma.Enumerable<PlannedOrder['status']>,
    data: Prisma.PlannedOrderUpdateManyMutationInput | Prisma.PlannedOrderUncheckedUpdateManyInput,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const res = await tx.plannedOrder.updateMany({
      where: { id, status: Array.isArray(from) ? { in: from } : from },
      data,
    });
    if (res.count === 0) throw new ConflictException('Заявка в другом статусе');
  }

  /** Владелец заявки? Иначе 403. Используется переходами клиента. */
  async guardClient(clientId: string, id: string) {
    const order = await this.findOrThrow(id);
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }
}
```

- [ ] **Step 7: Контроллер**

Создать `apps/api/src/planned-orders/planned-orders.controller.ts` (маршрут `GET /planned-orders/:id` добавится в Task 5 вместе с `getByIdForUser` — на этом шаге его ещё нет):

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlannedOrdersService } from './planned-orders.service';
import { CreatePlannedOrderDto } from './dto';

@Controller('planned-orders')
@UseGuards(JwtAuthGuard)
export class PlannedOrdersController {
  constructor(private readonly plannedOrders: PlannedOrdersService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePlannedOrderDto) {
    return this.plannedOrders.create(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.plannedOrders.listMine(user.id);
  }
}
```

- [ ] **Step 8: Модуль и регистрация**

Создать `apps/api/src/planned-orders/planned-orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersController } from './planned-orders.controller';

@Module({
  imports: [RealtimeModule],
  providers: [PlannedOrdersService],
  controllers: [PlannedOrdersController],
  exports: [PlannedOrdersService],
})
export class PlannedOrdersModule {}
```

В `apps/api/src/app.module.ts`:

```typescript
import { PlannedOrdersModule } from './planned-orders/planned-orders.module';
// ...
    PlannedOrdersModule,
```

(последней строкой в `imports`, после `OrdersModule`).

- [ ] **Step 9: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-create.e2e-spec`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/planned-orders apps/api/src/queue/queue.constants.ts apps/api/src/app.module.ts apps/api/test/helpers.ts apps/api/test/planned-orders-create.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): публикация плановой заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Лента мастера и редактированный просмотр заявки

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Test: `apps/api/test/planned-orders-feed.e2e-spec.ts`

**Interfaces:**
- Consumes: `PLANNED_ORDER_INCLUDE`, `FEED_SELECT` (Task 4).
- Produces: `PlannedOrdersService.feed(masterUserId)`, `.getByIdForUser(user, id)`, `.redactMasterContact(order)` (используется в Task 7); HTTP `GET /planned-orders/feed`, `GET /planned-orders/:id`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/planned-orders-feed.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi } from './helpers';

describe('Лента и просмотр плановой заявки (e2e)', () => {
  let app: INestApplication;
  let plumbingId: string;
  let electricsId: string;
  let client: { token: string; userId: string };
  let plumber: { token: string; userId: string };
  let electrician: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const cats = await seedCategories(app);
    plumbingId = cats.plumbing.id;
    electricsId = cats.electrics.id;
    client = await loginAs(app, '+77070000001');
    plumber = await createActiveMaster(app, '+77070000002', plumbingId);
    electrician = await createActiveMaster(app, '+77070000003', electricsId);
  });

  it('лента фильтруется по категории мастера, без адреса и контакта клиента', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);

    const plumberFeed = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/feed')
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(plumberFeed.body).toHaveLength(1);
    expect(plumberFeed.body[0].id).toBe(order.id);
    expect(plumberFeed.body[0].address).toBeUndefined();

    const electricianFeed = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/feed')
      .set('Authorization', `Bearer ${electrician.token}`)
      .expect(200);
    expect(electricianFeed.body).toHaveLength(0);
  });

  it('чужой мастер видит заявку без адреса и контакта клиента; выбранный мастер — с ними', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const redacted = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(redacted.body.address).toBeNull();
    expect(redacted.body.client).toBeNull();
  });

  it('клиент видит свою заявку полностью', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const full = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(full.body.address).toBe('ул. Абая, 1');
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-feed.e2e-spec`
Expected: FAIL — 404 на `/feed` и `/:id`.

- [ ] **Step 3: Добавить методы в сервис**

В `apps/api/src/planned-orders/planned-orders.service.ts`:
- добавить импорт `FEED_SELECT` из `./planned-order.constants`;
- добавить импорт `User` из `@prisma/client` (для типа параметра);
- добавить методы в класс (после `guardClient`):

```typescript
  async feed(masterUserId: string) {
    const categories = await this.prisma.masterCategory.findMany({
      where: { masterProfile: { userId: masterUserId } },
      select: { categoryId: true },
    });
    const categoryIds = categories.map((c) => c.categoryId);
    if (categoryIds.length === 0) return [];
    return this.prisma.plannedOrder.findMany({
      where: { status: 'PUBLISHED', categoryId: { in: categoryIds } },
      orderBy: { scheduledAt: 'asc' },
      select: FEED_SELECT,
    });
  }

  async getByIdForUser(user: User, id: string) {
    const order = await this.findOrThrow(id);
    if (order.clientId === user.id) return this.redactMasterContact(order);
    const revealed = order.masterId === user.id;
    return revealed ? order : { ...order, address: null, client: null };
  }

  private static readonly MASTER_CONTACT_REVEALED_STATUSES: PlannedOrder['status'][] = [
    'CONFIRMED',
    'IN_PROGRESS',
    'DONE',
    'CLOSED',
  ];

  /** Клиенту телефон мастера виден только с CONFIRMED — §3.4 шаг 7. */
  private redactMasterContact<T extends { status: PlannedOrder['status']; master: { id: string; name: string | null; phone: string } | null }>(
    order: T,
  ): T {
    if (order.master && !PlannedOrdersService.MASTER_CONTACT_REVEALED_STATUSES.includes(order.status)) {
      return { ...order, master: { ...order.master, phone: '' } };
    }
    return order;
  }
```

- [ ] **Step 4: Добавить эндпоинты в контроллер**

В `apps/api/src/planned-orders/planned-orders.controller.ts` добавить импорт `Param` (уже есть в списке из `@nestjs/common`, добавить в деструктуризацию) и методы:

```typescript
  @Get('feed')
  feed(@CurrentUser() user: User) {
    return this.plannedOrders.feed(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.getByIdForUser(user, id);
  }
```

(добавить `Param` в импорт из `'@nestjs/common'`: `import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';`)

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-feed.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/planned-orders
git commit -m "$(cat <<'EOF'
feat(planned-orders): лента мастера по категории и редактированный просмотр

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Ставки мастеров

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Modify: `apps/api/test/helpers.ts` (добавить `grantLeadCredits`)
- Test: `apps/api/test/planned-orders-bids.e2e-spec.ts`

**Interfaces:**
- Consumes: `PLANNED_MAX_BIDS` (Task 4), `RealtimeGateway.emitToUser` (этап 2).
- Produces: `PlannedOrdersService.placeBid(masterUserId, id, dto)`; HTTP `POST /planned-orders/:id/bids`; WS `bid:new` клиенту.

- [ ] **Step 1: Добавить хелпер и написать падающий e2e-тест**

В `apps/api/test/helpers.ts` добавить:

```typescript
export async function grantLeadCredits(app: INestApplication, masterUserId: string, amount: number): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.leadCreditAccount.upsert({
    where: { masterUserId },
    create: { masterUserId, balance: amount },
    update: { balance: { increment: amount } },
  });
}
```

Создать `apps/api/test/planned-orders-bids.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp, resetDb, seedCategories, loginAs, createActiveMaster,
  createPlannedOrderViaApi, grantLeadCredits,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Ставки на плановую заявку (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let masters: { token: string; userId: string }[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77080000001');
    masters = [];
    for (let i = 0; i < 6; i++) {
      const m = await createActiveMaster(app, `+7708000001${i}`, plumbingId);
      await grantLeadCredits(app, m.userId, 5);
      masters.push(m);
    }
  });

  it('ставка списывает 1 кредит и создаёт запись', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 8000, term: 'сегодня до 18:00', comment: 'есть всё оборудование' })
      .expect(201);
    expect(res.body).toMatchObject({ price: 8000, term: 'сегодня до 18:00' });

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: masters[0].userId } });
    expect(account.balance).toBe(4);
    const tx = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: masters[0].userId } });
    expect(tx).toMatchObject({ type: 'SPEND', amount: 1 });
  });

  it('недостаточно кредитов — 422, повторный отклик тем же мастером — 409', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const poor = await createActiveMaster(app, '+77080000099', plumbingId); // без кредитов
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${poor.token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 9000, term: 'завтра' })
      .expect(409);
  });

  it('лимит 5 мастеров на заявку', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/planned-orders/${order.id}/bids`)
        .set('Authorization', `Bearer ${masters[i].token}`)
        .send({ price: 8000, term: 'завтра' })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[5].token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(422);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-bids.e2e-spec`
Expected: FAIL — 404.

- [ ] **Step 3: Реализовать `placeBid` в сервисе**

В `apps/api/src/planned-orders/planned-orders.service.ts`:
- добавить импорты `UnprocessableEntityException` из `@nestjs/common` и `PLANNED_MAX_BIDS` из `./planned-order.constants`, `PlaceBidDto` из `./dto`;
- добавить метод:

```typescript
  async placeBid(masterUserId: string, plannedOrderId: string, dto: PlaceBidDto) {
    let clientId = '';
    let bidsCount = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.plannedOrder.findUnique({ where: { id: plannedOrderId } });
        if (!order) throw new NotFoundException('Заявка не найдена');
        if (order.status !== 'PUBLISHED') throw new ConflictException('Заявка уже не принимает ставки');
        clientId = order.clientId;

        const existingBids = await tx.plannedOrderBid.count({ where: { plannedOrderId } });
        if (existingBids >= PLANNED_MAX_BIDS) {
          throw new UnprocessableEntityException('Достигнут лимит откликов на заявку');
        }

        const spent = await tx.leadCreditAccount.updateMany({
          where: { masterUserId, balance: { gte: 1 } },
          data: { balance: { decrement: 1 } },
        });
        if (spent.count === 0) throw new UnprocessableEntityException('Недостаточно lead-кредитов');

        const created = await tx.plannedOrderBid.create({
          data: { plannedOrderId, masterUserId, price: dto.price, term: dto.term, comment: dto.comment ?? null },
        });
        await tx.leadCreditTransaction.create({
          data: { masterUserId, type: 'SPEND', amount: 1, bidId: created.id },
        });
        bidsCount = existingBids + 1;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Вы уже откликнулись на эту заявку');
      }
      throw e;
    }

    this.gateway.emitToUser(clientId, 'bid:new', { plannedOrderId, bidsCount });
    return this.prisma.plannedOrderBid.findFirstOrThrow({ where: { plannedOrderId, masterUserId } });
  }
```

- [ ] **Step 4: Добавить эндпоинт в контроллер**

В `apps/api/src/planned-orders/planned-orders.controller.ts` добавить импорт `PlaceBidDto` в строку `import { CreatePlannedOrderDto } from './dto';` → `import { CreatePlannedOrderDto, PlaceBidDto } from './dto';`, и метод:

```typescript
  @Post(':id/bids')
  placeBid(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: PlaceBidDto) {
    return this.plannedOrders.placeBid(user.id, id, dto);
  }
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-bids.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/planned-orders apps/api/test/helpers.ts apps/api/test/planned-orders-bids.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): ставки мастеров со списанием lead-кредита

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Выбор мастера, подтверждение, таймаут

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Test: `apps/api/test/planned-orders-select.e2e-spec.ts`

**Interfaces:**
- Consumes: `redactMasterContact`, `gate` (Task 4/5).
- Produces: `.select(clientId, id, dto)`, `.confirm(masterUserId, id)`, `.decline(masterUserId, id)`, `.handleConfirmTimeout(data)`, `.emitPlannedStatus(id)`; HTTP `POST /planned-orders/:id/select`, `/confirm`, `/decline`; WS `bid:selected`, `bid:closed`, `planned:status`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/planned-orders-select.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp, resetDb, seedCategories, loginAs, createActiveMaster,
  createPlannedOrderViaApi, grantLeadCredits,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlannedOrdersService } from '../src/planned-orders/planned-orders.service';

describe('Выбор и подтверждение мастера (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plannedOrders: PlannedOrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };

  async function bid(token: string, orderId: string, price: number) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price, term: 'завтра' })
      .expect(201);
    return res.body;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    plannedOrders = app.get(PlannedOrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090100001');
    m1 = await createActiveMaster(app, '+77090100002', plumbingId);
    m2 = await createActiveMaster(app, '+77090100003', plumbingId);
    await grantLeadCredits(app, m1.userId, 5);
    await grantLeadCredits(app, m2.userId, 5);
  });

  it('выбор → MASTER_SELECTED; телефон мастера клиенту ещё скрыт', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await bid(m2.token, order.id, 9000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);
    expect(res.body.status).toBe('MASTER_SELECTED');
    expect(res.body.master.id).toBe(m1.userId);
    expect(res.body.master.phone).toBe('');
  });

  it('подтверждение мастером → CONFIRMED, телефон раскрыт клиенту, цена = ставке', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${m1.token}`)
      .expect(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.workPrice).toBe(8000);

    const clientView = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(clientView.body.master.phone).toBeTruthy();
  });

  it('явный decline и джоба-таймаут возвращают заявку в PUBLISHED с сохранением бидов', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/decline`)
      .set('Authorization', `Bearer ${m1.token}`)
      .expect(201);

    let fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });
    expect(await prisma.plannedOrderBid.count({ where: { plannedOrderId: order.id } })).toBe(1);

    // повторный выбор того же бида работает после возврата в PUBLISHED
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);

    // джоба-таймаут на уже неактуальный bidId (устаревший) — no-op
    fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: 'stale-bid-id' });
    const stillSelected = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stillSelected.status).toBe('MASTER_SELECTED');

    // реальный таймаут по актуальному bidId возвращает в PUBLISHED
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: fresh.selectedBidId! });
    const afterTimeout = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterTimeout.status).toBe('PUBLISHED');
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-select.e2e-spec`
Expected: FAIL — 404 на `/select`, `/confirm`, `/decline`.

- [ ] **Step 3: Реализовать методы в сервисе**

В `apps/api/src/planned-orders/planned-orders.service.ts`:
- добавить импорты `ForbiddenException` из `@nestjs/common`, `SelectBidDto` из `./dto`, `PLANNED_CONFIRM_TIMEOUT_S` из `./planned-order.constants`;
- добавить методы:

```typescript
  async select(clientId: string, plannedOrderId: string, dto: SelectBidDto) {
    const order = await this.guardClient(clientId, plannedOrderId);
    const bid = await this.prisma.plannedOrderBid.findUnique({ where: { id: dto.bidId } });
    if (!bid || bid.plannedOrderId !== plannedOrderId) throw new BadRequestException('Ставка не найдена');
    void order;

    await this.gate(plannedOrderId, 'PUBLISHED', {
      status: 'MASTER_SELECTED',
      masterId: bid.masterUserId,
      selectedBidId: bid.id,
      selectedAt: new Date(),
    });
    await this.queue.send(JOBS.PLANNED_CONFIRM_TIMEOUT, { plannedOrderId, bidId: bid.id }, PLANNED_CONFIRM_TIMEOUT_S);

    const others = await this.prisma.plannedOrderBid.findMany({
      where: { plannedOrderId, masterUserId: { not: bid.masterUserId } },
    });
    this.gateway.emitToUser(bid.masterUserId, 'bid:selected', { plannedOrderId });
    for (const o of others) {
      this.gateway.emitToUser(o.masterUserId, 'bid:closed', { plannedOrderId, reason: 'Выбран другой мастер' });
    }
    await this.emitPlannedStatus(plannedOrderId);
    const fresh = await this.findOrThrow(plannedOrderId);
    return this.redactMasterContact(fresh);
  }

  async confirm(masterUserId: string, plannedOrderId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    if (!order.selectedBidId) throw new ConflictException('Ставка не выбрана');
    const bid = await this.prisma.plannedOrderBid.findUniqueOrThrow({ where: { id: order.selectedBidId } });
    await this.gate(plannedOrderId, 'MASTER_SELECTED', {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      workPrice: bid.price,
    });
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async decline(masterUserId: string, plannedOrderId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    await this.returnToPublished(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  /** Джоба: мастер молчал 2 часа. bidId сверяется — устаревший вызов (после re-select) игнорируется. */
  async handleConfirmTimeout({ plannedOrderId, bidId }: { plannedOrderId: string; bidId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order || order.status !== 'MASTER_SELECTED' || order.selectedBidId !== bidId) return;
    await this.returnToPublished(plannedOrderId);
  }

  private async returnToPublished(plannedOrderId: string): Promise<void> {
    await this.gate(plannedOrderId, 'MASTER_SELECTED', {
      status: 'PUBLISHED',
      masterId: null,
      selectedBidId: null,
      selectedAt: null,
    });
    await this.emitPlannedStatus(plannedOrderId);
  }

  async emitPlannedStatus(plannedOrderId: string): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId }, include: PLANNED_ORDER_INCLUDE });
    if (!order) return;
    const base = {
      plannedOrderId: order.id,
      status: order.status,
      workPrice: order.workPrice,
      cancelReason: order.cancelReason,
      scheduledAt: order.scheduledAt,
    };
    this.gateway.emitToUser(order.clientId, 'planned:status', { ...base, master: this.redactMasterContact(order).master });
    if (order.masterId) this.gateway.emitToUser(order.masterId, 'planned:status', { ...base, master: order.master });
  }
```

Также зарегистрировать джобу в `onModuleInit`:

```typescript
  onModuleInit(): void {
    this.queue.register(JOBS.PLANNED_CONFIRM_TIMEOUT, (d: { plannedOrderId: string; bidId: string }) =>
      this.handleConfirmTimeout(d),
    );
  }
```

(заменяет пустое тело из Task 4).

- [ ] **Step 4: Добавить эндпоинты в контроллер**

В `apps/api/src/planned-orders/planned-orders.controller.ts` добавить импорт `SelectBidDto` (`import { CreatePlannedOrderDto, PlaceBidDto, SelectBidDto } from './dto';`) и методы:

```typescript
  @Post(':id/select')
  select(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SelectBidDto) {
    return this.plannedOrders.select(user.id, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.confirm(user.id, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.decline(user.id, id);
  }
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-select.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/planned-orders apps/api/test/planned-orders-select.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): выбор мастера, подтверждение, таймаут 2ч

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Выполнение, истечение публикации, авто-закрытие

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Test: `apps/api/test/planned-orders-complete.e2e-spec.ts`

**Interfaces:**
- Consumes: `emitPlannedStatus`, `gate` (Task 7).
- Produces: `.onSite`, `.complete`, `.confirmCompletion`, `.handleAutoClose`, `.handlePlannedExpiry`; HTTP `/on-site`, `/complete`, `/confirm-completion`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/planned-orders-complete.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlannedOrdersService } from '../src/planned-orders/planned-orders.service';

describe('Выполнение и закрытие плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plannedOrders: PlannedOrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  async function fullyConfirmed() {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    return order.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    plannedOrders = app.get(PlannedOrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090200001');
    master = await createActiveMaster(app, '+77090200002', plumbingId);
    await grantLeadCredits(app, master.userId, 5);
  });

  it('полный цикл: on-site → complete → confirm-completion → CLOSED', async () => {
    const orderId = await fullyConfirmed();
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/confirm-completion`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);
    expect(res.body.status).toBe('CLOSED');
  });

  it('джоба авто-закрытия закрывает заявку из DONE', async () => {
    const orderId = await fullyConfirmed();
    await request(app.getHttpServer()).post(`/api/v1/planned-orders/${orderId}/on-site`).set('Authorization', `Bearer ${master.token}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/planned-orders/${orderId}/complete`).set('Authorization', `Bearer ${master.token}`).expect(201);

    await plannedOrders.handleAutoClose({ plannedOrderId: orderId });
    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('CLOSED');
  });

  it('джоба истечения публикации: без ставок → EXPIRED, со ставками → no-op', async () => {
    const empty = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await plannedOrders.handlePlannedExpiry({ plannedOrderId: empty.id });
    const expired = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: empty.id } });
    expect(expired.status).toBe('EXPIRED');

    const withBid = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${withBid.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 5000, term: 'завтра' })
      .expect(201);
    await plannedOrders.handlePlannedExpiry({ plannedOrderId: withBid.id });
    const stillPublished = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: withBid.id } });
    expect(stillPublished.status).toBe('PUBLISHED');
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-complete.e2e-spec`
Expected: FAIL — 404 на `/on-site`, `/complete`, `/confirm-completion`.

- [ ] **Step 3: Реализовать методы в сервисе**

В `apps/api/src/planned-orders/planned-orders.service.ts`:
- добавить импорт `PLANNED_AUTO_CLOSE_S` из `./planned-order.constants`;
- добавить приватный `guardMaster` (аналог `guardClient`) и методы:

```typescript
  private async guardMaster(masterUserId: string, id: string) {
    const order = await this.findOrThrow(id);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  async onSite(masterUserId: string, plannedOrderId: string) {
    await this.guardMaster(masterUserId, plannedOrderId);
    await this.gate(plannedOrderId, 'CONFIRMED', { status: 'IN_PROGRESS' });
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async complete(masterUserId: string, plannedOrderId: string) {
    await this.guardMaster(masterUserId, plannedOrderId);
    await this.gate(plannedOrderId, 'IN_PROGRESS', { status: 'DONE', completedAt: new Date() });
    await this.queue.send(JOBS.PLANNED_AUTO_CLOSE, { plannedOrderId }, PLANNED_AUTO_CLOSE_S);
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async confirmCompletion(clientId: string, plannedOrderId: string) {
    await this.guardClient(clientId, plannedOrderId);
    await this.closeOrder(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async handleAutoClose({ plannedOrderId }: { plannedOrderId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order || order.status !== 'DONE') return;
    await this.closeOrder(plannedOrderId);
  }

  private async closeOrder(plannedOrderId: string): Promise<void> {
    await this.gate(plannedOrderId, 'DONE', { status: 'CLOSED', closedAt: new Date() });
    await this.emitPlannedStatus(plannedOrderId);
  }

  async handlePlannedExpiry({ plannedOrderId }: { plannedOrderId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({
      where: { id: plannedOrderId },
      include: { _count: { select: { bids: true } } },
    });
    if (!order || order.status !== 'PUBLISHED' || order._count.bids > 0) return;
    await this.gate(plannedOrderId, 'PUBLISHED', { status: 'EXPIRED' });
    await this.emitPlannedStatus(plannedOrderId);
  }
```

Дописать регистрацию джоб в `onModuleInit`:

```typescript
  onModuleInit(): void {
    this.queue.register(JOBS.PLANNED_CONFIRM_TIMEOUT, (d: { plannedOrderId: string; bidId: string }) =>
      this.handleConfirmTimeout(d),
    );
    this.queue.register(JOBS.PLANNED_AUTO_CLOSE, (d: { plannedOrderId: string }) => this.handleAutoClose(d));
    this.queue.register(JOBS.PLANNED_EXPIRY, (d: { plannedOrderId: string }) => this.handlePlannedExpiry(d));
  }
```

- [ ] **Step 4: Добавить эндпоинты в контроллер**

В `apps/api/src/planned-orders/planned-orders.controller.ts` добавить:

```typescript
  @Post(':id/on-site')
  onSite(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.onSite(user.id, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.complete(user.id, id);
  }

  @Post(':id/confirm-completion')
  confirmCompletion(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.confirmCompletion(user.id, id);
  }
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-complete.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/planned-orders apps/api/test/planned-orders-complete.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): выполнение, авто-закрытие 24ч, истечение публикации

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Отмена (§3.9, плановый режим)

**Files:**
- Modify: `apps/api/src/planned-orders/planned-orders.service.ts`
- Modify: `apps/api/src/planned-orders/planned-orders.controller.ts`
- Test: `apps/api/test/planned-orders-cancel.e2e-spec.ts`

**Interfaces:**
- Produces: `.cancel(user, id)`; HTTP `POST /planned-orders/:id/cancel`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/planned-orders-cancel.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Отмена плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  async function bidAndSelect(orderId: string, price = 7000) {
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price, term: 'сегодня' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);
    return bidRes.body.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090300001');
    master = await createActiveMaster(app, '+77090300002', plumbingId);
    await grantLeadCredits(app, master.userId, 5);
  });

  it('клиент отменяет до выбора мастера: бесплатно, кредит мастера не возвращается', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe('CANCELLED_BY_CLIENT');
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(4); // потратил 1 на ставку, возврата нет
  });

  it('клиент отменяет после выбора мастера: кредит возвращается полностью выбранному', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe('CANCELLED_BY_CLIENT');
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(5); // потратил 1, вернули 1
    const refund = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'REFUND' } });
    expect(refund.amount).toBe(1);
  });

  it('мастер отменяет после подтверждения: −2 кредита, штраф приоритета, заявка снова PUBLISHED', async () => {
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
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: master.userId } });
    expect(profile.priorityPenaltyUntil).toBeTruthy();
  });

  it('мастер не может отменить до подтверждения (409)', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(409);
  });

  it('посторонний не может отменить (403)', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const stranger = await loginAs(app, '+77090300099');
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd apps/api && npm run test:e2e -- planned-orders-cancel.e2e-spec`
Expected: FAIL — 404 на `/cancel`.

- [ ] **Step 3: Реализовать `cancel` в сервисе**

В `apps/api/src/planned-orders/planned-orders.service.ts` добавить импорт `PlannedOrder as PlannedOrderModel`-типа не требуется (уже импортирован `PlannedOrder`), и импорт `User` уже есть из Task 5. Добавить методы:

```typescript
  async cancel(user: User, plannedOrderId: string): Promise<PlannedOrder> {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.clientId === user.id) {
      await this.cancelByClient(order);
    } else if (order.masterId === user.id) {
      await this.cancelByMaster(order);
    } else {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return this.findOrThrow(plannedOrderId);
  }

  private async cancelByClient(order: PlannedOrder): Promise<void> {
    const before: PlannedOrder['status'][] = ['CREATED', 'PUBLISHED'];
    const after: PlannedOrder['status'][] = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

    if (before.includes(order.status)) {
      await this.gate(order.id, before, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом' });
      await this.emitPlannedStatus(order.id);
      return;
    }

    if (after.includes(order.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.gate(
          order.id,
          after,
          { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом после выбора мастера' },
          tx,
        );
        if (order.masterId) {
          await tx.leadCreditAccount.update({
            where: { masterUserId: order.masterId },
            data: { balance: { increment: 1 } },
          });
          await tx.leadCreditTransaction.create({
            data: { masterUserId: order.masterId, type: 'REFUND', amount: 1, bidId: order.selectedBidId },
          });
        }
      });
      await this.emitPlannedStatus(order.id);
      return;
    }

    throw new ConflictException('На этом этапе отмена недоступна');
  }

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
      await tx.leadCreditAccount.update({
        where: { masterUserId: order.masterId! },
        data: { balance: { decrement: 2 } },
      });
      await tx.leadCreditTransaction.create({
        data: { masterUserId: order.masterId!, type: 'SPEND', amount: 2, bidId: order.selectedBidId },
      });
      await tx.masterProfile.updateMany({
        where: { userId: order.masterId! },
        data: { priorityPenaltyUntil: new Date(Date.now() + 24 * 3600 * 1000) },
      });
    });
    await this.emitPlannedStatus(order.id);
  }
```

- [ ] **Step 4: Добавить эндпоинт в контроллер**

В `apps/api/src/planned-orders/planned-orders.controller.ts` добавить:

```typescript
  @Post(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.cancel(user, id);
  }
```

- [ ] **Step 5: Прогнать тест — PASS**

Run: `cd apps/api && npm run test:e2e -- planned-orders-cancel.e2e-spec`
Expected: PASS.

- [ ] **Step 6: Прогнать весь набор e2e — без регрессий**

Run: `cd apps/api && npm run test:e2e`
Expected: все тесты, включая новые `planned-orders-*`, `lead-credits`, — PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/planned-orders apps/api/test/planned-orders-cancel.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(planned-orders): отмена клиентом и мастером по §3.9

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Веб — публикация плановой заявки

**Files:**
- Modify: `apps/web/src/orderStatus.ts`
- Modify: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/PlannedNewOrderPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `api()` (`apps/web/src/api.ts`, этап 2).
- Produces: маршрут `/planned/new`, экспорт `PLANNED_STATUS_LABELS`.

- [ ] **Step 1: Добавить лейблы статусов**

В `apps/web/src/orderStatus.ts` добавить в конец файла:

```typescript
export const PLANNED_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создана',
  PUBLISHED: 'Опубликована',
  MASTER_SELECTED: 'Мастер выбран',
  CONFIRMED: 'Подтверждена',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CLOSED: 'Закрыта',
  EXPIRED: 'Истекла',
  CANCELLED_BY_CLIENT: 'Отменена клиентом',
  CANCELLED_BY_MASTER: 'Отменена мастером',
  DISPUTE: 'Спор',
};

export function isPlannedTerminalStatus(s: string): boolean {
  return ['CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}
```

- [ ] **Step 2: Добавить вторую CTA на `HomePage`**

В `apps/web/src/pages/HomePage.tsx` заменить блок `return (...)`:

```tsx
  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <h1 className="text-2xl font-bold">MasterQala</h1>
      {order ? (
        <Link to={`/order/${order.id}`} className="block rounded-xl border p-4 shadow-sm">
          <div className="font-semibold">{order.category?.name}</div>
          <div className="text-teal-700">{STATUS_LABELS[order.status]}</div>
          <div className="text-sm text-gray-500">{order.address}</div>
        </Link>
      ) : (
        <Link to="/order/new" className="block rounded-xl bg-teal-700 p-6 text-center text-xl font-semibold text-white">
          Вызвать мастера
        </Link>
      )}
      <Link to="/planned/new" className="block rounded-xl border border-teal-700 p-6 text-center text-xl font-semibold text-teal-700">
        Запланировать
      </Link>
    </div>
  );
```

- [ ] **Step 3: Создать форму публикации**

Создать `apps/web/src/pages/PlannedNewOrderPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function minDateTimeLocal(): string {
  const d = new Date(Date.now() + 3600_000);
  return d.toISOString().slice(0, 16);
}

function maxDateTimeLocal(): string {
  const d = new Date(Date.now() + 14 * 24 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export default function PlannedNewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [scheduledAt, setScheduledAt] = useState(minDateTimeLocal());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
  }, []);

  const canSubmit = categoryId && description && address && district && scheduledAt && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/planned-orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address,
          district,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      navigate(`/planned/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Запланировать заявку</h1>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full border px-4 py-2 text-sm ${categoryId === c.id ? 'border-teal-700 bg-teal-700 text-white' : ''}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded border p-3"
        rows={3}
        placeholder="Опишите проблему"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        className="w-full rounded border p-3"
        placeholder="Адрес (улица, дом, квартира)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="w-full rounded border p-3"
        placeholder="Район"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
      />
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Дата и время</label>
        <input
          type="datetime-local"
          className="w-full rounded border p-3"
          value={scheduledAt}
          min={minDateTimeLocal()}
          max={maxDateTimeLocal()}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      <p className="text-sm text-gray-600">
        Мастера увидят категорию, район и описание и предложат свою цену. Вы выбираете лучшую ставку.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
      >
        {submitting ? 'Публикуем…' : 'Опубликовать заявку'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Зарегистрировать маршрут**

В `apps/web/src/App.tsx` добавить импорт `import PlannedNewOrderPage from './pages/PlannedNewOrderPage';` и маршрут внутри `<Route element={<Layout />}>`, после `/order/:id`:

```tsx
              <Route path="/planned/new" element={<PlannedNewOrderPage />} />
```

(маршрут `/planned/:id` появится в Task 11 — до этого он не существует, что нормально: `navigate` на несуществующий путь при первом ручном тесте даст 404-страницу роутера; это допустимо между задачами, финальная проверка — в Task 13).

- [ ] **Step 5: Собрать web — без ошибок типов**

Run: `cd apps/web && npm run build`
Expected: сборка проходит без ошибок TypeScript (кроме отсутствия маршрута `/planned/:id`, что не влияет на билд — это runtime-навигация, не импорт).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/orderStatus.ts apps/web/src/pages/HomePage.tsx apps/web/src/pages/PlannedNewOrderPage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): форма публикации плановой заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Веб — детальная страница плановой заявки (клиент)

**Files:**
- Create: `apps/web/src/pages/PlannedOrderPage.tsx`
- Modify: `apps/web/src/pages/MyOrdersPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `getSocket()` (`apps/web/src/socket.ts`, этап 2), `PLANNED_STATUS_LABELS` (Task 10).
- Produces: маршрут `/planned/:id`.

- [ ] **Step 1: Создать детальную страницу**

Создать `apps/web/src/pages/PlannedOrderPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { PLANNED_STATUS_LABELS, isPlannedTerminalStatus } from '../orderStatus';

export default function PlannedOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: any) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [id, load]);

  async function selectBid(bidId: string) {
    try {
      await api(`/planned-orders/${id}/select`, { method: 'POST', body: JSON.stringify({ bidId }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/planned-orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  if (error && !order) return <div className="p-6 text-red-600">{error}</div>;
  if (!order) return <div className="p-6 text-gray-500">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm p-6 pb-32 space-y-4">
      <h1 className="text-xl font-bold">{order.category?.name}</h1>
      <div className="text-teal-700">{PLANNED_STATUS_LABELS[order.status]}</div>
      <div className="text-sm text-gray-500">{new Date(order.scheduledAt).toLocaleString('ru-RU')}</div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {order.status === 'PUBLISHED' && (
        <div className="space-y-2">
          <h2 className="font-semibold">Ставки ({order.bids.length}/5)</h2>
          {order.bids.length === 0 && <p className="text-gray-500">Пока никто не откликнулся</p>}
          {order.bids.map((b: any) => (
            <div key={b.id} className="rounded-xl border p-4 space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold">{b.price} ₸</span>
                <span className="text-sm text-gray-500">{b.term}</span>
              </div>
              {b.comment && <div className="text-sm text-gray-600">{b.comment}</div>}
              <button className="w-full rounded bg-teal-700 p-2 text-white" onClick={() => selectBid(b.id)}>
                Выбрать
              </button>
            </div>
          ))}
        </div>
      )}

      {['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && order.master && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold">{order.master.name ?? 'Мастер'}</div>
          {order.master.phone ? (
            <a href={`tel:${order.master.phone}`} className="text-teal-700 underline">{order.master.phone}</a>
          ) : (
            <div className="text-sm text-gray-500">Ждём подтверждения…</div>
          )}
        </div>
      )}

      {isPlannedTerminalStatus(order.status) && (
        <button className="text-teal-700 underline" onClick={() => navigate('/')}>На главную</button>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-white p-4">
        {order.status === 'DONE' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-completion')}>
            Подтвердить выполнение
          </button>
        )}
        {['CREATED', 'PUBLISHED', 'MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', 'Отменить заявку?')}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Зарегистрировать маршрут**

В `apps/web/src/App.tsx` добавить импорт `import PlannedOrderPage from './pages/PlannedOrderPage';` и маршрут:

```tsx
              <Route path="/planned/:id" element={<PlannedOrderPage />} />
```

- [ ] **Step 3: Объединить историю заявок**

В `apps/web/src/pages/MyOrdersPage.tsx` заменить содержимое файла:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS, PLANNED_STATUS_LABELS } from '../orderStatus';

export default function MyOrdersPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')]).then(([urgent, planned]) => {
      const merged = [
        ...urgent.map((o: any) => ({ ...o, kind: 'urgent' as const })),
        ...planned.map((o: any) => ({ ...o, kind: 'planned' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(merged);
    });
  }, []);

  return (
    <div className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-2xl font-bold">Мои заявки</h1>
      {items.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
      {items.map((o) => (
        <Link
          key={o.id}
          to={o.kind === 'urgent' ? `/order/${o.id}` : `/planned/${o.id}`}
          className="block rounded-xl border p-4"
        >
          <div className="flex justify-between">
            <span className="font-semibold">{o.category?.name}</span>
            <span className="text-sm text-teal-700">
              {o.kind === 'urgent' ? STATUS_LABELS[o.status] : PLANNED_STATUS_LABELS[o.status]}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · {o.kind === 'urgent' ? 'Сейчас' : 'Запланировать'}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Собрать web**

Run: `cd apps/web && npm run build`
Expected: сборка без ошибок.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/PlannedOrderPage.tsx apps/web/src/pages/MyOrdersPage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): детальная страница плановой заявки и объединённая история

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Веб — лента и отклик мастера, экран lead-кредитов

**Files:**
- Modify: `apps/web/src/pages/WorkPage.tsx`
- Create: `apps/web/src/pages/LeadCreditsPage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `getSocket()`, `api()`.
- Produces: сегмент «Плановые» внутри `/work`, маршрут `/lead-credits`.

- [ ] **Step 1: Добавить сегмент-контрол и плановый флоу в `WorkPage`**

В `apps/web/src/pages/WorkPage.tsx` добавить состояние вкладки и плановый блок. Заменить начало функции (после существующих `useState`) и конец компонента:

Добавить после `const [error, setError] = useState('');`:

```tsx
  const [tab, setTab] = useState<'urgent' | 'planned'>('urgent');
  const [feed, setFeed] = useState<any[]>([]);
  const [plannedOrder, setPlannedOrder] = useState<any | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [plannedError, setPlannedError] = useState('');

  const loadFeed = useCallback(() => {
    api('/planned-orders/feed').then(setFeed);
  }, []);

  useEffect(() => {
    if (tab !== 'planned') return;
    loadFeed();
    const socket = getSocket();
    const onUpdate = () => loadFeed();
    socket.on('bid:closed', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:closed', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [tab, loadFeed]);

  async function openPlannedOrder(id: string) {
    setPlannedError('');
    const o = await api(`/planned-orders/${id}`);
    setPlannedOrder(o);
  }

  async function submitBid() {
    if (!plannedOrder || !Number(bidPrice) || !bidTerm) return;
    try {
      await api(`/planned-orders/${plannedOrder.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ price: Number(bidPrice), term: bidTerm, comment: bidComment || undefined }),
      });
      setPlannedOrder(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      loadFeed();
    } catch (e: any) {
      setPlannedError(e.message);
    }
  }
```

Заменить финальный `return` компонента (блок «Работа» без активной заявки/оффера) на версию с сегмент-контролом:

```tsx
  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <div className="flex rounded-full border p-1">
        <button
          className={`flex-1 rounded-full py-2 text-sm ${tab === 'urgent' ? 'bg-teal-700 text-white' : ''}`}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </button>
        <button
          className={`flex-1 rounded-full py-2 text-sm ${tab === 'planned' ? 'bg-teal-700 text-white' : ''}`}
          onClick={() => setTab('planned')}
        >
          Плановые
        </button>
      </div>

      {tab === 'urgent' && (
        <>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <div className="font-semibold">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
              <div className="text-sm text-gray-500">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
            </div>
            <button
              onClick={online ? goOffline : goOnline}
              className={`rounded-full px-5 py-2 text-white ${online ? 'bg-gray-400' : 'bg-teal-700'}`}
            >
              {online ? 'Выйти' : 'Онлайн'}
            </button>
          </div>
          {geoDenied && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера и попробуйте снова.
            </p>
          )}
          {offerNote && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{offerNote}</p>}
          {online && <p className="text-center text-gray-500">Ждём заявки рядом с вами…</p>}
        </>
      )}

      {tab === 'planned' && !plannedOrder && (
        <div className="space-y-3">
          <Link to="/lead-credits" className="block text-center text-teal-700 underline">Баланс и покупка кредитов</Link>
          {feed.length === 0 && <p className="text-center text-gray-500">Пока нет заявок в ваших категориях</p>}
          {feed.map((o) => (
            <button key={o.id} onClick={() => openPlannedOrder(o.id)} className="block w-full rounded-xl border p-4 text-left">
              <div className="flex justify-between">
                <span className="font-semibold">{o.category?.name}</span>
                <span className="text-sm text-gray-500">{o._count.bids}/5 ставок</span>
              </div>
              <div className="text-sm text-gray-600">{o.district}</div>
              <div className="text-sm text-gray-500">{new Date(o.scheduledAt).toLocaleString('ru-RU')}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'planned' && plannedOrder && (
        <div className="space-y-3">
          <button className="text-sm text-gray-500" onClick={() => setPlannedOrder(null)}>← Назад к ленте</button>
          <h2 className="text-lg font-bold">{plannedOrder.category?.name}</h2>
          <div className="text-sm text-gray-600">{plannedOrder.district}</div>
          <div className="text-sm text-gray-600">{plannedOrder.description}</div>
          <input
            type="number" min="1" placeholder="Ваша цена, ₸"
            className="w-full rounded border p-3" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)}
          />
          <input
            placeholder="Срок (например: сегодня до 18:00)"
            className="w-full rounded border p-3" value={bidTerm} onChange={(e) => setBidTerm(e.target.value)}
          />
          <input
            placeholder="Комментарий (необязательно)"
            className="w-full rounded border p-3" value={bidComment} onChange={(e) => setBidComment(e.target.value)}
          />
          {plannedError && <p className="text-sm text-red-600">{plannedError}</p>}
          <button
            className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
            disabled={!Number(bidPrice) || !bidTerm}
            onClick={submitBid}
          >
            Откликнуться (1 кредит)
          </button>
        </div>
      )}
    </div>
  );
```

Добавить импорт `Link` в шапку файла: `import { Link } from 'react-router-dom';`.

- [ ] **Step 2: Создать экран кредитов**

Создать `apps/web/src/pages/LeadCreditsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function LeadCreditsPage() {
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState('');

  function load() {
    api('/lead-credits/balance').then((r) => setBalance(r.balance));
    api('/lead-credits/packages').then(setPackages);
  }

  useEffect(load, []);

  async function purchase(id: string) {
    setPurchasing(id);
    setError('');
    try {
      const r = await api('/lead-credits/purchase', { method: 'POST', body: JSON.stringify({ package: id }) });
      setBalance(r.balance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing('');
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lead-кредиты</h1>
      <div className="rounded-xl bg-teal-50 p-4 text-center">
        <div className="text-3xl font-bold text-teal-700">{balance}</div>
        <div className="text-sm text-gray-600">кредитов на балансе</div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {packages.map((p) => (
          <button
            key={p.id}
            disabled={!!purchasing}
            onClick={() => purchase(p.id)}
            className="flex w-full items-center justify-between rounded-xl border p-4 disabled:opacity-40"
          >
            <span>{p.credits} кредит{p.credits > 1 ? 'ов' : ''}</span>
            <span className="font-semibold text-teal-700">{purchasing === p.id ? 'Оплата…' : `${p.priceTenge} ₸`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Зарегистрировать маршрут**

В `apps/web/src/App.tsx` добавить импорт `import LeadCreditsPage from './pages/LeadCreditsPage';` и маршрут внутри `<Route element={<Layout />}>`:

```tsx
              <Route path="/lead-credits" element={<LeadCreditsPage />} />
```

- [ ] **Step 4: Собрать web**

Run: `cd apps/web && npm run build`
Expected: сборка без ошибок.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/WorkPage.tsx apps/web/src/pages/LeadCreditsPage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): лента и отклик мастера на плановые заявки, покупка кредитов

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Сквозная проверка полного цикла

**Files:**
- Test: `apps/api/test/planned-orders-lifecycle.e2e-spec.ts`

**Interfaces:**
- Consumes: все методы `PlannedOrdersService` и `LeadCreditsService` (Tasks 3–9).

- [ ] **Step 1: Написать сквозной e2e-тест полного жизненного цикла**

Создать `apps/api/test/planned-orders-lifecycle.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Плановая заявка: полный жизненный цикл (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77099900001');
    master = await createActiveMaster(app, '+77099900002', plumbingId);
  });

  it('покупка кредита → публикация → ставка → выбор → подтверждение → выполнение → закрытие', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);

    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);

    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 9000, term: 'завтра утром', comment: 'привезу материалы' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const final = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm-completion`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    expect(final.body.status).toBe('CLOSED');
    expect(final.body.workPrice).toBe(9000);

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(0); // 1 куплен, 1 потрачен на ставку
  });
});
```

- [ ] **Step 2: Прогнать — PASS с первого раза**

Run: `cd apps/api && npm run test:e2e -- planned-orders-lifecycle.e2e-spec`
Expected: PASS (это регрессионный/интеграционный тест поверх уже реализованной логики Tasks 3–9, а не TDD для новой фичи — если падает, значит есть баг на стыке задач, искать и чинить перед коммитом).

- [ ] **Step 3: Прогнать весь backend e2e-набор целиком**

Run: `cd apps/api && npm run test:e2e`
Expected: все тесты (этап 1, этап 2, этап 3) — PASS.

- [ ] **Step 4: Собрать оба приложения**

Run: `cd apps/api && npm run build && cd ../web && npm run build`
Expected: оба билда зелёные, без ошибок TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/planned-orders-lifecycle.e2e-spec.ts
git commit -m "$(cat <<'EOF'
test: сквозной e2e-сценарий полного цикла плановой заявки

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Ручная браузерная проверка двумя окнами (как в этапе 2, Task 14/15)**

Не кодовый шаг — выполняется после Step 5 в браузере (или через subagent с доступом к preview-инструментам): открыть два окна (клиент и мастер, разные пользователи), пройти сценарий «купить кредиты → опубликовать плановую заявку → откликнуться → выбрать → подтвердить → на месте → выполнено → подтвердить выполнение», на каждом шаге сверяя статус в UI с `PlannedOrder`/`LeadCreditAccount`/`LeadCreditTransaction` в Postgres напрямую. Задокументировать результат в прогресс-леджере `.superpowers/sdd/progress.md` (не в git), как это было сделано для этапа 2.
