# Этап 1 «Фундамент» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Монорепо с работающей SMS-аутентификацией, профилями клиентов, онбордингом мастера (анкета + документы) и мини-админкой оператора для верификации (одобрить / отклонить / запросить данные) — по спеке `docs/project-spec.md` §2, §3.1, §3.2, §6.

**Architecture:** pnpm-монорепо: `apps/api` (NestJS + Prisma + PostgreSQL), `apps/web` (Vite + React PWA + Tailwind). Внешние зависимости (SMS-провайдер, файловое хранилище) — за интерфейсами с dev-адаптерами (консольный SMS, локальный диск). БД поднимается в Docker (образ PostGIS — гео-запросы понадобятся на этапе 2, схема этапа 1 их не использует).

**Tech Stack:** Node.js 20+, pnpm 9, NestJS 10, Prisma 5, PostgreSQL 16 (postgis/postgis:16-3.4), Jest + supertest, Vite 5, React 18, React Router 6, TanStack Query 5, Tailwind CSS 4, vite-plugin-pwa.

## Global Constraints

Из спеки (`docs/project-spec.md` §6) — обязательны во всех задачах:

- TTL SMS-кода: **5 минут**; лимит отправки: **3 кода за 10 минут на номер**; попыток ввода кода: **≤5**.
- Телефон нормализуется к формату **`+7XXXXXXXXXX`** (принимаются `8XXXXXXXXXX`, `7XXXXXXXXXX`, `+7XXXXXXXXXX`).
- ИИН: **ровно 12 цифр**.
- Документы: **jpeg/png/pdf, ≤10 МБ**.
- Статусы профиля мастера (enum в коде на английском, в UI по-русски): `PENDING_REVIEW`=НА_ПРОВЕРКЕ, `NEEDS_INFO`=НУЖНЫ_ДАННЫЕ, `ACTIVE`=АКТИВЕН, `REJECTED`=ОТКЛОНЁН.
- Категории фазы 1: сантехника (`plumbing`), электрика (`electrics`).
- Тексты ошибок и UI — на русском. JWT живёт 30 дней. API-префикс `/api/v1`.
- Порты: API 3000, web 5173, БД 5432, тестовая БД 5433.
- Один аккаунт (телефон) может быть и клиентом, и мастером: роль `OPERATOR` — поле `User.role`; «мастер» — это наличие `MasterProfile` со статусом `ACTIVE`.
- Коммит после каждой задачи. Тесты API — e2e через supertest на тестовой БД (порт 5433).

---

### Task 1: Монорепо, Docker Compose, каркас API с healthcheck

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `docker-compose.yml`
- Create: `apps/api/*` (генерируется Nest CLI), `apps/api/src/health.controller.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: —
- Produces: работающий NestJS на `:3000` с префиксом `/api/v1`; `GET /api/v1/health → {status:'ok'}`; docker-compose с БД `masterqala` (5432) и `masterqala_test` (5433); скрипт `pnpm --filter api test:e2e`.

- [ ] **Step 1: Корень монорепо**

```bash
cd /home/erda/Музыка/MasterQala.kz
```

`package.json`:
```json
{
  "name": "masterqala",
  "private": true,
  "packageManager": "pnpm@9.15.0"
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.gitignore`:
```
node_modules/
dist/
.env
uploads/
*.log
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: masterqala
      POSTGRES_PASSWORD: masterqala
      POSTGRES_DB: masterqala
    ports:
      - "5432:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
  db_test:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: masterqala
      POSTGRES_PASSWORD: masterqala
      POSTGRES_DB: masterqala_test
    ports:
      - "5433:5432"
volumes:
  dbdata:
```

- [ ] **Step 2: Поднять БД**

Run: `docker compose up -d && docker compose ps`
Expected: оба контейнера `running (healthy|started)`.

- [ ] **Step 3: Сгенерировать NestJS-приложение**

```bash
mkdir -p apps && cd apps
pnpm dlx @nestjs/cli@10 new api --package-manager pnpm --strict --skip-git
cd .. && pnpm install
```

- [ ] **Step 4: Написать падающий тест healthcheck**

`apps/api/test/health.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health → 200 {status:ok}', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

Run: `pnpm --filter api test:e2e`
Expected: FAIL — 404 (контроллера нет).

- [ ] **Step 5: Реализовать healthcheck и настроить main.ts**

`apps/api/src/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

`apps/api/src/main.ts` (заменить целиком):
```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });
  await app.listen(3000);
}
bootstrap();
```

В `apps/api/src/app.module.ts` добавить `HealthController` в `controllers` (и удалить сгенерированные `AppController`/`AppService` вместе с их файлами и spec-файлами).

- [ ] **Step 6: Тест проходит**

Run: `pnpm --filter api test:e2e`
Expected: PASS (1 passed).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: каркас монорепо, docker-compose с БД, NestJS API с healthcheck"
```

---

### Task 2: Prisma, схема БД, миграция, сиды (категории + оператор)

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/.env`, `apps/api/.env.example`
- Create: `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/test/helpers.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: БД из Task 1.
- Produces: глобальный `PrismaService` (инжектится как `PrismaService`); модели `User`, `SmsCode`, `MasterProfile`, `Category`, `MasterCategory`, `MasterDocument`, `VerificationDecision`; enum'ы `UserRole {CLIENT, OPERATOR}`, `MasterStatus {PENDING_REVIEW, NEEDS_INFO, ACTIVE, REJECTED}`, `DocumentType {ID_CARD, QUALIFICATION}`, `DecisionType {APPROVE, REJECT, REQUEST_INFO}`; тест-хелперы `createTestApp(): Promise<INestApplication>` и `resetDb(app): Promise<void>`; сиды: категории `plumbing`/`electrics`, оператор из env `OPERATOR_PHONE`.

- [ ] **Step 1: Установить Prisma**

```bash
pnpm --filter api add @prisma/client @nestjs/config
pnpm --filter api add -D prisma ts-node
```

- [ ] **Step 2: Схема**

`apps/api/.env` (и копия без секретов в `.env.example`):
```
DATABASE_URL="postgresql://masterqala:masterqala@localhost:5432/masterqala"
JWT_SECRET="dev-secret-change-me"
OPERATOR_PHONE="+77000000001"
UPLOAD_DIR="./uploads"
```

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  CLIENT
  OPERATOR
}

enum MasterStatus {
  PENDING_REVIEW
  NEEDS_INFO
  ACTIVE
  REJECTED
}

enum DocumentType {
  ID_CARD
  QUALIFICATION
}

enum DecisionType {
  APPROVE
  REJECT
  REQUEST_INFO
}

model User {
  id             String         @id @default(uuid())
  phone          String         @unique
  name           String?
  defaultAddress String?
  role           UserRole       @default(CLIENT)
  createdAt      DateTime       @default(now())
  masterProfile  MasterProfile?
  decisions      VerificationDecision[]
}

