# Этап 2 «Срочный режим» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный жизненный цикл срочной заявки: превью цены → создание с холдом сбора → матчинг волнами → принятие → статусы до закрытия → отмены/таймауты, плюс presence мастеров, realtime по WebSocket, mock-оплата, начисления и экраны клиента/мастера.

**Architecture:** Событийный оркестратор поверх фундамента этапа 1: каждый переход статуса — транзакция с атомарным гейтом `updateMany({id, status: from})` (count===0 → 409), затем побочные эффекты (платёж/начисление/джоба), затем WS-события. Таймеры — pg-boss в той же PostgreSQL. Гео — PostGIS (raw SQL поверх Prisma `Unsupported`). Внешние зависимости за DI-токенами: `ROUTING_SERVICE` (dev: ST_Distance × 1.3), `PAYMENT_PROVIDER` (mock).

**Tech Stack:** NestJS 10, Prisma 5.21 + PostgreSQL 16/PostGIS 3.4 (docker-compose: dev 5432, test 5433), pg-boss 10, socket.io (@nestjs/websockets + @nestjs/platform-socket.io, клиент socket.io-client), React 19 + Vite + Tailwind 4 (pnpm workspace).

**Ветка:** работа в `stage2-urgent`, создать от `stage1-foundation`: `git checkout stage1-foundation && git checkout -b stage2-urgent`.

## Global Constraints

- Все пользовательские тексты — по-русски; идентификаторы в коде — по-английски.
- Тарифы (§6 бизнес-спеки, копия): база **2 000 ₸**, **150 ₸/км**, коэф. времени **08–20 ×1.0 / 20–23 ×1.2 / 23–08 ×1.5** (время **Asia/Almaty**, фиксированно), сервисный сбор **40% от выезда, мин. 1 000 ₸**. Дистанция dev: `ST_Distance` (по прямой) × **1.3**.
- Волны: радиусы **3/6/10 км**, таймауты **60/60/90 с**; таймаут подтверждения цены **15 мин**; авто-закрытие **24 ч**; presence offline: `lastSeenAt` старше **2 мин**.
- У клиента **одна активная срочная заявка** (409 при второй). Мастер «занят», если у него заявка в ACCEPTED..IN_PROGRESS.
- Паттерн перехода: `prisma.$transaction` → гейт `updateMany` → `count===0` → `ConflictException('Заявка в другом статусе')`; WS-события — после коммита.
- e2e: `pnpm --filter api test:e2e` (нужен `docker compose up -d db_test` + применённые миграции на 5433); джоб-хендлеры в тестах вызываются напрямую, pg-boss в e2e отключён через `PGBOSS_DISABLED=1`.
- Коммиты: `git commit` с trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Уточнения к спеке (зафиксированные в этом плане решения)

1. **`Order.searchAttempt`** (int, с 1) + уникальность OrderOffer **(orderId, masterUserId, attempt)** вместо (orderId, masterUserId) из дизайн-доки. Иначе «Повторить поиск» и перезапуск после отмены мастером не могли бы повторно оффернуть тех же мастеров, а журнал пришлось бы чистить. Внутри одной попытки мастер по-прежнему не получает заказ дважды; отменивший мастер исключается фильтром `outcome='ACCEPTED'` по прошлым попыткам.
2. **Отмена мастером не ставит терминальный `CANCELLED_BY_MASTER`**, а сразу возвращает заявку в `SEARCHING` (masterId=null, attempt+1, волна с 1) — транзитное состояние из §5.1 схлопнуто, как и описано в дизайн-доке §4; факт остаётся в журнале OrderOffer (outcome ACCEPTED у отменившего). Значение enum сохраняем — пригодится этапу 5.
3. **`MockPaymentProvider.void` после capture** трактуем как «возврат» (кейс: мастер отменил после capture → повторный поиск → NO_MASTERS). Реальный провайдер этапа 4 разделит release холда и refund.
4. **WS-комнаты — только `user:{userId}`.** Комнаты `order:{id}` не нужны: обе стороны заявки известны, события шлём адресно.
5. **`NO_MASTERS` считается активной заявкой** для лимита и `GET /orders/active`: клиент сначала решает — «Повторить поиск» или «Отменить».
6. Клиент **не может** отменить в `INSPECTION` и `IN_PROGRESS` (строго по §5.1: отмена клиентом — из SEARCHING, ACCEPTED, MASTER_ON_WAY и через reject-price из AWAITING_PRICE_CONFIRM).
7. `POST /orders` возвращает **422 «Мастеров рядом нет»**, если в 10 км нет подходящего онлайн-мастера (предусловие §3.3, шаг 2); превью в этом случае отдаёт `{available:false}`.

## Карта файлов

**API (apps/api):**

| Файл | Ответственность |
|---|---|
| `prisma/schema.prisma` | +Order, OrderOffer, MasterPresence, PaymentTransaction, Accrual, enums |
| `src/payments/payment.interface.ts`, `mock-payment.provider.ts`, `payments.module.ts` | DI-токен PAYMENT_PROVIDER, mock hold/capture/void |
| `src/routing/routing.interface.ts`, `postgis-routing.service.ts`, `routing.module.ts` | DI-токен ROUTING_SERVICE, dev-реализация |
| `src/pricing/pricing.config.ts`, `pricing.service.ts`, `pricing.service.spec.ts`, `pricing.module.ts` | тарифы (env-переопределение), формула, quote по ближайшему мастеру |
| `src/queue/queue.constants.ts`, `queue.service.ts`, `queue.module.ts` | pg-boss: register/send/cron, PGBOSS_DISABLED |
| `src/realtime/presence.service.ts`, `realtime.gateway.ts`, `realtime.module.ts` | presence, JWT-handshake, emitToUser |
| `src/orders/order.constants.ts`, `dto.ts`, `orders.service.ts`, `matching.service.ts`, `orders.controller.ts`, `orders.module.ts` | state machine, волны, HTTP API |
| `test/helpers.ts`, `test/setup-env.ts`, `test/*.e2e-spec.ts` | хелперы (активный мастер, гео-точки), e2e |

**Web (apps/web):**

| Файл | Ответственность |
|---|---|
| `src/socket.ts` | socket.io-клиент (singleton, JWT в auth) |
| `src/orderStatus.ts` | русские лейблы статусов, порядок степпера |
| `src/components/TabBar.tsx`, `src/Layout.tsx` | нижние табы (Работа — только ACTIVE-мастерам) |
| `src/pages/ProfilePage.tsx` | бывший HomePage (профиль) |
| `src/pages/HomePage.tsx` | кнопка «Вызвать мастера» / карточка активной заявки |
| `src/pages/NewOrderPage.tsx` | форма заявки + живое превью цены |
| `src/pages/OrderPage.tsx` | поиск / степпер / нет мастеров / терминал |
| `src/pages/MyOrdersPage.tsx` | история заявок |
| `src/pages/WorkPage.tsx` | мастер: тумблер онлайн, оффер, активная заявка |
| `src/App.tsx` | новые маршруты + Layout |

---

### Task 1: Зависимости, Prisma-схема, миграция PostGIS, тест-хелперы

**Files:**
- Modify: `apps/api/package.json` (зависимости)
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_stage2_urgent_orders/migration.sql` (через `--create-only` + правка)
- Modify: `apps/api/test/helpers.ts`
- Create: `apps/api/test/setup-env.ts`
- Modify: `apps/api/test/jest-e2e.json`

**Interfaces:**
- Consumes: модели этапа 1 (User, Category, MasterProfile, MasterCategory).
- Produces: модели `Order`, `OrderOffer`, `MasterPresence`, `PaymentTransaction`, `Accrual`; enums `OrderStatus`, `OfferOutcome`, `PaymentType`, `PaymentStatus`, `AccrualType`; хелперы `ALMATY`, `pointAtKm(km)`, `createActiveMaster(app, phone, categoryId, point?)`, `setMasterOnline(app, userId, point)`, `setMasterOffline(app, userId)`; `createTestApp({listen?: boolean})`.

- [ ] **Step 1: Установить зависимости**

```bash
pnpm --filter api add pg-boss @nestjs/websockets@^10 @nestjs/platform-socket.io@^10
pnpm --filter api add -D socket.io-client
pnpm --filter web add socket.io-client
```

- [ ] **Step 2: Дополнить `prisma/schema.prisma`**

К модели `User` добавить связи, добавить связь `orders Order[]` в `Category`, и новые блоки:

```prisma
model User {
  // ...существующие поля без изменений...
  clientOrders  Order[]        @relation("ClientOrders")
  masterOrders  Order[]        @relation("MasterOrders")
  offers        OrderOffer[]
  presence      MasterPresence?
  accruals      Accrual[]
}

model Category {
  // ...существующие поля...
  orders Order[]
}

enum OrderStatus {
  CREATED
  SEARCHING
  ACCEPTED
  MASTER_ON_WAY
  INSPECTION
  AWAITING_PRICE_CONFIRM
  IN_PROGRESS
  DONE
  CLOSED
  NO_MASTERS
  CANCELLED_BY_CLIENT
  CANCELLED_BY_MASTER
  DISPUTE
}

enum OfferOutcome {
  PENDING
  ACCEPTED
  LOST
  EXPIRED
}

enum PaymentType {
  HOLD
  CAPTURE
  VOID
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
}

enum AccrualType {
  CALLOUT_COMPENSATION
}

model Order {
  id              String      @id @default(uuid())
  clientId        String
  client          User        @relation("ClientOrders", fields: [clientId], references: [id])
  categoryId      String
  category        Category    @relation(fields: [categoryId], references: [id])
  description     String
  address         String
  location        Unsupported("geography(Point, 4326)")?
  status          OrderStatus @default(CREATED)
  masterId        String?
  master          User?       @relation("MasterOrders", fields: [masterId], references: [id])
  wave            Int         @default(0)
  searchAttempt   Int         @default(1)
  calloutPrice    Int
  serviceFee      Int
  workPrice       Int?
  workComment     String?
  cancelReason    String?
  acceptedAt      DateTime?
  onSiteAt        DateTime?
  priceProposedAt DateTime?
  completedAt     DateTime?
  closedAt        DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  offers          OrderOffer[]
  payments        PaymentTransaction[]
  accruals        Accrual[]

  @@index([clientId, status])
  @@index([masterId, status])
}

model OrderOffer {
  id           String       @id @default(uuid())
  orderId      String
  order        Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  masterUserId String
  master       User         @relation(fields: [masterUserId], references: [id])
  wave         Int
  attempt      Int
  sentAt       DateTime     @default(now())
  respondedAt  DateTime?
  outcome      OfferOutcome @default(PENDING)

  @@unique([orderId, masterUserId, attempt])
  @@index([masterUserId, outcome])
}

model MasterPresence {
  masterUserId String   @id
  user         User     @relation(fields: [masterUserId], references: [id])
  isOnline     Boolean  @default(false)
  lastSeenAt   DateTime @default(now())
  location     Unsupported("geography(Point, 4326)")?
}

model PaymentTransaction {
  id          String        @id @default(uuid())
  orderId     String
  order       Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  type        PaymentType
  amount      Int
  status      PaymentStatus
  providerRef String
  createdAt   DateTime      @default(now())

  @@index([orderId, type])
}

model Accrual {
  id           String      @id @default(uuid())
  masterUserId String
  master       User        @relation(fields: [masterUserId], references: [id])
  orderId      String      @unique
  order        Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  type         AccrualType
  amount       Int
  createdAt    DateTime    @default(now())
}
```

- [ ] **Step 3: Создать миграцию черновиком и дописать PostGIS**

```bash
cd apps/api && pnpm exec prisma migrate dev --create-only --name stage2_urgent_orders
```

В начало созданного `migration.sql` добавить:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

В конец добавить GIST-индексы:

```sql
CREATE INDEX "Order_location_idx" ON "Order" USING GIST ("location");
CREATE INDEX "MasterPresence_location_idx" ON "MasterPresence" USING GIST ("location");
```

- [ ] **Step 4: Применить миграцию к dev- и test-БД**

```bash
docker compose up -d db db_test
cd apps/api && pnpm exec prisma migrate dev
DATABASE_URL=postgresql://masterqala:masterqala@localhost:5433/masterqala_test pnpm exec prisma migrate deploy
```

Ожидаемо: обе команды `migrate` завершаются без ошибок, `prisma generate` прошёл.

- [ ] **Step 5: setup-env для e2e (pg-boss off)**

Создать `apps/api/test/setup-env.ts`:

```ts
process.env.PGBOSS_DISABLED = '1';
```

В `apps/api/test/jest-e2e.json` добавить ключ:

```json
"setupFiles": ["<rootDir>/setup-env.ts"]
```

- [ ] **Step 6: Расширить `test/helpers.ts`**

Обновить `resetDb` (полный новый список TRUNCATE) и добавить хелперы. `createTestApp` получает опцию `listen` (для WS-тестов):

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(opts: { listen?: boolean } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (opts.listen) {
    await app.listen(0);
  } else {
    await app.init();
  }
  return app;
}

export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual" CASCADE',
  );
}

// seedCategories и loginAs — без изменений.

export const ALMATY = { lat: 43.2389, lng: 76.8897 };

/** Точка в km километрах к северу от ALMATY (1° широты ≈ 110.6 км). */
export function pointAtKm(km: number) {
  return { lat: ALMATY.lat + km / 110.6, lng: ALMATY.lng };
}

export async function setMasterOnline(
  app: INestApplication,
  userId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const prisma = app.get(PrismaService);
  await prisma.masterPresence.upsert({
    where: { masterUserId: userId },
    create: { masterUserId: userId, isOnline: true },
    update: { isOnline: true, lastSeenAt: new Date() },
  });
  await prisma.$executeRaw`UPDATE "MasterPresence" SET location = ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography WHERE "masterUserId" = ${userId}`;
}

export async function setMasterOffline(app: INestApplication, userId: string) {
  const prisma = app.get(PrismaService);
  await prisma.masterPresence.updateMany({ where: { masterUserId: userId }, data: { isOnline: false } });
}

export async function createActiveMaster(
  app: INestApplication,
  phone: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
): Promise<{ token: string; userId: string }> {
  const { token, userId } = await loginAs(app, phone);
  const prisma = app.get(PrismaService);
  await prisma.masterProfile.create({
    data: {
      userId,
      fullName: `Мастер ${phone}`,
      iin: '850101300123',
      district: 'Алмалинский',
      experienceYears: 5,
      status: 'ACTIVE',
      categories: { create: [{ categoryId }] },
    },
  });
  await setMasterOnline(app, userId, point);
  return { token, userId };
}

export async function createOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ categoryId, description: 'Прорвало трубу', address: 'ул. Абая, 1', ...point })
    .expect(201);
  return res.body;
}
```

