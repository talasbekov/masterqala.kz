# Этап 6 «Оператор (desktop)» — Цикл A (бэкенд) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в `apps/api` бэкенд-эндпоинты, нужные панели оператора (desktop-редизайн, Цикл B): заказы (список/деталь/ручное назначение), пользователи (список/блокировка), мастера (список), метрики дашборда, и общий журнал действий (`AuditLog`), покрывающий и решения оператора, и авто-события системы.

**Architecture:** Каждая новая admin-поверхность — отдельный тонкий NestJS-модуль (`admin-users`, `admin-masters`, `admin-orders`, `admin-metrics`) со своим контроллером+сервисом, читающим `PrismaService` напрямую (по прецеденту `AdminController`/`DisputesService.listAll`). Мутации, требующие транзакционной атомарности с бизнес-логикой (ручное назначение заказа), живут в существующем `OrdersService`, а не дублируются. Общий `AuditLogService` (новый модуль `audit-log`) — единственная точка записи журнала, инжектится во все места решений (существующие: `AdminService.decide`, `DisputesService.resolve`, `OrdersService.handleAutoClose`, `MasterPenaltyService.penalizeForCancellation`; новые: `AdminUsersService.block/unblock`, `OrdersService.manualAssign`).

**Tech Stack:** NestJS, Prisma (PostgreSQL + PostGIS), Jest (unit + e2e через `test/jest-e2e.json`), class-validator DTO.

## Global Constraints

- Спека: [docs/superpowers/specs/2026-07-20-stage6-operator-backend-design.md](../specs/2026-07-20-stage6-operator-backend-design.md) — все эндпоинты/схема/точки AuditLog взяты оттуда дословно.
- Все admin-роуты — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('OPERATOR')`, по образцу `AdminController`/`AdminDisputesController`.
- Перед каждым e2e-прогоном чистить `/tmp/jest_rs`, гонять с `--runInBand` (известная причуда `ts-jest`/`AppModule`-компиляции всего графа разом — см. память проекта).
- Никаких изменений в клиентском/мастерском UI или бизнес-flow, кроме проверки `isBlocked` на вход (Task 2).
- TDD: каждый шаг с кодом — RED (тест написан, прогнан, упал) → GREEN (минимальная реализация, тест прошёл) → commit.

---

## Task 1: `AuditLog` + `User.isBlocked` — схема и `AuditLogService`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/audit-log/audit-log.module.ts`
- Create: `apps/api/src/audit-log/audit-log.service.ts`
- Test: `apps/api/src/audit-log/audit-log.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `AuditLogService.write(entry: AuditLogEntry, client?: Prisma.TransactionClient | PrismaService): Promise<void>`, `AuditLogService.list(page?: number, pageSize?: number): Promise<{rows, total, page, pageSize}>`, exported from `AuditLogModule`.

- [ ] **Step 1: Добавить модели в схему**

В `apps/api/prisma/schema.prisma` добавить после блока `enum DecisionType { ... }`:

```prisma
enum AuditActorType {
  OPERATOR
  SYSTEM
}

enum AuditTargetType {
  MASTER_PROFILE
  USER
  ORDER
  PLANNED_ORDER
  DISPUTE
}
```

Добавить модель `AuditLog` в конец файла:

```prisma
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

В модель `User` добавить поля и обратную связь:

```prisma
model User {
  ...
  isBlocked      Boolean    @default(false)
  blockedAt      DateTime?
  blockedReason  String?
  auditLogs      AuditLog[]
}
```

- [ ] **Step 2: Прогнать миграцию**

```bash
cd apps/api && npx prisma migrate dev --name add_audit_log_and_user_blocking
```

Ожидается: миграция создана и применена, `npx prisma generate` выполнен автоматически (проверить, что `@prisma/client` содержит `AuditLog`, `AuditActorType`, `AuditTargetType`).

- [ ] **Step 3: Написать падающий unit-тест `AuditLogService`**

Создать `apps/api/src/audit-log/audit-log.service.spec.ts`:

```typescript
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('writes an audit entry using the provided transaction client', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { auditLog: { create } } as any;
    const service = new AuditLogService({} as any);

    await service.write(
      { actorType: 'OPERATOR', actorId: 'op-1', action: 'USER_BLOCKED', targetType: 'USER', targetId: 'u-1', comment: 'spam' },
      tx,
    );

    expect(create).toHaveBeenCalledWith({
      data: { actorType: 'OPERATOR', actorId: 'op-1', action: 'USER_BLOCKED', targetType: 'USER', targetId: 'u-1', comment: 'spam' },
    });
  });

  it('defaults to the injected PrismaService when no transaction client is given', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { auditLog: { create } } as any;
    const service = new AuditLogService(prisma);

    await service.write({ actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: 'o-1' });

    expect(create).toHaveBeenCalledWith({
      data: { actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: 'o-1' },
    });
  });

  it('paginates journal entries newest-first', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { auditLog: { findMany, count }, $transaction: (ops: Promise<any>[]) => Promise.all(ops) } as any;
    const service = new AuditLogService(prisma);

    const result = await service.list(2, 10);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } }));
    expect(result).toEqual({ rows: [{ id: 'a' }], total: 1, page: 2, pageSize: 10 });
  });
});
```

- [ ] **Step 4: Запустить тест, убедиться что падает**

```bash
cd apps/api && npx jest src/audit-log/audit-log.service.spec.ts
```

Ожидается: FAIL — `Cannot find module './audit-log.service'`.

- [ ] **Step 5: Реализовать `AuditLogService` и `AuditLogModule`**

Создать `apps/api/src/audit-log/audit-log.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuditActorType, AuditTargetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  comment?: string | null;
}

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditLogEntry, client: TxOrPrisma = this.prisma): Promise<void> {
    await client.auditLog.create({ data: entry });
  }

  async list(page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { actor: { select: { name: true, phone: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { rows, total, page, pageSize };
  }
}
```

Создать `apps/api/src/audit-log/audit-log.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
```

- [ ] **Step 6: Запустить тест, убедиться что проходит**

```bash
cd apps/api && npx jest src/audit-log/audit-log.service.spec.ts
```