model SmsCode {
  id        String    @id @default(uuid())
  phone     String
  code      String
  expiresAt DateTime
  attempts  Int       @default(0)
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([phone, createdAt])
}

model Category {
  id      String           @id @default(uuid())
  slug    String           @unique
  name    String
  masters MasterCategory[]
}

model MasterProfile {
  id              String           @id @default(uuid())
  userId          String           @unique
  user            User             @relation(fields: [userId], references: [id])
  fullName        String
  iin             String
  district        String
  experienceYears Int
  status          MasterStatus     @default(PENDING_REVIEW)
  rejectionReason String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  categories      MasterCategory[]
  documents       MasterDocument[]
  decisions       VerificationDecision[]
}

model MasterCategory {
  masterProfileId String
  categoryId      String
  masterProfile   MasterProfile @relation(fields: [masterProfileId], references: [id], onDelete: Cascade)
  category        Category      @relation(fields: [categoryId], references: [id])

  @@id([masterProfileId, categoryId])
}

model MasterDocument {
  id              String        @id @default(uuid())
  masterProfileId String
  masterProfile   MasterProfile @relation(fields: [masterProfileId], references: [id], onDelete: Cascade)
  type            DocumentType
  filePath        String
  originalName    String
  mimeType        String
  sizeBytes       Int
  createdAt       DateTime      @default(now())
}

model VerificationDecision {
  id              String        @id @default(uuid())
  masterProfileId String
  masterProfile   MasterProfile @relation(fields: [masterProfileId], references: [id], onDelete: Cascade)
  operatorId      String
  operator        User          @relation(fields: [operatorId], references: [id])
  decision        DecisionType
  comment         String?
  createdAt       DateTime      @default(now())
}
```

- [ ] **Step 3: Миграция обеих БД**

```bash
cd apps/api
pnpm prisma migrate dev --name init
DATABASE_URL="postgresql://masterqala:masterqala@localhost:5433/masterqala_test" pnpm prisma migrate deploy
cd ../..
```

Expected: `init` применена к обеим БД без ошибок.

- [ ] **Step 4: PrismaService + сиды**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

В `apps/api/src/app.module.ts` импортировать `PrismaModule` и `ConfigModule.forRoot({ isGlobal: true })`.

`apps/api/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { slug: 'plumbing' },
    create: { slug: 'plumbing', name: 'Сантехника' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'electrics' },
    create: { slug: 'electrics', name: 'Электрика' },
    update: {},
  });
  const operatorPhone = process.env.OPERATOR_PHONE;
  if (operatorPhone) {
    await prisma.user.upsert({
      where: { phone: operatorPhone },
      create: { phone: operatorPhone, role: 'OPERATOR', name: 'Оператор' },
      update: { role: 'OPERATOR' },
    });
  }
  console.log('Seed done');
}

main().finally(() => prisma.$disconnect());
```

В `apps/api/package.json` добавить:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```
и в `scripts`:
```json
"test:e2e": "DATABASE_URL=postgresql://masterqala:masterqala@localhost:5433/masterqala_test jest --config ./test/jest-e2e.json --runInBand"
```

- [ ] **Step 5: Тест-хелперы**

`apps/api/test/helpers.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision" CASCADE',
  );
}

export async function seedCategories(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const plumbing = await prisma.category.create({ data: { slug: 'plumbing', name: 'Сантехника' } });
  const electrics = await prisma.category.create({ data: { slug: 'electrics', name: 'Электрика' } });
  return { plumbing, electrics };
}
```

- [ ] **Step 6: Запустить сиды и проверить**

Run: `pnpm --filter api prisma db seed && pnpm --filter api test:e2e`
Expected: `Seed done`; healthcheck-тест по-прежнему PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: схема Prisma (пользователи, мастера, документы, решения), сиды, тест-хелперы"
```

---

### Task 3: Нормализация телефона и SMS-адаптер

**Files:**
- Create: `apps/api/src/common/phone.ts`, `apps/api/src/sms/sms.interface.ts`, `apps/api/src/sms/console-sms.sender.ts`, `apps/api/src/sms/sms.module.ts`
- Test: `apps/api/src/common/phone.spec.ts`

**Interfaces:**
- Consumes: —
- Produces: `normalizePhone(raw: string): string | null` (→ `+7XXXXXXXXXX` или `null`); интерфейс `SmsSender { send(phone: string, text: string): Promise<void> }`; DI-токен `SMS_SENDER: symbol`; модуль `SmsModule`, экспортирующий `SMS_SENDER` (провайдер — `ConsoleSmsSender`, пишет код в лог).

- [ ] **Step 1: Падающий unit-тест нормализации**

`apps/api/src/common/phone.spec.ts`:
```ts
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['+77071234567', '+77071234567'],
    ['87071234567', '+77071234567'],
    ['77071234567', '+77071234567'],
    ['8 (707) 123-45-67', '+77071234567'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each([['12345'], ['+1202555'], ['abc'], ['']])('%s → null', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
```

Run: `pnpm --filter api test -- phone`
Expected: FAIL — модуль `./phone` не найден.

- [ ] **Step 2: Реализация**

`apps/api/src/common/phone.ts`:
```ts
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1);
  }
  return null;
}
```

Run: `pnpm --filter api test -- phone`
Expected: PASS.

- [ ] **Step 3: SMS-адаптер**

`apps/api/src/sms/sms.interface.ts`:
```ts
export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
```

`apps/api/src/sms/console-sms.sender.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms.interface';

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string): Promise<void> {
    this.logger.log(`→ ${phone}: ${text}`);
  }
}
```

`apps/api/src/sms/sms.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SMS_SENDER } from './sms.interface';
import { ConsoleSmsSender } from './console-sms.sender';

@Module({
  providers: [{ provide: SMS_SENDER, useClass: ConsoleSmsSender }],
  exports: [SMS_SENDER],
})
export class SmsModule {}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: нормализация телефона КЗ и SMS-адаптер с консольной реализацией"
```

---

### Task 4: Аутентификация — запрос SMS-кода (TTL 5 мин, лимит 3/10 мин)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `SMS_SENDER`/`SmsSender` (Task 3), `normalizePhone` (Task 3), хелперы (Task 2).
- Produces: `POST /api/v1/auth/request-code {phone} → 204`; `AuthService.requestCode(rawPhone: string): Promise<void>`; ошибки: 400 «Неверный формат номера», 429 «Слишком много запросов кода, попробуйте позже».

- [ ] **Step 1: Падающие e2e-тесты**

`apps/api/test/auth.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth: request-code', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('создаёт код с TTL 5 минут и отвечает 204', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '87071234567' })
      .expect(204);

    const code = await prisma.smsCode.findFirstOrThrow({ where: { phone: '+77071234567' } });
    expect(code.code).toMatch(/^\d{6}$/);
    const ttlMs = code.expiresAt.getTime() - code.createdAt.getTime();
    expect(ttlMs).toBeGreaterThan(4.9 * 60_000);
    expect(ttlMs).toBeLessThan(5.1 * 60_000);
  });

  it('невалидный номер → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '12345' })
      .expect(400);
  });

  it('4-й запрос за 10 минут → 429', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/request-code')
        .send({ phone: '+77071234567' })
        .expect(204);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '+77071234567' })
      .expect(429);
  });
});
```

Run: `pnpm --filter api test:e2e -- auth`
Expected: FAIL — 404 (эндпоинта нет).

- [ ] **Step 2: Реализация**

`apps/api/src/auth/dto.ts`:
```ts
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestCodeDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class VerifyCodeDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
```

`apps/api/src/auth/auth.service.ts`:
```ts
import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_SENDER, SmsSender } from '../sms/sms.interface';
import { normalizePhone } from '../common/phone';

