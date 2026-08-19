# Экран спора со стороны мастера — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать мастеру в `apps/master` возможность увидеть открытый на него спор, заявление клиента и фото, один раз отправить своё пояснение с фото, и увидеть исход после разрешения оператором.

**Architecture:** Два новых read-эндпоинта в существующем `apps/api/src/disputes` (список "моих" споров + список evidence с авторством), плюс новый раздел в `apps/master` (пункт навигации со счётчиком, список споров, экран деталей), переиспользующий уже существующие `PATCH /disputes/:id` и `POST /disputes/:id/evidence`.

**Tech Stack:** NestJS + Prisma (backend), Next.js App Router + Tailwind (frontend), Jest + Supertest для e2e-тестов бэкенда.

## Global Constraints

- Бэкенд-эндпоинты — только GET, без изменения схемы Prisma и без новых socket-событий (спека: "Realtime-уведомление о новом споре" — вне скоупа).
- Guard-паттерн для новых read-эндпоинтов — переиспользовать `guardParticipant` как есть, не ослаблять.
- `apps/master` не использует `react-i18next` — все строки на русском хардкодом, как в `ActiveOrderView.tsx`.
- Мастер отвечает на спор клиента ровно один раз (`PATCH /disputes/:id` уже это гарантирует на бэкенде) — фронтенд должен требовать подтверждение перед отправкой и не давать редактировать после.
- Поля исхода (`refundServiceFee`, `penalizeMaster`) показывать строкой только если значение не `null`.
- `apps/master` не имеет тестового фреймворка на фронтенде (нет jest/playwright в `package.json`) — верификация фронтенд-задач ручная, через dev-сервер/preview-тул, не через автотесты.

---

## Файловая структура

**Backend (`apps/api/src/disputes`):**
- Modify: `disputes.service.ts` — добавить `listMine(userId)` и `listEvidence(userId, disputeId)`.
- Modify: `disputes.controller.ts` — добавить `GET disputes/mine` и `GET disputes/:id/evidence`.
- Create: `apps/api/test/disputes-mine.e2e-spec.ts` — тесты на `GET /disputes/mine`.
- Modify: `apps/api/test/disputes-evidence.e2e-spec.ts` — добавить тесты на `GET /disputes/:id/evidence`.

**Frontend (`apps/master`):**
- Create: `apps/master/lib/disputes.ts` — типы + функции API-клиента (по образцу `masterApplication.ts`).
- Modify: `apps/master/components/NavLink.tsx` — добавить опциональный проп `badge` (счётчик).
- Modify: `apps/master/components/Sidebar.tsx` — добавить пункт "Мои споры" со счётчиком.
- Create: `apps/master/app/(app)/disputes/page.tsx` — список споров.
- Create: `apps/master/components/DisputeDetailView.tsx` — экран деталей спора.
- Create: `apps/master/app/(app)/disputes/[id]/page.tsx` — роут-обёртка.

---

### Task 1: Backend — `GET /disputes/mine`

**Files:**
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Modify: `apps/api/src/disputes/disputes.controller.ts`
- Create: `apps/api/test/disputes-mine.e2e-spec.ts`

**Interfaces:**
- Produces: `DisputesService.listMine(userId: string): Promise<{ id: string; orderId: string | null; plannedOrderId: string | null; status: 'OPEN' | 'RESOLVED'; reason: string; createdAt: Date; resolvedAt: Date | null }[]>`
- Produces: маршрут `GET /api/v1/disputes/mine` (JWT-guarded), тело ответа — массив выше, отсортирован по `createdAt desc`.

- [ ] **Step 1: Написать падающий e2e-тест**

Создать `apps/api/test/disputes-mine.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { MatchingService } from '../src/orders/matching.service';

describe('Список своих споров (e2e)', () => {
  let app: INestApplication;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77140000001');
    master = await createActiveMaster(app, '+77140000002', plumbingId);

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

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
  });

  it('мастер видит спор по своей заявке в списке', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ orderId, status: 'OPEN', reason: 'Потоп' });
  });

  it('клиент тоже видит свой спор в списке', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ orderId });
  });

  it('посторонний мастер не видит чужой спор', async () => {
    const stranger = await createActiveMaster(app, '+77140000003', plumbingId);
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd apps/api && npm run test:e2e -- disputes-mine.e2e-spec.ts`
Expected: FAIL — `Cannot GET /api/v1/disputes/mine` (404), т.к. эндпоинта ещё нет.