Ожидается: PASS, 3/3.

- [ ] **Step 7: Зарегистрировать модуль в `AppModule`**

В `apps/api/src/app.module.ts` добавить импорт и в массив `imports`:

```typescript
import { AuditLogModule } from './audit-log/audit-log.module';
// ...
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule,
  CommonModule,
  QueueModule,
  AuditLogModule,
  AuthModule,
  // ... остальные без изменений
],
```

- [ ] **Step 8: Собрать проект**

```bash
cd apps/api && npx tsc --noEmit
```

Ожидается: без ошибок.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/audit-log apps/api/src/app.module.ts
git commit -m "feat(api): AuditLog + User.isBlocked — схема и AuditLogService"
```

---

## Task 2: Блокировка пользователя — enforcement в auth

**Files:**
- Modify: `apps/api/src/auth/jwt-auth.guard.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Test: `apps/api/test/auth-blocked.e2e-spec.ts`

**Interfaces:**
- Consumes: `User.isBlocked` (Task 1).
- Produces: заблокированный пользователь получает `403 Forbidden` и на защищённых роутах, и при попытке получить новый токен через `verify-code`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/auth-blocked.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Blocked user enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('rejects an already-issued token once the user is blocked', async () => {
    const client = await loginAs(app, '+77011112233');
    await prisma.user.update({
      where: { id: client.userId },
      data: { isBlocked: true, blockedAt: new Date(), blockedReason: 'жалобы' },
    });

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('refuses to issue a new token for a blocked user', async () => {
    const client = await loginAs(app, '+77011112233');
    await prisma.user.update({ where: { id: client.userId }, data: { isBlocked: true } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '+77011112233' })
      .expect(204);
    const code = await prisma.smsCode.findFirstOrThrow({
      where: { phone: '+77011112233' },
      orderBy: { createdAt: 'desc' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-code')
      .send({ phone: '+77011112233', code: code.code })
      .expect(403);
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json auth-blocked.e2e-spec.ts --runInBand
```

Ожидается: оба теста FAIL (получают 200/201 вместо 403).

- [ ] **Step 3: Добавить проверку в `JwtAuthGuard`**

В `apps/api/src/auth/jwt-auth.guard.ts` изменить импорт и метод `canActivate`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
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
    if (user.isBlocked) throw new ForbiddenException('Аккаунт заблокирован');
    req.user = user;
    return true;
  }
}
```

- [ ] **Step 4: Добавить проверку в `AuthService.verifyCode`**

В `apps/api/src/auth/auth.service.ts` изменить импорт и хвост метода `verifyCode`:

```typescript
import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
// ...
    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
    if (user.isBlocked) throw new ForbiddenException('Аккаунт заблокирован');
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      accessToken,
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
    };
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json auth-blocked.e2e-spec.ts --runInBand
```

Ожидается: PASS, 2/2.

- [ ] **Step 6: Прогнать весь auth e2e-набор, убедиться в отсутствии регрессий**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json auth --runInBand
```

Ожидается: все PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth apps/api/test/auth-blocked.e2e-spec.ts
git commit -m "feat(api): блокировка пользователя — 403 на JwtAuthGuard и verify-code"
```

---

## Task 3: `/admin/users` — список + блокировка/разблокировка

**Files:**
- Create: `apps/api/src/admin-users/admin-users.module.ts`
- Create: `apps/api/src/admin-users/admin-users.service.ts`
- Create: `apps/api/src/admin-users/admin-users.controller.ts`
- Create: `apps/api/src/admin-users/dto.ts`
- Test: `apps/api/src/admin-users/admin-users.service.spec.ts`
- Test: `apps/api/test/admin-users.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `AuditLogService.write` (Task 1).
- Produces: `AdminUsersService.list(search?)`, `.block(operatorId, userId, reason)`, `.unblock(operatorId, userId)`.

- [ ] **Step 1: Написать падающий unit-тест сервиса**

Создать `apps/api/src/admin-users/admin-users.service.spec.ts`:

```typescript
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  function build() {
    const prisma = {
      user: { findMany: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    } as any;
    const auditLog = { write: jest.fn() } as any;
    return { service: new AdminUsersService(prisma, auditLog), prisma, auditLog };
  }

  it('blocks a user and writes an audit entry', async () => {
    const { service, prisma, auditLog } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u-1', isBlocked: true });

    await service.block('op-1', 'u-1', 'жалобы мастеров');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ isBlocked: true, blockedReason: 'жалобы мастеров' }),
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'OPERATOR',
        actorId: 'op-1',
        action: 'USER_BLOCKED',
        targetType: 'USER',
        targetId: 'u-1',
        comment: 'жалобы мастеров',
      }),
    );
  });

  it('unblocks a user and clears the reason', async () => {
    const { service, prisma, auditLog } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u-1', isBlocked: false });

    await service.unblock('op-1', 'u-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_UNBLOCKED', targetId: 'u-1' }),
    );
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
cd apps/api && npx jest src/admin-users/admin-users.service.spec.ts
```

Ожидается: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать DTO, сервис, контроллер, модуль**

Создать `apps/api/src/admin-users/dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
```

Создать `apps/api/src/admin-users/admin-users.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(search?: string) {
    const users = await this.prisma.user.findMany({
      where: search
        ? { OR: [{ phone: { contains: search } }, { name: { contains: search, mode: 'insensitive' } }] }
        : {},
      orderBy: { createdAt: 'desc' },
      include: {
        masterProfile: { select: { id: true } },
        _count: { select: { clientOrders: true, masterOrders: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.masterProfile ? 'клиент + мастер' : 'клиент',
      orders: u._count.clientOrders + u._count.masterOrders,
      isBlocked: u.isBlocked,
    }));
  }

  async block(operatorId: string, userId: string, reason: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true, blockedAt: new Date(), blockedReason: reason },
    });
    await this.auditLog.write({
      actorType: 'OPERATOR',
      actorId: operatorId,
      action: 'USER_BLOCKED',
      targetType: 'USER',
      targetId: userId,
      comment: reason,
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async unblock(operatorId: string, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
    await this.auditLog.write({
      actorType: 'OPERATOR',
      actorId: operatorId,
      action: 'USER_UNBLOCKED',
      targetType: 'USER',
      targetId: userId,
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }
}
```

Создать `apps/api/src/admin-users/admin-users.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminUsersService } from './admin-users.service';
import { BlockUserDto } from './dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminUsersController {
  constructor(private readonly admin: AdminUsersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.admin.list(search);
  }

  @Post(':id/block')
  block(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.admin.block(operator.id, id, dto.reason);
  }

  @Post(':id/unblock')
  unblock(@CurrentUser() operator: User, @Param('id') id: string) {
    return this.admin.unblock(operator.id, id);
  }
}
```

Создать `apps/api/src/admin-users/admin-users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [AuditLogModule],
  providers: [AdminUsersService],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
```

- [ ] **Step 4: Запустить unit-тест, убедиться что проходит**

```bash
cd apps/api && npx jest src/admin-users/admin-users.service.spec.ts
```

Ожидается: PASS, 2/2.

- [ ] **Step 5: Зарегистрировать модуль в `AppModule`**

В `apps/api/src/app.module.ts`:

```typescript
import { AdminUsersModule } from './admin-users/admin-users.module';
// ... в imports, рядом с AdminModule
  AdminModule,
  AdminUsersModule,
```

- [ ] **Step 6: Написать падающий e2e-тест**

Создать `apps/api/test/admin-users.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Admin users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('lists users and toggles block state', async () => {
    const client = await loginAs(app, '+77011234567');
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(list.body.find((u: any) => u.id === client.userId)).toMatchObject({ isBlocked: false });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/block`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ reason: 'жалобы' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/unblock`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
  });

  it('rejects non-operator callers', async () => {
    const client = await loginAs(app, '+77011234567');
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('requires a reason to block', async () => {
    const client = await loginAs(app, '+77011234567');
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/block`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({})
      .expect(400);
  });
});
```

- [ ] **Step 7: Запустить, убедиться что падает, затем что проходит**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-users.e2e-spec.ts --runInBand
```

Ожидается: сначала FAIL (роутов ещё не было до Step 3 — если Step 3 уже выполнен, тест должен сразу быть GREEN; порядок здесь важен только для unit-теста сервиса, e2e пишется и гоняется после реализации). Итог — PASS, 3/3.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin-users apps/api/test/admin-users.e2e-spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): /admin/users — список, блокировка, разблокировка"
```

---

## Task 4: `/admin/masters` — список

**Files:**
- Create: `apps/api/src/admin-masters/admin-masters.module.ts`
- Create: `apps/api/src/admin-masters/admin-masters.service.ts`
- Create: `apps/api/src/admin-masters/admin-masters.controller.ts`
- Test: `apps/api/src/admin-masters/admin-masters.service.spec.ts`
- Test: `apps/api/test/admin-masters.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `ReviewsService.attachRatingToAll<T extends {master:{id:string}}>(entities): Promise<T[]>` (существующий, добавляет `rating`/`reviewCount` в объект `master`).
- Produces: `AdminMastersService.list(categorySlug?, district?)`.

- [ ] **Step 1: Написать падающий unit-тест**

Создать `apps/api/src/admin-masters/admin-masters.service.spec.ts`:

```typescript
import { AdminMastersService } from './admin-masters.service';

describe('AdminMastersService', () => {
  function build() {
    const prisma = { masterProfile: { findMany: jest.fn() } } as any;
    const reviews = { attachRatingToAll: jest.fn((rows: any[]) => Promise.resolve(rows)) } as any;
    return { service: new AdminMastersService(prisma, reviews), prisma, reviews };
  }

  it('derives status priority: blocked > priority-penalized > online > offline', async () => {
    const { service, prisma } = build();
    const now = Date.now();
    prisma.masterProfile.findMany.mockResolvedValue([
      { id: 'p1', userId: 'u1', fullName: 'Блок', blockedUntil: new Date(now + 100000), priorityPenaltyUntil: null, categories: [], presence: { isOnline: true }, user: { id: 'u1', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 } } },
      { id: 'p2', userId: 'u2', fullName: 'Штраф', blockedUntil: null, priorityPenaltyUntil: new Date(now + 100000), categories: [], presence: { isOnline: true }, user: { id: 'u2', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 } } },
      { id: 'p3', userId: 'u3', fullName: 'Онлайн', blockedUntil: null, priorityPenaltyUntil: null, categories: [], presence: { isOnline: true }, user: { id: 'u3', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 } } },
      { id: 'p4', userId: 'u4', fullName: 'Офлайн', blockedUntil: null, priorityPenaltyUntil: null, categories: [], presence: { isOnline: false }, user: { id: 'u4', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 } } },
    ]);

    const rows = await service.list();

    expect(rows.map((r) => r.status)).toEqual([
      expect.stringContaining('блокирован до'),
      expect.stringContaining('приоритет ↓ до'),
      'активен · онлайн',
      'активен · офлайн',
    ]);
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
cd apps/api && npx jest src/admin-masters/admin-masters.service.spec.ts
```

Ожидается: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать сервис, контроллер, модуль**

Создать `apps/api/src/admin-masters/admin-masters.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';

@Injectable()
export class AdminMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async list(categorySlug?: string, district?: string) {
    const profiles = await this.prisma.masterProfile.findMany({
      where: {
        status: 'ACTIVE',
        district: district ?? undefined,
        categories: categorySlug ? { some: { category: { slug: categorySlug } } } : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, _count: { select: { masterOrders: true, masterPlannedOrders: true } } },
        },
        categories: { include: { category: true } },
        presence: { select: { isOnline: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const base = profiles.map((p) => {
      let status: string;
      if (p.blockedUntil && p.blockedUntil > now) {
        status = `блокирован до ${p.blockedUntil.toISOString()}`;
      } else if (p.priorityPenaltyUntil && p.priorityPenaltyUntil > now) {
        status = `приоритет ↓ до ${p.priorityPenaltyUntil.toISOString()}`;
      } else {
        status = p.presence?.isOnline ? 'активен · онлайн' : 'активен · офлайн';
      }
      return {
        id: p.id,
        categories: p.categories.map((c) => c.category.name),
        orders: p.user._count.masterOrders + p.user._count.masterPlannedOrders,
        status,
        master: { id: p.userId, name: p.user.name ?? p.fullName },
      };
    });

    const enriched = await this.reviews.attachRatingToAll(base);
    return enriched.map(({ master, ...rest }: any) => ({
      ...rest,
      name: master.name,
      rating: master.rating ?? null,
      reviewCount: master.reviewCount ?? 0,
    }));
  }
}
```

Создать `apps/api/src/admin-masters/admin-masters.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminMastersService } from './admin-masters.service';

@Controller('admin/masters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminMastersController {
  constructor(private readonly admin: AdminMastersService) {}

  @Get()
  list(@Query('category') category?: string, @Query('district') district?: string) {
    return this.admin.list(category, district);
  }
}
```

Создать `apps/api/src/admin-masters/admin-masters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminMastersService } from './admin-masters.service';
import { AdminMastersController } from './admin-masters.controller';

@Module({
  imports: [ReviewsModule],
  providers: [AdminMastersService],
  controllers: [AdminMastersController],
})
export class AdminMastersModule {}
```

- [ ] **Step 4: Запустить unit-тест, убедиться что проходит**

```bash
cd apps/api && npx jest src/admin-masters/admin-masters.service.spec.ts
```

Ожидается: PASS, 1/1.

- [ ] **Step 5: Зарегистрировать модуль в `AppModule`**

```typescript
import { AdminMastersModule } from './admin-masters/admin-masters.module';
// ... в imports
  AdminUsersModule,
  AdminMastersModule,
```

- [ ] **Step 6: Написать и прогнать e2e-тест**

Создать `apps/api/test/admin-masters.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster } from './helpers';

describe('Admin masters (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('lists active masters with a derived status', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');
    const master = await createActiveMaster(app, '+77010000001', categories.plumbing.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/masters')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'активен · онлайн', categories: ['Сантехника'] }),
    ]));
    expect(res.body.find((r: any) => r.id)).toBeDefined();
    expect(master.userId).toBeTruthy();
  });
});
```

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-masters.e2e-spec.ts --runInBand
```

Ожидается: PASS, 1/1.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin-masters apps/api/test/admin-masters.e2e-spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): /admin/masters — список с производным статусом"
```

---

## Task 5: `/admin/orders` — список и деталь (read-only)

**Files:**
- Create: `apps/api/src/admin-orders/admin-orders.module.ts`
- Create: `apps/api/src/admin-orders/admin-orders.service.ts`
- Create: `apps/api/src/admin-orders/admin-orders.controller.ts`
- Test: `apps/api/test/admin-orders.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `AdminOrdersService.list(opts)`, `.detail(id, type)` — типы `AdminOrderRow`, `AdminOrderDetail` (используются Task 6 контроллером без изменений).