const CODE_TTL_MS = 5 * 60_000;
const SEND_WINDOW_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestCode(rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const windowStart = new Date(Date.now() - SEND_WINDOW_MS);
    const recent = await this.prisma.smsCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recent >= MAX_SENDS_PER_WINDOW) {
      throw new HttpException('Слишком много запросов кода, попробуйте позже', 429);
    }

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.smsCode.create({
      data: { phone, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.sms.send(phone, `Ваш код подтверждения: ${code}`);
  }
}
```

`apps/api/src/auth/auth.controller.ts`:
```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestCodeDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-code')
  @HttpCode(204)
  async requestCode(@Body() dto: RequestCodeDto): Promise<void> {
    await this.auth.requestCode(dto.phone);
  }
}
```

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [SmsModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
```

Импортировать `AuthModule` в `app.module.ts`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter api test:e2e -- auth`
Expected: PASS (3 passed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: запрос SMS-кода с TTL 5 мин и rate-limit 3/10мин"
```

---

### Task 5: Аутентификация — проверка кода, JWT, гарды

**Files:**
- Create: `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/src/auth/roles.guard.ts`, `apps/api/src/auth/current-user.decorator.ts`
- Modify: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts` (дополнить), `apps/api/test/helpers.ts` (дополнить)

**Interfaces:**
- Consumes: Task 4.
- Produces: `POST /api/v1/auth/verify-code {phone, code} → 200 {accessToken, user:{id,phone,name,role}}`; `JwtAuthGuard` (кладёт объект `User` из БД в `request.user`); декоратор `@CurrentUser()` → `User`; `@Roles('OPERATOR')` + `RolesGuard` (403 для прочих); JWT payload `{sub: userId, role}`, срок 30 дней; лимит 5 попыток ввода кода; тест-хелпер `loginAs(app, phone, role?): Promise<{token: string; userId: string}>`.

- [ ] **Step 1: Установить JWT**

```bash
pnpm --filter api add @nestjs/jwt
```

- [ ] **Step 2: Падающие тесты**

Дополнить `apps/api/test/auth.e2e-spec.ts`:
```ts
describe('Auth: verify-code', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function requestAndGetCode(phone: string): Promise<string> {
    await request(app.getHttpServer()).post('/api/v1/auth/request-code').send({ phone }).expect(204);
    const record = await prisma.smsCode.findFirstOrThrow({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    return record.code;
  }

  it('верный код → токен и созданный пользователь', async () => {
    const code = await requestAndGetCode('+77071234567');
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-code')
      .send({ phone: '+77071234567', code })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.phone).toBe('+77071234567');
    expect(res.body.user.role).toBe('CLIENT');
  });

  it('повторный вход тем же номером не создаёт второго пользователя', async () => {
    const code1 = await requestAndGetCode('+77071234567');
    await request(app.getHttpServer()).post('/api/v1/auth/verify-code').send({ phone: '+77071234567', code: code1 }).expect(200);
    const code2 = await requestAndGetCode('+77071234567');
    await request(app.getHttpServer()).post('/api/v1/auth/verify-code').send({ phone: '+77071234567', code: code2 }).expect(200);
    expect(await prisma.user.count()).toBe(1);
  });

  it('неверный код → 400; после 5 неверных попыток верный код тоже отклоняется', async () => {
    const code = await requestAndGetCode('+77071234567');
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-code')
        .send({ phone: '+77071234567', code: '000000' })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-code')
      .send({ phone: '+77071234567', code })
      .expect(400);
  });

  it('использованный код не работает второй раз', async () => {
    const code = await requestAndGetCode('+77071234567');
    await request(app.getHttpServer()).post('/api/v1/auth/verify-code').send({ phone: '+77071234567', code }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/verify-code').send({ phone: '+77071234567', code }).expect(400);
  });
});
```

Run: `pnpm --filter api test:e2e -- auth`
Expected: FAIL — 404 на verify-code.

- [ ] **Step 3: Реализация verify + JWT**

Дополнить `apps/api/src/auth/auth.service.ts` (конструктор получает ещё `private readonly jwt: JwtService`; импорт `JwtService` из `@nestjs/jwt`; константа `const MAX_VERIFY_ATTEMPTS = 5;`):
```ts
async verifyCode(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new BadRequestException('Неверный формат номера');

  const record = await this.prisma.smsCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new BadRequestException('Код не найден или истёк');
  }
  if (record.code !== code) {
    await this.prisma.smsCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new BadRequestException('Неверный код');
  }
  await this.prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
  const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
  return {
    accessToken,
    user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
  };
}
```

В `auth.controller.ts` добавить:
```ts
@Post('verify-code')
@HttpCode(200)
verifyCode(@Body() dto: VerifyCodeDto) {
  return this.auth.verifyCode(dto.phone, dto.code);
}
```

В `auth.module.ts` добавить в imports:
```ts
JwtModule.register({
  global: true,
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  signOptions: { expiresIn: '30d' },
}),
```

- [ ] **Step 4: Гарды и декоратор**

`apps/api/src/auth/jwt-auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Требуется вход');
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Недействительный токен');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    req.user = user;
    return true;
  }
}
```

`apps/api/src/auth/roles.guard.ts`:
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
```

`apps/api/src/auth/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});
```

Дополнить `apps/api/test/helpers.ts`:
```ts
import * as request from 'supertest';
import { UserRole } from '@prisma/client';

export async function loginAs(
  app: INestApplication,
  phone: string,
  role: UserRole = 'CLIENT',
): Promise<{ token: string; userId: string }> {
  const prisma = app.get(PrismaService);
  await request(app.getHttpServer()).post('/api/v1/auth/request-code').send({ phone }).expect(204);
  const code = await prisma.smsCode.findFirstOrThrow({ where: { phone }, orderBy: { createdAt: 'desc' } });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/verify-code')
    .send({ phone, code: code.code })
    .expect(200);
  if (role !== 'CLIENT') {
    await prisma.user.update({ where: { id: res.body.user.id }, data: { role } });
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}
```