- [ ] **Step 3: Добавить `listMine` в сервис**

В `apps/api/src/disputes/disputes.service.ts`, после метода `addCounterStatement` (перед `listAll`), добавить:

```typescript
  async listMine(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { order: { OR: [{ clientId: userId }, { masterId: userId }] } },
          { plannedOrder: { OR: [{ clientId: userId }, { masterId: userId }] } },
        ],
      },
      select: {
        id: true,
        orderId: true,
        plannedOrderId: true,
        status: true,
        reason: true,
        createdAt: true,
        resolvedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
```

- [ ] **Step 4: Добавить маршрут в контроллер**

В `apps/api/src/disputes/disputes.controller.ts`, добавить после конструктора (до `openForOrder`), чтобы не путать с параметризованными маршрутами ниже:

```typescript
  @Get('disputes/mine')
  listMine(@CurrentUser() user: User) {
    return this.disputes.listMine(user.id);
  }
```

- [ ] **Step 5: Запустить тест и убедиться, что он проходит**

Run: `cd apps/api && npm run test:e2e -- disputes-mine.e2e-spec.ts`
Expected: PASS (3 теста).

- [ ] **Step 6: Коммит**

```bash
git add apps/api/src/disputes/disputes.service.ts apps/api/src/disputes/disputes.controller.ts apps/api/test/disputes-mine.e2e-spec.ts
git commit -m "feat(api): добавить GET /disputes/mine для списка своих споров"
```

---

### Task 2: Backend — `GET /disputes/:id/evidence` (список с авторством)

**Files:**
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Modify: `apps/api/src/disputes/disputes.controller.ts`
- Modify: `apps/api/test/disputes-evidence.e2e-spec.ts`

**Interfaces:**
- Consumes: `PersistentScanStatus` тип из `../storage/persistent-file-scans.service` (уже импортирован в файле).
- Produces: `DisputesService.listEvidence(userId: string, disputeId: string): Promise<{ id: string; uploadedByUserId: string; isMine: boolean; mimeType: string; scanStatus: PersistentScanStatus; createdAt: Date }[]>`
- Produces: маршрут `GET /api/v1/disputes/:id/evidence` (JWT-guarded, только участники спора — 403 иначе), отсортирован по `createdAt asc`.

- [ ] **Step 1: Дописать падающие тесты в существующий e2e-файл**

В `apps/api/test/disputes-evidence.e2e-spec.ts`, добавить внутри `describe('скачивание доказательства', ...)` блока — новый `describe` рядом (тем же уровнем, после блока скачивания, перед закрывающей скобкой файла):

```typescript
  describe('список доказательств с авторством', () => {
    it('участник видит фото с флагом isMine', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${client.token}`)
        .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'client.jpg', contentType: 'image/jpeg' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${master.token}`)
        .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'master.jpg', contentType: 'image/jpeg' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${master.token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      const mine = res.body.filter((e: { isMine: boolean }) => e.isMine);
      const theirs = res.body.filter((e: { isMine: boolean }) => !e.isMine);
      expect(mine).toHaveLength(1);
      expect(theirs).toHaveLength(1);
      expect(mine[0].uploadedByUserId).toBe(master.userId);
    });

    it('посторонний не может получить список доказательств (403)', async () => {
      const stranger = await loginAs(app, '+77130000096');
      await request(app.getHttpServer())
        .get(`/api/v1/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });
  });
```

- [ ] **Step 2: Запустить тесты и убедиться, что новые падают**

Run: `cd apps/api && npm run test:e2e -- disputes-evidence.e2e-spec.ts`
Expected: FAIL на двух новых тестах — `Cannot GET /api/v1/disputes/:id/evidence` (404).

- [ ] **Step 3: Добавить `listEvidence` в сервис**

В `apps/api/src/disputes/disputes.service.ts`, после метода `getEvidenceStatus` (перед `addCounterStatement`), добавить:

```typescript
  async listEvidence(userId: string, disputeId: string) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    const rows = await this.prisma.$queryRaw<
      { id: string; uploadedByUserId: string; mimeType: string; scanStatus: PersistentScanStatus; createdAt: Date }[]
    >`
      SELECT "id", "uploadedByUserId", "mimeType", "scanStatus", "createdAt"
      FROM "DisputeEvidence"
      WHERE "disputeId" = ${disputeId}
      ORDER BY "createdAt" ASC
    `;
    return rows.map((row) => ({
      id: row.id,
      uploadedByUserId: row.uploadedByUserId,
      isMine: row.uploadedByUserId === userId,
      mimeType: row.mimeType,
      scanStatus: row.scanStatus,
      createdAt: row.createdAt,
    }));
  }