- [ ] **Step 1: Реализовать сервис**

Создать `apps/api/src/admin-orders/admin-orders.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminOrderRow {
  id: string;
  type: 'urgent' | 'planned';
  client: string;
  master: string | null;
  category: string;
  status: string;
  createdAt: Date;
}

interface TimelineEntry {
  at: Date;
  event: string;
}

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { type?: 'urgent' | 'planned'; status?: string; search?: string }): Promise<AdminOrderRow[]> {
    const rows: AdminOrderRow[] = [];
    const searchFilter = opts.search
      ? [{ id: { startsWith: opts.search } }, { client: { phone: { contains: opts.search } } }]
      : undefined;

    if (opts.type !== 'planned') {
      const orders = await this.prisma.order.findMany({
        where: { status: opts.status as any, OR: searchFilter },
        include: { client: true, master: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      rows.push(
        ...orders.map((o) => ({
          id: o.id,
          type: 'urgent' as const,
          client: o.client.name ?? o.client.phone,
          master: o.master ? o.master.name ?? o.master.phone : null,
          category: o.category.name,
          status: o.status,
          createdAt: o.createdAt,
        })),
      );
    }

    if (opts.type !== 'urgent') {
      const planned = await this.prisma.plannedOrder.findMany({
        where: { status: opts.status as any, OR: searchFilter },
        include: { client: true, master: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      rows.push(
        ...planned.map((o) => ({
          id: o.id,
          type: 'planned' as const,
          client: o.client.name ?? o.client.phone,
          master: o.master ? o.master.name ?? o.master.phone : null,
          category: o.category.name,
          status: o.status,
          createdAt: o.createdAt,
        })),
      );
    }

    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
  }

  async detail(id: string, type: 'urgent' | 'planned') {
    if (type === 'planned') return this.plannedDetail(id);
    return this.urgentDetail(id);
  }

  private async urgentDetail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: true, master: true, category: true, disputes: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const timeline: TimelineEntry[] = [
      { at: order.createdAt, event: `создана · выезд ${order.calloutPrice} ₸` },
      ...(order.acceptedAt ? [{ at: order.acceptedAt, event: `принял ${order.master?.name ?? order.master?.phone}` }] : []),
      ...(order.priceProposedAt ? [{ at: order.priceProposedAt, event: 'цена предложена клиенту' }] : []),
      ...(order.completedAt ? [{ at: order.completedAt, event: 'выполнено' }] : []),
      ...(order.closedAt ? [{ at: order.closedAt, event: 'закрыта' }] : []),
      ...order.disputes.map((d) => ({ at: d.createdAt, event: `открыт спор #${d.id}` })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    const canAssign =
      order.status === 'SEARCHING' && order.wave === 3 && Date.now() - order.createdAt.getTime() > 5 * 60_000;

    return {
      id: order.id,
      type: 'urgent' as const,
      status: order.status,
      address: order.address,
      district: order.district,
      createdAt: order.createdAt,
      client: { name: order.client.name, phone: order.client.phone },
      master: order.master ? { name: order.master.name, phone: order.master.phone } : null,
      category: order.category.name,
      calloutPrice: order.calloutPrice,
      serviceFee: order.serviceFee,
      workPrice: order.workPrice,
      timeline,
      canAssign,
    };
  }

  private async plannedDetail(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({
      where: { id },
      include: { client: true, master: true, category: true, disputes: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const timeline: TimelineEntry[] = [
      { at: order.createdAt, event: 'создана' },
      ...(order.publishedAt ? [{ at: order.publishedAt, event: 'опубликована' }] : []),
      ...(order.selectedAt ? [{ at: order.selectedAt, event: `выбран ${order.master?.name ?? order.master?.phone}` }] : []),
      ...(order.confirmedAt ? [{ at: order.confirmedAt, event: 'подтверждена мастером' }] : []),
      ...(order.completedAt ? [{ at: order.completedAt, event: 'выполнено' }] : []),
      ...(order.closedAt ? [{ at: order.closedAt, event: 'закрыта' }] : []),
      ...order.disputes.map((d) => ({ at: d.createdAt, event: `открыт спор #${d.id}` })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return {
      id: order.id,
      type: 'planned' as const,
      status: order.status,
      address: order.address,
      district: order.district,
      createdAt: order.createdAt,
      client: { name: order.client.name, phone: order.client.phone },
      master: order.master ? { name: order.master.name, phone: order.master.phone } : null,
      category: order.category.name,
      budget: order.budget,
      workPrice: order.workPrice,
      timeline,
      canAssign: false,
    };
  }
}
```

- [ ] **Step 2: Реализовать контроллер и модуль**

Создать `apps/api/src/admin-orders/admin-orders.controller.ts`:

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminOrdersService } from './admin-orders.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminOrdersController {
  constructor(private readonly admin: AdminOrdersService) {}

  @Get()
  list(
    @Query('type') type?: 'urgent' | 'planned',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.list({ type, status, search });
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('type') type: 'urgent' | 'planned' = 'urgent') {
    return this.admin.detail(id, type);
  }
}
```

Создать `apps/api/src/admin-orders/admin-orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';

@Module({
  providers: [AdminOrdersService],
  controllers: [AdminOrdersController],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
```

- [ ] **Step 3: Зарегистрировать модуль в `AppModule`**

```typescript
import { AdminOrdersModule } from './admin-orders/admin-orders.module';
// ... в imports
  AdminMastersModule,
  AdminOrdersModule,
```

- [ ] **Step 4: Написать падающий e2e-тест**

Создать `apps/api/test/admin-orders.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
} from './helpers';

describe('Admin orders — list & detail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categories: Awaited<ReturnType<typeof seedCategories>>;
  let operator: { token: string; userId: string };
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(app);
    categories = await seedCategories(app);
    operator = await loginAs(app, '+77010000001', 'OPERATOR');
    client = await loginAs(app, '+77010000002');
    await createActiveMaster(app, '+77010000003', categories.plumbing.id);
  });

  it('lists urgent orders and marks a stuck wave-3 search as assignable in the detail view', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id, type: 'urgent', status: 'SEARCHING' })]),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}?type=urgent`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(detail.body.canAssign).toBe(true);
    expect(detail.body.timeline[0]).toMatchObject({ event: expect.stringContaining('создана') });
  });

  it('rejects non-operator callers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });
});
```

- [ ] **Step 5: Запустить, убедиться что падает, затем проходит**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-orders.e2e-spec.ts --runInBand
```

Ожидается: PASS, 2/2 (модуль/роуты уже реализованы в Step 1-2, тест сразу должен пройти после регистрации в Step 3 — если запущен раньше Step 3, упадёт с 404).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin-orders apps/api/test/admin-orders.e2e-spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): /admin/orders — объединённый список и деталь заказа"
```

---

## Task 6: Ручное назначение мастера — кандидаты + `manualAssign`

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/admin-orders/admin-orders.service.ts`
- Modify: `apps/api/src/admin-orders/admin-orders.controller.ts`
- Modify: `apps/api/src/admin-orders/admin-orders.module.ts`
- Create: `apps/api/src/admin-orders/dto.ts`
- Test: `apps/api/test/admin-orders.e2e-spec.ts` (добавить кейсы)