- [ ] **Step 7: Проверить, что этап 1 не сломан**

```bash
pnpm --filter api test && pnpm --filter api test:e2e
```

Ожидаемо: все тесты этапа 1 PASS (новых тестов ещё нет).

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/prisma apps/api/test pnpm-lock.yaml
git commit -m "feat(stage2): схема данных срочных заявок, PostGIS-миграция, тест-хелперы"
```

---

### Task 2: Платёжный модуль (PAYMENT_PROVIDER + MockPaymentProvider)

**Files:**
- Create: `apps/api/src/payments/payment.interface.ts`
- Create: `apps/api/src/payments/mock-payment.provider.ts`
- Create: `apps/api/src/payments/payments.module.ts`
- Modify: `apps/api/src/app.module.ts` (импорт PaymentsModule)
- Test: `apps/api/test/payments.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, модель `PaymentTransaction` (Task 1).
- Produces: токен `PAYMENT_PROVIDER`; интерфейс `PaymentProvider { hold(orderId: string, amount: number): Promise<PaymentTransaction>; capture(orderId: string): Promise<PaymentTransaction>; void(orderId: string): Promise<PaymentTransaction> }`. `capture`/`void` идемпотентны (повторный вызов возвращает существующую транзакцию); сумма capture/void берётся из последнего HOLD.

- [ ] **Step 1: Написать падающий тест**

`apps/api/test/payments.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, loginAs, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../src/payments/payment.interface';

describe('MockPaymentProvider (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let payments: PaymentProvider;
  let orderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    payments = app.get(PAYMENT_PROVIDER);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    const { userId } = await loginAs(app, '+77010000001');
    const order = await prisma.order.create({
      data: {
        clientId: userId, categoryId: plumbing.id, description: 'т', address: 'а',
        calloutPrice: 3000, serviceFee: 1200,
      },
    });
    orderId = order.id;
  });

  it('hold пишет SUCCEEDED-транзакцию HOLD', async () => {
    const tx = await payments.hold(orderId, 1200);
    expect(tx).toMatchObject({ orderId, type: 'HOLD', amount: 1200, status: 'SUCCEEDED' });
    expect(tx.providerRef).toMatch(/^mock-/);
  });

  it('capture берёт сумму холда и идемпотентен', async () => {
    await payments.hold(orderId, 1200);
    const c1 = await payments.capture(orderId);
    const c2 = await payments.capture(orderId);
    expect(c1.amount).toBe(1200);
    expect(c2.id).toBe(c1.id);
    expect(await prisma.paymentTransaction.count({ where: { orderId, type: 'CAPTURE' } })).toBe(1);
  });

  it('void идемпотентен', async () => {
    await payments.hold(orderId, 1200);
    const v1 = await payments.void(orderId);
    const v2 = await payments.void(orderId);
    expect(v1.type).toBe('VOID');
    expect(v2.id).toBe(v1.id);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter api test:e2e -- payments`
Expected: FAIL — `Cannot find module '../src/payments/payment.interface'`.

- [ ] **Step 3: Реализация**

`apps/api/src/payments/payment.interface.ts`:

```ts
import { PaymentTransaction } from '@prisma/client';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
}
```

`apps/api/src/payments/mock-payment.provider.ts`:

```ts
import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentTransaction, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from './payment.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly prisma: PrismaService) {}

  async hold(orderId: string, amount: number): Promise<PaymentTransaction> {
    return this.prisma.paymentTransaction.create({
      data: { orderId, type: 'HOLD', amount, status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` },
    });
  }

  async capture(orderId: string): Promise<PaymentTransaction> {
    return this.settle(orderId, 'CAPTURE');
  }

  async void(orderId: string): Promise<PaymentTransaction> {
    return this.settle(orderId, 'VOID');
  }

  private async settle(orderId: string, type: PaymentType): Promise<PaymentTransaction> {
    const existing = await this.prisma.paymentTransaction.findFirst({
      where: { orderId, type },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;
    const hold = await this.prisma.paymentTransaction.findFirst({
      where: { orderId, type: 'HOLD', status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!hold) throw new ConflictException('Нет холда по заявке');
    return this.prisma.paymentTransaction.create({
      data: { orderId, type, amount: hold.amount, status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` },
    });
  }
}
```

`apps/api/src/payments/payments.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';

@Module({
  providers: [{ provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
```

В `app.module.ts` добавить `PaymentsModule` в imports.

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- payments`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments apps/api/src/app.module.ts apps/api/test/payments.e2e-spec.ts
git commit -m "feat(stage2): mock-платёжный провайдер hold/capture/void за DI-токеном"
```

---

### Task 3: Роутинг (ROUTING_SERVICE) и прайсинг (PricingService)

**Files:**
- Create: `apps/api/src/routing/routing.interface.ts`
- Create: `apps/api/src/routing/postgis-routing.service.ts`
- Create: `apps/api/src/routing/routing.module.ts`
- Create: `apps/api/src/pricing/pricing.config.ts`
- Create: `apps/api/src/pricing/pricing.service.ts`
- Create: `apps/api/src/pricing/pricing.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/pricing/pricing.service.spec.ts` (юнит), `apps/api/test/pricing-quote.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; presence/профили мастеров (Task 1).
- Produces: `LatLng {lat: number; lng: number}`; токен `ROUTING_SERVICE`, интерфейс `RoutingService { distanceKm(from: LatLng, to: LatLng): Promise<number> }`; чистая функция `computeTimeCoefficient(now: Date): number`; `PricingConfig {baseFare, perKm, feeRate, feeMin}`; `PriceQuote {calloutPrice: number; serviceFee: number; distanceKm: number; coefficient: number}`; `PricingService.quote(categoryId: string, to: LatLng, now?: Date): Promise<PriceQuote | null>` (null — нет подходящего онлайн-мастера в 10 км; учитывает занятость мастера).

- [ ] **Step 1: Юнит-тест формулы (падающий)**

`apps/api/src/pricing/pricing.service.spec.ts`:

```ts
import { computeTimeCoefficient, calcPrices } from './pricing.service';

// Час Алматы (UTC+5) задаём через UTC: 12:00 Алматы = 07:00 UTC.
function almatyHour(hour: number): Date {
  return new Date(Date.UTC(2026, 6, 15, (hour - 5 + 24) % 24, 30));
}

describe('computeTimeCoefficient (Asia/Almaty)', () => {
  it.each([
    [8, 1.0], [12, 1.0], [19, 1.0],
    [20, 1.2], [22, 1.2],
    [23, 1.5], [2, 1.5], [7, 1.5],
  ])('час %i → коэф. %f', (hour, coef) => {
    expect(computeTimeCoefficient(almatyHour(hour))).toBe(coef);
  });
});

describe('calcPrices', () => {
  const cfg = { baseFare: 2000, perKm: 150, feeRate: 0.4, feeMin: 1000 };

  it('день, 4 км: (2000 + 4×150)×1.0 = 2600; сбор 40% = 1040', () => {
    expect(calcPrices(cfg, 4, 1.0)).toEqual({ calloutPrice: 2600, serviceFee: 1040 });
  });

  it('ночь, 2 км: (2000+300)×1.5 = 3450; сбор 1380', () => {
    expect(calcPrices(cfg, 2, 1.5)).toEqual({ calloutPrice: 3450, serviceFee: 1380 });
  });

  it('минимальный сбор 1000 ₸: 0.5 км днём → выезд 2075, 40% = 830 → сбор 1000', () => {
    expect(calcPrices(cfg, 0.5, 1.0)).toEqual({ calloutPrice: 2075, serviceFee: 1000 });
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test -- pricing`
Expected: FAIL — модуль `./pricing.service` не найден.

- [ ] **Step 3: Реализация routing + pricing**

`apps/api/src/routing/routing.interface.ts`:

```ts
export interface LatLng {
  lat: number;
  lng: number;
}

export const ROUTING_SERVICE = Symbol('ROUTING_SERVICE');

export interface RoutingService {
  /** Расстояние по дорогам, км. */
  distanceKm(from: LatLng, to: LatLng): Promise<number>;
}
```

`apps/api/src/routing/postgis-routing.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LatLng, RoutingService } from './routing.interface';

@Injectable()
export class PostgisRoutingService implements RoutingService {
  /** Приближение «по дорогам»: прямая × 1.3 (реальный 2ГИС/Google — позже). */
  static readonly ROAD_FACTOR = 1.3;

  constructor(private readonly prisma: PrismaService) {}

  async distanceKm(from: LatLng, to: LatLng): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ m: number }[]>`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(${from.lng}, ${from.lat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography
      ) AS m`;
    return (rows[0].m / 1000) * PostgisRoutingService.ROAD_FACTOR;
  }
}
```

`apps/api/src/routing/routing.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ROUTING_SERVICE } from './routing.interface';
import { PostgisRoutingService } from './postgis-routing.service';

@Module({
  providers: [{ provide: ROUTING_SERVICE, useClass: PostgisRoutingService }],
  exports: [ROUTING_SERVICE],
})
export class RoutingModule {}
```

`apps/api/src/pricing/pricing.config.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PricingConfig {
  readonly baseFare: number;
  readonly perKm: number;
  readonly feeRate: number;
  readonly feeMin: number;

  constructor(config: ConfigService) {
    this.baseFare = Number(config.get('PRICING_BASE_FARE') ?? 2000);
    this.perKm = Number(config.get('PRICING_PER_KM') ?? 150);
    this.feeRate = Number(config.get('SERVICE_FEE_RATE') ?? 0.4);
    this.feeMin = Number(config.get('SERVICE_FEE_MIN') ?? 1000);
  }
}
```

`apps/api/src/pricing/pricing.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LatLng, ROUTING_SERVICE, RoutingService } from '../routing/routing.interface';
import { PricingConfig } from './pricing.config';

export const MAX_SEARCH_RADIUS_M = 10000;

export interface PriceQuote {
  calloutPrice: number;
  serviceFee: number;
  distanceKm: number;
  coefficient: number;
}

export function computeTimeCoefficient(now: Date): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Almaty', hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  if (hour >= 8 && hour < 20) return 1.0;
  if (hour >= 20 && hour < 23) return 1.2;
  return 1.5;
}

export function calcPrices(
  cfg: Pick<PricingConfig, 'baseFare' | 'perKm' | 'feeRate' | 'feeMin'>,
  distanceKm: number,
  coefficient: number,
): { calloutPrice: number; serviceFee: number } {
  const calloutPrice = Math.round((cfg.baseFare + distanceKm * cfg.perKm) * coefficient);
  const serviceFee = Math.max(Math.round(calloutPrice * cfg.feeRate), cfg.feeMin);
  return { calloutPrice, serviceFee };
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: PricingConfig,
    @Inject(ROUTING_SERVICE) private readonly routing: RoutingService,
  ) {}

  async quote(categoryId: string, to: LatLng, now: Date = new Date()): Promise<PriceQuote | null> {
    const nearest = await this.findNearestFreeMaster(categoryId, to);
    if (!nearest) return null;
    const distanceKm = await this.routing.distanceKm(nearest, to);
    const coefficient = computeTimeCoefficient(now);
    return { ...calcPrices(this.cfg, distanceKm, coefficient), distanceKm, coefficient };
  }

  private async findNearestFreeMaster(categoryId: string, to: LatLng): Promise<LatLng | null> {
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(mp.location::geometry) AS lat, ST_X(mp.location::geometry) AS lng
      FROM "MasterPresence" mp
      JOIN "MasterProfile" pr ON pr."userId" = mp."masterUserId" AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${categoryId}
      WHERE mp."isOnline" = true AND mp.location IS NOT NULL
        AND ST_DWithin(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography, ${MAX_SEARCH_RADIUS_M})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = mp."masterUserId"
            AND ao.status IN ('ACCEPTED','MASTER_ON_WAY','INSPECTION','AWAITING_PRICE_CONFIRM','IN_PROGRESS')
        )
      ORDER BY ST_Distance(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography)
      LIMIT 1`;
    return rows[0] ?? null;
  }
}
```

`apps/api/src/pricing/pricing.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { RoutingModule } from '../routing/routing.module';
import { PricingConfig } from './pricing.config';
import { PricingService } from './pricing.service';

@Module({
  imports: [RoutingModule],
  providers: [PricingConfig, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
```

В `app.module.ts` добавить `RoutingModule, PricingModule` в imports.

- [ ] **Step 4: Юнит-тесты зелёные**

Run: `pnpm --filter api test -- pricing`
Expected: PASS (11 тестов).

- [ ] **Step 5: e2e quote (падающий → зелёный)**

`apps/api/test/pricing-quote.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, createActiveMaster, setMasterOffline, ALMATY, pointAtKm } from './helpers';
import { PricingService, calcPrices, computeTimeCoefficient } from '../src/pricing/pricing.service';

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
    const q = await pricing.quote(plumbingId, ALMATY);
    expect(q).not.toBeNull();
    expect(q!.distanceKm).toBeGreaterThan(2.4); // ~2 км × 1.3
    expect(q!.distanceKm).toBeLessThan(2.8);
    const expected = calcPrices({ baseFare: 2000, perKm: 150, feeRate: 0.4, feeMin: 1000 }, q!.distanceKm, computeTimeCoefficient(new Date()));
    expect(q!.calloutPrice).toBe(expected.calloutPrice);
    expect(q!.serviceFee).toBe(expected.serviceFee);
  });

  it('null, если мастера офлайн или дальше 10 км', async () => {
    const far = await createActiveMaster(app, '+77020000003', plumbingId, pointAtKm(12));
    expect(await pricing.quote(plumbingId, ALMATY)).toBeNull();
    const near = await createActiveMaster(app, '+77020000004', plumbingId, pointAtKm(1));
    await setMasterOffline(app, near.userId);
    expect(await pricing.quote(plumbingId, ALMATY)).toBeNull();
    void far;
  });
});
```

Run: `pnpm --filter api test:e2e -- pricing-quote`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routing apps/api/src/pricing apps/api/src/app.module.ts apps/api/test/pricing-quote.e2e-spec.ts
git commit -m "feat(stage2): роутинг-адаптер PostGIS и прайсинг с коэффициентом времени"
```

---

### Task 4: Очередь таймеров (pg-boss)

**Files:**
- Create: `apps/api/src/queue/queue.constants.ts`
- Create: `apps/api/src/queue/queue.service.ts`
- Create: `apps/api/src/queue/queue.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/queue.e2e-spec.ts`

**Interfaces:**
- Consumes: `ConfigService` (`DATABASE_URL`, `PGBOSS_DISABLED`).
- Produces: `JOBS = { WAVE: 'order-wave', WAVE_TIMEOUT: 'order-wave-timeout', PRICE_TIMEOUT: 'order-price-timeout', AUTO_CLOSE: 'order-auto-close', PRESENCE_SWEEP: 'presence-sweep' }`; `QueueService.register(name: string, handler: (data: any) => Promise<void>): void`, `registerCron(name, cron, handler)`, `send(name: string, data: object, afterSeconds?: number): Promise<void>`. Сервисы регистрируют хендлеры в своих `onModuleInit` (Nest вызывает их до `onApplicationBootstrap`, где стартует pg-boss). При `PGBOSS_DISABLED=1` `send` — no-op (e2e зовут хендлеры напрямую).

- [ ] **Step 1: Падающий тест**

`apps/api/test/queue.e2e-spec.ts` — доставка отложенной джобы против test-БД (pg-boss здесь включаем вручную, минуя setup-env):

```ts
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../src/queue/queue.service';

describe('QueueService (e2e, реальный pg-boss)', () => {
  const config = new ConfigService({
    DATABASE_URL: 'postgresql://masterqala:masterqala@localhost:5433/masterqala_test',
    PGBOSS_DISABLED: '0',
  });

  it('доставляет джобу зарегистрированному хендлеру', async () => {
    const queue = new QueueService(config);
    const got: any[] = [];
    queue.register('stage2-selftest', async (data) => {
      got.push(data);
    });
    await queue.onApplicationBootstrap();
    await queue.send('stage2-selftest', { ping: 1 });
    const deadline = Date.now() + 15000;
    while (got.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    await queue.onApplicationShutdown();
    expect(got).toEqual([{ ping: 1 }]);
  }, 30000);

  it('send — no-op при PGBOSS_DISABLED=1', async () => {
    const disabled = new QueueService(new ConfigService({ PGBOSS_DISABLED: '1' }));
    await disabled.onApplicationBootstrap();
    await expect(disabled.send('stage2-selftest', {})).resolves.toBeUndefined();
    await disabled.onApplicationShutdown();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- queue`
Expected: FAIL — модуль `../src/queue/queue.service` не найден.

- [ ] **Step 3: Реализация**

`apps/api/src/queue/queue.constants.ts`:

```ts
export const JOBS = {
  WAVE: 'order-wave',
  WAVE_TIMEOUT: 'order-wave-timeout',
  PRICE_TIMEOUT: 'order-price-timeout',
  AUTO_CLOSE: 'order-auto-close',
  PRESENCE_SWEEP: 'presence-sweep',
} as const;
```

`apps/api/src/queue/queue.service.ts`:

```ts
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss = require('pg-boss');

type JobHandler = (data: any) => Promise<void>;

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly crons: { name: string; cron: string }[] = [];
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get('PGBOSS_DISABLED') !== '1';
  }

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  registerCron(name: string, cron: string, handler: JobHandler): void {
    this.register(name, handler);
    this.crons.push({ name, cron });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) return;
    this.boss = new PgBoss(this.config.get<string>('DATABASE_URL')!);
    this.boss.on('error', (err) => this.logger.error(err));
    await this.boss.start();
    for (const [name, handler] of this.handlers) {
      await this.boss.createQueue(name).catch(() => undefined); // уже существует — ок
      await this.boss.work(name, async (jobs: PgBoss.Job[]) => {
        for (const job of jobs) await handler(job.data);
      });
    }
    for (const { name, cron } of this.crons) {
      await this.boss.schedule(name, cron);
    }
  }

  /** Поставить джобу; afterSeconds — задержка. No-op, если pg-boss отключён (e2e). */
  async send(name: string, data: object, afterSeconds = 0): Promise<void> {
    if (!this.boss) return;
    await this.boss.send(name, data, afterSeconds > 0 ? { startAfter: afterSeconds } : {});
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: false, wait: false });
    this.boss = null;
  }
}
```

`apps/api/src/queue/queue.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
```

В `app.module.ts` добавить `QueueModule` в imports.

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- queue`
Expected: PASS (2 теста; первый ждёт доставку до 15 с).

Примечание: если API pg-boss v10 отличается (сигнатура `work`/`createQueue`), сверить с `node_modules/pg-boss/types.d.ts` и поправить обёртку — тест выше является контрактом.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queue apps/api/src/app.module.ts apps/api/test/queue.e2e-spec.ts
git commit -m "feat(stage2): очередь отложенных джоб на pg-boss с отключением в тестах"
```

---

### Task 5: Realtime-модуль: presence мастеров + WS-gateway

**Files:**
- Create: `apps/api/src/realtime/presence.service.ts`
- Create: `apps/api/src/realtime/realtime.gateway.ts`
- Create: `apps/api/src/realtime/realtime.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/realtime-presence.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtService` (JwtModule глобальный из AuthModule), `PrismaService`, `QueueService` (Task 4).
- Produces: `PresenceService { setOnline(userId, lat, lng), setOffline(userId), updateGeo(userId, lat, lng), sweepOffline() }`; `RealtimeGateway.emitToUser(userId: string, event: string, payload: object): void`. WS-протокол: handshake `auth: { token }` (JWT, иначе disconnect); входящие `presence:online {lat,lng}`, `presence:offline`, `geo:update {lat,lng}`; исходящие (шлют задачи 6–11): `offer:new`, `offer:closed {orderId, reason}`, `order:status`.

- [ ] **Step 1: Падающий тест**

`apps/api/test/realtime-presence.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { createTestApp, resetDb, seedCategories, createActiveMaster, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PresenceService } from '../src/realtime/presence.service';

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

async function waitFor(check: () => Promise<boolean>, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('условие не наступило');
}

describe('Realtime presence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;

  beforeAll(async () => {
    app = await createTestApp({ listen: true });
    prisma = app.get(PrismaService);
    url = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('presence:online создаёт запись с гео, presence:offline гасит', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77030000001', plumbing.id);
    await prisma.masterPresence.deleteMany({});
    const socket = await connect(url, master.token);
    socket.emit('presence:online', { lat: ALMATY.lat, lng: ALMATY.lng });
    await waitFor(async () =>
      (await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } }))?.isOnline === true,
    );
    socket.emit('presence:offline');
    await waitFor(async () =>
      (await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } }))?.isOnline === false,
    );
    socket.disconnect();
  });

  it('без валидного JWT соединение отклоняется', async () => {
    await expect(connect(url, 'garbage')).rejects.toBeDefined();
  });

  it('sweepOffline гасит устаревшие (lastSeenAt > 2 мин)', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77030000002', plumbing.id);
    await prisma.masterPresence.update({
      where: { masterUserId: master.userId },
      data: { lastSeenAt: new Date(Date.now() - 3 * 60 * 1000) },
    });
    await app.get(PresenceService).sweepOffline();
    const row = await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } });
    expect(row!.isOnline).toBe(false);
  });
});
```

Примечание: `connect_error` при невалидном токене — gateway рвёт соединение в `handleConnection`; socket.io-client с `transports:['websocket']` получит `connect` и затем `disconnect`. Поэтому в реализации отклоняем через middleware `server.use` (см. Step 3) — тогда клиент получает именно `connect_error`.

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- realtime-presence`
Expected: FAIL — модуль `../src/realtime/presence.service` не найден.

- [ ] **Step 3: Реализация**

`apps/api/src/realtime/presence.service.ts`:

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';

export const PRESENCE_OFFLINE_MINUTES = 2;

@Injectable()
export class PresenceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.queue.registerCron(JOBS.PRESENCE_SWEEP, '* * * * *', () => this.sweepOffline());
  }

  async setOnline(userId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.masterPresence.upsert({
      where: { masterUserId: userId },
      create: { masterUserId: userId, isOnline: true },
      update: { isOnline: true, lastSeenAt: new Date() },
    });
    await this.setLocation(userId, lat, lng);
  }

  async updateGeo(userId: string, lat: number, lng: number): Promise<void> {
    await this.setLocation(userId, lat, lng);
  }

  async setOffline(userId: string): Promise<void> {
    await this.prisma.masterPresence.updateMany({
      where: { masterUserId: userId },
      data: { isOnline: false },
    });
  }

  async sweepOffline(): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "MasterPresence" SET "isOnline" = false
      WHERE "isOnline" = true AND "lastSeenAt" < now() - interval '${PRESENCE_OFFLINE_MINUTES} minutes'`;
  }

  private async setLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "MasterPresence"
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          "lastSeenAt" = now(), "isOnline" = true
      WHERE "masterUserId" = ${userId}`;
  }
}
```

Внимание: interval в raw SQL с параметром не интерполируется Prisma внутри строки — записать как `now() - interval '2 minutes'` литералом (константу использовать в комментарии/тестах), либо `now() - make_interval(mins => ${PRESENCE_OFFLINE_MINUTES})`. Использовать `make_interval`.

`apps/api/src/realtime/realtime.gateway.ts`:

```ts
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';

interface GeoPayload {
  lat: number;
  lng: number;
}

@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
  ) {}

  afterInit(server: Server): void {
    // Отклоняем невалидный JWT ещё в handshake — клиент получает connect_error.
    server.use(async (socket, next) => {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(socket.handshake.auth?.token ?? '');
        socket.data.userId = payload.sub;
        await socket.join(`user:${payload.sub}`);
        next();
      } catch {
        next(new Error('Требуется вход'));
      }
    });
    server.on('connection', (socket) => {
      socket.on('disconnect', () => {
        if (socket.data.userId) void this.presence.setOffline(socket.data.userId);
      });
    });
  }

  @SubscribeMessage('presence:online')
  async onOnline(@ConnectedSocket() socket: Socket, @MessageBody() body: GeoPayload): Promise<void> {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') return;
    await this.presence.setOnline(socket.data.userId, body.lat, body.lng);
  }

  @SubscribeMessage('presence:offline')
  async onOffline(@ConnectedSocket() socket: Socket): Promise<void> {
    await this.presence.setOffline(socket.data.userId);
  }

  @SubscribeMessage('geo:update')
  async onGeo(@ConnectedSocket() socket: Socket, @MessageBody() body: GeoPayload): Promise<void> {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') return;
    await this.presence.updateGeo(socket.data.userId, body.lat, body.lng);
  }

  emitToUser(userId: string, event: string, payload: object): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
```

`apps/api/src/realtime/realtime.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [PresenceService, RealtimeGateway],
  exports: [PresenceService, RealtimeGateway],
})
export class RealtimeModule {}
```

В `app.module.ts` добавить `RealtimeModule` в imports.

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- realtime-presence`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/realtime apps/api/src/app.module.ts apps/api/test/realtime-presence.e2e-spec.ts
git commit -m "feat(stage2): WS-gateway с JWT и presence мастеров с офлайн-свипом"
```

---

### Task 6: OrdersModule: превью, создание, чтение, лимит «одна активная»

**Files:**
- Create: `apps/api/src/orders/order.constants.ts`
- Create: `apps/api/src/orders/dto.ts`
- Create: `apps/api/src/orders/orders.service.ts` (создание/чтение; переходы добавят задачи 8–11)
- Create: `apps/api/src/orders/orders.controller.ts`
- Create: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/orders-create.e2e-spec.ts`