- [ ] **Step 5: Тесты проходят**

Run: `pnpm --filter api test:e2e -- auth`
Expected: PASS (все тесты обоих describe).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: проверка SMS-кода, JWT на 30 дней, гарды JwtAuthGuard/RolesGuard"
```

---

### Task 6: Профиль пользователя (GET/PATCH /users/me)

**Files:**
- Create: `apps/api/src/users/users.module.ts`, `apps/api/src/users/users.controller.ts`, `apps/api/src/users/dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/users.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `@CurrentUser()`, `loginAs` (Task 5).
- Produces: `GET /api/v1/users/me → {id, phone, name, defaultAddress, role}`; `PATCH /api/v1/users/me {name?, defaultAddress?}` → обновлённый объект. Без токена — 401.

- [ ] **Step 1: Падающие тесты**

`apps/api/test/users.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Users: me', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('без токена → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET возвращает профиль, PATCH обновляет имя и адрес', async () => {
    const { token } = await loginAs(app, '+77071234567');
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.phone).toBe('+77071234567');
    expect(me.body.name).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ерда', defaultAddress: 'Алматы, ул. Абая 1' })
      .expect(200);
    expect(updated.body.name).toBe('Ерда');
    expect(updated.body.defaultAddress).toBe('Алматы, ул. Абая 1');
  });
});
```

Run: `pnpm --filter api test:e2e -- users`
Expected: FAIL — 404.

- [ ] **Step 2: Реализация**

`apps/api/src/users/dto.ts`:
```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultAddress?: string;
}
```

`apps/api/src/users/users.controller.ts`:
```ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateMeDto } from './dto';

function toDto(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    defaultAddress: user.defaultAddress,
    role: user.role,
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return toDto(user);
  }

  @Patch('me')
  async update(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: dto });
    return toDto(updated);
  }
}
```

`apps/api/src/users/users.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';

@Module({ controllers: [UsersController] })
export class UsersModule {}
```

Импортировать `UsersModule` в `app.module.ts`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter api test:e2e -- users`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: профиль пользователя GET/PATCH /users/me"
```

---

### Task 7: Анкета мастера — подача и просмотр своей заявки

**Files:**
- Create: `apps/api/src/masters/masters.module.ts`, `apps/api/src/masters/masters.service.ts`, `apps/api/src/masters/masters.controller.ts`, `apps/api/src/masters/dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/masters.e2e-spec.ts`

**Interfaces:**
- Consumes: гарды/декораторы (Task 5), `seedCategories`, `loginAs` (Task 2/5).
- Produces: `POST /api/v1/masters/application {fullName, iin, district, experienceYears, categoryIds[]}` → профиль в статусе `PENDING_REVIEW` (201); `GET /api/v1/masters/application` → свой профиль с `categories` и `documents` или 404; `GET /api/v1/categories` → список категорий (публичный). `MastersService.submitApplication(userId, dto)` — при статусах `NEEDS_INFO`/`REJECTED` переподача обновляет данные и возвращает статус в `PENDING_REVIEW`; при `PENDING_REVIEW`/`ACTIVE` — 409.

- [ ] **Step 1: Падающие тесты**

`apps/api/test/masters.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Masters: application', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  function validBody(categoryId: string) {
    return {
      fullName: 'Иванов Иван Иванович',
      iin: '900101300123',
      district: 'Бостандыкский',
      experienceYears: 5,
      categoryIds: [categoryId],
    };
  }

  it('подача анкеты создаёт профиль в статусе PENDING_REVIEW', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(res.body.categories).toHaveLength(1);
  });

  it('невалидный ИИН → 400', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(plumbing.id), iin: '12345' })
      .expect(400);
  });

  it('повторная подача при PENDING_REVIEW → 409', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(409);
  });

  it('переподача после NEEDS_INFO возвращает статус в PENDING_REVIEW', async () => {
    const { plumbing, electrics } = await seedCategories(app);
    const { token, userId } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    await prisma.masterProfile.update({ where: { userId }, data: { status: 'NEEDS_INFO' } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(electrics.id), experienceYears: 6 })
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(res.body.experienceYears).toBe(6);
    expect(res.body.categories[0].category.slug).toBe('electrics');
  });

  it('GET своей заявки: 404 без заявки, 200 с заявкой', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .get('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('GET /categories публичный', async () => {
    await seedCategories(app);
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body).toHaveLength(2);
  });
});
```

Run: `pnpm --filter api test:e2e -- masters`
Expected: FAIL — 404.

- [ ] **Step 2: Реализация**

`apps/api/src/masters/dto.ts`:
```ts
import { ArrayMinSize, IsArray, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SubmitApplicationDto {
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  fullName!: string;

  @Matches(/^\d{12}$/, { message: 'ИИН должен состоять из 12 цифр' })
  iin!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district!: string;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];
}
```

`apps/api/src/masters/masters.service.ts`:
```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  documents: true,
} as const;

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  async submitApplication(userId: string, dto: SubmitApplicationDto) {
    const categories = await this.prisma.category.findMany({ where: { id: { in: dto.categoryIds } } });
    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException('Неизвестная категория');
    }

    const existing = await this.prisma.masterProfile.findUnique({ where: { userId } });
    if (existing && (existing.status === 'PENDING_REVIEW' || existing.status === 'ACTIVE')) {
      throw new ConflictException('Заявка уже на рассмотрении или профиль активен');
    }

    const fields = {
      fullName: dto.fullName,
      iin: dto.iin,
      district: dto.district,
      experienceYears: dto.experienceYears,
      status: 'PENDING_REVIEW' as const,
      rejectionReason: null,
    };

    if (existing) {
      return this.prisma.masterProfile.update({
        where: { id: existing.id },
        data: {
          ...fields,
          categories: {
            deleteMany: {},
            create: dto.categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        include: PROFILE_INCLUDE,
      });
    }
    return this.prisma.masterProfile.create({
      data: {
        ...fields,
        userId,
        categories: { create: dto.categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: PROFILE_INCLUDE,
    });
  }

  async getOwnApplication(userId: string) {
    const profile = await this.prisma.masterProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('Заявка не найдена');
    return profile;
  }
}
```

`apps/api/src/masters/masters.controller.ts`:
```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MastersService } from './masters.service';
import { SubmitApplicationDto } from './dto';

@Controller()
export class MastersController {
  constructor(
    private readonly masters: MastersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('masters/application')
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Body() dto: SubmitApplicationDto) {
    return this.masters.submitApplication(user.id, dto);
  }

  @Get('masters/application')
  @UseGuards(JwtAuthGuard)
  getOwn(@CurrentUser() user: User) {
    return this.masters.getOwnApplication(user.id);
  }
}
```

`apps/api/src/masters/masters.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';

@Module({
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService],
})
export class MastersModule {}
```