**Interfaces:**
- Consumes: `AuditLogService.write` (Task 1), `ACTIVE_MASTER_STATUSES` из `../orders/order.constants` (существующий).
- Produces: `OrdersService.manualAssign(operatorId, orderId, masterUserId): Promise<Order>`; `AdminOrdersService.candidates(orderId): Promise<AssignCandidate[]>`.

- [ ] **Step 1: Написать падающие e2e-тесты**

Добавить в конец `describe` блока `apps/api/test/admin-orders.e2e-spec.ts` (внутри существующего `describe('Admin orders — list & detail (e2e)'`, ...)` — переименовать `describe` в `'Admin orders (e2e)'`, если нужно, и добавить:

```typescript
  it('lists a nearby online master as a manual-assign candidate', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}/candidates`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ isOnline: true });
  });

  it('force-assigns a stuck search to a chosen master and logs it in the audit trail', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });
    const candidates = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}/candidates`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    const masterUserId = candidates.body[0].masterUserId;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId })
      .expect(201);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe('ACCEPTED');
    expect(updated.masterId).toBe(masterUserId);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { targetId: created.id, action: 'ORDER_MANUALLY_ASSIGNED' },
    });
    expect(log.actorType).toBe('OPERATOR');
    expect(log.actorId).toBe(operator.userId);
  });

  it('rejects manual assignment for an order that already left SEARCHING', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({ where: { id: created.id }, data: { status: 'NO_MASTERS' } });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId: 'irrelevant' })
      .expect(409);
  });
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-orders.e2e-spec.ts --runInBand
```

Ожидается: FAIL — `GET /admin/orders/:id/candidates` и `POST /admin/orders/:id/assign` возвращают 404.

- [ ] **Step 3: Добавить `manualAssign` в `OrdersService`**

В `apps/api/src/orders/orders.service.ts` добавить импорт и параметр конструктора:

```typescript
import { AuditLogService } from '../audit-log/audit-log.service';
// ...
constructor(
  private readonly prisma: PrismaService,
  private readonly pricing: PricingService,
  private readonly queue: QueueService,
  private readonly gateway: RealtimeGateway,
  @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  private readonly penalties: MasterPenaltyService,
  private readonly compensation: CompensationService,
  private readonly disputes: DisputesService,
  @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  private readonly reviews: ReviewsService,
  private readonly auditLog: AuditLogService,
) {}
```

Добавить метод (например, сразу после `accept()`):

```typescript
/** Операторское назначение зависшего в поиске заказа конкретному мастеру, в обход offer-flow. */
async manualAssign(operatorId: string, orderId: string, masterUserId: string): Promise<Order> {
  await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');

    const gate = await tx.order.updateMany({
      where: { id: orderId, status: 'SEARCHING' },
      data: { status: 'ACCEPTED', masterId: masterUserId, acceptedAt: new Date() },
    });
    if (gate.count === 0) throw new ConflictException('Заявка больше не в поиске');

    await tx.orderOffer.updateMany({
      where: { orderId, attempt: order.searchAttempt, outcome: 'PENDING' },
      data: { outcome: 'LOST', respondedAt: new Date() },
    });

    await this.auditLog.write(
      {
        actorType: 'OPERATOR',
        actorId: operatorId,
        action: 'ORDER_MANUALLY_ASSIGNED',
        targetType: 'ORDER',
        targetId: orderId,
        comment: `назначен мастер ${masterUserId}`,
      },
      tx,
    );
  });

  await this.payments.capture(orderId);
  await this.emitOrderStatus(orderId);
  return this.findOrThrow(orderId);
}
```

В `apps/api/src/orders/orders.module.ts` добавить импорт `AuditLogModule`:

```typescript
import { AuditLogModule } from '../audit-log/audit-log.module';
// ...
@Module({
  imports: [PricingModule, PaymentsModule, RealtimeModule, CommonModule, DisputesModule, StorageModule, ReviewsModule, AuditLogModule],
  providers: [OrdersService, MatchingService],
  controllers: [OrdersController],
  exports: [OrdersService, MatchingService],
})
export class OrdersModule {}
```

- [ ] **Step 4: Обновить unit-тесты `OrdersService`, если они мокают конструктор напрямую**

```bash
cd apps/api && grep -rl "new OrdersService(" src test
```

Если найдены файлы — в каждом добавить `{ write: jest.fn() } as any` последним аргументом в вызов `new OrdersService(...)`, соответствующим новому параметру `auditLog`. Прогнать:

```bash
cd apps/api && npx jest src/orders
```

Ожидается: PASS без изменений в поведении существующих тестов (падать могли только из-за несовпадения арности конструктора).

- [ ] **Step 5: Добавить `candidates()` в `AdminOrdersService`**

В `apps/api/src/admin-orders/admin-orders.service.ts` добавить импорты и метод:

```typescript
import { Prisma } from '@prisma/client';
import { ACTIVE_MASTER_STATUSES } from '../orders/order.constants';