**Interfaces:**
- Consumes: `PricingService.quote` (Task 3), `PAYMENT_PROVIDER` (Task 2), `QueueService`/`JOBS` (Task 4), `RealtimeGateway` (Task 5).
- Produces:
  - `order.constants.ts`: `WAVE_RADII_M = [3000, 6000, 10000]`, `WAVE_TIMEOUTS_S = [60, 60, 90]`, `MAX_WAVE = 3`, `PRICE_CONFIRM_TIMEOUT_S = 15 * 60`, `AUTO_CLOSE_S = 24 * 3600`, `ACTIVE_MASTER_STATUSES: OrderStatus[]` (ACCEPTED, MASTER_ON_WAY, INSPECTION, AWAITING_PRICE_CONFIRM, IN_PROGRESS), `ACTIVE_CLIENT_STATUSES = [CREATED, SEARCHING, NO_MASTERS, ...ACTIVE_MASTER_STATUSES, DONE]`, `ORDER_INCLUDE` (category + master/client `{id,name,phone}`).
  - `OrdersService`: `preview(dto)` → `PriceQuote & {available:true} | {available:false}`; `create(clientId, dto)` → Order (409 при активной, 422 если нет мастеров); `getActive(clientId)` → `{order: Order|null}`; `listMine(clientId)`; `getById(user, id)` (владелец/назначенный мастер/OPERATOR, иначе 403); `getMasterActive(masterUserId)` → `{order: Order|null}`; `emitOrderStatus(order)` — WS `order:status {orderId, status, wave, master, workPrice, workComment, cancelReason, calloutPrice, priceProposedAt}` обеим сторонам; `accrueCompensation(tx, order)` — `Accrual(CALLOUT_COMPENSATION, calloutPrice − serviceFee)` через `createMany({skipDuplicates: true})`.
  - HTTP: `POST /orders/preview`, `POST /orders`, `GET /orders/active`, `GET /orders`, `GET /orders/:id`, `GET /master/active-order` (все под JwtAuthGuard).

- [ ] **Step 1: Падающий тест**

`apps/api/test/orders-create.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, ALMATY, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Создание срочной заявки (e2e)', () => {
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
    client = await loginAs(app, '+77040000001');
    await createActiveMaster(app, '+77040000002', plumbingId, pointAtKm(2));
  });

  it('превью возвращает цену, при отсутствии мастеров — available:false', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(ok.body.available).toBe(true);
    expect(ok.body.calloutPrice).toBeGreaterThanOrEqual(2000);
    expect(ok.body.serviceFee).toBeGreaterThanOrEqual(1000);

    await prisma.masterPresence.updateMany({ data: { isOnline: false } });
    const empty = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(empty.body).toEqual({ available: false });
  });

  it('создание: заявка в SEARCHING, есть HOLD на сбор, гео записано', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    expect(order.status).toBe('SEARCHING');
    expect(order.serviceFee).toBeGreaterThanOrEqual(1000);
    const hold = await prisma.paymentTransaction.findFirst({ where: { orderId: order.id, type: 'HOLD' } });
    expect(hold).toMatchObject({ amount: order.serviceFee, status: 'SUCCEEDED' });
    const [geo] = await prisma.$queryRaw<{ lat: number }[]>`
      SELECT ST_Y(location::geometry) AS lat FROM "Order" WHERE id = ${order.id}`;
    expect(geo.lat).toBeCloseTo(ALMATY.lat, 3);
  });

  it('вторая активная заявка — 409; после отмены создать можно', async () => {
    const first = await createOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, description: 'ещё', address: 'а', ...ALMATY })
      .expect(409);
    await prisma.order.update({ where: { id: first.id }, data: { status: 'CANCELLED_BY_CLIENT' } });
    await createOrderViaApi(app, client.token, plumbingId);
  });

  it('нет мастеров в 10 км → 422', async () => {
    await prisma.masterPresence.updateMany({ data: { isOnline: false } });
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, description: 'т', address: 'а', ...ALMATY })
      .expect(422);
  });

  it('GET /orders/active и GET /orders/:id с доступом', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    const active = await request(app.getHttpServer())
      .get('/api/v1/orders/active')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(active.body.order.id).toBe(order.id);

    const stranger = await loginAs(app, '+77040000003');
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- orders-create`
Expected: FAIL — 404 на `/api/v1/orders/*` (модуля нет).

- [ ] **Step 3: Реализация**

`apps/api/src/orders/order.constants.ts`:

```ts
import { OrderStatus, Prisma } from '@prisma/client';

export const WAVE_RADII_M = [3000, 6000, 10000];
export const WAVE_TIMEOUTS_S = [60, 60, 90];
export const MAX_WAVE = 3;
export const PRICE_CONFIRM_TIMEOUT_S = 15 * 60;
export const AUTO_CLOSE_S = 24 * 3600;

export const ACTIVE_MASTER_STATUSES: OrderStatus[] = [
  'ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION', 'AWAITING_PRICE_CONFIRM', 'IN_PROGRESS',
];

export const ACTIVE_CLIENT_STATUSES: OrderStatus[] = [
  'CREATED', 'SEARCHING', 'NO_MASTERS', ...ACTIVE_MASTER_STATUSES, 'DONE',
];

export const ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.OrderInclude;
```

`apps/api/src/orders/dto.ts`:

```ts
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PreviewOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @IsNumber() @Min(-180) @Max(180)
  lng!: number;
}

export class CreateOrderDto extends PreviewOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  description!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  address!: string;
}

export class ProposePriceDto {
  @IsInt() @Min(1)
  amount!: number;

  @IsOptional() @IsString() @MaxLength(1000)
  comment?: string;
}
```

`apps/api/src/orders/orders.service.ts` (первая версия — создание/чтение/общие помощники):

```ts
import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable,
  NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { Order, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ACTIVE_CLIENT_STATUSES, ACTIVE_MASTER_STATUSES, ORDER_INCLUDE } from './order.constants';
import { CreateOrderDto, PreviewOrderDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async preview(dto: PreviewOrderDto) {
    const quote = await this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng });
    return quote ? { available: true, ...quote } : { available: false };
  }

  async create(clientId: string, dto: CreateOrderDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const active = await this.prisma.order.count({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
    });
    if (active > 0) throw new ConflictException('У вас уже есть активная заявка');

    const quote = await this.pricing.quote(dto.categoryId, { lat: dto.lat, lng: dto.lng });
    if (!quote) throw new UnprocessableEntityException('Мастеров рядом нет');

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          calloutPrice: quote.calloutPrice,
          serviceFee: quote.serviceFee,
        },
      });
      await tx.$executeRaw`
        UPDATE "Order"
        SET location = ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        WHERE id = ${created.id}`;
      return created;
    });

    // Ошибка холда → заявка остаётся CREATED и не публикуется (§3.3).
    await this.payments.hold(order.id, order.serviceFee);
    await this.gate(order.id, 'CREATED', { status: 'SEARCHING' });
    await this.queue.send(JOBS.WAVE, { orderId: order.id, wave: 1 });
    return this.findOrThrow(order.id);
  }

  async getActive(clientId: string) {
    const order = await this.prisma.order.findFirst({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return { order };
  }

  async listMine(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async getMasterActive(masterUserId: string) {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, status: { in: ACTIVE_MASTER_STATUSES } },
      include: ORDER_INCLUDE,
    });
    return { order };
  }

  async getById(user: User, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== user.id && order.masterId !== user.id && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return order;
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    return order;
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    orderId: string,
    from: Prisma.Enumerable<Order['status']>,
    data: Prisma.OrderUpdateManyMutationInput,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: Array.isArray(from) ? { in: from } : from },
      data,
    });
    if (res.count === 0) throw new ConflictException('Заявка в другом статусе');
  }

  /** Начисление компенсации мастеру; идемпотентно за счёт unique(orderId). */
  async accrueCompensation(tx: Tx, order: Order): Promise<void> {
    if (!order.masterId) return;
    await tx.accrual.createMany({
      data: [{
        masterUserId: order.masterId,
        orderId: order.id,
        type: 'CALLOUT_COMPENSATION',
        amount: order.calloutPrice - order.serviceFee,
      }],
      skipDuplicates: true,
    });
  }

  /** WS `order:status` обеим сторонам заявки. */
  async emitOrderStatus(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) return;
    const payload = {
      orderId: order.id,
      status: order.status,
      wave: order.wave,
      master: order.master,
      workPrice: order.workPrice,
      workComment: order.workComment,
      cancelReason: order.cancelReason,
      calloutPrice: order.calloutPrice,
      priceProposedAt: order.priceProposedAt,
    };
    this.gateway.emitToUser(order.clientId, 'order:status', payload);
    if (order.masterId) this.gateway.emitToUser(order.masterId, 'order:status', payload);
  }
}
```

`apps/api/src/orders/orders.controller.ts` (первая версия):

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, PreviewOrderDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders/preview')
  preview(@Body() dto: PreviewOrderDto) {
    return this.orders.preview(dto);
  }

  @Post('orders')
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get('orders/active')
  getActive(@CurrentUser() user: User) {
    return this.orders.getActive(user.id);
  }

  @Get('orders')
  listMine(@CurrentUser() user: User) {
    return this.orders.listMine(user.id);
  }

  @Get('orders/:id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getById(user, id);
  }

  @Get('master/active-order')
  getMasterActive(@CurrentUser() user: User) {
    return this.orders.getMasterActive(user.id);
  }
}
```

`apps/api/src/orders/orders.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [PricingModule, PaymentsModule, RealtimeModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
```

В `app.module.ts` добавить `OrdersModule` в imports.

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- orders-create`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders apps/api/src/app.module.ts apps/api/test/orders-create.e2e-spec.ts
git commit -m "feat(stage2): создание срочной заявки с превью цены, холдом и лимитом одной активной"
```

---

### Task 7: MatchingService — волны и таймауты

**Files:**
- Create: `apps/api/src/orders/matching.service.ts`
- Modify: `apps/api/src/orders/orders.service.ts` (+`markNoMasters`)
- Modify: `apps/api/src/orders/orders.module.ts` (провайдер MatchingService)
- Test: `apps/api/test/matching-waves.e2e-spec.ts`

**Interfaces:**
- Consumes: `OrdersService.gate/markNoMasters/emitOrderStatus`, `QueueService`, `RealtimeGateway`, константы Task 6.
- Produces: `MatchingService.handleWave({orderId: string; wave: number}): Promise<void>` и `handleWaveTimeout({orderId: string; wave: number; attempt: number}): Promise<void>` (регистрируются на `JOBS.WAVE`/`JOBS.WAVE_TIMEOUT` в `onModuleInit`; e2e зовут их напрямую). `OrdersService.markNoMasters(orderId)`: гейт SEARCHING→NO_MASTERS + `payments.void` + EXPIRED всем PENDING-офферам + WS. WS-оффер мастеру: `offer:new {orderId, category, description, address, distanceKm, compensation, deadline, wave}`.

- [ ] **Step 1: Падающий тест**

`apps/api/test/matching-waves.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Матчинг волнами (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let electricsId: string;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const cats = await seedCategories(app);
    plumbingId = cats.plumbing.id;
    electricsId = cats.electrics.id;
    client = await loginAs(app, '+77050000001');
  });

  it('волна 1: офферы только мастерам в 3 км нужной категории', async () => {
    const near = await createActiveMaster(app, '+77050000002', plumbingId, pointAtKm(2));
    await createActiveMaster(app, '+77050000003', plumbingId, pointAtKm(5)); // дальше 3 км
    await createActiveMaster(app, '+77050000004', electricsId, pointAtKm(1)); // не та категория
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: near.userId, wave: 1, outcome: 'PENDING', attempt: 1 });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.wave).toBe(1);
  });

  it('пустая волна 1 → сразу волна 2 без таймаута', async () => {
    const mid = await createActiveMaster(app, '+77050000005', plumbingId, pointAtKm(5));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: mid.userId, wave: 2 });
  });

  it('таймаут волны: PENDING → EXPIRED, следующая волна получает новых', async () => {
    await createActiveMaster(app, '+77050000006', plumbingId, pointAtKm(2));
    const far = await createActiveMaster(app, '+77050000007', plumbingId, pointAtKm(5));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });
    await matching.handleWaveTimeout({ orderId: order.id, wave: 1, attempt: 1 });

    const expired = await prisma.orderOffer.findMany({ where: { orderId: order.id, outcome: 'EXPIRED' } });
    expect(expired).toHaveLength(1);
    const wave2 = await prisma.orderOffer.findMany({ where: { orderId: order.id, wave: 2 } });
    expect(wave2.map((o) => o.masterUserId)).toEqual([far.userId]);
  });

  it('все волны пусты → NO_MASTERS и VOID холда', async () => {
    const master = await createActiveMaster(app, '+77050000008', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await prisma.masterPresence.updateMany({ where: { masterUserId: master.userId }, data: { isOnline: false } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('NO_MASTERS');
    const voidTx = await prisma.paymentTransaction.findFirst({ where: { orderId: order.id, type: 'VOID' } });
    expect(voidTx).not.toBeNull();
  });

  it('идемпотентность: заявка не в SEARCHING → волна ничего не делает', async () => {
    await createActiveMaster(app, '+77050000009', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED_BY_CLIENT' } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    expect(await prisma.orderOffer.count({ where: { orderId: order.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- matching-waves`
Expected: FAIL — модуль `../src/orders/matching.service` не найден.

- [ ] **Step 3: Реализация**

В `orders.service.ts` добавить метод:

```ts
  /** SEARCHING → NO_MASTERS: void холда, гашение PENDING-офферов, WS. */
  async markNoMasters(orderId: string): Promise<void> {
    const pending = await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'SEARCHING', { status: 'NO_MASTERS' }, tx);
      const offers = await tx.orderOffer.findMany({ where: { orderId, outcome: 'PENDING' } });
      await tx.orderOffer.updateMany({
        where: { id: { in: offers.map((o) => o.id) } },
        data: { outcome: 'EXPIRED' },
      });
      return offers;
    });
    await this.payments.void(orderId); // после capture (отмена мастером) mock трактует как возврат
    for (const o of pending) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Поиск завершён' });
    }
    await this.emitOrderStatus(orderId);
  }
```

`apps/api/src/orders/matching.service.ts`:

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PostgisRoutingService } from '../routing/postgis-routing.service';
import { OrdersService } from './orders.service';
import { MAX_WAVE, WAVE_RADII_M, WAVE_TIMEOUTS_S } from './order.constants';

interface WaveJob {
  orderId: string;
  wave: number;
}

interface WaveTimeoutJob extends WaveJob {
  attempt: number;
}

interface Candidate {
  id: string;
  meters: number;
}

@Injectable()
export class MatchingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.WAVE, (d: WaveJob) => this.handleWave(d));
    this.queue.register(JOBS.WAVE_TIMEOUT, (d: WaveTimeoutJob) => this.handleWaveTimeout(d));
  }

  async handleWave({ orderId, wave }: WaveJob): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { category: true } });
    if (!order || order.status !== 'SEARCHING') return;

    const candidates = await this.findCandidates(orderId, order.categoryId, order.clientId, order.searchAttempt, WAVE_RADII_M[wave - 1]);
    if (candidates.length === 0) {
      if (wave < MAX_WAVE) return this.handleWave({ orderId, wave: wave + 1 });
      return this.orders.markNoMasters(orderId);
    }

    await this.prisma.$transaction([
      this.prisma.order.updateMany({ where: { id: orderId, status: 'SEARCHING' }, data: { wave } }),
      this.prisma.orderOffer.createMany({
        data: candidates.map((c) => ({ orderId, masterUserId: c.id, wave, attempt: order.searchAttempt })),
        skipDuplicates: true,
      }),
    ]);

    const timeoutS = WAVE_TIMEOUTS_S[wave - 1];
    const deadline = new Date(Date.now() + timeoutS * 1000).toISOString();
    const compensation = order.calloutPrice - order.serviceFee;
    for (const c of candidates) {
      this.gateway.emitToUser(c.id, 'offer:new', {
        orderId,
        category: order.category.name,
        description: order.description,
        address: order.address,
        distanceKm: Math.round((c.meters / 1000) * PostgisRoutingService.ROAD_FACTOR * 10) / 10,
        compensation,
        deadline,
        wave,
      });
    }
    await this.queue.send(JOBS.WAVE_TIMEOUT, { orderId, wave, attempt: order.searchAttempt }, timeoutS);
    await this.orders.emitOrderStatus(orderId); // клиенту — «расширяем радиус»
  }

  async handleWaveTimeout({ orderId, wave, attempt }: WaveTimeoutJob): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'SEARCHING' || order.searchAttempt !== attempt || order.wave !== wave) return;

    const expired = await this.prisma.orderOffer.findMany({
      where: { orderId, wave, attempt, outcome: 'PENDING' },
    });
    await this.prisma.orderOffer.updateMany({
      where: { id: { in: expired.map((o) => o.id) } },
      data: { outcome: 'EXPIRED' },
    });
    for (const o of expired) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Время на принятие истекло' });
    }
    if (wave < MAX_WAVE) return this.handleWave({ orderId, wave: wave + 1 });
    return this.orders.markNoMasters(orderId);
  }

  /** Кандидаты волны: ACTIVE-профиль, онлайн, в радиусе, категория, свободен, без оффера в этой попытке, не отменял эту заявку. */
  private async findCandidates(
    orderId: string,
    categoryId: string,
    clientId: string,
    attempt: number,
    radiusM: number,
  ): Promise<Candidate[]> {
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT u.id, ST_Distance(mp.location, o.location) AS meters
      FROM "MasterPresence" mp
      JOIN "User" u ON u.id = mp."masterUserId"
      JOIN "MasterProfile" pr ON pr."userId" = u.id AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${categoryId}
      JOIN "Order" o ON o.id = ${orderId}
      WHERE mp."isOnline" = true
        AND mp.location IS NOT NULL
        AND o.location IS NOT NULL
        AND u.id <> ${clientId}
        AND ST_DWithin(mp.location, o.location, ${radiusM})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = u.id
            AND ao.status IN ('ACCEPTED','MASTER_ON_WAY','INSPECTION','AWAITING_PRICE_CONFIRM','IN_PROGRESS')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "OrderOffer" oo
          WHERE oo."orderId" = ${orderId} AND oo."masterUserId" = u.id
            AND (oo.attempt = ${attempt} OR oo.outcome = 'ACCEPTED')
        )
      ORDER BY meters ASC`;
  }
}
```