Импортировать `MastersModule` в `app.module.ts`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter api test:e2e -- masters`
Expected: PASS (6 passed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: анкета мастера — подача, переподача после NEEDS_INFO, просмотр, категории"
```

---

### Task 8: Загрузка документов мастера (локальное хранилище за интерфейсом)

**Files:**
- Create: `apps/api/src/storage/storage.interface.ts`, `apps/api/src/storage/local-disk.storage.ts`, `apps/api/src/storage/storage.module.ts`
- Modify: `apps/api/src/masters/masters.controller.ts`, `apps/api/src/masters/masters.service.ts`, `apps/api/src/masters/masters.module.ts`, `apps/api/src/masters/dto.ts`
- Test: `apps/api/test/documents.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 7.
- Produces: интерфейс `FileStorage { save(buffer: Buffer, ext: string): Promise<string>; absolutePath(relPath: string): string }`, DI-токен `FILE_STORAGE: symbol`, `LocalDiskStorage` (пишет в `UPLOAD_DIR`, имя файла — uuid); `POST /api/v1/masters/application/documents` (multipart: `file`, поле `type` = `ID_CARD|QUALIFICATION`) → 201 запись `MasterDocument`; правила: только jpeg/png/pdf, ≤10 МБ, только при статусе `PENDING_REVIEW|NEEDS_INFO`.

- [ ] **Step 1: Установить типы multer**

```bash
pnpm --filter api add -D @types/multer
```

- [ ] **Step 2: Падающие тесты**

`apps/api/test/documents.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';

describe('Masters: documents', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function createApplication(token: string, categoryId: string) {
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [categoryId],
      })
      .expect(201);
  }

  it('загрузка png-документа к заявке → 201', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await createApplication(token, plumbing.id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'udo.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.type).toBe('ID_CARD');
    expect(res.body.originalName).toBe('udo.png');
  });

  it('недопустимый mime-тип → 400', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await createApplication(token, plumbing.id);

    await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' })
      .expect(400);
  });

  it('без заявки → 404', async () => {
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89]), { filename: 'x.png', contentType: 'image/png' })
      .expect(404);
  });
});
```

Run: `pnpm --filter api test:e2e -- documents`
Expected: FAIL — 404.

- [ ] **Step 3: Хранилище**

`apps/api/src/storage/storage.interface.ts`:
```ts
export interface FileStorage {
  save(buffer: Buffer, ext: string): Promise<string>;
  absolutePath(relPath: string): string;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
```

`apps/api/src/storage/local-disk.storage.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { FileStorage } from './storage.interface';

@Injectable()
export class LocalDiskStorage implements FileStorage {
  private readonly dir = resolve(process.env.UPLOAD_DIR ?? './uploads');

  async save(buffer: Buffer, ext: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const relPath = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, relPath), buffer);
    return relPath;
  }

  absolutePath(relPath: string): string {
    return join(this.dir, relPath);
  }
}
```

`apps/api/src/storage/storage.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './storage.interface';
import { LocalDiskStorage } from './local-disk.storage';

@Module({
  providers: [{ provide: FILE_STORAGE, useClass: LocalDiskStorage }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
```

- [ ] **Step 4: Эндпоинт загрузки**

В `apps/api/src/masters/dto.ts` добавить:
```ts
import { IsEnum } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}
```

В `masters.service.ts` добавить (конструктор получает ещё `@Inject(FILE_STORAGE) private readonly storage: FileStorage`):
```ts
private static readonly ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
static readonly MAX_FILE_BYTES = 10 * 1024 * 1024;

async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
  const profile = await this.prisma.masterProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundException('Сначала заполните анкету');
  if (profile.status !== 'PENDING_REVIEW' && profile.status !== 'NEEDS_INFO') {
    throw new ConflictException('Документы можно загружать только пока заявка на проверке');
  }
  const ext = MastersService.ALLOWED_MIME[file.mimetype];
  if (!ext) throw new BadRequestException('Допустимы только JPEG, PNG и PDF');
  if (file.size > MastersService.MAX_FILE_BYTES) {
    throw new BadRequestException('Файл больше 10 МБ');
  }
  const relPath = await this.storage.save(file.buffer, ext);
  return this.prisma.masterDocument.create({
    data: {
      masterProfileId: profile.id,
      type,
      filePath: relPath,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });
}
```

В `masters.controller.ts` добавить:
```ts
import { UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadDocumentDto } from './dto';

@Post('masters/application/documents')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('file'))
uploadDocument(
  @CurrentUser() user: User,
  @Body() dto: UploadDocumentDto,
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) throw new BadRequestException('Файл обязателен');
  return this.masters.uploadDocument(user.id, dto.type, file);
}
```

В `masters.module.ts` импортировать `StorageModule`.

- [ ] **Step 5: Тесты проходят**

Run: `pnpm --filter api test:e2e -- documents`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: загрузка документов мастера, локальное хранилище за интерфейсом FileStorage"
```

---

### Task 9: Админка оператора — список и детали заявок, скачивание документов

**Files:**
- Create: `apps/api/src/admin/admin.module.ts`, `apps/api/src/admin/admin.controller.ts`, `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/admin.e2e-spec.ts`

**Interfaces:**
- Consumes: `Roles`/`RolesGuard`/`JwtAuthGuard` (Task 5), `FILE_STORAGE` (Task 8), `loginAs` с ролью `OPERATOR`.
- Produces: `GET /api/v1/admin/applications?status=PENDING_REVIEW` → список `{id, fullName, district, status, createdAt, user:{phone}, categories}`; `GET /api/v1/admin/applications/:id` → полная заявка с документами и журналом решений; `GET /api/v1/admin/applications/:id/documents/:docId` → файл (StreamableFile). Не-оператору — 403.

- [ ] **Step 1: Падающие тесты**

`apps/api/test/admin.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';

describe('Admin: applications', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function submitApplication(phone: string) {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, phone);
    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [plumbing.id],
      })
      .expect(201);
    return { masterToken: token, profileId: res.body.id as string };
  }

  it('клиенту доступ запрещён → 403', async () => {
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .get('/api/v1/admin/applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('оператор видит список с фильтром по статусу и детали', async () => {
    const { profileId } = await submitApplication('+77071234567');
    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/applications?status=PENDING_REVIEW')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].user.phone).toBe('+77071234567');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${profileId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(detail.body.iin).toBe('900101300123');
    expect(detail.body.decisions).toEqual([]);
  });

  it('оператор скачивает документ мастера', async () => {
    const { masterToken, profileId } = await submitApplication('+77071234567');
    const upload = await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${masterToken}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89, 0x50]), { filename: 'udo.png', contentType: 'image/png' })
      .expect(201);

    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${profileId}/documents/${upload.body.id}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
  });
});
```

Run: `pnpm --filter api test:e2e -- admin`
Expected: FAIL — 404.