export interface AssignCandidate {
  masterUserId: string;
  name: string;
  distanceKm: number;
  isOnline: boolean;
}
```

Добавить метод в класс `AdminOrdersService`:

```typescript
  async candidates(orderId: string): Promise<AssignCandidate[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');

    const rows = await this.prisma.$queryRaw<{ id: string; name: string | null; meters: number }[]>`
      SELECT u.id, u.name, ST_Distance(mp.location, o.location) AS meters
      FROM "MasterPresence" mp
      JOIN "User" u ON u.id = mp."masterUserId"
      JOIN "MasterProfile" pr ON pr."userId" = u.id AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${order.categoryId}
      JOIN "Order" o ON o.id = ${orderId}
      WHERE mp."isOnline" = true
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
        AND mp.location IS NOT NULL AND o.location IS NOT NULL
        AND u.id <> ${order.clientId}
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao WHERE ao."masterId" = u.id AND ao.status IN (${Prisma.join(ACTIVE_MASTER_STATUSES)})
        )
      ORDER BY meters ASC
      LIMIT 10`;

    return rows.map((r) => ({
      masterUserId: r.id,
      name: r.name ?? '—',
      distanceKm: Math.round(r.meters / 100) / 10,
      isOnline: true,
    }));
  }
```

- [ ] **Step 6: Подключить `OrdersService` в `AdminOrdersController`/`AdminOrdersModule`**

В `apps/api/src/admin-orders/dto.ts` создать:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignOrderDto {
  @IsString()
  @IsNotEmpty()
  masterUserId!: string;
}
```