В `orders.module.ts` добавить `MatchingService` в providers (и export — понадобится тестам через `app.get`).

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- matching-waves`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders apps/api/test/matching-waves.e2e-spec.ts
git commit -m "feat(stage2): матчинг волнами 3/6/10 км с таймаутами и NO_MASTERS"
```

---

### Task 8: Принятие заявки и разрешение гонки

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (+`accept`)
- Modify: `apps/api/src/orders/orders.controller.ts` (+`POST orders/:id/accept`)
- Test: `apps/api/test/orders-accept.e2e-spec.ts`

**Interfaces:**
- Consumes: гейт/офферы (задачи 6–7), `payments.capture` (идемпотентный).
- Produces: `OrdersService.accept(masterUserId: string, orderId: string): Promise<Order>` — в транзакции: проверка «мастер свободен» (409 «У вас уже есть активная заявка»), наличие PENDING-оффера текущей попытки (403 «Предложение недоступно»), гейт SEARCHING→ACCEPTED (409 «Заявку уже принял другой мастер»), свой оффер → ACCEPTED, остальные PENDING → LOST; после коммита capture + WS (`order:status` клиенту, `offer:closed` проигравшим).

- [ ] **Step 1: Падающий тест**

`apps/api/test/orders-accept.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

function accept(app: INestApplication, token: string, orderId: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/orders/${orderId}/accept`)
    .set('Authorization', `Bearer ${token}`);
}

describe('Принятие заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };
  let orderId: string;

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
    client = await loginAs(app, '+77060000001');
    m1 = await createActiveMaster(app, '+77060000002', plumbingId, pointAtKm(1));
    m2 = await createActiveMaster(app, '+77060000003', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
  });

  it('гонка: двое принимают одновременно → 1×200(201) и 1×409, офферы ACCEPTED/LOST, CAPTURE один', async () => {
    const [r1, r2] = await Promise.all([accept(app, m1.token, orderId), accept(app, m2.token, orderId)]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe('ACCEPTED');
    expect([m1.userId, m2.userId]).toContain(order!.masterId);

    const outcomes = (await prisma.orderOffer.findMany({ where: { orderId } })).map((o) => o.outcome).sort();
    expect(outcomes).toEqual(['ACCEPTED', 'LOST']);

    expect(await prisma.paymentTransaction.count({ where: { orderId, type: 'CAPTURE' } })).toBe(1);
  });

  it('мастер без оффера не может принять (403)', async () => {
    const stranger = await createActiveMaster(app, '+77060000004', plumbingId, pointAtKm(20));
    await accept(app, stranger.token, orderId).expect(403);
  });

  it('занятый мастер не может принять вторую (409)', async () => {
    await accept(app, m1.token, orderId).expect(201);
    const client2 = await loginAs(app, '+77060000005');
    const order2 = await createOrderViaApi(app, client2.token, plumbingId);
    await matching.handleWave({ orderId: order2.id, wave: 1 });
    await accept(app, m1.token, order2.id).expect(409);
  });
});
```

Примечание: во втором заказе оффер получит и m1 (пока свободен на момент волны... нет — m1 уже занят после accept, кандидаты его отфильтруют; оффер получит только m2). Тест зовёт accept от m1 — ожидаемо 409 занятости ИЛИ 403 отсутствия оффера: занятость проверяется первой, поэтому 409.

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- orders-accept`
Expected: FAIL — 404 на `/accept`.

- [ ] **Step 3: Реализация**

В `orders.service.ts` добавить:

```ts
  async accept(masterUserId: string, orderId: string) {
    const losers = await this.prisma.$transaction(async (tx) => {
      const busy = await tx.order.count({
        where: { masterId: masterUserId, status: { in: ACTIVE_MASTER_STATUSES } },
      });
      if (busy > 0) throw new ConflictException('У вас уже есть активная заявка');

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заявка не найдена');

      const offer = await tx.orderOffer.findFirst({
        where: { orderId, masterUserId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      if (!offer) throw new ForbiddenException('Предложение недоступно');

      const gate = await tx.order.updateMany({
        where: { id: orderId, status: 'SEARCHING' },
        data: { status: 'ACCEPTED', masterId: masterUserId, acceptedAt: new Date() },
      });
      if (gate.count === 0) throw new ConflictException('Заявку уже принял другой мастер');

      await tx.orderOffer.update({
        where: { id: offer.id },
        data: { outcome: 'ACCEPTED', respondedAt: new Date() },
      });
      const rest = await tx.orderOffer.findMany({
        where: { orderId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      await tx.orderOffer.updateMany({
        where: { id: { in: rest.map((o) => o.id) } },
        data: { outcome: 'LOST', respondedAt: new Date() },
      });
      return rest;
    });

    await this.payments.capture(orderId); // идемпотентен: при повторном поиске capture уже есть
    for (const o of losers) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Заявку принял другой мастер' });
    }
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }
```

В `orders.controller.ts` добавить:

```ts
  @Post('orders/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.accept(user.id, id);
  }
```

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- orders-accept`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders apps/api/test/orders-accept.e2e-spec.ts
git commit -m "feat(stage2): атомарное принятие заявки с разрешением гонки и capture сбора"
```

---

### Task 9: Переходы «еду / на месте / цена» и таймаут цены

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (+onWay, onSite, proposePrice, confirmPrice, rejectPrice, handlePriceTimeout, guardMaster/guardClient, onModuleInit-регистрация)
- Modify: `apps/api/src/orders/orders.controller.ts`
- Test: `apps/api/test/orders-price-flow.e2e-spec.ts`

**Interfaces:**
- Consumes: гейт, `accrueCompensation`, `QueueService`/`JOBS.PRICE_TIMEOUT`.
- Produces: `onWay(masterUserId, orderId)` ACCEPTED→MASTER_ON_WAY; `onSite(...)` MASTER_ON_WAY→INSPECTION (+onSiteAt); `proposePrice(masterUserId, orderId, dto: ProposePriceDto)` INSPECTION→AWAITING_PRICE_CONFIRM (+workPrice, workComment, priceProposedAt) + джоба PRICE_TIMEOUT через 900 с; `confirmPrice(clientId, orderId)` AWAITING→IN_PROGRESS; `rejectPrice(clientId, orderId)` AWAITING→CANCELLED_BY_CLIENT (reason «Клиент отклонил цену работ») + начисление; `handlePriceTimeout({orderId})` AWAITING→CANCELLED_BY_CLIENT (reason «Таймаут подтверждения цены (15 минут)») + начисление. Роут-методы проверяют принадлежность: действия мастера — только назначенный мастер (403 «Нет доступа к заявке»), клиента — только владелец. `OrdersService` реализует `OnModuleInit` и регистрирует `JOBS.PRICE_TIMEOUT` и `JOBS.AUTO_CLOSE` (хендлер auto-close добавит Task 10; здесь — заглушка-метод, см. Step 3).

- [ ] **Step 1: Падающий тест**

`apps/api/test/orders-price-flow.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Цепочка до цены и таймаут цены (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    client = await loginAs(app, '+77070000001');
    master = await createActiveMaster(app, '+77070000002', plumbing.id, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    orderId = order.id;
    await app.get(MatchingService).handleWave({ orderId, wave: 1 });
    await post(master.token, 'accept').expect(201);
  });

  it('еду → на месте → цена → подтверждение → В_РАБОТЕ', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000, comment: 'Замена смесителя' }).expect(201);
    let o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o).toMatchObject({ status: 'AWAITING_PRICE_CONFIRM', workPrice: 15000, workComment: 'Замена смесителя' });
    expect(o!.priceProposedAt).not.toBeNull();

    await post(client.token, 'confirm-price').expect(201);
    o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('IN_PROGRESS');
  });

  it('пропуск шага — 409, чужой пользователь — 403', async () => {
    await post(master.token, 'on-site').expect(409); // ACCEPTED, а не MASTER_ON_WAY
    await post(client.token, 'on-way').expect(403); // клиент не мастер заявки
    await post(master.token, 'confirm-price').expect(403); // мастер не клиент
  });

  it('отклонение цены → ОТМЕНЕНА_КЛИЕНТОМ + начисление компенсации', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 20000 }).expect(201);
    await post(client.token, 'reject-price').expect(201);
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    const accrual = await prisma.accrual.findUnique({ where: { orderId } });
    expect(accrual).toMatchObject({ masterUserId: master.userId, amount: o!.calloutPrice - o!.serviceFee });
  });

  it('таймаут цены (хендлер) → авто-отмена + начисление; идемпотентен', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 20000 }).expect(201);
    await orders.handlePriceTimeout({ orderId });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(o!.cancelReason).toContain('Таймаут');
    await orders.handlePriceTimeout({ orderId }); // не в AWAITING — тихо выходит
    expect(await prisma.accrual.count({ where: { orderId } })).toBe(1);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- orders-price-flow`