- [ ] **Step 2: Реализация**

`apps/api/src/admin/admin.service.ts`:
```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../storage/storage.interface';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  listApplications(status?: MasterStatus) {
    return this.prisma.masterProfile.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        district: true,
        status: true,
        createdAt: true,
        user: { select: { phone: true } },
        categories: { include: { category: true } },
      },
    });
  }

  async getApplication(id: string) {
    const profile = await this.prisma.masterProfile.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true } },
        categories: { include: { category: true } },
        documents: true,
        decisions: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { name: true, phone: true } } },
        },
      },
    });
    if (!profile) throw new NotFoundException('Заявка не найдена');
    return profile;
  }

  async getDocumentStream(profileId: string, docId: string) {
    const doc = await this.prisma.masterDocument.findFirst({
      where: { id: docId, masterProfileId: profileId },
    });
    if (!doc) throw new NotFoundException('Документ не найден');
    return { stream: createReadStream(this.storage.absolutePath(doc.filePath)), doc };
  }
}
```

`apps/api/src/admin/admin.controller.ts`:
```ts
import { Controller, Get, Param, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Query('status') status?: MasterStatus) {
    return this.admin.listApplications(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.admin.getApplication(id);
  }

  @Get(':id/documents/:docId')
  async document(@Param('id') id: string, @Param('docId') docId: string) {
    const { stream, doc } = await this.admin.getDocumentStream(id, docId);
    return new StreamableFile(stream, { type: doc.mimeType, disposition: 'inline' });
  }
}
```

`apps/api/src/admin/admin.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [StorageModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
```

Импортировать `AdminModule` в `app.module.ts`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter api test:e2e -- admin`
Expected: PASS (3 passed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: админка оператора — список заявок, детали, скачивание документов"
```

---

### Task 10: Решение оператора (одобрить / отклонить / запросить данные) + журнал