Заменить содержимое `apps/api/src/admin-orders/admin-orders.controller.ts` целиком:

```typescript
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { AssignOrderDto } from './dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminOrdersController {
  constructor(
    private readonly admin: AdminOrdersService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  list(
    @Query('type') type?: 'urgent' | 'planned',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.list({ type, status, search });
  }

  @Get(':id/candidates')
  candidates(@Param('id') id: string) {
    return this.admin.candidates(id);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('type') type: 'urgent' | 'planned' = 'urgent') {
    return this.admin.detail(id, type);
  }

  @Post(':id/assign')
  assign(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: AssignOrderDto) {
    return this.orders.manualAssign(operator.id, id, dto.masterUserId);
  }
}
```

В `apps/api/src/admin-orders/admin-orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';

@Module({
  imports: [OrdersModule],
  providers: [AdminOrdersService],
  controllers: [AdminOrdersController],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
```

- [ ] **Step 7: Запустить e2e, убедиться что всё проходит**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-orders.e2e-spec.ts --runInBand
```

Ожидается: PASS, 5/5.

- [ ] **Step 8: Собрать проект**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/orders apps/api/src/admin-orders apps/api/test/admin-orders.e2e-spec.ts
git commit -m "feat(api): ручное назначение мастера на зависший поиск"
```

---

## Task 7: `/admin/metrics` — дашборд

**Files:**
- Create: `apps/api/src/admin-metrics/admin-metrics.module.ts`
- Create: `apps/api/src/admin-metrics/admin-metrics.service.ts`
- Create: `apps/api/src/admin-metrics/admin-metrics.controller.ts`
- Test: `apps/api/test/admin-metrics.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `AdminMetricsService.getDashboard()`.

- [ ] **Step 1: Реализовать сервис**

Создать `apps/api/src/admin-metrics/admin-metrics.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_CLIENT_STATUSES } from '../orders/order.constants';

