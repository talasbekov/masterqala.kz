# Client v2 — Backend Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 8 backend data gaps identified in the client-v2 design handoff (`docs/superpowers/specs/2026-07-19-client-v2-backend-design.md`) so cycle 2 (client UI rebuild) can consume real data instead of mocks.

**Architecture:** NestJS/Prisma, following every existing pattern in `apps/api` exactly (atomic `gate()` transitions, `FileStorage` for uploads, `RealtimeGateway.emitToUser` for WS, TDD with `test:e2e` against the disposable Postgres test DB). One Prisma migration covers all schema changes (spec's risk note: fewer migrations = less drift risk, precedent from stage 3's GIST-index incident). No new npm dependencies.

**Tech Stack:** NestJS 10, Prisma 5.21, PostgreSQL/PostGIS, class-validator, Jest + supertest.

## Global Constraints

- Every task's verification is `pnpm --filter api build` (must exit 0) plus the task's own new/updated tests. Run the full suite (`npx jest` for unit, `DATABASE_URL=... npx jest --config ./test/jest-e2e.json --runInBand` for e2e) only in the final verification task — per-task, run just the relevant spec file(s) to keep iteration fast.
- TDD every step: RED (write test, watch it fail for the right reason) → GREEN (minimal code) → commit. No exceptions.
- Test DB: the project's `docker-compose.yml` maps `db_test` to host port 5433. If that port is occupied by an unrelated container on your machine, start a throwaway one instead: `docker run -d --name masterqala-e2e-tmp -e POSTGRES_USER=masterqala -e POSTGRES_PASSWORD=masterqala -e POSTGRES_DB=masterqala_test -p 5434:5432 postgis/postgis:16-3.4`, then use `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5434/masterqala_test` for both `prisma migrate deploy` and the e2e run. Remove the container when done.
- This worktree's `node_modules` must exist before anything runs: `pnpm install` at the repo root, then `pnpm --filter api exec prisma generate` — worktrees never share `node_modules` (confirmed operational note in project memory).
- Do not touch: operator/admin endpoints (`/admin/*`), Kaspi/SMS integration, master-role or operator-role UI. Out of scope per the design doc.
- All new user-facing strings are Russian, matching the existing codebase's language.
- File paths below are relative to `apps/api/` unless stated otherwise.

---