Expected: FAIL — 404 на `/on-way`.

- [ ] **Step 3: Реализация**

В `orders.service.ts` (класс получает `implements OnModuleInit`; импорты `OnModuleInit`, `PRICE_CONFIRM_TIMEOUT_S`):

```ts
  onModuleInit(): void {
    this.queue.register(JOBS.PRICE_TIMEOUT, (d: { orderId: string }) => this.handlePriceTimeout(d));
    this.queue.register(JOBS.AUTO_CLOSE, (d: { orderId: string }) => this.handleAutoClose(d));
  }

  /** Заявка принадлежит мастеру? Иначе 403. */
  private async guardMaster(masterUserId: string, orderId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  private async guardClient(clientId: string, orderId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  async onWay(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'ACCEPTED', { status: 'MASTER_ON_WAY' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async onSite(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'MASTER_ON_WAY', { status: 'INSPECTION', onSiteAt: new Date() });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async proposePrice(masterUserId: string, orderId: string, dto: ProposePriceDto) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'INSPECTION', {
      status: 'AWAITING_PRICE_CONFIRM',
      workPrice: dto.amount,
      workComment: dto.comment ?? null,
      priceProposedAt: new Date(),
    });
    await this.queue.send(JOBS.PRICE_TIMEOUT, { orderId }, PRICE_CONFIRM_TIMEOUT_S);
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async confirmPrice(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.gate(orderId, 'AWAITING_PRICE_CONFIRM', { status: 'IN_PROGRESS' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async rejectPrice(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.cancelPaidFromAwaiting(orderId, 'Клиент отклонил цену работ');
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 15 минут. Не в AWAITING — тихий выход (идемпотентность). */
  async handlePriceTimeout({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'AWAITING_PRICE_CONFIRM') return;
    await this.cancelPaidFromAwaiting(orderId, 'Таймаут подтверждения цены (15 минут)');
  }

  /** AWAITING_PRICE_CONFIRM → CANCELLED_BY_CLIENT с удержанием сбора и компенсацией мастеру (§3.9). */
  private async cancelPaidFromAwaiting(orderId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'AWAITING_PRICE_CONFIRM', { status: 'CANCELLED_BY_CLIENT', cancelReason: reason }, tx);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.accrueCompensation(tx, order);
    });
    await this.emitOrderStatus(orderId);
  }

  /** Заглушка до Task 10. */
  async handleAutoClose(_d: { orderId: string }): Promise<void> {}
```

В `orders.controller.ts` добавить:

```ts
  @Post('orders/:id/on-way')
  onWay(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.onWay(user.id, id);
  }

  @Post('orders/:id/on-site')
  onSite(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.onSite(user.id, id);
  }

  @Post('orders/:id/propose-price')
  proposePrice(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ProposePriceDto) {
    return this.orders.proposePrice(user.id, id, dto);
  }

  @Post('orders/:id/confirm-price')
  confirmPrice(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.confirmPrice(user.id, id);
  }

  @Post('orders/:id/reject-price')
  rejectPrice(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.rejectPrice(user.id, id);
  }
```

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- orders-price-flow`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders apps/api/test/orders-price-flow.e2e-spec.ts
git commit -m "feat(stage2): переходы еду/на месте/цена, подтверждение и таймаут цены"
```

---

### Task 10: Завершение: выполнено, подтверждение, авто-закрытие 24 ч, начисление

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (+complete, confirmCompletion, реальный handleAutoClose)
- Modify: `apps/api/src/orders/orders.controller.ts`
- Test: `apps/api/test/orders-complete.e2e-spec.ts`

**Interfaces:**
- Consumes: гейт, `accrueCompensation`, `JOBS.AUTO_CLOSE` (регистрация уже есть из Task 9).
- Produces: `complete(masterUserId, orderId)` IN_PROGRESS→DONE (+completedAt) + джоба AUTO_CLOSE через 86400 с; `confirmCompletion(clientId, orderId)` DONE→CLOSED (+closedAt) + начисление; `handleAutoClose({orderId})` — то же по джобе (не в DONE — тихий выход).

- [ ] **Step 1: Падающий тест**

`apps/api/test/orders-complete.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Завершение заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    client = await loginAs(app, '+77080000001');
    master = await createActiveMaster(app, '+77080000002', plumbing.id, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    orderId = order.id;
    await app.get(MatchingService).handleWave({ orderId, wave: 1 });
    await post(master.token, 'accept').expect(201);
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000 }).expect(201);
    await post(client.token, 'confirm-price').expect(201);
  });

  it('happy path: выполнено → подтверждение клиентом → ЗАКРЫТА, начисление = выезд − сбор', async () => {
    await post(master.token, 'complete').expect(201);
    let o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('DONE');
    expect(o!.completedAt).not.toBeNull();

    await post(client.token, 'confirm-completion').expect(201);
    o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CLOSED');
    expect(o!.closedAt).not.toBeNull();

    const accrual = await prisma.accrual.findUnique({ where: { orderId } });
    expect(accrual).toMatchObject({
      masterUserId: master.userId,
      type: 'CALLOUT_COMPENSATION',
      amount: o!.calloutPrice - o!.serviceFee,
    });
    // Полная история платежей: HOLD + CAPTURE, без VOID.
    const types = (await prisma.paymentTransaction.findMany({ where: { orderId } })).map((t) => t.type).sort();
    expect(types).toEqual(['CAPTURE', 'HOLD']);
  });

  it('авто-закрытие по джобе 24ч: DONE → CLOSED + начисление, идемпотентно', async () => {
    await post(master.token, 'complete').expect(201);
    await orders.handleAutoClose({ orderId });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CLOSED');
    await orders.handleAutoClose({ orderId }); // повтор — тихий выход
    expect(await prisma.accrual.count({ where: { orderId } })).toBe(1);
  });

  it('подтвердить может только клиент, завершить — только мастер', async () => {
    await post(client.token, 'complete').expect(403);
    await post(master.token, 'complete').expect(201);
    await post(master.token, 'confirm-completion').expect(403);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- orders-complete`
Expected: FAIL — 404 на `/complete`.

- [ ] **Step 3: Реализация**

В `orders.service.ts` (импорт `AUTO_CLOSE_S`; заменить заглушку `handleAutoClose`):

```ts
  async complete(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'IN_PROGRESS', { status: 'DONE', completedAt: new Date() });
    await this.queue.send(JOBS.AUTO_CLOSE, { orderId }, AUTO_CLOSE_S);
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async confirmCompletion(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.closeOrder(orderId);
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 24 ч после «Выполнено». */
  async handleAutoClose({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'DONE') return;
    await this.closeOrder(orderId);
  }

  /** DONE → CLOSED + компенсация мастеру (§3.8). */
  private async closeOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'DONE', { status: 'CLOSED', closedAt: new Date() }, tx);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.accrueCompensation(tx, order);
    });
    await this.emitOrderStatus(orderId);
  }
```

В `orders.controller.ts` добавить:

```ts
  @Post('orders/:id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.complete(user.id, id);
  }

  @Post('orders/:id/confirm-completion')
  confirmCompletion(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.confirmCompletion(user.id, id);
  }
```

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- orders-complete`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders apps/api/test/orders-complete.e2e-spec.ts
git commit -m "feat(stage2): завершение заявки с авто-закрытием 24ч и компенсацией мастеру"
```

---

### Task 11: Отмены (§3.9) и повторный поиск

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (+cancel, retrySearch)
- Modify: `apps/api/src/orders/orders.controller.ts`
- Test: `apps/api/test/orders-cancel.e2e-spec.ts`

**Interfaces:**
- Consumes: гейт, `payments.void/hold`, `accrueCompensation`, `JOBS.WAVE`.
- Produces:
  - `cancel(user: User, orderId)` — ветвление по инициатору:
    - клиент, статус CREATED/SEARCHING/NO_MASTERS → CANCELLED_BY_CLIENT (reason «Отменена клиентом»), PENDING-офферы → EXPIRED + `offer:closed`, void холда (кроме NO_MASTERS — там уже VOID);
    - клиент, статус ACCEPTED/MASTER_ON_WAY → CANCELLED_BY_CLIENT (reason «Отменена клиентом после принятия»), сбор удержан (capture уже был), начисление мастеру;
    - клиент, AWAITING_PRICE_CONFIRM → делегирует `rejectPrice`-логике (`cancelPaidFromAwaiting`, reason «Отменена клиентом после принятия»);
    - клиент, INSPECTION/IN_PROGRESS/терминальные → 409 «На этом этапе отмена недоступна»;
    - мастер, ACCEPTED/MASTER_ON_WAY → возврат в SEARCHING (masterId=null, wave=0, searchAttempt+1, acceptedAt=null), WS клиенту, джоба WAVE(1); отменивший исключён из будущих волн (offer.outcome=ACCEPTED);
    - мастер в иных статусах → 409; посторонний → 403.
  - `retrySearch(clientId, orderId)` — NO_MASTERS→SEARCHING: новый hold, searchAttempt+1, wave=0, джоба WAVE(1).
  - HTTP: `POST /orders/:id/cancel`, `POST /orders/:id/retry-search`.

- [ ] **Step 1: Падающий тест**