@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const since = new Date(Date.now() - 24 * 3600_000);
    const nonTerminalStatuses = ACTIVE_CLIENT_STATUSES.filter((s) => s !== 'NO_MASTERS');

    const [
      activeUrgentCount,
      publishedPlannedCount,
      openDisputesCount,
      pendingVerificationCount,
      pendingWithdrawalsCount,
    ] = await Promise.all([
      this.prisma.order.count({ where: { status: { in: nonTerminalStatuses as any } } }),
      this.prisma.plannedOrder.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.masterProfile.count({ where: { status: { in: ['PENDING_REVIEW', 'NEEDS_INFO'] } } }),
      this.prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }),
    ]);

    const [{ accepted, noMasters }] = await this.prisma.$queryRaw<{ accepted: bigint; noMasters: bigint }[]>`
      SELECT
        count(*) FILTER (WHERE "acceptedAt" IS NOT NULL) AS accepted,
        count(*) FILTER (WHERE status = 'NO_MASTERS') AS "noMasters"
      FROM "Order"
      WHERE "createdAt" >= ${since}`;
    const totalDecided = Number(accepted) + Number(noMasters);
    const foundMasterRate = totalDecided === 0 ? null : Math.round((Number(accepted) / totalDecided) * 100);

    const [{ median }] = await this.prisma.$queryRaw<{ median: number | null }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "acceptedAt" - "createdAt")) AS median
      FROM "Order"
      WHERE "acceptedAt" IS NOT NULL AND "createdAt" >= ${since}`;

    const stuckOrders = await this.prisma.order.findMany({
      where: { status: 'SEARCHING', wave: 3, createdAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    return {
      activeUrgentCount,
      publishedPlannedCount,
      foundMasterRate,
      medianSearchSeconds: median === null ? null : Math.round(Number(median)),
      openDisputesCount,
      pendingVerificationCount,
      pendingWithdrawalsCount,
      stuckSearches: stuckOrders.map((o) => ({
        id: o.id,
        category: o.category.name,
        address: o.address,
        wave: o.wave,
        waitingSeconds: Math.round((Date.now() - o.createdAt.getTime()) / 1000),
      })),
    };
  }
}
```

- [ ] **Step 2: Реализовать контроллер и модуль**

Создать `apps/api/src/admin-metrics/admin-metrics.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminMetricsService } from './admin-metrics.service';

@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminMetricsController {
  constructor(private readonly admin: AdminMetricsService) {}

  @Get()
  getDashboard() {
    return this.admin.getDashboard();
  }
}
```

Создать `apps/api/src/admin-metrics/admin-metrics.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetricsController } from './admin-metrics.controller';

@Module({
  providers: [AdminMetricsService],
  controllers: [AdminMetricsController],
})
export class AdminMetricsModule {}
```

- [ ] **Step 3: Зарегистрировать модуль в `AppModule`**

```typescript
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';
// ... в imports
  AdminOrdersModule,
  AdminMetricsModule,
```

- [ ] **Step 4: Написать и прогнать e2e-тест**

Создать `apps/api/test/admin-metrics.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';

describe('Admin metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('reports dashboard aggregates including stuck searches', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const client = await loginAs(app, '+77010000002');
    await createActiveMaster(app, '+77010000003', categories.plumbing.id);

    const stuck = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: stuck.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const pendingApplicant = await loginAs(app, '+77010000004');
    await prisma.masterProfile.create({
      data: {
        userId: pendingApplicant.userId,
        fullName: 'В ожидании',
        iin: '000000000000',
        district: 'Есильский район',
        experienceYears: 1,
        status: 'PENDING_REVIEW',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.activeUrgentCount).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingVerificationCount).toBe(1);
    expect(res.body.stuckSearches).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: stuck.id, wave: 3 })]),
    );
  });
});
```

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-metrics.e2e-spec.ts --runInBand
```

Ожидается: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-metrics apps/api/test/admin-metrics.e2e-spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): /admin/metrics — агрегаты дашборда оператора"
```

---

## Task 8: Точки записи `AuditLog` + `/admin/journal`

**Files:**
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Modify: `apps/api/src/disputes/disputes.module.ts`
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/common/master-penalty.service.ts`
- Modify: `apps/api/src/common/common.module.ts`
- Create: `apps/api/src/audit-log/admin-journal.controller.ts`
- Modify: `apps/api/src/audit-log/audit-log.module.ts`
- Test: `apps/api/test/admin-journal.e2e-spec.ts`

**Interfaces:**
- Consumes: `AuditLogService.write` (Task 1), уже внедрённая в `OrdersService` (Task 6).

- [ ] **Step 1: Добавить контроллер журнала**

Создать `apps/api/src/audit-log/admin-journal.controller.ts`:

```typescript
import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuditLogService } from './audit-log.service';

@Controller('admin/journal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminJournalController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.auditLog.list(page);
  }
}
```

Обновить `apps/api/src/audit-log/audit-log.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminJournalController } from './admin-journal.controller';