### Task 1: Schema migration — all 8 items' schema changes in one migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `test/helpers.ts` (`resetDb` TRUNCATE list)
- Create: `prisma/migrations/<timestamp>_client_v2_backend_extensions/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Prisma Client types for every later task: `Order.district/entrance/floor/apartment/addressComment/photos`, `PlannedOrder.entrance/floor/apartment/addressComment/budget/slotStart/slotEnd/photos` (replacing `scheduledAt`), models `OrderPhoto`, `PlannedOrderPhoto`, `Address`, `User.addresses`.

- [ ] **Step 1: Edit `prisma/schema.prisma` — `Order` model**

Find the `model Order {` block and replace the `address` line through `location` line:

```prisma
  address         String
  district        String
  entrance        String?
  floor           String?
  apartment       String?
  addressComment  String?
  location        Unsupported("geography(Point, 4326)")?
```

Add `photos OrderPhoto[]` to the end of the relation list at the bottom of the `Order` model (next to `disputes Dispute[]`):

```prisma
  disputes        Dispute[]
  photos          OrderPhoto[]
```

- [ ] **Step 2: Edit `prisma/schema.prisma` — `PlannedOrder` model**

Replace:
```prisma
  address        String
  district       String
  scheduledAt    DateTime
  status         PlannedOrderStatus @default(CREATED)
```
with:
```prisma
  address        String
  district       String
  entrance       String?
  floor          String?
  apartment      String?
  addressComment String?
  budget         Int?
  slotStart      DateTime
  slotEnd        DateTime
  status         PlannedOrderStatus @default(CREATED)
```

Add `photos PlannedOrderPhoto[]` next to the existing `disputes Dispute[]` relation line in `PlannedOrder`.

- [ ] **Step 3: Add new models to `prisma/schema.prisma`**

Add after the `PlannedOrderBid` model:

```prisma
model OrderPhoto {
  id        String   @id @default(uuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  path      String
  createdAt DateTime @default(now())

  @@index([orderId])
}

model PlannedOrderPhoto {
  id             String       @id @default(uuid())
  plannedOrderId String
  plannedOrder   PlannedOrder @relation(fields: [plannedOrderId], references: [id], onDelete: Cascade)
  path           String
  createdAt      DateTime     @default(now())

  @@index([plannedOrderId])
}

model Address {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  label     String
  address   String
  entrance  String?
  floor     String?
  apartment String?
  comment   String?
  lat       Float?
  lng       Float?
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 4: Add the `addresses` relation to `User`**

In `model User {`, add `addresses Address[]` next to `cancellations MasterCancellation[]`.

- [ ] **Step 5: Generate and apply the migration**

Run: `cd apps/api && DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala npx prisma migrate dev --name client_v2_backend_extensions`
Expected: migration created and applied, exits 0. If it fails because your local dev DB has existing `Order`/`PlannedOrder` rows that can't satisfy the new required `district`/`slotStart`/`slotEnd` columns, run `npx prisma migrate reset` first (safe — this is a pre-launch project with no real user data, confirmed in `docs/superpowers/specs/2026-07-19-client-v2-backend-design.md`) and re-run the migrate command.

- [ ] **Step 6: Regenerate Prisma Client**

Run: `npx prisma generate`
Expected: exits 0, no errors.

- [ ] **Step 7: Add new tables to the e2e `resetDb` TRUNCATE list**

In `test/helpers.ts`, find the `resetDb` function's `TRUNCATE` string and add `"OrderPhoto","PlannedOrderPhoto","Address"` to the list (anywhere before `CASCADE`):

```ts
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual","PlannedOrder","PlannedOrderBid","LeadCreditAccount","LeadCreditTransaction","LeadCreditPurchase","MasterWalletAccount","WithdrawalRequest","Dispute","MasterCancellation","OrderPhoto","PlannedOrderPhoto","Address" CASCADE',
  );
}
```

- [ ] **Step 8: Verify the build**

Run: `pnpm --filter api build` (from repo root)
Expected: fails — `orders.service.ts`, `planned-orders.service.ts`, `matching.service.ts`, `dto.ts` files, `order.constants.ts`, `planned-order.constants.ts` still reference the old shape (`CreateOrderDto` missing `district`, `scheduledAt` no longer exists, etc.). **This is expected** — later tasks fix each reference. Confirm the error list only mentions files this plan will touch (no unrelated breakage).

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations test/helpers.ts
git commit -m "feat(api): схема — фото заявок, детали/сохранённые адреса, district, бюджет+слот плановой"
```

---

### Task 2: ETA formula (standalone, no dependencies)

**Files:**
- Modify: `src/routing/routing.interface.ts` (add constant, if not already a good home — see step 1)
- Create: `src/routing/eta.ts`
- Test: `src/routing/eta.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ASSUMED_SPEED_KMH: number`, `estimateEtaMinutes(distanceKm: number): number` — used by Task 10 (RealtimeGateway relay).

- [ ] **Step 1: Write the failing test — `src/routing/eta.spec.ts`**

```ts
import { estimateEtaMinutes, ASSUMED_SPEED_KMH } from './eta';

describe('estimateEtaMinutes', () => {
  it('городская скорость по умолчанию — 30 км/ч', () => {
    expect(ASSUMED_SPEED_KMH).toBe(30);
  });

  it('5 км при 30 км/ч — 10 минут', () => {
    expect(estimateEtaMinutes(5)).toBe(10);
  });

  it('округляет до целых минут', () => {
    expect(estimateEtaMinutes(1)).toBe(2);
  });

  it('0 км — 0 минут', () => {
    expect(estimateEtaMinutes(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest eta.spec.ts`
Expected: FAIL — `Cannot find module './eta'`.

- [ ] **Step 3: Write minimal implementation — `src/routing/eta.ts`**

```ts
export const ASSUMED_SPEED_KMH = 30;

export function estimateEtaMinutes(distanceKm: number): number {
  return Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest eta.spec.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/routing/eta.ts src/routing/eta.spec.ts
git commit -m "feat(api): честная формула ETA (прямая×1.3 уже есть в PostgisRoutingService, здесь — время)"
```

---

### Task 3: Generic uploads endpoint

**Files:**
- Create: `src/uploads/uploads.module.ts`
- Create: `src/uploads/uploads.controller.ts`
- Modify: `src/app.module.ts`
- Test: `test/uploads.e2e-spec.ts`

**Interfaces:**
- Consumes: `FILE_STORAGE`/`FileStorage` (existing, `src/storage/storage.interface.ts`)
- Produces: `POST /api/v1/uploads` → `{ path: string }`, consumed by Tasks 4 and 5 (client sends the returned `path` back in `photoPaths`).

- [ ] **Step 1: Write the failing e2e test — `test/uploads.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('POST /uploads (e2e)', () => {
  let app: INestApplication;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    client = await loginAs(app, '+77050000001');
  });

  it('загружает JPEG и возвращает path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body.path).toMatch(/\.jpg$/);
  });

  it('без файла — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(400);
  });

  it('недопустимый MIME — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('без токена — 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .attach('file', Buffer.from([0xff, 0xd8]), { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json uploads.e2e-spec.ts`
Expected: FAIL — `404 Not Found` (route doesn't exist yet).

- [ ] **Step 3: Create `src/uploads/uploads.controller.ts`**

```ts
import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';

const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Допустимы только JPEG и PNG');
    const path = await this.storage.save(file.buffer, ext);
    return { path };
  }
}
```

- [ ] **Step 4: Create `src/uploads/uploads.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [StorageModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
```

- [ ] **Step 5: Register in `src/app.module.ts`**

Add `import { UploadsModule } from './uploads/uploads.module';` to the imports at the top, and add `UploadsModule` to the `imports: [...]` array (anywhere, e.g. next to `StorageModule`-consuming modules — after `MastersModule`).

- [ ] **Step 6: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json uploads.e2e-spec.ts`
Expected: PASS, 4/4.

- [ ] **Step 7: Commit**

```bash
git add src/uploads src/app.module.ts test/uploads.e2e-spec.ts
git commit -m "feat(api): generic POST /uploads для фото до создания заявки"
```

---

### Task 4: Order photos — DTO, service, streaming endpoint

**Files:**
- Modify: `src/orders/dto.ts`
- Modify: `src/orders/order.constants.ts`
- Modify: `src/orders/orders.service.ts`
- Modify: `src/orders/orders.controller.ts`
- Test: `test/order-photos.e2e-spec.ts`

**Interfaces:**
- Consumes: `path` strings from Task 3's `POST /uploads`
- Produces: `Order.photos: { id, path, createdAt }[]` in every order response (via `ORDER_INCLUDE`)

- [ ] **Step 1: Write the failing e2e test — `test/order-photos.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, pointAtKm, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Фото к срочной заявке (e2e)', () => {
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
    client = await loginAs(app, '+77051000001');
    await createActiveMaster(app, '+77051000002', plumbingId, pointAtKm(2));
  });

  it('создание с photoPaths сохраняет OrderPhoto и отдаёт их в ответе', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'Прорвало трубу',
        address: 'ул. Абая, 1',
        district: 'Есильский район',
        photoPaths: [up.body.path],
        ...ALMATY,
      })
      .expect(201);

    expect(order.body.photos).toHaveLength(1);
    expect(order.body.photos[0].path).toBe(up.body.path);

    const count = await prisma.orderPhoto.count({ where: { orderId: order.body.id } });
    expect(count).toBe(1);
  });

  it('больше 5 фото — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        photoPaths: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'],
        ...ALMATY,
      })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json order-photos.e2e-spec.ts`
Expected: FAIL — 400/500 on order creation (`district` unknown to DTO, `photoPaths` unknown, whitelist strips them or validation rejects).

- [ ] **Step 3: Update `src/orders/dto.ts`**

Replace the whole file:

```ts
import {
  ArrayMaxSize,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PreviewOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class CreateOrderDto extends PreviewOrderDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressComment?: string;

  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoPaths?: string[];
}

export class ProposePriceDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
```

- [ ] **Step 4: Update `ORDER_INCLUDE` in `src/orders/order.constants.ts`**

```ts
export const ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  photos: true,
} satisfies Prisma.OrderInclude;
```

- [ ] **Step 5: Update `OrdersService.create` in `src/orders/orders.service.ts`**

Replace the `create` method body's `tx.order.create` call and everything through the geo raw query — insert `district`/address-detail fields and photo creation inside the same transaction:

```ts
  async create(clientId: string, dto: CreateOrderDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const active = await this.prisma.order.count({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
    });
    if (active > 0)
      throw new ConflictException('У вас уже есть активная заявка');

    const quote = await this.pricing.quote(
      dto.categoryId,
      { lat: dto.lat, lng: dto.lng },
      clientId,
    );
    if (!quote) throw new UnprocessableEntityException('Мастеров рядом нет');

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          district: dto.district,
          entrance: dto.entrance ?? null,
          floor: dto.floor ?? null,
          apartment: dto.apartment ?? null,
          addressComment: dto.addressComment ?? null,
          calloutPrice: quote.calloutPrice,
          serviceFee: quote.serviceFee,
        },
      });
      await tx.$executeRaw`
        UPDATE "Order"
        SET location = ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        WHERE id = ${created.id}`;
      if (dto.photoPaths?.length) {
        await tx.orderPhoto.createMany({
          data: dto.photoPaths.map((path) => ({ orderId: created.id, path })),
        });
      }
      return created;
    });

    // Холд на полную стоимость выезда, не только на сбор: при ПРИНЯТА капчится
    // целиком, платформа удерживает serviceFee себе, остаток уходит мастеру
    // компенсацией (accrueCallout = calloutPrice − serviceFee) — без этого
    // с реальным провайдером компенсация платилась бы из денег, которых
    // платформа не собирала (P0, §23 отчёта).
    // Ошибка холда → заявка остаётся CREATED и не публикуется (§3.3).
    await this.payments.hold(order.id, order.calloutPrice);
    await this.gate(order.id, 'CREATED', { status: 'SEARCHING' });
    await this.queue.send(JOBS.WAVE, { orderId: order.id, wave: 1 });
    return this.findOrThrow(order.id);
  }
```

(This preserves the P0 fix from the previous cycle — only the `tx.order.create` data block and photo insert are new.)

- [ ] **Step 6: Add the photo-stream endpoint**

In `src/orders/orders.service.ts`, add a new method (near `getById`):

```ts
  async getPhotoStream(user: User, orderId: string, photoId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.clientId !== user.id && order.masterId !== user.id && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    const photo = order.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не найдено');
    return this.storage.absolutePath(photo.path);
  }
```

This needs `FileStorage` injected — add to the constructor:
```ts
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
```
and the import at the top:
```ts
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
```

In `src/orders/orders.controller.ts`, add:

```ts
  @Get('orders/:id/photos/:photoId')
  async photo(@CurrentUser() user: User, @Param('id') id: string, @Param('photoId') photoId: string) {
    const absPath = await this.orders.getPhotoStream(user, id, photoId);
    return new StreamableFile(createReadStream(absPath), { type: 'image/jpeg', disposition: 'inline' });
  }
```

Add imports at the top of `orders.controller.ts`: `StreamableFile` from `@nestjs/common` (add to the existing import), and `import { createReadStream } from 'fs';`.

- [ ] **Step 7: Register `StorageModule` in `OrdersModule`**

In `src/orders/orders.module.ts`, add `import { StorageModule } from '../storage/storage.module';` and add `StorageModule` to the `imports: [...]` array.

- [ ] **Step 8: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json order-photos.e2e-spec.ts`
Expected: PASS, 2/2.

- [ ] **Step 9: Fix the existing `createOrderViaApi` test helper (Task 12 will add `district` there — skip if Task 12 already landed; otherwise this test file's 2nd case already passes its own inline `district`)**

No action needed in this task — `test/helpers.ts::createOrderViaApi` is updated in Task 12, which also fixes `district`-dependent breakage across the rest of the suite. This task's own test file supplies `district` inline and doesn't depend on the helper.

- [ ] **Step 10: Commit**

```bash
git add src/orders test/order-photos.e2e-spec.ts
git commit -m "feat(api): фото и детали адреса на срочной заявке"
```

---

### Task 5: Planned order photos — DTO, service, streaming endpoint

**Files:**
- Modify: `src/planned-orders/dto.ts`
- Modify: `src/planned-orders/planned-order.constants.ts`
- Modify: `src/planned-orders/planned-orders.service.ts`
- Modify: `src/planned-orders/planned-orders.controller.ts`
- Modify: `src/planned-orders/planned-orders.module.ts`
- Test: `test/planned-order-photos.e2e-spec.ts`

**Interfaces:**
- Consumes: `path` strings from Task 3's `POST /uploads`
- Produces: `PlannedOrder.photos: { id, path, createdAt }[]` in every planned-order response

**Note:** this task adds `photoPaths`/address-detail fields to `CreatePlannedOrderDto` only — it deliberately does **not** touch `scheduledAt`/`budget`/`slotStart`/`slotEnd` (that's Task 9, kept separate because it's the riskiest single change in this plan).

- [ ] **Step 1: Write the failing e2e test — `test/planned-order-photos.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Фото к плановой заявке (e2e)', () => {
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
    client = await loginAs(app, '+77052000001');
  });

  it('создание с photoPaths сохраняет PlannedOrderPhoto', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const order = await createPlannedOrderViaApi(app, client.token, plumbingId, { photoPaths: [up.body.path] });

    expect(order.photos).toHaveLength(1);
    const count = await prisma.plannedOrderPhoto.count({ where: { plannedOrderId: order.id } });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-order-photos.e2e-spec.ts`
Expected: FAIL — `createPlannedOrderViaApi` doesn't accept `photoPaths` yet (TypeScript) or the field is silently dropped by validation whitelist, so `order.photos` is `undefined`.

- [ ] **Step 3: Update `test/helpers.ts::createPlannedOrderViaApi` to accept `photoPaths`**

Find the function and widen the `overrides` type and pass-through:

```ts
export async function createPlannedOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  overrides: Partial<{ description: string; address: string; district: string; scheduledAt: string; photoPaths: string[] }> = {},
) {
  const scheduledAt = overrides.scheduledAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post('/api/v1/planned-orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      categoryId,
      description: overrides.description ?? 'Повесить люстру',
      address: overrides.address ?? 'ул. Абая, 1',
      district: overrides.district ?? 'Есильский район',
      scheduledAt,
      photoPaths: overrides.photoPaths,
    })
    .expect(201);
  return res.body;
}
```

(Keep `scheduledAt` here for now — Task 9 changes this helper again to `slotStart`/`slotEnd`. Read the surrounding function body from the file first since line numbers may have shifted from earlier tasks.)

- [ ] **Step 4: Add `photoPaths` and address-detail fields to `CreatePlannedOrderDto` in `src/planned-orders/dto.ts`**

```ts
import { ArrayMaxSize, IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressComment?: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoPaths?: string[];
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

- [ ] **Step 5: Update `PLANNED_ORDER_INCLUDE` in `src/planned-orders/planned-order.constants.ts`**

```ts
export const PLANNED_ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  bids: {
    include: { master: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  photos: true,
} satisfies Prisma.PlannedOrderInclude;
```

- [ ] **Step 6: Wire photo creation into `PlannedOrdersService.create`**

In `src/planned-orders/planned-orders.service.ts`, wrap the existing `this.prisma.plannedOrder.create(...)` call in a transaction that also inserts photos:

```ts
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.plannedOrder.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          district: dto.district,
          entrance: dto.entrance ?? null,
          floor: dto.floor ?? null,
          apartment: dto.apartment ?? null,
          addressComment: dto.addressComment ?? null,
          scheduledAt,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      if (dto.photoPaths?.length) {
        await tx.plannedOrderPhoto.createMany({
          data: dto.photoPaths.map((path) => ({ plannedOrderId: created.id, path })),
        });
      }
      return created;
    });
```

- [ ] **Step 7: Add the photo-stream endpoint**

In `src/planned-orders/planned-orders.service.ts`, add (near `getByIdForUser`):

```ts
  async getPhotoStream(user: User, plannedOrderId: string, photoId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.clientId !== user.id && order.masterId !== user.id && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    const photo = order.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не найдено');
    return this.storage.absolutePath(photo.path);
  }
```

Add `@Inject(FILE_STORAGE) private readonly storage: FileStorage,` to the constructor and `import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';` to the imports.

In `src/planned-orders/planned-orders.controller.ts`, add:

```ts
  @Get(':id/photos/:photoId')
  async photo(@CurrentUser() user: User, @Param('id') id: string, @Param('photoId') photoId: string) {
    const absPath = await this.plannedOrders.getPhotoStream(user, id, photoId);
    return new StreamableFile(createReadStream(absPath), { type: 'image/jpeg', disposition: 'inline' });
  }
```

Add `StreamableFile` to the `@nestjs/common` import and `import { createReadStream } from 'fs';` at the top.

- [ ] **Step 8: Register `StorageModule` in `PlannedOrdersModule`**

In `src/planned-orders/planned-orders.module.ts`, add `import { StorageModule } from '../storage/storage.module';` and `StorageModule` to `imports: [...]`.

- [ ] **Step 9: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-order-photos.e2e-spec.ts`
Expected: PASS, 1/1.

- [ ] **Step 10: Commit**

```bash
git add src/planned-orders test/planned-order-photos.e2e-spec.ts test/helpers.ts
git commit -m "feat(api): фото на плановой заявке"
```

---

### Task 6: Saved addresses CRUD

**Files:**
- Create: `src/addresses/dto.ts`
- Create: `src/addresses/addresses.service.ts`
- Create: `src/addresses/addresses.controller.ts`
- Create: `src/addresses/addresses.module.ts`
- Modify: `src/app.module.ts`
- Test: `test/addresses.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing consumed by later tasks (leaf feature)

- [ ] **Step 1: Write the failing e2e test — `test/addresses.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('CRUD сохранённых адресов (e2e)', () => {
  let app: INestApplication;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    client = await loginAs(app, '+77053000001');
  });

  it('создаёт, читает, обновляет, удаляет свой адрес', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true })
      .expect(201);
    expect(created.body).toMatchObject({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true });

    const list = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${created.body.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом (новый)' })
      .expect(200);
    expect(updated.body.label).toBe('Дом (новый)');

    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${created.body.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(empty.body).toHaveLength(0);
  });

  it('второй isDefault:true снимает флаг с первого', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Работа', address: 'ул. Кенесары, 2', isDefault: true })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const byId = Object.fromEntries(list.body.map((a: { id: string; isDefault: boolean }) => [a.id, a.isDefault]));
    expect(byId[first.body.id]).toBe(false);
    expect(byId[second.body.id]).toBe(true);
  });

  it('чужой адрес не редактировать/не удалить (403)', async () => {
    const mine = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1' })
      .expect(201);
    const stranger = await loginAs(app, '+77053000002');
    await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${mine.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ label: 'Взлом' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${mine.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json addresses.e2e-spec.ts`
Expected: FAIL — `404 Not Found` (routes don't exist).

- [ ] **Step 3: Create `src/addresses/dto.ts`**

```ts
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
```

- [ ] **Step 4: Create `src/addresses/addresses.service.ts`**

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.create({
      data: {
        userId,
        label: dto.label,
        address: dto.address,
        entrance: dto.entrance ?? null,
        floor: dto.floor ?? null,
        apartment: dto.apartment ?? null,
        comment: dto.comment ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.guardOwner(userId, id);
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.guardOwner(userId, id);
    await this.prisma.address.delete({ where: { id } });
  }

  private async guardOwner(userId: string, id: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Адрес не найден');
    if (address.userId !== userId) throw new ForbiddenException('Нет доступа к адресу');
  }

  private async clearDefault(userId: string): Promise<void> {
    await this.prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }
}
```

- [ ] **Step 5: Create `src/addresses/addresses.controller.ts`**

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.addresses.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.addresses.remove(user.id, id);
  }
}
```

- [ ] **Step 6: Create `src/addresses/addresses.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';

@Module({
  providers: [AddressesService],
  controllers: [AddressesController],
})
export class AddressesModule {}
```

- [ ] **Step 7: Register in `src/app.module.ts`**

Add `import { AddressesModule } from './addresses/addresses.module';` and add `AddressesModule` to `imports: [...]`.

- [ ] **Step 8: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json addresses.e2e-spec.ts`
Expected: PASS, 3/3.

- [ ] **Step 9: Commit**

```bash
git add src/addresses src/app.module.ts test/addresses.e2e-spec.ts
git commit -m "feat(api): CRUD сохранённых адресов"
```

---

### Task 7: Master stats in bid response (experienceYears, completedCount, verified)

**Files:**
- Modify: `src/planned-orders/planned-order.constants.ts`
- Modify: `src/planned-orders/planned-orders.service.ts`
- Test: `test/planned-orders-bids.e2e-spec.ts` (existing file — read it first, then add a case)

**Interfaces:**
- Consumes: `MasterProfile.experienceYears`, `MasterProfile.status`, `Order`/`PlannedOrder` closed-count (existing)
- Produces: `bid.master.experienceYears: number`, `bid.master.completedCount: number`, `bid.master.verified: boolean` on every bid returned in `PlannedOrder.bids`

- [ ] **Step 1: Write the failing test — append inside the `describe('Ставки на плановую заявку (e2e)', ...)` block in `test/planned-orders-bids.e2e-spec.ts`, after the existing `it(...)` cases**

This file's `beforeEach` already defines `client`, `plumbingId`, and a `masters` array of 6 active masters each granted 5 lead credits (`masters[0]` through `masters[5]`) — reuse them as-is:

```ts
  it('ставка включает опыт, кол-во закрытых заказов и verified мастера', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 5000, term: '2 часа' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);

    expect(detail.body.bids[0].master).toMatchObject({
      experienceYears: expect.any(Number),
      completedCount: 0,
      verified: true,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-bids.e2e-spec.ts`
Expected: FAIL — `detail.body.bids[0].master.experienceYears` is `undefined` (current `master` select is just `{ id, name }`).

- [ ] **Step 3: Update `PLANNED_ORDER_INCLUDE` bids.master select in `src/planned-orders/planned-order.constants.ts`**

```ts
export const PLANNED_ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  bids: {
    include: {
      master: {
        select: {
          id: true,
          name: true,
          masterProfile: { select: { experienceYears: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  photos: true,
} satisfies Prisma.PlannedOrderInclude;
```

- [ ] **Step 4: Add a post-processing step in `PlannedOrdersService` to shape the bid.master payload**

The raw Prisma result now nests `bid.master.masterProfile.{experienceYears,status}` — flatten it and add `completedCount`. Add a private helper and call it everywhere `PLANNED_ORDER_INCLUDE` results are returned to a client (`findOrThrow`, `listMine`, `getByIdForUser` already funnel through `findOrThrow`/`redactMasterContact` — add the shaping in `findOrThrow` right after the Prisma query, before the dispute lookup):

```ts
  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { plannedOrderId: id }, orderBy: { createdAt: 'desc' } });
    return { ...order, bids: await this.enrichBids(order.bids), dispute };
  }

  private async enrichBids<
    T extends { masterUserId: string; master: { id: string; name: string | null; masterProfile: { experienceYears: number; status: string } | null } },
  >(bids: T[]) {
    const counts = await Promise.all(
      bids.map((b) =>
        Promise.all([
          this.prisma.order.count({ where: { masterId: b.masterUserId, status: 'CLOSED' } }),
          this.prisma.plannedOrder.count({ where: { masterId: b.masterUserId, status: 'CLOSED' } }),
        ]),
      ),
    );
    return bids.map((b, i) => ({
      ...b,
      master: {
        id: b.master.id,
        name: b.master.name,
        experienceYears: b.master.masterProfile?.experienceYears ?? 0,
        completedCount: counts[i][0] + counts[i][1],
        verified: b.master.masterProfile?.status === 'ACTIVE',
      },
    }));
  }
```

Also apply the same `bids: await this.enrichBids(order.bids)` shaping in `listMine` (map over each order) — update:

```ts
  async listMine(clientId: string) {
    const orders = await this.prisma.plannedOrder.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: PLANNED_ORDER_INCLUDE,
    });
    return Promise.all(orders.map(async (order) => this.redactMasterContact({ ...order, bids: await this.enrichBids(order.bids) })));
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-bids.e2e-spec.ts`
Expected: PASS, all cases including the new one.

- [ ] **Step 6: Run the broader planned-orders e2e files to check for regressions from the `bids.master` shape change**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders`
Expected: all `planned-orders-*.e2e-spec.ts` files PASS. If any assert the old flat `bid.master === { id, name }` shape, update that assertion to the new shape (it now includes `experienceYears`/`completedCount`/`verified`).

- [ ] **Step 7: Commit**

```bash
git add src/planned-orders test/planned-orders-bids.e2e-spec.ts
git commit -m "feat(api): опыт/кол-во заказов/verified мастера в ставке"
```

---

### Task 8: Deadline timestamps in order responses

**Files:**
- Modify: `src/orders/orders.service.ts`
- Modify: `src/planned-orders/planned-orders.service.ts`
- Test: `test/orders-price-flow.e2e-spec.ts` (existing — add a case), `test/planned-orders-lifecycle.e2e-spec.ts` (existing — add a case)

**Interfaces:**
- Consumes: existing `priceProposedAt`, `PRICE_CONFIRM_TIMEOUT_S`, `selectedAt`, `PLANNED_CONFIRM_TIMEOUT_S`
- Produces: `order.priceDeadline: string | null`, `plannedOrder.confirmDeadline: string | null` in every response

- [ ] **Step 1: Write the failing test — append inside the `describe('Цепочка до цены и таймаут цены (e2e)', ...)` block in `test/orders-price-flow.e2e-spec.ts`, after the existing `it(...)` cases**

This file's `beforeEach` already creates+accepts an order and exposes module-scoped `client`, `master`, `orderId`, and a `post(token, path, body?)` helper (`POST /api/v1/orders/${orderId}/${path}`) — reuse them as-is:

```ts
  it('priceDeadline = priceProposedAt + 15 минут', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000 }).expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const proposedAt = new Date(detail.body.priceProposedAt).getTime();
    const deadline = new Date(detail.body.priceDeadline).getTime();
    expect(deadline - proposedAt).toBe(15 * 60 * 1000);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json orders-price-flow.e2e-spec.ts`
Expected: FAIL — `detail.body.priceDeadline` is `undefined`.

- [ ] **Step 3: Add `priceDeadline` to `OrdersService` responses**

In `src/orders/orders.service.ts`, add a private helper and use it in `findOrThrow` (the single place all order reads funnel through):

```ts
  private withDeadlines<T extends { priceProposedAt: Date | null }>(order: T) {
    return {
      ...order,
      priceDeadline: order.priceProposedAt
        ? new Date(order.priceProposedAt.getTime() + PRICE_CONFIRM_TIMEOUT_S * 1000).toISOString()
        : null,
    };
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
    return this.withDeadlines({ ...order, dispute });
  }
```

Apply the same wrap to the other three read paths — replace each method exactly as shown (only the `return` line changes in each):

```ts
  async getActive(clientId: string) {
    const order = await this.prisma.order.findFirst({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return { order: order ? this.withDeadlines(order) : null };
  }

  async listMine(clientId: string) {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map((o) => this.withDeadlines(o));
  }

  async getMasterActive(masterUserId: string) {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, status: { in: ACTIVE_MASTER_STATUSES } },
      include: ORDER_INCLUDE,
    });
    return { order: order ? this.withDeadlines(order) : null };
  }

  async getById(user: User, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (
      order.clientId !== user.id &&
      order.masterId !== user.id &&
      user.role !== 'OPERATOR'
    ) {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    const dispute = await this.prisma.dispute.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
    return this.withDeadlines({ ...order, dispute });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json orders-price-flow.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test — append inside the `describe('Плановая заявка: полный жизненный цикл (e2e)', ...)` block in `test/planned-orders-lifecycle.e2e-spec.ts`, after the existing `it(...)`**

This file's `beforeEach` already defines `client`, `master`, `plumbingId` (an active master with no lead credits yet) — reuse them as-is:

```ts
  it('confirmDeadline = selectedAt + 2 часа', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 9000, term: 'завтра утром' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const selectedAt = new Date(detail.body.selectedAt).getTime();
    const deadline = new Date(detail.body.confirmDeadline).getTime();
    expect(deadline - selectedAt).toBe(2 * 3600 * 1000);
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-lifecycle.e2e-spec.ts`
Expected: FAIL — `confirmDeadline` undefined.

- [ ] **Step 7: Add `confirmDeadline` to `PlannedOrdersService.findOrThrow`**

```ts
  private withDeadline<T extends { selectedAt: Date | null; status: string }>(order: T) {
    return {
      ...order,
      confirmDeadline:
        order.selectedAt && order.status === 'MASTER_SELECTED'
          ? new Date(order.selectedAt.getTime() + PLANNED_CONFIRM_TIMEOUT_S * 1000).toISOString()
          : null,
    };
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { plannedOrderId: id }, orderBy: { createdAt: 'desc' } });
    return this.withDeadline({ ...order, bids: await this.enrichBids(order.bids), dispute });
  }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-lifecycle.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/orders/orders.service.ts src/planned-orders/planned-orders.service.ts test/orders-price-flow.e2e-spec.ts test/planned-orders-lifecycle.e2e-spec.ts
git commit -m "feat(api): priceDeadline/confirmDeadline вычисляемые поля в ответе"
```

---

### Task 9: District instead of exact address in offer (privacy fix) + `createOrderViaApi` helper update

**Files:**
- Modify: `src/orders/matching.service.ts`
- Modify: `test/helpers.ts` (`createOrderViaApi`)
- Modify: `test/realtime-orders.e2e-spec.ts` (existing test already captures the real `offer:new` WS payload — extend its assertions; `matching-waves.e2e-spec.ts` only asserts `OrderOffer` table rows, never payload content, so it needs no change)

**Interfaces:**
- Consumes: `Order.district` (from Task 1's schema change)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Update `test/helpers.ts::createOrderViaApi` to always send `district`**

```ts
export async function createOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ categoryId, description: 'Прорвало трубу', address: 'ул. Абая, 1', district: 'Есильский район', ...point })
    .expect(201);
  return res.body;
}
```

This single change is why every other e2e file that calls `createOrderViaApi` (there are around 20) keeps working without individual edits — confirmed during design that `district` is only ever set through this one helper in tests.

- [ ] **Step 2: Extend the existing `offer:new` assertions in `test/realtime-orders.e2e-spec.ts`**

Find this block inside the `'мастер получает offer:new, клиент — order:status при принятии'` test:

```ts
    const offer = await offerPromise;
    expect(offer).toMatchObject({ orderId: order.id, category: 'Сантехника', wave: 1 });
    expect(offer.compensation).toBe(order.calloutPrice - order.serviceFee);
    expect(offer.deadline).toBeDefined();
```

Replace it with:

```ts
    const offer = await offerPromise;
    expect(offer).toMatchObject({ orderId: order.id, category: 'Сантехника', wave: 1, district: 'Есильский район' });
    expect(offer.address).toBeUndefined();
    expect(offer.compensation).toBe(order.calloutPrice - order.serviceFee);
    expect(offer.deadline).toBeDefined();
```

(`createOrderViaApi` — used by this test via its call in the existing `it(...)` body — now always sends `district: 'Есильский район'` per Step 1, so this exact string is safe to assert.)

- [ ] **Step 3: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json realtime-orders.e2e-spec.ts`
Expected: FAIL — `offer.address` is defined (the exact address `'ул. Абая, 1'`), `offer.district` is `undefined`.

- [ ] **Step 4: Fix `src/orders/matching.service.ts`**

In `handleWave`, change the `emitToUser` call:

```ts
    for (const c of candidates) {
      this.gateway.emitToUser(c.id, 'offer:new', {
        orderId,
        category: order.category.name,
        description: order.description,
        district: order.district,
        distanceKm: Math.round((c.meters / 1000) * PostgisRoutingService.ROAD_FACTOR * 10) / 10,
        compensation,
        deadline,
        wave,
      });
    }
```

(Only the `address: order.address` line changes to `district: order.district` — everything else in `handleWave` stays as-is.)

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json realtime-orders.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Run `matching-waves.e2e-spec.ts` to confirm it's unaffected**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json matching-waves.e2e-spec.ts`
Expected: PASS, unchanged — these tests only assert `OrderOffer` table columns (`masterUserId`, `wave`, `outcome`, `attempt`), never the WS payload, so the `address`→`district` field swap doesn't touch them; they only needed the `district`-carrying `createOrderViaApi` from Step 1 to keep passing.

- [ ] **Step 7: Commit**

```bash
git add src/orders/matching.service.ts test/helpers.ts test/realtime-orders.e2e-spec.ts
git commit -m "fix(api): офер шлёт district вместо точного адреса клиента (утечка ПДн до принятия)"
```

---

### Task 10: Live master geolocation relay + ETA

**Files:**
- Modify: `src/realtime/realtime.gateway.ts`
- Modify: `test/realtime-orders.e2e-spec.ts` (existing — Task 9 already touched this file's `offer:new` assertions; this task appends a new `it(...)` case)

**Interfaces:**
- Consumes: `estimateEtaMinutes`/`ASSUMED_SPEED_KMH` (Task 2), `PostgisRoutingService.ROAD_FACTOR` (existing), `PrismaService` (existing, `@Global()`)
- Produces: WS event `master:location` on `user:{clientId}` room, `{ orderId, lat, lng, etaMinutes }`

- [ ] **Step 1: Write the failing test — append inside the `describe('Realtime события заявки (e2e)', ...)` block in `test/realtime-orders.e2e-spec.ts`, after the existing `it(...)`**

This file already defines `connect(url, token)` and `once<T>(socket, event, ms?)` helpers at the top (used by the existing test) — reuse them as-is:

```ts
  it('geo:update от мастера с активной заявкой релеит master:location клиенту', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77100000003');
    const master = await createActiveMaster(app, '+77100000004', plumbing.id, pointAtKm(1));

    const masterSocket = await connect(url, master.token);
    const clientSocket = await connect(url, client.token);

    const order = await createOrderViaApi(app, client.token, plumbing.id);
    await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const locatedPromise = once<any>(clientSocket, 'master:location');
    masterSocket.emit('geo:update', { lat: pointAtKm(0.5).lat, lng: pointAtKm(0.5).lng });
    const located = await locatedPromise;
    expect(located).toMatchObject({ orderId: order.id, lat: expect.any(Number), lng: expect.any(Number), etaMinutes: expect.any(Number) });

    masterSocket.disconnect();
    clientSocket.disconnect();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json realtime-orders.e2e-spec.ts`
Expected: FAIL — timeout waiting for `master:location` (never emitted).

- [ ] **Step 3: Update `src/realtime/realtime.gateway.ts`**

**Scope note:** `PlannedOrder` has no `location` geography column (only `Order` does — the design doc's Task 1 didn't add one, since plotting a live map pin for the planned flow's `CONFIRMED`→`IN_PROGRESS` travel leg was never in the 8-item scope). This task therefore relays `master:location` for **urgent orders only**. If cycle 2's client screens also expect a live map for the planned flow's "мастер едет" state, that's a gap to raise before building that specific screen — not silently patched here.

```ts
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostgisRoutingService } from '../routing/postgis-routing.service';
import { estimateEtaMinutes } from '../routing/eta';

interface GeoPayload {
  lat: number;
  lng: number;
}

const URGENT_EN_ROUTE_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY'];

@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    private readonly prisma: PrismaService,
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
    await this.relayToActiveOrder(socket.data.userId, body.lat, body.lng);
  }

  emitToUser(userId: string, event: string, payload: object): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Мастер с активной срочной заявкой (едет) — шлём его позицию + ETA клиенту заявки. */
  private async relayToActiveOrder(masterUserId: string, lat: number, lng: number): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, status: { in: URGENT_EN_ROUTE_STATUSES } },
    });
    if (!order) return;
    const etaMinutes = await this.etaTo(lat, lng, order.id);
    this.emitToUser(order.clientId, 'master:location', { orderId: order.id, lat, lng, etaMinutes });
  }

  private async etaTo(lat: number, lng: number, orderId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ m: number }[]>`
      SELECT ST_Distance(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, location) AS m
      FROM "Order" WHERE id = ${orderId} AND location IS NOT NULL`;
    if (!rows[0]) return 0;
    const distanceKm = (rows[0].m / 1000) * PostgisRoutingService.ROAD_FACTOR;
    return estimateEtaMinutes(distanceKm);
  }
}
```

- [ ] **Step 4: `RealtimeModule` already has `PrismaService` available**

No change needed to `src/realtime/realtime.module.ts` — `PrismaModule` is `@Global()` (confirmed in `src/prisma/prisma.module.ts`), so `PrismaService` injects into `RealtimeGateway` without adding it to the module's `imports`.

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json realtime-orders.e2e-spec.ts`
Expected: PASS, both cases (the Task 9 district assertion and this task's `master:location` case).

- [ ] **Step 6: Commit**

```bash
git add src/realtime/realtime.gateway.ts test/realtime-orders.e2e-spec.ts
git commit -m "feat(api): релей геопозиции мастера + ETA клиенту срочной заявки"
```

---

### Task 11: Planned order budget + slot (riskiest schema-dependent change — last)

**Files:**
- Modify: `src/planned-orders/dto.ts`
- Modify: `src/planned-orders/planned-order.constants.ts`
- Modify: `src/planned-orders/planned-orders.service.ts`
- Modify: `test/helpers.ts` (`createPlannedOrderViaApi`)
- Modify: `test/planned-orders-create.e2e-spec.ts`

**Interfaces:**
- Consumes: `PlannedOrder.slotStart`/`slotEnd`/`budget` (Task 1 schema)
- Produces: nothing consumed by later tasks — this is the last functional task before doc-sync and verification

- [ ] **Step 1: Replace the two `scheduledAt`-based cases in `test/planned-orders-create.e2e-spec.ts` and add a new one**

The file has exactly two cases referencing `scheduledAt` (`'дата в прошлом — 400'` and `'дата дальше 14 дней — 400'`) plus two that don't (`'создание сразу публикует заявку'` via `createPlannedOrderViaApi`, unaffected here since Step 8 of this task updates that helper; `'GET /planned-orders/mine...'`, also unaffected). Replace the two date-validation cases:

```ts
  it('дата в прошлом — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        slotStart: new Date(Date.now() - 3600_000).toISOString(),
        slotEnd: new Date(Date.now() - 1800_000).toISOString(),
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
        slotStart: new Date(Date.now() + 20 * 24 * 3600_000).toISOString(),
        slotEnd: new Date(Date.now() + 20 * 24 * 3600_000 + 3600_000).toISOString(),
      })
      .expect(400);
  });

  it('slotEnd раньше slotStart — 400', async () => {
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        slotStart: start.toISOString(),
        slotEnd: new Date(start.getTime() - 3600 * 1000).toISOString(),
      })
      .expect(400);
  });
```

(Insert the new `slotEnd раньше slotStart` case right after the two replaced ones, inside the same `describe` block.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-create.e2e-spec.ts`
Expected: FAIL — DTO still expects `scheduledAt`, whitelist strips `slotStart`/`slotEnd`, validation rejects.

- [ ] **Step 3: Update `CreatePlannedOrderDto` in `src/planned-orders/dto.ts`**

```ts
import { ArrayMaxSize, IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressComment?: string;

  @IsISO8601()
  slotStart!: string;

  @IsISO8601()
  slotEnd!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoPaths?: string[];
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

- [ ] **Step 4: Update `FEED_SELECT` in `src/planned-orders/planned-order.constants.ts`**

```ts
export const FEED_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  district: true,
  description: true,
  slotStart: true,
  slotEnd: true,
  budget: true,
  status: true,
  createdAt: true,
  _count: { select: { bids: true } },
} satisfies Prisma.PlannedOrderSelect;
```

- [ ] **Step 5: Update `PlannedOrdersService.create`**

Replace the date-handling block and the `plannedOrder.create` call:

```ts
  async create(clientId: string, dto: CreatePlannedOrderDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const slotStart = new Date(dto.slotStart);
    const slotEnd = new Date(dto.slotEnd);
    const now = new Date();
    const horizon = new Date(now.getTime() + PLANNED_HORIZON_DAYS * 24 * 3600 * 1000);
    if (slotStart <= now) throw new BadRequestException('Дата должна быть в будущем');
    if (slotStart > horizon) {
      throw new BadRequestException(`Дата должна быть не позднее ${PLANNED_HORIZON_DAYS} дней вперёд`);
    }
    if (slotEnd <= slotStart) throw new BadRequestException('Конец слота должен быть позже начала');

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.plannedOrder.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          district: dto.district,
          entrance: dto.entrance ?? null,
          floor: dto.floor ?? null,
          apartment: dto.apartment ?? null,
          addressComment: dto.addressComment ?? null,
          budget: dto.budget ?? null,
          slotStart,
          slotEnd,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      if (dto.photoPaths?.length) {
        await tx.plannedOrderPhoto.createMany({
          data: dto.photoPaths.map((path) => ({ plannedOrderId: created.id, path })),
        });
      }
      return created;
    });
    const delaySeconds = Math.max(0, Math.floor((slotStart.getTime() - Date.now()) / 1000));
    await this.queue.send(JOBS.PLANNED_EXPIRY, { plannedOrderId: order.id }, delaySeconds);
    return this.findOrThrow(order.id);
  }
```

- [ ] **Step 6: Update `emitPlannedStatus`'s `base` object**

Find the line `scheduledAt: order.scheduledAt,` inside `emitPlannedStatus` and replace with `slotStart: order.slotStart, slotEnd: order.slotEnd,`.

- [ ] **Step 7: Update `test/helpers.ts::createPlannedOrderViaApi` (final form)**

```ts
export async function createPlannedOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  overrides: Partial<{
    description: string;
    address: string;
    district: string;
    slotStart: string;
    slotEnd: string;
    budget: number;
    photoPaths: string[];
  }> = {},
) {
  const slotStart = overrides.slotStart ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const slotEnd = overrides.slotEnd ?? new Date(new Date(slotStart).getTime() + 2 * 3600 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post('/api/v1/planned-orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      categoryId,
      description: overrides.description ?? 'Повесить люстру',
      address: overrides.address ?? 'ул. Абая, 1',
      district: overrides.district ?? 'Есильский район',
      slotStart,
      slotEnd,
      budget: overrides.budget,
      photoPaths: overrides.photoPaths,
    })
    .expect(201);
  return res.body;
}
```

This is the single point of change for every other planned-orders e2e file that calls this helper (confirmed during design: only this helper + `dto.ts` + `planned-orders.service.ts` + `planned-orders-create.e2e-spec.ts` reference the date field directly).

- [ ] **Step 8: Run test to verify it passes**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders-create.e2e-spec.ts`
Expected: PASS, all cases including the new `slotEnd < slotStart` case.

- [ ] **Step 9: Run every planned-orders e2e file to confirm no regressions from the helper/field rename**

Run: `DATABASE_URL=postgresql://masterqala:masterqala@localhost:5432/masterqala_test npx jest --config ./test/jest-e2e.json planned-orders`
Expected: all `planned-orders-*.e2e-spec.ts` PASS. If any file directly asserts `body.scheduledAt`, update it to `body.slotStart`/`body.slotEnd`.

- [ ] **Step 10: Commit**

```bash
git add src/planned-orders test/helpers.ts test/planned-orders-create.e2e-spec.ts
git commit -m "feat(api): бюджет и слот (start/end) вместо scheduledAt в плановой заявке"
```

---

### Task 12: Sync `docs/project-spec.md`

**Files:**
- Modify: `docs/project-spec.md`

**Interfaces:**
- Consumes: nothing (documentation only)
- Produces: nothing

- [ ] **Step 1: Update §3.3 (срочная заявка) to mention district-only offers**

Find the step describing the wave broadcast in §3.3 and add a clause: masters in a wave see category, description, district and distance — not the exact address; the exact address is revealed only after `ПРИНЯТА`.

- [ ] **Step 2: Update §3.4 (плановая заявка) — budget and slot**

Find the description of `PlannedOrder` creation fields and replace `scheduledAt` (single date) wording with "слот — начало и конец (`slotStart`/`slotEnd`)" and add the optional `budget` field to the list of client inputs.

- [ ] **Step 3: Update §6 (тарифы/пороги) table**

Add rows: "Лимит фото на заявку — 5, JPEG/PNG ≤10 МБ" and "Минимальная сумма вывода" row's neighbors — insert near the existing photo-related row if one exists, otherwise append to the table.

- [ ] **Step 4: Commit**

```bash
git add docs/project-spec.md
git commit -m "docs: синхронизация спеки с бэкенд-расширениями client v2 (district в офере, слот+бюджет плановой, фото)"
```

---

### Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Rebuild Prisma Client and run full unit suite**

Run: `cd apps/api && npx prisma generate && npx jest`
Expected: all suites PASS (existing 33 + this plan's new `eta.spec.ts` = 34+).

- [ ] **Step 2: Run full e2e suite**

Ensure a test DB is reachable (see Global Constraints), then:
Run: `DATABASE_URL=<test-db-url> npx prisma migrate deploy && DATABASE_URL=<test-db-url> npx jest --config ./test/jest-e2e.json --runInBand`
Expected: all suites PASS except the pre-existing, environment-specific `queue.e2e-spec.ts` port conflict noted in this repo's history (not a regression from this plan — verify by checking the failure is the same `password authentication failed` on port 5433, nothing new).

- [ ] **Step 3: Build**

Run: `cd /path/to/repo/root && pnpm --filter api build`
Expected: exits 0, zero TypeScript errors.

- [ ] **Step 4: Manual smoke check of the two new features that can't be fully expressed in supertest — real file round-trip**

Run: `cd apps/api && pnpm start:dev` (or however the dev server is normally started in this repo — check `package.json`), then in another terminal:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/request-code -H 'Content-Type: application/json' -d '{"phone":"+77099999999"}' > /dev/null; echo "check SmsCode table for the code, then call /auth/verify-code the same way, extract accessToken")
```
(This step is a manual sanity pass, not automated — the point is confirming a real multipart upload + real photo GET round-trips end to end once, since supertest's `.attach()` doesn't catch every real-world multipart edge case. Skip if time-constrained; the e2e suite already covers the logic path.)

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: фиксы по итогам финальной проверки цикла 1 (бэкенд client v2)"
```

(Skip this commit if Steps 1-3 were clean and nothing changed.)