`apps/api/test/orders-cancel.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm, setMasterOffline } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Отмены по §3.9 и повторный поиск (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };

  const post = (token: string, orderId: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send({});

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
    client = await loginAs(app, '+77090000001');
    m1 = await createActiveMaster(app, '+77090000002', plumbingId, pointAtKm(1));
    m2 = await createActiveMaster(app, '+77090000003', plumbingId, pointAtKm(2));
  });

  it('клиент отменяет до принятия: бесплатно, VOID, офферы EXPIRED', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(client.token, order.id, 'cancel').expect(201);

    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'VOID' } })).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(0);
    expect(await prisma.orderOffer.count({ where: { orderId: order.id, outcome: 'PENDING' } })).toBe(0);
    expect(await prisma.accrual.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('клиент отменяет после принятия: сбор удержан, компенсация мастеру', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(client.token, order.id, 'cancel').expect(201);

    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'VOID' } })).toBe(0);
    const accrual = await prisma.accrual.findUnique({ where: { orderId: order.id } });
    expect(accrual!.amount).toBe(o!.calloutPrice - o!.serviceFee);
  });

  it('клиент не может отменить в IN_PROGRESS (409)', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(m1.token, order.id, 'on-way').expect(201);
    await post(m1.token, order.id, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/propose-price`)
      .set('Authorization', `Bearer ${m1.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, order.id, 'confirm-price').expect(201);
    await post(client.token, order.id, 'cancel').expect(409);
  });

  it('мастер отменяет после принятия: заявка снова в поиске, отменивший исключён', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(m1.token, order.id, 'cancel').expect(201);

    let o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o).toMatchObject({ status: 'SEARCHING', masterId: null, searchAttempt: 2, wave: 0 });

    await matching.handleWave({ orderId: order.id, wave: 1 });
    const offers2 = await prisma.orderOffer.findMany({ where: { orderId: order.id, attempt: 2 } });
    expect(offers2.map((x) => x.masterUserId)).toEqual([m2.userId]); // m1 исключён

    await post(m2.token, order.id, 'accept').expect(201);
    o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.masterId).toBe(m2.userId);
    // capture был при первом принятии и не дублируется
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(1);
  });

  it('повторный поиск из NO_MASTERS: новый hold и новая попытка', async () => {
    await setMasterOffline(app, m1.userId);
    await setMasterOffline(app, m2.userId);
    // мастеров нет для волн, но для создания нужен хотя бы один онлайн — включим и выключим
    const m3 = await createActiveMaster(app, '+77090000004', plumbingId, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await setMasterOffline(app, m3.userId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe('NO_MASTERS');

    await post(client.token, order.id, 'retry-search').expect(201);
    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o).toMatchObject({ status: 'SEARCHING', searchAttempt: 2 });
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'HOLD' } })).toBe(2);
  });

  it('посторонний не может отменить (403)', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    const stranger = await loginAs(app, '+77090000005');
    await post(stranger.token, order.id, 'cancel').expect(403);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm --filter api test:e2e -- orders-cancel`
Expected: FAIL — 404 на `/cancel`.

- [ ] **Step 3: Реализация**

В `orders.service.ts` добавить:

```ts
  async cancel(user: User, orderId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.clientId === user.id) {
      await this.cancelByClient(order);
    } else if (order.masterId === user.id) {
      await this.cancelByMaster(order);
    } else {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return this.findOrThrow(orderId);
  }

  private async cancelByClient(order: Order & { id: string }): Promise<void> {
    const free: Order['status'][] = ['CREATED', 'SEARCHING', 'NO_MASTERS'];
    const paid: Order['status'][] = ['ACCEPTED', 'MASTER_ON_WAY'];

    if (free.includes(order.status)) {
      const pending = await this.prisma.$transaction(async (tx) => {
        await this.gate(order.id, free, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом' }, tx);
        const offers = await tx.orderOffer.findMany({ where: { orderId: order.id, outcome: 'PENDING' } });
        await tx.orderOffer.updateMany({
          where: { id: { in: offers.map((o) => o.id) } },
          data: { outcome: 'EXPIRED' },
        });
        return offers;
      });
      if (order.status !== 'NO_MASTERS') await this.payments.void(order.id); // в NO_MASTERS уже VOID
      for (const o of pending) {
        this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId: order.id, reason: 'Клиент отменил заявку' });
      }
      await this.emitOrderStatus(order.id);
      return;
    }

    if (paid.includes(order.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.gate(order.id, paid, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом после принятия' }, tx);
        const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        await this.accrueCompensation(tx, fresh);
      });
      await this.emitOrderStatus(order.id);
      return;
    }

    if (order.status === 'AWAITING_PRICE_CONFIRM') {
      await this.cancelPaidFromAwaiting(order.id, 'Отменена клиентом после принятия');
      return;
    }

    throw new ConflictException('На этом этапе отмена недоступна');
  }

  private async cancelByMaster(order: Order & { id: string }): Promise<void> {
    // §3.9 + дизайн-дока §4: перезапуск поиска с волны 1, отменивший исключён
    // (его OrderOffer.outcome === 'ACCEPTED'); санкции мастеру — этап 5.
    await this.gate(order.id, ['ACCEPTED', 'MASTER_ON_WAY'], {
      status: 'SEARCHING',
      masterId: null,
      acceptedAt: null,
      wave: 0,
      searchAttempt: { increment: 1 } as never,
    });
    await this.queue.send(JOBS.WAVE, { orderId: order.id, wave: 1 });
    await this.emitOrderStatus(order.id);
  }

  async retrySearch(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.payments.hold(orderId, (await this.findOrThrow(orderId)).serviceFee);
    await this.gate(orderId, 'NO_MASTERS', {
      status: 'SEARCHING',
      wave: 0,
      searchAttempt: { increment: 1 } as never,
    });
    await this.queue.send(JOBS.WAVE, { orderId, wave: 1 });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }
```

Замечания реализации:
- `updateMany` с `{ increment: 1 }` типизируется через `Prisma.OrderUpdateManyMutationInput` — если `gate` объявлен уже с этим типом, каст `as never` не нужен; убрать его и типизировать `gate(…, data: Prisma.OrderUpdateManyMutationInput)` (как в Task 6).
- `retrySearch`: hold ставится до гейта; если гейт бросил 409 (статус уже не NO_MASTERS), лишний HOLD останется висеть в mock-журнале — приемлемо для этапа 2 (реальный провайдер этапа 4 получит компенсирующий void). Отметить комментарием в коде.
- Повторный capture при повторном принятии не создаётся — `MockPaymentProvider.capture` идемпотентен (Task 2).

В `orders.controller.ts` добавить:

```ts
  @Post('orders/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.cancel(user, id);
  }

  @Post('orders/:id/retry-search')
  retrySearch(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.retrySearch(user.id, id);
  }
```

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter api test:e2e -- orders-cancel`
Expected: PASS (6 тестов).

- [ ] **Step 5: Полный прогон API**

Run: `pnpm --filter api test && pnpm --filter api test:e2e`
Expected: все юнит- и e2e-тесты PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/orders apps/api/test/orders-cancel.e2e-spec.ts
git commit -m "feat(stage2): отмены обеих сторон по §3.9 и повторный поиск с новой попыткой"
```

---

### Task 12: WS-события сквозняком (offer:new / order:status) — e2e

**Files:**
- Test: `apps/api/test/realtime-orders.e2e-spec.ts`

**Interfaces:**
- Consumes: всё из задач 5–11. Задача чисто верификационная: доказывает, что события доходят живым сокетам (спека §11: «WS — socket.io-client: получение оффера, order:status»).

- [ ] **Step 1: Написать тест**

`apps/api/test/realtime-orders.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { MatchingService } from '../src/orders/matching.service';

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function once<T>(socket: Socket, event: string, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`нет события ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Realtime события заявки (e2e)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await createTestApp({ listen: true });
    url = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('мастер получает offer:new, клиент — order:status при принятии', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77100000001');
    const master = await createActiveMaster(app, '+77100000002', plumbing.id, pointAtKm(1));

    const masterSocket = await connect(url, master.token);
    const clientSocket = await connect(url, client.token);

    const order = await createOrderViaApi(app, client.token, plumbing.id);
    const offerPromise = once<any>(masterSocket, 'offer:new');
    await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
    const offer = await offerPromise;
    expect(offer).toMatchObject({ orderId: order.id, category: 'Сантехника', wave: 1 });
    expect(offer.compensation).toBe(order.calloutPrice - order.serviceFee);
    expect(offer.deadline).toBeDefined();

    const statusPromise = once<any>(clientSocket, 'order:status');
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    const status = await statusPromise;
    expect(status).toMatchObject({ orderId: order.id, status: 'ACCEPTED' });
    expect(status.master.id).toBe(master.userId);

    masterSocket.disconnect();
    clientSocket.disconnect();
  });
});
```

- [ ] **Step 2: Запустить**

Run: `pnpm --filter api test:e2e -- realtime-orders`
Expected: PASS сразу, если задачи 5–11 сделаны верно; иначе тест указывает на разрыв (например, emitOrderStatus не вызван после accept) — починить и перезапустить.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/realtime-orders.e2e-spec.ts
git commit -m "test(stage2): сквозная проверка WS-событий оффера и статуса"
```

---

### Task 13: Web-каркас: socket-клиент, лейблы статусов, таб-навигация, Профиль

**Files:**
- Create: `apps/web/src/socket.ts`
- Create: `apps/web/src/orderStatus.ts`
- Create: `apps/web/src/components/TabBar.tsx`
- Create: `apps/web/src/Layout.tsx`
- Create: `apps/web/src/pages/ProfilePage.tsx` (перенос содержимого нынешнего HomePage)
- Modify: `apps/web/src/pages/HomePage.tsx` (временная заглушка — полноценная в Task 14)
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/auth.tsx` (сброс сокета при logout)

**Interfaces:**
- Consumes: `api()` (`src/api.ts`), `useAuth`, `GET /masters/application` (этап 1), socket.io-client.
- Produces: `getSocket(): Socket` (JWT из localStorage в `auth`), `resetSocket()`; `STATUS_LABELS: Record<string, string>`, `STEPPER_STEPS: {status: string; label: string}[]`, `isTerminalStatus(s: string): boolean`; `useMasterStatus(): 'ACTIVE' | 'NONE' | 'PENDING'` (хук в TabBar); маршруты `/`, `/orders`, `/order/new`, `/order/:id`, `/work`, `/profile` внутри `Layout`.

- [ ] **Step 1: socket и лейблы**

`apps/web/src/socket.ts`:

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1$/, '');
    socket = io(base, { auth: { token: localStorage.getItem('token') } });
  }
  return socket;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

`apps/web/src/orderStatus.ts`:

```ts
export const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создана',
  SEARCHING: 'Поиск мастера',
  ACCEPTED: 'Принята',
  MASTER_ON_WAY: 'Мастер в пути',
  INSPECTION: 'Осмотр',
  AWAITING_PRICE_CONFIRM: 'Согласование цены',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CLOSED: 'Закрыта',
  NO_MASTERS: 'Мастера не найдены',
  CANCELLED_BY_CLIENT: 'Отменена клиентом',
  CANCELLED_BY_MASTER: 'Отменена мастером',
  DISPUTE: 'Спор',
};

export const STEPPER_STEPS = [
  { status: 'ACCEPTED', label: 'Принята' },
  { status: 'MASTER_ON_WAY', label: 'Мастер в пути' },
  { status: 'INSPECTION', label: 'Осмотр' },
  { status: 'AWAITING_PRICE_CONFIRM', label: 'Согласование цены' },
  { status: 'IN_PROGRESS', label: 'В работе' },
  { status: 'DONE', label: 'Выполнена' },
  { status: 'CLOSED', label: 'Закрыта' },
];

export function isTerminalStatus(s: string): boolean {
  return ['CLOSED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}

export const WAVE_TEXTS: Record<number, string> = {
  0: 'Начинаем поиск…',
  1: 'Ищем мастера в радиусе 3 км…',
  2: 'Расширяем поиск до 6 км…',
  3: 'Расширяем поиск до 10 км…',
};
```

- [ ] **Step 2: TabBar и Layout**

`apps/web/src/components/TabBar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';

export function useMasterActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    api('/masters/application')
      .then((p) => setActive(p?.status === 'ACTIVE'))
      .catch(() => setActive(false));
  }, []);
  return active;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 py-3 text-center text-xs ${isActive ? 'text-teal-700 font-semibold' : 'text-gray-500'}`;

export default function TabBar() {
  const isMaster = useMasterActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-white">
      <NavLink to="/" end className={tabClass}>Главная</NavLink>
      <NavLink to="/orders" className={tabClass}>Мои заявки</NavLink>
      {isMaster && <NavLink to="/work" className={tabClass}>Работа</NavLink>}
      <NavLink to="/profile" className={tabClass}>Профиль</NavLink>
    </nav>
  );
}
```

`apps/web/src/Layout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

export default function Layout() {
  return (
    <div className="pb-16">
      <Outlet />
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: ProfilePage и маршруты**

`apps/web/src/pages/ProfilePage.tsx` — перенести содержимое текущего `HomePage.tsx` целиком (профиль, «Стать мастером», «Панель оператора», выход), поменяв только имя компонента на `ProfilePage`. В `logout` внутри `auth.tsx` добавить сброс сокета:

```tsx
// auth.tsx
import { resetSocket } from './socket';
// ...
  const logout = () => {
    localStorage.clear();
    resetSocket();
    setUser(null);
  };