**Files:**
- Create: `apps/api/src/admin/dto.ts`
- Modify: `apps/api/src/admin/admin.service.ts`, `apps/api/src/admin/admin.controller.ts`
- Test: `apps/api/test/admin-decision.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 9.
- Produces: `POST /api/v1/admin/applications/:id/decision {decision: 'APPROVE'|'REJECT'|'REQUEST_INFO', comment?}` → обновлённый профиль. Переходы (спека §3.1): только из `PENDING_REVIEW`; `APPROVE→ACTIVE`, `REJECT→REJECTED` (comment обязателен, пишется в `rejectionReason`), `REQUEST_INFO→NEEDS_INFO` (comment обязателен). Каждое решение — строка в `VerificationDecision` с `operatorId`. Иначе: не из `PENDING_REVIEW` → 409; `REJECT`/`REQUEST_INFO` без comment → 400.

- [ ] **Step 1: Падающие тесты**

`apps/api/test/admin-decision.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin: decision', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function setup() {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [plumbing.id],
      })
      .expect(201);
    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    return { profileId: res.body.id as string, opToken };
  }

  it('APPROVE → ACTIVE + запись в журнале', async () => {
    const { profileId, opToken } = await setup();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'APPROVE' })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(await prisma.verificationDecision.count({ where: { masterProfileId: profileId } })).toBe(1);
  });

  it('REJECT без комментария → 400; с комментарием → REJECTED с причиной', async () => {
    const { profileId, opToken } = await setup();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REJECT' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REJECT', comment: 'Документы нечитаемы' })
      .expect(201);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Документы нечитаемы');
  });

  it('REQUEST_INFO → NEEDS_INFO; повторное решение по той же заявке → 409', async () => {
    const { profileId, opToken } = await setup();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REQUEST_INFO', comment: 'Приложите подтверждение квалификации' })
      .expect(201);
    expect(res.body.status).toBe('NEEDS_INFO');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'APPROVE' })
      .expect(409);
  });
});
```

Run: `pnpm --filter api test:e2e -- admin-decision`
Expected: FAIL — 404.

- [ ] **Step 2: Реализация**

`apps/api/src/admin/dto.ts`:
```ts
import { DecisionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecisionDto {
  @IsEnum(DecisionType)
  decision!: DecisionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
```

В `admin.service.ts` добавить (импорт `BadRequestException`, `ConflictException`, `DecisionType` и `DecisionDto`):
```ts
private static readonly TRANSITIONS: Record<DecisionType, MasterStatus> = {
  APPROVE: 'ACTIVE',
  REJECT: 'REJECTED',
  REQUEST_INFO: 'NEEDS_INFO',
};

async decide(operatorId: string, profileId: string, dto: DecisionDto) {
  const profile = await this.prisma.masterProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new NotFoundException('Заявка не найдена');
  if (profile.status !== 'PENDING_REVIEW') {
    throw new ConflictException('Заявка не находится на рассмотрении');
  }
  if (dto.decision !== 'APPROVE' && !dto.comment) {
    throw new BadRequestException('Укажите причину решения');
  }
  const [updated] = await this.prisma.$transaction([
    this.prisma.masterProfile.update({
      where: { id: profileId },
      data: {
        status: AdminService.TRANSITIONS[dto.decision],
        rejectionReason: dto.decision === 'REJECT' ? dto.comment : null,
      },
    }),
    this.prisma.verificationDecision.create({
      data: {
        masterProfileId: profileId,
        operatorId,
        decision: dto.decision,
        comment: dto.comment,
      },
    }),
  ]);
  return updated;
}
```

В `admin.controller.ts` добавить:
```ts
import { Body, Post } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { DecisionDto } from './dto';

@Post(':id/decision')
decide(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: DecisionDto) {
  return this.admin.decide(operator.id, id, dto);
}
```

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter api test:e2e` (весь набор)
Expected: PASS — все спеки зелёные.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: решение оператора по заявке мастера с журналом верификации"
```

---

### Task 11: Каркас web-приложения (Vite + React PWA + Tailwind) и вход по SMS

**Files:**
- Create: `apps/web/*` (генерируется Vite), `apps/web/src/api.ts`, `apps/web/src/auth.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/HomePage.tsx`, `apps/web/src/App.tsx`
- Modify: `apps/web/vite.config.ts`, `apps/web/src/index.css`, `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: API Task 4–6 (`/auth/request-code`, `/auth/verify-code`, `/users/me`).
- Produces: PWA на `:5173`; `api(path, options?)` и `apiUpload(path, formData)` — fetch-обёртки с Bearer-токеном из `localStorage('token')`; `useAuth()` контекст `{user, login(token, user), logout()}`; роуты `/login`, `/` (защищённый — редирект на `/login` без токена); страница Home с редактированием имени/адреса.

- [ ] **Step 1: Скаффолд**

```bash
cd apps
pnpm create vite web --template react-ts
cd web
pnpm add react-router-dom @tanstack/react-query tailwindcss @tailwindcss/vite
pnpm add -D vite-plugin-pwa
cd ../.. && pnpm install
```

- [ ] **Step 2: Конфигурация**

`apps/web/vite.config.ts` (заменить целиком):
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MasterQala',
        short_name: 'MasterQala',
        theme_color: '#0f766e',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
});
```

`apps/web/src/index.css` (заменить целиком):
```css
@import "tailwindcss";
```

- [ ] **Step 3: API-клиент и контекст авторизации**

`apps/web/src/api.ts`:
```ts
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Ошибка ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  return handle(res);
}

export async function apiUpload(path: string, formData: FormData) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handle(res);
}
```

`apps/web/src/auth.tsx`:
```tsx
import { createContext, useContext, useState, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'CLIENT' | 'OPERATOR';
}

interface AuthCtx {
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = (token: string, u: AuthUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
```

- [ ] **Step 4: Страницы входа и Home, роутер**

`apps/web/src/pages/LoginPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function requestCode() {
    setError('');
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone }) });
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError('');
    try {
      const res = await api('/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone, code }) });
      login(res.accessToken, res.user);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Вход</h1>
      {step === 'phone' ? (
        <>
          <input
            className="w-full rounded border p-3"
            placeholder="+7 707 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={requestCode}>
            Получить код
          </button>
        </>
      ) : (
        <>
          <input
            className="w-full rounded border p-3"
            placeholder="Код из SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={verify}>
            Войти
          </button>
        </>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

`apps/web/src/pages/HomePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function HomePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/users/me').then((me) => {
      setName(me.name ?? '');
      setAddress(me.defaultAddress ?? '');
    });
  }, []);

  async function save() {
    await api('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, defaultAddress: address }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Профиль</h1>
        <button className="text-sm text-gray-500" onClick={logout}>Выйти</button>
      </div>
      <p className="text-gray-600">{user?.phone}</p>
      <input className="w-full rounded border p-3" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full rounded border p-3" placeholder="Адрес по умолчанию" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={save}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>
      <Link to="/become-master" className="block text-center text-teal-700 underline">
        Стать мастером
      </Link>
      {user?.role === 'OPERATOR' && (
        <Link to="/admin" className="block text-center text-teal-700 underline">
          Панель оператора
        </Link>
      )}
    </div>
  );
}
```

`apps/web/src/App.tsx` (заменить целиком):
```tsx
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

`apps/web/src/main.tsx` (заменить целиком):
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Удалить `apps/web/src/App.css` и `apps/web/src/assets/react.svg` (не используются).

- [ ] **Step 5: Проверка сборки и ручная проверка**

Run: `pnpm --filter web build`
Expected: сборка без ошибок TypeScript.

Ручная проверка: запустить API (`pnpm --filter api start:dev`) и web (`pnpm --filter web dev`), открыть `http://localhost:5173` → ввести телефон → взять код из лога API (`SMS → +7…: Ваш код…`) → войти → сохранить имя/адрес → перезагрузить страницу, данные на месте.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: web PWA — вход по SMS-коду, страница профиля"
```

---

### Task 12: Web — анкета мастера, загрузка документов, экран статуса

**Files:**
- Create: `apps/web/src/pages/BecomeMasterPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: API Task 7–8 (`/categories`, `/masters/application`, `/masters/application/documents`), `api`/`apiUpload` (Task 11).
- Produces: роут `/become-master`: если заявки нет — форма (ФИО, ИИН, район, опыт, чекбоксы категорий) + после подачи блок загрузки документов (удостоверение, квалификация); если заявка есть — статус по-русски (НА ПРОВЕРКЕ / НУЖНЫ ДАННЫЕ / АКТИВЕН / ОТКЛОНЁН + причина), при `NEEDS_INFO`/`REJECTED` — кнопка «Подать заново» (открывает форму с текущими значениями).

- [ ] **Step 1: Страница**

`apps/web/src/pages/BecomeMasterPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUpload } from '../api';

interface Category { id: string; slug: string; name: string }
interface Doc { id: string; type: string; originalName: string }
interface Application {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';
  rejectionReason: string | null;
  categories: { category: Category }[];
  documents: Doc[];
}

const STATUS_RU: Record<Application['status'], string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны дополнительные данные',
  ACTIVE: 'Активен — вы мастер!',
  REJECTED: 'Отклонена',
};

const DOC_TYPES = [
  { value: 'ID_CARD', label: 'Удостоверение личности' },
  { value: 'QUALIFICATION', label: 'Подтверждение квалификации' },
];

export default function BecomeMasterPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ fullName: '', iin: '', district: '', experienceYears: 0 });
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const cats = await api('/categories');
    setCategories(cats);
    try {
      const a = await api('/masters/application');
      setApp(a);
      setForm({ fullName: a.fullName, iin: a.iin, district: a.district, experienceYears: a.experienceYears });
      setSelectedCats(a.categories.map((c: { category: Category }) => c.category.id));
    } catch {
      setApp(null);
    }
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setError('');
    try {
      await api('/masters/application', {
        method: 'POST',
        body: JSON.stringify({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats }),
      });
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(type: string, file: File) {
    setError('');
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);
    try {
      await apiUpload('/masters/application/documents', fd);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!loaded) return <p className="p-6">Загрузка…</p>;

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <h1 className="text-2xl font-bold">Стать мастером</h1>

      {app && !editing && (
        <div className="rounded border p-4 space-y-2">
          <p className="font-semibold">Статус: {STATUS_RU[app.status]}</p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <p className="text-red-600">Причина: {app.rejectionReason}</p>
          )}
          {canResubmit && (
            <button className="rounded bg-teal-700 px-4 py-2 text-white" onClick={() => setEditing(true)}>
              Подать заново
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-3">
          <input className="w-full rounded border p-3" placeholder="ФИО полностью" value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="w-full rounded border p-3" placeholder="ИИН (12 цифр)" value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })} />
          <input className="w-full rounded border p-3" placeholder="Район" value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <input className="w-full rounded border p-3" type="number" placeholder="Опыт, лет" value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} />
          <fieldset className="space-y-1">
            <legend className="font-semibold">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={(e) =>
                    setSelectedCats(e.target.checked
                      ? [...selectedCats, c.id]
                      : selectedCats.filter((id) => id !== c.id))
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={submit}>
            Отправить на проверку
          </button>
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Документы</h2>
          {DOC_TYPES.map((dt) => (
            <div key={dt.value}>
              <label className="block text-sm">{dt.label}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => e.target.files?.[0] && upload(dt.value, e.target.files[0])}
              />
              <ul className="text-sm text-gray-600">
                {app!.documents.filter((d) => d.type === dt.value).map((d) => (
                  <li key={d.id}>✓ {d.originalName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

В `apps/web/src/App.tsx` добавить импорт и роут внутри `<Route element={<RequireAuth />}>`:
```tsx
import BecomeMasterPage from './pages/BecomeMasterPage';
// ...
<Route path="/become-master" element={<BecomeMasterPage />} />
```

- [ ] **Step 2: Проверка**

Run: `pnpm --filter web build`
Expected: сборка без ошибок.

Ручная проверка: войти → «Стать мастером» → заполнить анкету (ИИН 12 цифр) → отправить → статус «На проверке» → загрузить png → файл в списке с ✓.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: web — анкета мастера, загрузка документов, экран статуса"
```

---

### Task 13: Web — панель оператора

**Files:**
- Create: `apps/web/src/pages/AdminListPage.tsx`, `apps/web/src/pages/AdminDetailPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: API Task 9–10 (`/admin/applications`, `/admin/applications/:id`, `/admin/applications/:id/decision`, `/admin/applications/:id/documents/:docId`), `useAuth` (Task 11).
- Produces: роуты `/admin` (список с фильтром по статусу, по умолчанию `PENDING_REVIEW`) и `/admin/:id` (детали: анкета, документы ссылками, журнал решений, кнопки «Одобрить» / «Запросить данные» / «Отклонить» с полем причины). Доступ только `role==='OPERATOR'` (иначе редирект на `/`).

- [ ] **Step 1: Страницы**

`apps/web/src/pages/AdminListPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Row {
  id: string;
  fullName: string;
  district: string;
  status: string;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
}

const STATUSES = [
  { value: 'PENDING_REVIEW', label: 'На проверке' },
  { value: 'NEEDS_INFO', label: 'Нужны данные' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'REJECTED', label: 'Отклонённые' },
];

export default function AdminListPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/applications?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <h1 className="text-2xl font-bold">Заявки мастеров</h1>
      <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/${r.id}`} className="block p-3 hover:bg-gray-50">
              <span className="font-semibold">{r.fullName}</span> · {r.user.phone} · {r.district} ·{' '}
              {r.categories.map((c) => c.category.name).join(', ')}
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
```

`apps/web/src/pages/AdminDetailPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface Detail {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: string;
  rejectionReason: string | null;
  user: { phone: string };
  categories: { category: { name: string } }[];
  documents: { id: string; type: string; originalName: string }[];
  decisions: { id: string; decision: string; comment: string | null; createdAt: string; operator: { phone: string } }[];
}

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/applications/${id}`).then(setDetail);
  }, [id]);

  async function decide(decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') {
    setError('');
    try {
      await api(`/admin/applications/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: comment || undefined }),
      });
      navigate('/admin');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openDoc(docId: string) {
    const res = await fetch(`${API}/admin/applications/${id}/documents/${docId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  if (!detail) return <p className="p-6">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К списку</Link>
      <h1 className="text-2xl font-bold">{detail.fullName}</h1>
      <div className="rounded border p-4 space-y-1">
        <p>Телефон: {detail.user.phone}</p>
        <p>ИИН: {detail.iin}</p>
        <p>Район: {detail.district}</p>
        <p>Опыт: {detail.experienceYears} лет</p>
        <p>Категории: {detail.categories.map((c) => c.category.name).join(', ')}</p>
        <p>Статус: {detail.status}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-semibold">Документы</h2>
        {detail.documents.length === 0 && <p className="text-gray-500">Нет документов</p>}
        <ul>
          {detail.documents.map((d) => (
            <li key={d.id}>
              <button className="text-teal-700 underline" onClick={() => openDoc(d.id)}>
                {d.type === 'ID_CARD' ? 'Удостоверение' : 'Квалификация'}: {d.originalName}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {detail.status === 'PENDING_REVIEW' && (
        <div className="rounded border p-4 space-y-3">
          <textarea
            className="w-full rounded border p-2"
            placeholder="Комментарий (обязателен для отклонения и запроса данных)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded bg-green-700 px-4 py-2 text-white" onClick={() => decide('APPROVE')}>Одобрить</button>
            <button className="rounded bg-yellow-600 px-4 py-2 text-white" onClick={() => decide('REQUEST_INFO')}>Запросить данные</button>
            <button className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => decide('REJECT')}>Отклонить</button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}

      <div className="rounded border p-4">
        <h2 className="font-semibold">Журнал решений</h2>
        {detail.decisions.length === 0 && <p className="text-gray-500">Решений не было</p>}
        <ul className="text-sm">
          {detail.decisions.map((d) => (
            <li key={d.id}>
              {new Date(d.createdAt).toLocaleString('ru-RU')} — {d.decision} ({d.operator.phone})
              {d.comment && `: ${d.comment}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

В `apps/web/src/App.tsx` добавить гард оператора и роуты:
```tsx
import AdminListPage from './pages/AdminListPage';
import AdminDetailPage from './pages/AdminDetailPage';

function RequireOperator() {
  const { user } = useAuth();
  return user?.role === 'OPERATOR' ? <Outlet /> : <Navigate to="/" replace />;
}
```
и внутри `<Route element={<RequireAuth />}>`:
```tsx
<Route element={<RequireOperator />}>
  <Route path="/admin" element={<AdminListPage />} />
  <Route path="/admin/:id" element={<AdminDetailPage />} />
</Route>
```

- [ ] **Step 2: Проверка**

Run: `pnpm --filter web build`
Expected: сборка без ошибок.

Ручная проверка: войти оператором (`+77000000001`, код из лога API) → «Панель оператора» → открыть заявку → открыть документ → «Запросить данные» с комментарием → мастер видит «Нужны дополнительные данные» и может податься заново → оператор одобряет → статус «Активен».

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: web — панель оператора: список заявок, детали, решения"
```

---

### Task 14: README и финальная верификация

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: всё выше.
- Produces: README с инструкцией запуска; полный прогон тестов и сборки.

- [ ] **Step 1: README**

`README.md`:
```markdown
# MasterQala.kz

Платформа вызова мастеров (Казахстан). Спека: `docs/project-spec.md`.

## Структура

- `apps/api` — NestJS + Prisma + PostgreSQL (API)
- `apps/web` — Vite + React PWA (клиенты, мастера, оператор)

## Запуск разработки

```bash
docker compose up -d                 # БД (5432) и тестовая БД (5433)
pnpm install
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ../..
pnpm --filter api start:dev          # API на :3000
pnpm --filter web dev                # Web на :5173
```

SMS-коды в dev пишутся в лог API (`SMS → +7…`). Оператор из сидов: `+77000000001`.

## Тесты

```bash
pnpm --filter api test               # unit
pnpm --filter api test:e2e           # e2e (нужна db_test на :5433)
```
```

- [ ] **Step 2: Полная верификация**

Run:
```bash
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter web build
```
Expected: все команды зелёные, без ошибок.

Ручной сквозной сценарий (по спеке §3.1): клиент регистрируется → подаёт анкету мастера → грузит документы → оператор запрашивает данные → мастер переподаётся → оператор одобряет → статус АКТИВЕН.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README с инструкцией запуска этапа 1"
```