```

- [ ] **Step 4: Добавить маршрут в контроллер**

В `apps/api/src/disputes/disputes.controller.ts`, добавить после `evidenceStatus` (до `addCounterStatement`):

```typescript
  @Get('disputes/:id/evidence')
  listEvidence(@CurrentUser() user: User, @Param('id') id: string) {
    return this.disputes.listEvidence(user.id, id);
  }
```

- [ ] **Step 5: Запустить тесты и убедиться, что весь файл проходит**

Run: `cd apps/api && npm run test:e2e -- disputes-evidence.e2e-spec.ts`
Expected: PASS (все тесты файла, включая существующие).

- [ ] **Step 6: Коммит**

```bash
git add apps/api/src/disputes/disputes.service.ts apps/api/src/disputes/disputes.controller.ts apps/api/test/disputes-evidence.e2e-spec.ts
git commit -m "feat(api): добавить GET /disputes/:id/evidence со списком фото и авторством"
```

---

### Task 3: Frontend — API-клиент `apps/master/lib/disputes.ts`

**Files:**
- Create: `apps/master/lib/disputes.ts`

**Interfaces:**
- Consumes: `api`, `apiUpload` из `./api` (`apps/master/lib/api.ts`) — `api(path, options?)`, `apiUpload(path, formData)`.
- Produces (используются в Task 5 и Task 6):
  - `type DisputeSummary = { id: string; orderId: string | null; plannedOrderId: string | null; status: 'OPEN' | 'RESOLVED'; reason: string; createdAt: string; resolvedAt: string | null }`
  - `type DisputeDetail = DisputeSummary & { counterStatement: string | null; resolutionNote: string | null; refundServiceFee: boolean | null; penalizeMaster: boolean | null }`
  - `type DisputeEvidence = { id: string; uploadedByUserId: string; isMine: boolean; mimeType: string; scanStatus: string; createdAt: string }`
  - `fetchMyDisputes(): Promise<DisputeSummary[]>`
  - `fetchDisputeContext(kind: 'orders' | 'planned-orders', id: string): Promise<{ dispute: DisputeDetail | null }>`
  - `fetchDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]>`
  - `submitCounterStatement(disputeId: string, counterStatement: string): Promise<DisputeDetail>`
  - `uploadDisputeEvidence(disputeId: string, file: File): Promise<unknown>`

- [ ] **Step 1: Создать файл с типами и функциями**

```typescript
import { api, apiUpload } from './api';

export type DisputeStatus = 'OPEN' | 'RESOLVED';

export interface DisputeSummary {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  status: DisputeStatus;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DisputeDetail extends DisputeSummary {
  counterStatement: string | null;
  resolutionNote: string | null;
  refundServiceFee: boolean | null;
  penalizeMaster: boolean | null;
}

export interface DisputeEvidence {
  id: string;
  uploadedByUserId: string;
  isMine: boolean;
  mimeType: string;
  scanStatus: string;
  createdAt: string;
}

export async function fetchMyDisputes(): Promise<DisputeSummary[]> {
  return api('/disputes/mine');
}

export async function fetchDisputeContext(
  kind: 'orders' | 'planned-orders',
  id: string,
): Promise<{ dispute: DisputeDetail | null; [key: string]: unknown }> {
  return api(`/${kind}/${id}`);
}

export async function fetchDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
  return api(`/disputes/${disputeId}/evidence`);
}