@Module({
  providers: [AuditLogService],
  controllers: [AdminJournalController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
```

- [ ] **Step 2: Ретрофит `AdminService.decide()` (верификация)**

В `apps/api/src/admin/admin.service.ts` добавить импорт и параметр конструктора:

```typescript
import { AuditLogService } from '../audit-log/audit-log.service';
// ...
constructor(
  private readonly prisma: PrismaService,
  @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  private readonly auditLog: AuditLogService,
) {}
```

В методе `decide()` — после `await tx.verificationDecision.create({...})` и перед `return tx.masterProfile.findUniqueOrThrow(...)`:

```typescript
      const actionByDecision: Record<DecisionType, string> = {
        APPROVE: 'MASTER_APPROVED',
        REJECT: 'MASTER_REJECTED',
        REQUEST_INFO: 'MASTER_NEEDS_INFO',
      };
      await this.auditLog.write(
        {
          actorType: 'OPERATOR',
          actorId: operatorId,
          action: actionByDecision[dto.decision],
          targetType: 'MASTER_PROFILE',
          targetId: profileId,
          comment: dto.comment,
        },
        tx,
      );
```

Обновить `apps/api/src/admin/admin.module.ts`, добавив `AuditLogModule` в `imports`.

- [ ] **Step 3: Ретрофит `DisputesService.resolve()`**

В `apps/api/src/disputes/disputes.service.ts` добавить импорт и параметр конструктора (в конец списка):

```typescript
import { AuditLogService } from '../audit-log/audit-log.service';
// ... в constructor добавить последним параметром
  private readonly auditLog: AuditLogService,
```

Внутри `$transaction` в `resolve()`, сразу после успешного `gated` (после блока `if (gated.count === 0) throw ...`), перед веткой `if (orderId) {`:

```typescript
    await this.auditLog.write(
      {
        actorType: 'OPERATOR',
        actorId: operatorId,
        action: 'DISPUTE_RESOLVED',
        targetType: 'DISPUTE',
        targetId: disputeId,
        comment: dto.resolutionNote,
      },
      tx,
    );
```

Обновить `apps/api/src/disputes/disputes.module.ts`, добавив `AuditLogModule` в `imports`.

- [ ] **Step 4: Ретрофит `OrdersService.handleAutoClose()`**

В `apps/api/src/orders/orders.service.ts` (конструктор уже содержит `auditLog` с Task 6):

```typescript
async handleAutoClose({ orderId }: { orderId: string }): Promise<void> {
  const order = await this.prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'DONE') return;
  if (await this.disputes.hasOpenDispute({ orderId })) return;
  await this.closeOrder(orderId);
  await this.auditLog.write({ actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: orderId });
}
```

- [ ] **Step 5: Ретрофит `MasterPenaltyService.penalizeForCancellation()`**

В `apps/api/src/common/master-penalty.service.ts` добавить импорт и параметр конструктора:

```typescript
import { AuditLogService } from '../audit-log/audit-log.service';
// ... в constructor добавить
  private readonly auditLog: AuditLogService,
```

В методе `penalizeForCancellation()`, внутри блока `if (count >= CANCELLATION_BLOCK_THRESHOLD) { ... }`, после `await tx.masterProfile.updateMany({...})`:

```typescript
    await this.auditLog.write(
      { actorType: 'SYSTEM', action: 'MASTER_AUTO_BLOCKED', targetType: 'MASTER_PROFILE', targetId: masterUserId },
      tx,
    );
```

Обновить `apps/api/src/common/common.module.ts`, добавив `AuditLogModule` в `imports` (проверить на циклический импорт: `AuditLogModule` зависит только от `PrismaModule`, `CommonModule` не импортируется внутри `AuditLogModule` — цикла нет).

- [ ] **Step 6: Обновить существующие unit-тесты, сломанные новой арностью конструкторов**

```bash
cd apps/api && npx tsc --noEmit
```

Для каждой ошибки вида «Expected N arguments, but got N-1» в `*.spec.ts`, добавить `{ write: jest.fn() } as any` последним аргументом в соответствующий вызов `new AdminService(...)` / `new DisputesService(...)` / `new MasterPenaltyService(...)`. Повторить `tsc --noEmit` до отсутствия ошибок.

- [ ] **Step 7: Прогнать все unit-тесты**

```bash
cd apps/api && npx jest --testPathIgnorePatterns=e2e
```

Ожидается: все существующие unit-тесты (`admin`, `disputes`, `common`) остаются GREEN — новые вызовы `auditLog.write` не меняют их прежние ассерты, только требуют мока в конструкторе.

- [ ] **Step 8: Написать и прогнать e2e-тест журнала**

Создать `apps/api/test/admin-journal.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Admin journal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('records a verification decision and surfaces it in the journal', async () => {
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const applicant = await loginAs(app, '+77010000005');
    await prisma.masterProfile.create({
      data: {
        userId: applicant.userId,
        fullName: 'Тест Тестов',
        iin: '000000000001',
        district: 'Есильский район',
        experienceYears: 1,
        status: 'PENDING_REVIEW',
      },
    });
    const profile = await prisma.masterProfile.findFirstOrThrow({ where: { userId: applicant.userId } });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profile.id}/decision`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ decision: 'APPROVE' })
      .expect(201);

    const journal = await request(app.getHttpServer())
      .get('/api/v1/admin/journal')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(journal.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'MASTER_APPROVED', targetId: profile.id, actorType: 'OPERATOR' }),
      ]),
    );
  });
});
```

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --config test/jest-e2e.json admin-journal.e2e-spec.ts --runInBand
```

Ожидается: PASS, 1/1.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/admin apps/api/src/disputes apps/api/src/orders apps/api/src/common apps/api/src/audit-log apps/api/test/admin-journal.e2e-spec.ts
git commit -m "feat(api): точки записи AuditLog + /admin/journal"
```

---

## Task 9: Сквозная проверка Цикла A

**Files:** нет новых — только прогон полного набора.

- [ ] **Step 1: Полный прогон unit + e2e**

```bash
rm -rf /tmp/jest_rs
cd apps/api && npx jest --testPathIgnorePatterns=e2e
cd apps/api && npx jest --config test/jest-e2e.json --runInBand
```

Ожидается: все зелёные (кроме уже известного environmental fail `queue.e2e-spec.ts` из-за занятого порта 5433 сторонним контейнером на этой машине — не регрессия, задокументировано в памяти проекта).

- [ ] **Step 2: Проверить сборку**

```bash
cd apps/api && npx tsc --noEmit
cd apps/api && npx nest build
```

Ожидается: без ошибок.

- [ ] **Step 3: Итоговый коммит (если остались незакоммиченные изменения)**

```bash
git status --porcelain
```

Если пусто — Цикл A завершён, дальше по прецеденту (`superpowers:finishing-a-development-branch` не требуется — работа велась прямо в `main`, как и предыдущие циклы этого проекта). Если есть хвосты — закоммитить их отдельным коммитом с понятным сообщением.