```

`apps/web/src/pages/HomePage.tsx` — временная заглушка (реализация в Task 14):

```tsx
export default function HomePage() {
  return <div className="p-6">Главная</div>;
}
```

`apps/web/src/App.tsx`:

```tsx
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import BecomeMasterPage from './pages/BecomeMasterPage';
import AdminListPage from './pages/AdminListPage';
import AdminDetailPage from './pages/AdminDetailPage';
import NewOrderPage from './pages/NewOrderPage';
import OrderPage from './pages/OrderPage';
import MyOrdersPage from './pages/MyOrdersPage';
import WorkPage from './pages/WorkPage';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireOperator() {
  const { user } = useAuth();
  return user?.role === 'OPERATOR' ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/orders" element={<MyOrdersPage />} />
              <Route path="/order/new" element={<NewOrderPage />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/work" element={<WorkPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="/become-master" element={<BecomeMasterPage />} />
            <Route element={<RequireOperator />}>
              <Route path="/admin" element={<AdminListPage />} />
              <Route path="/admin/:id" element={<AdminDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

Для сборки этого шага создать заглушки `NewOrderPage.tsx`, `OrderPage.tsx`, `MyOrdersPage.tsx`, `WorkPage.tsx` по образцу HomePage-заглушки (по одному `div` с названием экрана) — их наполнение в задачах 14–15.

- [ ] **Step 4: Сборка**

Run: `pnpm --filter web build`
Expected: сборка без ошибок TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(stage2-web): таб-навигация, socket-клиент, страница профиля"
```

---

### Task 14: Web клиента: главная, форма заявки с превью, экран заявки, история

**Files:**
- Modify: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/pages/NewOrderPage.tsx`
- Modify: `apps/web/src/pages/OrderPage.tsx`
- Modify: `apps/web/src/pages/MyOrdersPage.tsx`

**Interfaces:**
- Consumes: `api()`, `getSocket()`, `STATUS_LABELS/STEPPER_STEPS/WAVE_TEXTS/isTerminalStatus`; HTTP `GET /categories`, `POST /orders/preview`, `POST /orders`, `GET /orders/active`, `GET /orders/:id`, `GET /orders`, `POST /orders/:id/{confirm-price,reject-price,confirm-completion,cancel,retry-search}`; WS `order:status`.
- Produces: экраны клиента (используются только роутером).

- [ ] **Step 1: HomePage**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS } from '../orderStatus';

export default function HomePage() {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Загрузка…</div>;

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
    </div>
  );
}
```

- [ ] **Step 2: NewOrderPage (форма + живое превью)**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Geo {
  lat: number;
  lng: number;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function detectGeo() {
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Не удалось определить геолокацию — разрешите доступ и нажмите «Обновить»'),
    );
  }

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
    detectGeo();
  }, []);

  useEffect(() => {
    if (!categoryId || !geo) return setPreview(null);
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, ...geo }) })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [categoryId, geo]);

  async function submit() {
    if (!categoryId || !geo || !description || !address) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ categoryId, description, address, ...geo }),
      });
      navigate(`/order/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  const canSubmit = categoryId && geo && description && address && preview?.available && !submitting;

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Вызвать мастера</h1>

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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={geo ? 'text-teal-700' : 'text-gray-500'}>
            {geo ? 'Геолокация определена' : 'Определяем геолокацию…'}
          </span>
          <button className="text-teal-700 underline" onClick={detectGeo}>Обновить</button>
        </div>
        {geoError && <p className="text-sm text-red-600">{geoError}</p>}
        <input
          className="w-full rounded border p-3"
          placeholder="Адрес (улица, дом, квартира)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {preview && preview.available && (
        <div className="rounded-xl bg-teal-50 p-4">
          <div className="text-lg font-semibold">Выезд: {preview.calloutPrice} ₸</div>
          <p className="text-sm text-gray-600">
            Работа оплачивается мастеру напрямую после согласования цены.
          </p>
        </div>
      )}
      {preview && !preview.available && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm">Мастеров рядом нет — попробуйте позже.</div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
      >
        {submitting ? 'Создаём…' : 'Вызвать мастера'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: OrderPage (поиск / степпер / нет мастеров / терминал)**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS, STEPPER_STEPS, WAVE_TEXTS, isTerminalStatus } from '../orderStatus';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');
  const now = useNow();

  const load = useCallback(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = (p: any) => {
      if (p.orderId === id) load();
    };
    socket.on('order:status', onStatus);
    socket.io.on('reconnect', load); // fallback: рефетч при переподключении
    return () => {
      socket.off('order:status', onStatus);
      socket.io.off('reconnect', load);
    };
  }, [id, load]);

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  if (error && !order) return <div className="p-6 text-red-600">{error}</div>;
  if (!order) return <div className="p-6 text-gray-500">Загрузка…</div>;

  if (order.status === 'SEARCHING') {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-6 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <p className="text-lg">{WAVE_TEXTS[order.wave] ?? 'Ищем мастера…'}</p>
        <p className="text-gray-500">Прошло {mmss(now - new Date(order.createdAt).getTime())}</p>
        <button className="w-full rounded border p-3" onClick={() => action('cancel', 'Отменить поиск? Это бесплатно.')}>
          Отменить
        </button>
      </div>
    );
  }

  if (order.status === 'NO_MASTERS') {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-4 text-center">
        <h1 className="text-xl font-bold">Никто не откликнулся</h1>
        <p className="text-gray-600">Сервисный сбор не списан. Попробуйте ещё раз.</p>
        <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('retry-search')}>
          Повторить поиск
        </button>
        <button className="w-full rounded border p-3" onClick={() => action('cancel')}>Отменить</button>
      </div>
    );
  }

  if (isTerminalStatus(order.status)) {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-3 text-center">
        <h1 className="text-xl font-bold">{STATUS_LABELS[order.status]}</h1>
        {order.cancelReason && <p className="text-gray-600">{order.cancelReason}</p>}
        <button className="text-teal-700 underline" onClick={() => navigate('/')}>На главную</button>
      </div>
    );
  }

  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);
  const priceDeadline = order.priceProposedAt ? new Date(order.priceProposedAt).getTime() + 15 * 60 * 1000 : 0;

  return (
    <div className="mx-auto max-w-sm p-6 pb-32 space-y-5">
      <h1 className="text-xl font-bold">{order.category?.name}</h1>

      {order.master && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold">{order.master.name ?? 'Мастер'}</div>
          <a href={`tel:${order.master.phone}`} className="text-teal-700 underline">{order.master.phone}</a>
        </div>
      )}

      <ol className="space-y-2">
        {STEPPER_STEPS.map((s, i) => (
          <li key={s.status} className={`flex items-center gap-3 ${i === currentIdx ? 'font-semibold text-teal-700' : i < currentIdx ? 'text-gray-700' : 'text-gray-400'}`}>
            <span className={`h-3 w-3 rounded-full ${i <= currentIdx ? 'bg-teal-700' : 'bg-gray-300'}`} />
            {s.label}
          </li>
        ))}
      </ol>

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-white p-4">
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <>
            <div className="rounded-xl bg-teal-50 p-3">
              <div className="font-semibold">Стоимость работ: {order.workPrice} ₸</div>
              {order.workComment && <div className="text-sm text-gray-600">{order.workComment}</div>}
              <div className="text-sm text-gray-500">Осталось {mmss(priceDeadline - now)}</div>
            </div>
            <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-price')}>
              Подтвердить цену {order.workPrice} ₸
            </button>
            <button
              className="w-full rounded border p-3"
              onClick={() => action('reject-price', 'Отклонить цену? Заявка будет отменена, сервисный сбор удержан.')}
            >
              Отклонить
            </button>
          </>
        )}
        {order.status === 'DONE' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-completion')}>
            Подтвердить выполнение
          </button>
        )}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', 'Отменить заявку? Стоимость выезда будет удержана полностью.')}
          >
            Отменить заявку
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: MyOrdersPage**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS } from '../orderStatus';

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    api('/orders').then(setOrders);
  }, []);
  return (
    <div className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-2xl font-bold">Мои заявки</h1>
      {orders.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
      {orders.map((o) => (
        <Link key={o.id} to={`/order/${o.id}`} className="block rounded-xl border p-4">
          <div className="flex justify-between">
            <span className="font-semibold">{o.category?.name}</span>
            <span className="text-sm text-teal-700">{STATUS_LABELS[o.status]}</span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · Выезд {o.calloutPrice} ₸
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Сборка и коммит**

Run: `pnpm --filter web build`
Expected: без ошибок.

```bash
git add apps/web/src
git commit -m "feat(stage2-web): экраны клиента — форма с превью, поиск, степпер заявки, история"
```

---

### Task 15: Web мастера: «Работа» — тумблер онлайн, оффер, активная заявка

**Files:**
- Modify: `apps/web/src/pages/WorkPage.tsx`

**Interfaces:**
- Consumes: `api()`, `getSocket()`; WS `presence:online/offline`, `geo:update`, `offer:new {orderId, category, description, address, distanceKm, compensation, deadline, wave}`, `offer:closed {orderId, reason}`, `order:status`; HTTP `GET /master/active-order`, `POST /orders/:id/{accept,on-way,on-site,propose-price,complete,cancel}`.
- Produces: экран мастера.

- [ ] **Step 1: WorkPage**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';

function beepAndVibrate() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* звук недоступен — не критично */ }
  navigator.vibrate?.([200, 100, 200]);
}

function useCountdown(deadline: string | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

export default function WorkPage() {
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<any | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const [order, setOrder] = useState<any | null>(null);
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const geoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  const loadActive = useCallback(() => {
    api('/master/active-order').then((r) => setOrder(r.order));
  }, []);

  useEffect(() => {
    loadActive();
    const socket = getSocket();
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOffer = (o: any) => {
      setOffer(o);
      setOfferNote('');
      beepAndVibrate();
    };
    const onOfferClosed = (p: any) => {
      setOffer((cur: any) => (cur && cur.orderId === p.orderId ? null : cur));
      setOfferNote(p.reason);
    };
    const onStatus = () => loadActive();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer:new', onOffer);
    socket.on('offer:closed', onOfferClosed);
    socket.on('order:status', onStatus);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('offer:new', onOffer);
      socket.off('offer:closed', onOfferClosed);
      socket.off('order:status', onStatus);
    };
  }, [loadActive]);

  function goOnline() {
    setGeoDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const socket = getSocket();
        socket.emit('presence:online', { lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOnline(true);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((p) =>
            socket.emit('geo:update', { lat: p.coords.latitude, lng: p.coords.longitude }),
          );
        }, 30000);
      },
      () => setGeoDenied(true),
    );
  }

  function goOffline() {
    getSocket().emit('presence:offline');
    setOnline(false);
    if (geoTimer.current) clearInterval(geoTimer.current);
  }

  async function acceptOffer() {
    if (!offer) return;
    try {
      await api(`/orders/${offer.orderId}/accept`, { method: 'POST' });
      setOffer(null);
      loadActive();
    } catch (e: any) {
      setOffer(null);
      setOfferNote(e.message);
    }
  }

  async function action(path: string, body?: object, confirmText?: string) {
    if (!order) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    try {
      await api(`/orders/${order.id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      loadActive();
    } catch (e: any) {
      setError(e.message);
      loadActive();
    }
  }

  if (offer) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-center bg-teal-800 p-6 text-white">
        <div className="space-y-3 text-center">
          <div className="text-sm uppercase opacity-70">Новая заявка · {offer.distanceKm} км</div>
          <h1 className="text-2xl font-bold">{offer.category}</h1>
          <p>{offer.description}</p>
          <p className="opacity-80">{offer.address}</p>
          <div className="text-xl font-semibold">Компенсация выезда: {offer.compensation} ₸</div>
          <button onClick={acceptOffer} className="w-full rounded-xl bg-white p-4 text-xl font-bold text-teal-800">
            Принять ({secondsLeft} с)
          </button>
        </div>
      </div>
    );
  }

  if (order) {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-4">
        <h1 className="text-xl font-bold">{order.category?.name}</h1>
        <div className="rounded-xl border p-4 space-y-1">
          <div>{order.address}</div>
          <div className="text-sm text-gray-600">{order.description}</div>
          {order.client && (
            <a href={`tel:${order.client.phone}`} className="text-teal-700 underline">{order.client.phone}</a>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {order.status === 'ACCEPTED' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('on-way')}>Еду</button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('on-site')}>На месте</button>
        )}
        {order.status === 'INSPECTION' && (
          <div className="space-y-2">
            <input
              type="number" min="1" placeholder="Стоимость работ, ₸"
              className="w-full rounded border p-3" value={price} onChange={(e) => setPrice(e.target.value)}
            />
            <input
              placeholder="Комментарий (необязательно)"
              className="w-full rounded border p-3" value={comment} onChange={(e) => setComment(e.target.value)}
            />
            <button
              className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
              disabled={!Number(price)}
              onClick={() => action('propose-price', { amount: Number(price), comment: comment || undefined })}
            >
              Отправить цену
            </button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <p className="text-center text-gray-600">Ожидание подтверждения цены клиентом…</p>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('complete')}>Выполнено</button>
        )}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', undefined, 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}
          >
            Отменить
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Работа</h1>
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
    </div>
  );
}
```

- [ ] **Step 2: Сборка и коммит**

Run: `pnpm --filter web build`
Expected: без ошибок.

```bash
git add apps/web/src/pages/WorkPage.tsx
git commit -m "feat(stage2-web): экран мастера — онлайн-тумблер, оффер с таймером, активная заявка"
```

---

### Task 16: Документация, полный прогон и ручной сквозной сценарий

**Files:**
- Modify: `README.md` (раздел «Этап 2»)
- Modify: `apps/api/.env.example` (переменные тарифов)

**Interfaces:**
- Consumes: всё выше.
- Produces: обновлённая инструкция запуска; зафиксированный результат ручного сценария.

- [ ] **Step 1: .env.example**

Добавить в `apps/api/.env.example`:

```bash
# Тарифы срочного режима (значения по умолчанию зашиты в код)
# PRICING_BASE_FARE=2000
# PRICING_PER_KM=150
# SERVICE_FEE_RATE=0.4
# SERVICE_FEE_MIN=1000
# Отключение pg-boss (используется в e2e)
# PGBOSS_DISABLED=1
```

- [ ] **Step 2: README**

Дописать в корневой `README.md` раздел «Этап 2 — срочный режим»: что появилось (заявка, волны, WS, mock-оплата, начисления), как проверить руками (сценарий из Step 4), примечание про pg-boss (схема `pgboss` создаётся автоматически) и про два окна браузера.

- [ ] **Step 3: Полный прогон всего**

```bash
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter web build
```

Expected: всё PASS/успех. Это обязательный шаг перед заявлением о готовности (skill: verification-before-completion).

- [ ] **Step 4: Ручной сквозной сценарий (два окна)**

```bash
docker compose up -d db && pnpm --filter api start:dev   # окно 1
pnpm --filter web dev                                     # окно 2
```

Чек-лист (окно A — клиент, окно B/инкогнито — мастер; мастер заранее активирован оператором, гео браузера разрешено; для совпадения точек удобно подменить гео через DevTools → Sensors, обе точки — Алматы):

1. B: вкладка «Работа» → «Онлайн» → индикатор соединения активен.
2. A: «Вызвать мастера» → категория, описание, адрес → превью «Выезд: N ₸» → создать.
3. B: полноэкранный оффер со звуком и таймером → «Принять».
4. A: экран заявки — степпер «Принята», виден телефон мастера (WS, без F5).
5. B: «Еду» → «На месте» → цена 15000 + комментарий.
6. A: карточка цены с таймером → «Подтвердить».
7. B: «Выполнено». A: «Подтвердить выполнение» → «Закрыта».
8. Проверить в БД: `PaymentTransaction` HOLD+CAPTURE, `Accrual` = выезд − сбор.
9. Повторить с отменами: клиент в поиске (бесплатно), мастер после принятия (заявка возвращается в поиск второму мастеру), «нет мастеров» (всех в офлайн) → «Повторить поиск».

- [ ] **Step 5: Commit**

```bash
git add README.md apps/api/.env.example
git commit -m "docs(stage2): инструкция запуска и проверки срочного режима"
```

---

## Self-Review (выполнен при написании плана)

1. **Покрытие спеки этапа 2:** скоуп §1 — жизненный цикл (задачи 6–11), presence+гео (5), realtime (5, 12), mock-оплата (2), начисления (6, 9–11), экраны (13–15), табы (13). Архитектурные решения §2 — все воплощены (pg-boss T4, гейты T6+, DI-токены T2–T3, PostGIS T1). Модель §3 — T1. State machine §4 — T6, 8–11. Матчинг §5 — T7–8. Ценообразование §6 — T3. Realtime §7 — T5, 12. API §8 — T6, 8–11. Экраны §9 — T13–15. Крайние случаи §10 — пустая волна (T7), гонка (T8), reconnect-рефетч (T14 OrderPage, T15 loadActive), идемпотентные гейты (везде), рестарт API (pg-boss), Asia/Almaty (T3). Тесты §11 — по одной e2e-задаче на блок + юнит прайсинга + WS.
2. **Плейсхолдеров нет** — каждый шаг содержит код/команды.
3. **Согласованность типов** — проверены сигнатуры между задачами: `gate(orderId, from, data, tx?)`, `accrueCompensation(tx, order)`, `handleWave({orderId, wave})`, `handleWaveTimeout({orderId, wave, attempt})`, payload'ы `offer:new`/`order:status` совпадают у эмиттера (T7/T6) и потребителя (T15/T14).

Известные допущения перенесены в раздел «Уточнения к спеке» в начале плана — при ревью этапа сверить с владельцем продукта пункты 1, 5, 6.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-stage2-urgent-mode.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks (superpowers:subagent-driven-development).
2. **Inline Execution** — execute tasks in this session with checkpoints (superpowers:executing-plans).