export async function submitCounterStatement(disputeId: string, counterStatement: string): Promise<DisputeDetail> {
  return api(`/disputes/${disputeId}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
}

export async function uploadDisputeEvidence(disputeId: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append('file', file);
  return apiUpload(`/disputes/${disputeId}/evidence`, fd);
}
```

- [ ] **Step 2: Проверить типизацию**

Run: `cd apps/master && npx tsc --noEmit`
Expected: без новых ошибок в `lib/disputes.ts` (существующие ошибки проекта, если есть, не в счёт — но на чистом дереве ожидается 0 ошибок).

- [ ] **Step 3: Коммит**

```bash
git add apps/master/lib/disputes.ts
git commit -m "feat(master): добавить API-клиент для споров"
```

---

### Task 4: Frontend — пункт навигации "Мои споры" со счётчиком

**Files:**
- Modify: `apps/master/components/NavLink.tsx`
- Modify: `apps/master/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `fetchMyDisputes` из `@/lib/disputes` (Task 3).
- Produces: `NavLink` принимает опциональный проп `badge?: number` — рендерит пилюлю справа, только если `badge > 0`.

- [ ] **Step 1: Добавить проп `badge` в `NavLink`**

Заменить содержимое `apps/master/components/NavLink.tsx`:

```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: ReactNode;
  badge?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors ${
        isActive ? 'bg-fill-soft text-primary' : 'text-ink-soft hover:bg-fill-faint'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1">{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="rounded-pill bg-danger px-2 py-0.5 text-xs font-extrabold text-white">{badge}</span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Загрузить счётчик открытых споров и добавить пункт в `Sidebar`**

Заменить содержимое `apps/master/components/Sidebar.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { NavLink } from './NavLink';
import { useMasterPresence } from '@/lib/masterPresence';
import { fetchMyDisputes } from '@/lib/disputes';

export function Sidebar() {
  const { online, connected, geoDenied, goOnline, goOffline } = useMasterPresence();
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => {
    fetchMyDisputes()
      .then((disputes) => setOpenDisputes(disputes.filter((d) => d.status === 'OPEN').length))
      .catch(() => setOpenDisputes(0));
  }, []);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="🛠">
        Работа
      </NavLink>
      <NavLink href="/become-master" icon="📋">
        Анкета
      </NavLink>
      <NavLink href="/lead-credits" icon="🎫">
        Lead-кредиты
      </NavLink>
      <NavLink href="/wallet" icon="💳">
        Кошелёк
      </NavLink>
      <NavLink href="/disputes" icon="⚖️" badge={openDisputes}>
        Мои споры
      </NavLink>
      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <div className="rounded-md bg-fill-soft px-3 py-2 text-xs">
          <div className="font-extrabold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
          <div className="text-ink-soft">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
          {geoDenied && <div className="mt-1 text-danger">Нет доступа к геолокации</div>}
        </div>
        <button
          type="button"
          onClick={online ? goOffline : goOnline}
          className={`w-full rounded-pill px-3 py-2 text-xs font-extrabold text-white ${
            online ? 'bg-ink-soft' : 'bg-primary'
          }`}
        >
          {online ? 'Выйти' : 'Стать онлайн'}
        </button>
        <a
          href="https://client.masterqala.kz"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↗</span>
          Личный кабинет клиента
        </a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Ручная проверка**

Run: `cd apps/master && npm run dev` (или через preview-тул), войти под тестовым мастером без открытых споров.
Expected: пункт "Мои споры" виден в сайдбаре, без бейджа (счётчик 0 — бейдж не рендерится).

- [ ] **Step 4: Коммит**

```bash
git add apps/master/components/NavLink.tsx apps/master/components/Sidebar.tsx
git commit -m "feat(master): пункт навигации «Мои споры» со счётчиком открытых"
```

---

### Task 5: Frontend — список споров

**Files:**
- Create: `apps/master/app/(app)/disputes/page.tsx`

**Interfaces:**
- Consumes: `fetchMyDisputes`, `DisputeSummary` из `@/lib/disputes` (Task 3).

- [ ] **Step 1: Создать страницу списка**

```typescript
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchMyDisputes, type DisputeSummary } from '@/lib/disputes';

const STATUS_LABEL: Record<DisputeSummary['status'], string> = {
  OPEN: 'Открыт',
  RESOLVED: 'Решён',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DisputesListPage() {
  const [disputes, setDisputes] = useState<DisputeSummary[] | null>(null);

  useEffect(() => {
    fetchMyDisputes().then(setDisputes);
  }, []);

  if (disputes === null) return <div className="p-8 text-ink-soft">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-[560px] p-6">
      <h1 className="mb-4 text-lg font-extrabold text-ink">Мои споры</h1>
      {disputes.length === 0 && <p className="text-sm text-ink-soft">У вас нет споров.</p>}
      <div className="space-y-2">
        {disputes.map((d) => (
          <Link
            key={d.id}
            href={`/disputes/${d.id}`}
            className="flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:bg-fill-faint"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">{d.reason}</div>
              <div className="mt-1 text-xs text-ink-soft">{formatDate(d.createdAt)}</div>
            </div>
            <span
              className={`ml-3 shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${
                d.status === 'OPEN' ? 'bg-warning-bg text-warning-ink' : 'bg-fill-soft text-ink-soft'
              }`}
            >
              {STATUS_LABEL[d.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ручная проверка через preview-тул**

Запустить dev-сервер (`preview_start`), открыть `/disputes` под мастером без споров — убедиться, что видно "У вас нет споров.". Через `preview_screenshot` подтвердить рендер.
Expected: страница рендерится без консольных ошибок (`preview_console_logs`), пустое состояние отображается.

- [ ] **Step 3: Коммит**

```bash
git add "apps/master/app/(app)/disputes/page.tsx"
git commit -m "feat(master): экран списка споров"
```

---

### Task 6: Frontend — экран деталей спора

**Files:**
- Create: `apps/master/components/DisputeDetailView.tsx`
- Create: `apps/master/app/(app)/disputes/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchMyDisputes`, `fetchDisputeContext`, `fetchDisputeEvidence`, `submitCounterStatement`, `uploadDisputeEvidence`, `DisputeDetail`, `DisputeEvidence` из `@/lib/disputes` (Task 3).
- Produces: `DisputeDetailView({ disputeId }: { disputeId: string })` — самодостаточный компонент, роут передаёт только `id` из URL.

- [ ] **Step 1: Создать `DisputeDetailView`**

```typescript
'use client';
import { useEffect, useState } from 'react';
import {
  fetchMyDisputes,
  fetchDisputeContext,
  fetchDisputeEvidence,
  submitCounterStatement,
  uploadDisputeEvidence,
  type DisputeDetail,
  type DisputeEvidence,
} from '@/lib/disputes';

export function DisputeDetailView({ disputeId }: { disputeId: string }) {
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const summaries = await fetchMyDisputes();
    const summary = summaries.find((d) => d.id === disputeId);
    if (!summary) {
      setError('Спор не найден');
      return;
    }
    const kind = summary.orderId ? 'orders' : 'planned-orders';
    const targetId = summary.orderId ?? summary.plannedOrderId!;
    const [context, evidenceList] = await Promise.all([
      fetchDisputeContext(kind, targetId),
      fetchDisputeEvidence(disputeId),
    ]);
    setDispute(context.dispute);
    setEvidence(evidenceList);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [disputeId]);

  async function send() {
    if (!window.confirm('Пояснение нельзя будет изменить после отправки. Отправить?')) return;
    setError('');
    setSubmitting(true);
    try {
      const updated = await submitCounterStatement(disputeId, draft);
      setDispute(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError('');
    setUploading(true);
    try {
      await uploadDisputeEvidence(disputeId, file);
      const evidenceList = await fetchDisputeEvidence(disputeId);
      setEvidence(evidenceList);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!dispute) {
    return <div className="p-8 text-ink-soft">{error || 'Загрузка…'}</div>;
  }

  const clientPhotos = evidence.filter((e) => !e.isMine);
  const myPhotos = evidence.filter((e) => e.isMine);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-lg font-extrabold text-ink">Спор по заявке №{dispute.id.slice(0, 8)}</h1>
        <span
          className={`rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${
            dispute.status === 'OPEN' ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink'
          }`}
        >
          {dispute.status === 'OPEN' ? 'Открыт' : 'Решён'}
        </span>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <div className="mb-1 text-xs font-bold uppercase text-ink-soft">Заявление клиента</div>
        <div className="text-sm text-ink">{dispute.reason}</div>
        {clientPhotos.length > 0 && (
          <div className="mt-2 text-xs text-ink-soft">Фото клиента: {clientPhotos.length}</div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-extrabold text-ink">Моё пояснение</div>
        {dispute.counterStatement ? (
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-ink">
            {dispute.counterStatement}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Опишите свою позицию по спору"
              className="min-h-24 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={send}
              disabled={submitting || !draft.trim()}
              className="rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
            >
              Отправить
            </button>
          </div>
        )}
      </div>

      {dispute.status === 'OPEN' && (
        <div>
          <div className="mb-2 text-sm font-extrabold text-ink">
            Мои фото {myPhotos.length > 0 && <span className="text-xs font-semibold text-ink-soft">({myPhotos.length})</span>}
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-xl text-primary">
            {uploading ? '…' : '＋'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-danger">{error}</p>}

      {dispute.status === 'RESOLVED' && (
        <div className="rounded-md bg-fill p-4 text-sm text-ink">
          <div className="mb-1 text-xs font-bold uppercase text-ink-soft">Исход</div>
          {dispute.resolutionNote && <p>{dispute.resolutionNote}</p>}
          {dispute.refundServiceFee !== null && (
            <p className="mt-1 text-xs text-ink-soft">
              {dispute.refundServiceFee ? 'Клиенту возвращён сервисный сбор' : 'Возврат сервисного сбора не производился'}
            </p>
          )}
          {dispute.penalizeMaster !== null && (
            <p className="mt-1 text-xs text-ink-soft">
              {dispute.penalizeMaster ? 'К вам применён штраф' : 'Штраф не применён'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Создать роут-обёртку**

```typescript
'use client';
import { useParams } from 'next/navigation';
import { DisputeDetailView } from '@/components/DisputeDetailView';

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <DisputeDetailView disputeId={id} />;
}
```

- [ ] **Step 3: Ручная проверка через preview-тул — сквозной сценарий**

1. Через API (`curl` или тестовые e2e-хелперы вручную в консоли) создать заказ, довести до `DONE`, открыть спор клиентом с `reason: 'Тест'`.
2. Войти в `apps/master` под мастером этого заказа, открыть `/disputes` — убедиться, что спор виден в списке со статусом "Открыт".
3. Открыть карточку спора — убедиться, что видно заявление клиента, есть поле для пояснения и загрузки фото.
4. Ввести текст, нажать "Отправить", подтвердить в диалоге — убедиться, что после отправки текстовое поле исчезает и показывается отправленное пояснение как read-only.
5. Загрузить фото — убедиться, что счётчик "Мои фото" увеличивается, ошибок в `preview_console_logs` нет.
Expected: все шаги проходят без консольных ошибок; `preview_network` показывает `PATCH /disputes/:id` и `POST /disputes/:id/evidence` с кодом 200/201.

- [ ] **Step 4: Коммит**

```bash
git add apps/master/components/DisputeDetailView.tsx "apps/master/app/(app)/disputes/[id]/page.tsx"
git commit -m "feat(master): экран деталей спора — заявление клиента, пояснение мастера, исход"
```

---

## Самопроверка плана

**Покрытие спеки:**
- "Мастер видит список споров" → Task 4 (бейдж) + Task 5 (список). ✓
- "Читает заявление клиента и фото" → Task 6, блок "Заявление клиента" + `clientPhotos`. ✓
- "Подаёт пояснение (текст + фото), один раз" → Task 6, блок "Моё пояснение" + confirm-диалог + read-only после отправки. ✓
- "Видит исход" → Task 6, блок "Исход" (условие `status === 'RESOLVED'`). ✓
- Backend: список своих споров, список evidence с авторством → Task 1, Task 2. ✓
- "Нет реалтайма, бейдж по факту захода" → Task 4, `useEffect` без сокетов. ✓
- "Только ответ на спор клиента, не открытие" → в `DisputeDetailView` нет формы открытия спора, только ответ. ✓

**Плейсхолдеры:** отсутствуют, весь код — рабочие сниппеты.

**Согласованность типов:** `DisputeSummary`/`DisputeDetail`/`DisputeEvidence` определены один раз в Task 3 и используются с теми же именами полей в Task 4–6 (`status`, `reason`, `createdAt`, `isMine`, `uploadedByUserId`, `counterStatement`, `resolutionNote`, `refundServiceFee`, `penalizeMaster`).
