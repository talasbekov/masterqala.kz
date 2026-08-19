# Флоу мастера, мобильный ретрофит — Фаза A: каркас + presence + оффер

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `apps/master` адаптивным для первой фазы мобильного прототипа — навигация, presence-тумблер, KPI-сводка, входящий оффер.

**Architecture:** Ретрофит на месте (не отдельный workspace-пакет). Один роут на функцию, десктопная и мобильная раскладки — парные presentation-компоненты внутри одного и того же дерева, переключаемые CSS-парой `hidden md:flex` / `flex md:hidden` (брейкпоинт `md` = 768px). Общий data-слой (`lib/masterPresence.tsx`, `lib/masterStats.ts`) без дублирования между раскладками. Полная спека: `docs/superpowers/specs/2026-08-19-master-flow-mobile-design.md`.

**Tech Stack:** NestJS + Prisma (бэкенд, `apps/api`), Next.js 15 App Router + Tailwind CSS 4 (`apps/master`), Jest + supertest (бэкенд e2e), `@masterqala/ui` (общие иконки).

## Global Constraints

- Бэкенд не меняется, кроме одного явно одобренного исключения: новый `GET /masters/me/stats` (см. спеку, раздел «Фаза A»).
- Брейкпоинт для переключения раскладок — `md` (768px), CSS-парность, не JS-детект вьюпорта (риск гидратационного мисматча).
- Все данные и обработчики общие для десктопной и мобильной раскладки — ни один API-вызов не дублируется.
- Фронтенд-тестов на TypeScript-проекте нет осознанно (конвенция всего веб-редизайна) — верификация фронтенд-задач через `tsc --noEmit` + `pnpm --filter master build` + живую браузерную проверку на двух вьюпортах (390px и десктоп).
- Звук+вибрация на входящий оффер (`beepAndVibrate()` в `lib/masterPresence.tsx`) уже реализованы и работают независимо от вьюпорта — этот пункт спеки НЕ требует новой работы, только подтверждения, что мобильный вариант оффера его не дублирует и не ломает.

---

### Task 1: `MastersService.getMyStats` — бэкенд-агрегат для KPI-карточек

**Files:**
- Modify: `apps/api/src/masters/masters.service.ts`
- Test: `apps/api/src/masters/masters.service.spec.ts` (новый файл)

**Interfaces:**
- Consumes: `PrismaService` (уже инжектирован в `MastersService`), `ReviewsService.getMasterRatingSummary(masterUserId: string): Promise<{ rating: number | null; reviewCount: number }>` (существует, `apps/api/src/reviews/reviews.service.ts`).
- Produces: `MastersService.getMyStats(userId: string): Promise<MasterStats>`, где
  ```ts
  export interface MasterStats {
    completedCount: number;
    earnings: number;
    rating: number | null;
    reviewCount: number;
  }
  ```
  Task 2 использует этот метод и тип напрямую.

- [ ] **Step 1: Добавить зависимость `ReviewsService` в конструктор `MastersService`**

В `apps/api/src/masters/masters.service.ts` добавить импорт и параметр конструктора:

```ts
import { ReviewsService } from '../reviews/reviews.service';
```

В классе `MastersService`, в существующем конструкторе (после `private readonly fileScans: PersistentFileScansService,` и перед `@Inject(FILE_STORAGE) private readonly storage: FileStorage,`) добавить:

```ts
    private readonly reviews: ReviewsService,
```

- [ ] **Step 2: Написать падающий unit-тест**

Создать `apps/api/src/masters/masters.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PersistentFileScansService } from '../storage/persistent-file-scans.service';
import { FILE_STORAGE } from '../storage/storage.interface';
import { ReviewsService } from '../reviews/reviews.service';
import { MastersService } from './masters.service';

describe('MastersService.getMyStats', () => {
  let service: MastersService;
  let prisma: { order: { count: jest.Mock }; plannedOrder: { count: jest.Mock }; accrual: { aggregate: jest.Mock } };
  let reviews: { getMasterRatingSummary: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: { count: jest.fn() },
      plannedOrder: { count: jest.fn() },
      accrual: { aggregate: jest.fn() },
    };
    reviews = { getMasterRatingSummary: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MastersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PersistentFileScansService, useValue: {} },
        { provide: FILE_STORAGE, useValue: {} },
        { provide: ReviewsService, useValue: reviews },
      ],
    }).compile();
    service = moduleRef.get(MastersService);
  });

  it('суммирует завершённые срочные и плановые заявки, заработок и рейтинг', async () => {
    prisma.order.count.mockResolvedValue(7);
    prisma.plannedOrder.count.mockResolvedValue(3);
    prisma.accrual.aggregate.mockResolvedValue({ _sum: { amount: 42000 } });
    reviews.getMasterRatingSummary.mockResolvedValue({ rating: 4.8, reviewCount: 12 });

    const stats = await service.getMyStats('m1');

    expect(stats).toEqual({ completedCount: 10, earnings: 42000, rating: 4.8, reviewCount: 12 });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { masterId: 'm1', status: 'CLOSED' } });
    expect(prisma.plannedOrder.count).toHaveBeenCalledWith({ where: { masterId: 'm1', status: 'CLOSED' } });
    expect(prisma.accrual.aggregate).toHaveBeenCalledWith({ where: { masterUserId: 'm1' }, _sum: { amount: true } });
    expect(reviews.getMasterRatingSummary).toHaveBeenCalledWith('m1');
  });

  it('заработок 0, если начислений ещё не было', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.plannedOrder.count.mockResolvedValue(0);
    prisma.accrual.aggregate.mockResolvedValue({ _sum: { amount: null } });
    reviews.getMasterRatingSummary.mockResolvedValue({ rating: null, reviewCount: 0 });

    const stats = await service.getMyStats('m1');

    expect(stats).toEqual({ completedCount: 0, earnings: 0, rating: null, reviewCount: 0 });
  });
});
```

- [ ] **Step 2b: Запустить тест, убедиться что падает**

Run: `pnpm --filter api test -- --runInBand masters.service`
Expected: FAIL — `service.getMyStats is not a function`

- [ ] **Step 3: Реализовать `getMyStats`**

В `apps/api/src/masters/masters.service.ts`, в классе `MastersService`, добавить метод (рядом с другими публичными методами, например после `getDocumentStatus`):

```ts
  async getMyStats(userId: string): Promise<MasterStats> {
    const [orderCount, plannedCount, accrualAgg, ratingSummary] = await Promise.all([
      this.prisma.order.count({ where: { masterId: userId, status: 'CLOSED' } }),
      this.prisma.plannedOrder.count({ where: { masterId: userId, status: 'CLOSED' } }),
      this.prisma.accrual.aggregate({ where: { masterUserId: userId }, _sum: { amount: true } }),
      this.reviews.getMasterRatingSummary(userId),
    ]);
    return {
      completedCount: orderCount + plannedCount,
      earnings: accrualAgg._sum.amount ?? 0,
      rating: ratingSummary.rating,
      reviewCount: ratingSummary.reviewCount,
    };
  }
```

Добавить экспортируемый интерфейс `MasterStats` в начало файла (рядом с `PROFILE_INCLUDE`):

```ts
export interface MasterStats {
  completedCount: number;
  earnings: number;
  rating: number | null;
  reviewCount: number;
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `pnpm --filter api test -- --runInBand masters.service`
Expected: PASS, 2/2

- [ ] **Step 5: Коммит**

```bash
git add apps/api/src/masters/masters.service.ts apps/api/src/masters/masters.service.spec.ts
git commit -m "feat(masters): getMyStats — агрегат KPI для мобильной сводки мастера"
```

---

### Task 2: `GET /masters/me/stats` — контроллер + модуль + e2e

**Files:**
- Modify: `apps/api/src/masters/masters.controller.ts`
- Modify: `apps/api/src/masters/masters.module.ts`
- Test: `apps/api/test/masters-stats.e2e-spec.ts` (новый файл)

**Interfaces:**
- Consumes: `MastersService.getMyStats(userId: string): Promise<MasterStats>` (Task 1).
- Produces: маршрут `GET /api/v1/masters/me/stats`, JWT-защищён, отдаёт `MasterStats` JSON. Task 3 (фронтенд) вызывает этот маршрут.

- [ ] **Step 1: Импортировать `ReviewsModule` в `MastersModule`**

В `apps/api/src/masters/masters.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [StorageModule, ReviewsModule],
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService],
})
export class MastersModule {}
```

- [ ] **Step 2: Добавить маршрут в контроллер**

В `apps/api/src/masters/masters.controller.ts`, после метода `documentStatus`:

```ts
  @Get('masters/me/stats')
  @UseGuards(JwtAuthGuard)
  getMyStats(@CurrentUser() user: User) {
    return this.masters.getMyStats(user.id);
  }
```

- [ ] **Step 3: Написать падающий e2e-тест**

Создать `apps/api/test/masters-stats.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, createActiveMaster, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /masters/me/stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => { await resetDb(app); });

  it('без авторизации — 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/masters/me/stats').expect(401);
  });

  it('свежий мастер без заказов — все нули, рейтинг null', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77012220001', plumbing.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/me/stats')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);

    expect(res.body).toEqual({ completedCount: 0, earnings: 0, rating: null, reviewCount: 0 });
  });

  it('суммирует закрытые срочные и плановые заявки + начисления', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77012220002', plumbing.id);
    const client = await prisma.user.create({ data: { phone: '+77012220099', role: 'CLIENT' } });

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        masterId: master.userId,
        categoryId: plumbing.id,
        status: 'CLOSED',
        description: 'x',
        address: 'x',
        calloutPrice: 3000,
        serviceFee: 1000,
        commercialMode: 'PAID_MOCK',
      },
    });
    await prisma.accrual.create({
      data: { masterUserId: master.userId, orderId: order.id, type: 'CALLOUT_COMPENSATION', amount: 2000 },
    });
    await prisma.plannedOrder.create({
      data: {
        clientId: client.id,
        masterId: master.userId,
        categoryId: plumbing.id,
        status: 'CLOSED',
        description: 'x',
        address: 'x',
        district: 'x',
        commercialMode: 'PAID_MOCK',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/me/stats')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);

    expect(res.body).toEqual({ completedCount: 2, earnings: 2000, rating: null, reviewCount: 0 });
  });
});
```

- [ ] **Step 4: Запустить тест, убедиться что падает**

Run: `pnpm --filter api test:e2e -- --runInBand masters-stats`
Expected: FAIL до Step 1-2 (маршрута не существует — 404) либо ошибка DI, если модуль не подключён

Обязательные поля `Order`/`PlannedOrder` в тестовых данных выше уже сверены с `apps/api/prisma/schema.prisma` на момент написания этого плана: у `Order` нет поля `district` (только `address`), у `PlannedOrder` обязательны оба — `address` и `district`. Если к моменту реализации схема успела измениться — свериться заново.

- [ ] **Step 5: Запустить полный e2e-прогон, убедиться что новый файл проходит и остальные не сломаны**

Run: `pnpm --filter api test:e2e -- --runInBand masters-stats`
Expected: PASS, 3/3

Затем полный прогон (может занять 2-3 минуты):
Run: `pnpm --filter api test:e2e`
Expected: все сьюты зелёные, включая новый

- [ ] **Step 6: Коммит**

```bash
git add apps/api/src/masters/masters.controller.ts apps/api/src/masters/masters.module.ts apps/api/test/masters-stats.e2e-spec.ts
git commit -m "feat(masters): GET /masters/me/stats"
```

---

### Task 3: Фронтенд — типизированный клиент статистики

**Files:**
- Create: `apps/master/lib/masterStats.ts`

**Interfaces:**
- Consumes: `api(path: string): Promise<any>` из `apps/master/lib/api.ts` (существует).
- Produces: `fetchMasterStats(): Promise<MasterStats>`, тип `MasterStats` — Task 6 использует оба.

- [ ] **Step 1: Создать файл**

```ts
import { api } from './api';

export interface MasterStats {
  completedCount: number;
  earnings: number;
  rating: number | null;
  reviewCount: number;
}

export function fetchMasterStats(): Promise<MasterStats> {
  return api('/masters/me/stats');
}
```

- [ ] **Step 2: Тайпчек**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок

- [ ] **Step 3: Коммит**

```bash
git add apps/master/lib/masterStats.ts
git commit -m "feat(master): клиент GET /masters/me/stats"
```

---

### Task 4: Fix `UrgentOffer.address` → `district` + пометить Sidebar как десктопный

**Files:**
- Modify: `apps/master/lib/masterPresence.tsx`
- Modify: `apps/master/components/OfferOverlay.tsx`
- Modify: `apps/master/components/Sidebar.tsx`

**Interfaces:**
- Consumes: н/д (чистый рефакторинг существующих типов/вёрстки).
- Produces: `UrgentOffer.district?: string` вместо `address?: string` — Task 7 (мобильный оффер) использует новое поле. `Sidebar` теперь обёрнут в `hidden md:flex` — Task 5 полагается на то, что `Sidebar` больше не виден на мобильном.

- [ ] **Step 1: Переименовать поле в типе**

В `apps/master/lib/masterPresence.tsx`, интерфейс `UrgentOffer`:

```ts
export interface UrgentOffer {
  orderId: string;
  category: string;
  description: string;
  district?: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string;
}
```

(было `address?: string` — переименовать в `district?: string`, остальные поля без изменений).

- [ ] **Step 2: Обновить рендер в десктопном `OfferOverlay`**

В `apps/master/components/OfferOverlay.tsx`, строка `{offer.address && <p className="text-sm text-ink-soft">{offer.address}</p>}` заменить на:

```tsx
        {offer.district && <p className="text-sm text-ink-soft">{offer.district}</p>}
```

- [ ] **Step 3: Обернуть `Sidebar` в CSS-парность**

В `apps/master/components/Sidebar.tsx`, у корневого `<aside>` заменить класс `"flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4"` на:

```tsx
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 md:flex">
```

(добавлен `hidden` в начало и `md:flex` в конец — на мобильном сайдбар не рендерится визуально, на `md`+ ведёт себя как раньше).

- [ ] **Step 4: Тайпчек и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок

- [ ] **Step 5: Коммит**

```bash
git add apps/master/lib/masterPresence.tsx apps/master/components/OfferOverlay.tsx apps/master/components/Sidebar.tsx
git commit -m "fix(master): offer.district вместо неиспользуемого address, Sidebar только на md+"
```

---

### Task 5: `BottomTabBar` — мобильная навигация

**Files:**
- Create: `apps/master/components/BottomTabBar.tsx`
- Modify: `apps/master/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `useMasterPresence()` из `lib/masterPresence.tsx` (поле `offer` — для красного `⚡` на FAB при активном заказе, см. Step 1), иконки `WrenchIcon`/`UserIcon` из `@masterqala/ui`.
- Produces: компонент `BottomTabBar`, рендерится в layout рядом с `Sidebar`.

- [ ] **Step 1: Создать компонент**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WrenchIcon, UserIcon } from '@masterqala/ui';
import { useMasterPresence } from '@/lib/masterPresence';

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${active ? 'text-primary' : 'text-ink-soft'}`;

export function BottomTabBar() {
  const pathname = usePathname();
  const { offer } = useMasterPresence();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border bg-surface px-1 pb-1 pt-1.5 md:hidden">
      <Link href="/" className={tabClass(pathname === '/')}>
        <WrenchIcon className="h-5 w-5" />
        Работа
      </Link>
      <Link href="/planned" className={tabClass(pathname === '/planned')}>
        <span className="text-lg leading-5">📅</span>
        Плановые
      </Link>
      <div className="flex flex-1 justify-center">
        <Link
          href="/"
          className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full text-xl text-white shadow-card ${
            offer ? 'bg-danger' : 'bg-primary'
          }`}
          aria-label="Работа"
        >
          {offer ? '⚡' : '🛠'}
        </Link>
      </div>
      <Link href="/wallet" className={tabClass(pathname === '/wallet')}>
        <span className="text-lg leading-5">💳</span>
        Кошелёк
      </Link>
      <Link href="/become-master" className={tabClass(pathname === '/become-master')}>
        <UserIcon className="h-5 w-5" />
        Профиль
      </Link>
    </nav>
  );
}
```

*Примечание:* пункт «Плановые» (`/planned`) как отдельный роут ещё не существует — сейчас плановая лента живёт как вкладка внутри `/` (`app/(app)/page.tsx`, стейт `tab`). Ссылка временно ведёт на несуществующий отдельный роут — если Фаза C (плановая лента) ещё не реализована на момент этой задачи, заменить `href="/planned"` на `href="/"` (тот же роут, что и «Работа») до появления отдельного роута в Фазе C. Проверить перед реализацией: если `/planned` уже существует к этому моменту — использовать его; если нет — использовать `/`.

- [ ] **Step 2: Подключить в layout рядом с `Sidebar`**

В `apps/master/app/(app)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/Sidebar';
import { BottomTabBar } from '@/components/BottomTabBar';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterPresenceProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <BottomTabBar />
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
```

(добавлен импорт `BottomTabBar`, рендер `<BottomTabBar />` после закрывающего `</div>` основного флекса; `<main>` получил `pb-16 md:pb-0`, чтобы контент не перекрывался фиксированной панелью на мобильном).

- [ ] **Step 3: Тайпчек и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок

- [ ] **Step 4: Коммит**

```bash
git add apps/master/components/BottomTabBar.tsx apps/master/app/\(app\)/layout.tsx
git commit -m "feat(master): BottomTabBar — мобильная навигация в паре с Sidebar"
```

---

### Task 6: Мобильный presence-тумблер + KPI-карточки на `/`

**Files:**
- Modify: `apps/master/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `useMasterPresence()` (поля `online`, `connected`, `geoDenied`, `goOnline`, `goOffline` — уже используются в `Sidebar`, теперь и здесь), `fetchMasterStats()` из `lib/masterStats.ts` (Task 3).
- Produces: н/д (терминальный UI-блок).

- [ ] **Step 1: Добавить импорты и состояние статистики**

В `apps/master/app/(app)/page.tsx`, добавить в блок импортов:

```tsx
import { useMasterPresence } from '@/lib/masterPresence';
import { fetchMasterStats, type MasterStats } from '@/lib/masterStats';
```

В теле компонента `WorkDashboardPage`, рядом с существующими `useState`:

```tsx
  const { online, connected, geoDenied, goOnline, goOffline } = useMasterPresence();
  const [stats, setStats] = useState<MasterStats | null>(null);

  useEffect(() => {
    fetchMasterStats().then(setStats).catch(() => setStats(null));
  }, []);
```

- [ ] **Step 2: Вставить мобильный блок перед переключателем «Срочные/Плановые»**

В JSX, непосредственно перед `<div className="mx-auto mt-8 flex w-full max-w-[480px] rounded-pill border border-border p-1">` (переключатель вкладок), добавить:

```tsx
      <div className="mx-4 mt-4 flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <div>
            <div className="text-sm font-extrabold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
            <div className="text-xs text-ink-soft">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
            {geoDenied && <div className="mt-1 text-xs text-danger">Нет доступа к геолокации</div>}
          </div>
          <button
            type="button"
            onClick={online ? goOffline : goOnline}
            className={`rounded-pill px-4 py-2 text-xs font-extrabold text-white ${online ? 'bg-ink-soft' : 'bg-primary'}`}
          >
            {online ? 'Выйти' : 'На линию'}
          </button>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="text-lg font-extrabold text-ink">{stats.completedCount}</div>
              <div className="text-[10px] font-bold text-ink-soft">заказов</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="text-lg font-extrabold text-ink">{stats.earnings} ₸</div>
              <div className="text-[10px] font-bold text-ink-soft">заработок</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="text-lg font-extrabold text-ink">{stats.rating ? stats.rating.toFixed(1) : '—'}</div>
              <div className="text-[10px] font-bold text-ink-soft">рейтинг</div>
            </div>
          </div>
        )}
      </div>
```

Этот блок виден только на мобильном (`md:hidden`) — на десктопе presence-тумблер остаётся в `Sidebar`, KPI-карточек на десктопе нет (не было в исходной спеке для десктопа).

- [ ] **Step 3: Тайпчек и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок

- [ ] **Step 4: Коммит**

```bash
git add apps/master/app/\(app\)/page.tsx
git commit -m "feat(master): мобильный presence-тумблер и KPI-карточки на /"
```

---

### Task 7: Мобильный полноэкранный оффер

**Files:**
- Create: `apps/master/components/OfferOverlayMobile.tsx`
- Modify: `apps/master/components/OfferOverlay.tsx`

**Interfaces:**
- Consumes: `useMasterPresence()` (`offer`, `offerNote`, `acceptingOffer`, `acceptOffer`, `dismissOfferNote`), `useCountdown(deadline)` из `lib/useCountdown.ts`.
- Produces: н/д (терминальный UI-компонент, экспортируется как именованный `OfferOverlayMobile`).

- [ ] **Step 1: Создать мобильный компонент**

```tsx
'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlayMobile() {
  const { offer, offerNote, acceptingOffer, acceptOffer, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return null;
    return (
      <div className="fixed inset-x-4 bottom-20 z-50 flex items-start gap-3 rounded-md border border-border bg-fill-soft p-3 text-sm text-ink-soft shadow-lg md:hidden">
        <p className="flex-1">{offerNote}</p>
        <button type="button" onClick={dismissOfferNote} aria-label="Скрыть уведомление" className="text-ink-soft">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#123B52] p-5 pb-8 text-white md:hidden">
      <div className="mb-auto mt-10 text-center">
        <div className="inline-block rounded-pill bg-danger px-4 py-1.5 text-sm font-extrabold">
          {secondsLeft} с
        </div>
      </div>
      <div className="space-y-3 text-center">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/70">
          Новая заявка{offer.district ? ` · ${offer.district}` : ''} · {offer.distanceKm} км
        </div>
        <h2 className="text-2xl font-extrabold">{offer.category}</h2>
        <p className="text-sm text-white/80">{offer.description}</p>
        <p className="text-xs text-white/60">Точный адрес — после принятия</p>
        {offer.freePilot ? (
          <div className="rounded-md bg-white/10 p-3 text-sm font-semibold">
            Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
          </div>
        ) : (
          <div className="text-xl font-extrabold">Вам за выезд {offer.compensation} ₸</div>
        )}
      </div>
      <div className="mt-8 space-y-2">
        <button
          type="button"
          disabled={acceptingOffer}
          onClick={acceptOffer}
          className="w-full rounded-pill bg-white p-4 text-base font-extrabold text-[#123B52] disabled:opacity-40"
        >
          {acceptingOffer ? 'Принимаем…' : `Принять (${secondsLeft} с)`}
        </button>
        <button type="button" onClick={dismissOfferNote} className="w-full p-2 text-sm font-bold text-white/70">
          Пропустить
        </button>
      </div>
    </div>
  );
}
```

*Примечание:* «Пропустить» вызывает `dismissOfferNote()` — это очищает `offerNote`, но не сам активный `offer` (в текущем `MasterPresenceProvider` нет отдельного метода «явно отклонить оффер», только истечение по таймеру через `offer:closed` с сервера или `acceptOffer`). Оффер пропадёт сам по истечении дедлайна. Это не баг этой задачи — так же ведёт себя десктопный `OfferOverlay`, у которого вообще нет кнопки «Пропустить». Если нужно явное отклонение раньше таймаута — отдельная бэкенд+фронтенд задача вне Фазы A.

- [ ] **Step 2: Подключить в паре с десктопным вариантом**

В `apps/master/components/OfferOverlay.tsx`, обернуть корневой `<div className="fixed inset-0 z-50 flex items-center...">` (полноэкранная модалка с офером) в `hidden md:flex`, и аналогично блок уведомления (`fixed bottom-6 right-6...`) — в `hidden md:flex`. Добавить рендер `OfferOverlayMobile` рядом.

Итоговый файл `apps/master/components/OfferOverlay.tsx`:

```tsx
'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';
import { OfferOverlayMobile } from './OfferOverlayMobile';

export function OfferOverlay() {
  const { offer, offerNote, acceptingOffer, acceptOffer, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return <OfferOverlayMobile />;
    return (
      <>
        <div className="hidden md:flex fixed bottom-6 right-6 z-50 w-full max-w-[360px] items-start gap-3 rounded-md border border-border bg-fill-soft p-3 text-sm text-ink-soft shadow-lg">
          <p className="flex-1">{offerNote}</p>
          <button
            type="button"
            onClick={dismissOfferNote}
            aria-label="Скрыть уведомление"
            className="text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>
        <OfferOverlayMobile />
      </>
    );
  }

  return (
    <>
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center bg-ink/40 p-6">
        <div className="w-full max-w-[420px] space-y-3 rounded-lg bg-surface p-6 text-center shadow-xl">
          <div className="text-xs font-extrabold uppercase text-ink-soft">
            Новая заявка · {offer.distanceKm} км
          </div>
          <h2 className="text-xl font-extrabold text-ink">{offer.category}</h2>
          <p className="text-sm text-ink-soft">{offer.description}</p>
          {offer.district && <p className="text-sm text-ink-soft">{offer.district}</p>}
          {offer.freePilot ? (
            <div className="rounded-md bg-fill-soft p-3 text-sm font-semibold text-ink">
              Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
            </div>
          ) : (
            <div className="text-lg font-extrabold text-primary">Компенсация выезда: {offer.compensation} ₸</div>
          )}
          <button
            type="button"
            disabled={acceptingOffer}
            onClick={acceptOffer}
            className="w-full rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {acceptingOffer ? 'Принимаем…' : `Принять (${secondsLeft} с)`}
          </button>
        </div>
      </div>
      <OfferOverlayMobile />
    </>
  );
}
```

*Обоснование:* `OfferOverlayMobile` рендерится в обеих ветках (`!offer` и активный `offer`) — сам компонент внутри себя переключается по тому же состоянию `offer`/`offerNote` из того же `useMasterPresence()`, поэтому дублирования логики нет, просто оба варианта (десктоп/мобильный) всегда присутствуют в дереве и видимость решает CSS. Ветка `if (!offer) { if (!offerNote) return <OfferOverlayMobile />; ...}` — когда ни оффера, ни notification нет, возвращаем только `OfferOverlayMobile` (сам он тоже вернёт `null` в этом случае, но так убирается лишний фрагмент).

- [ ] **Step 3: Тайпчек и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок

- [ ] **Step 4: Коммит**

```bash
git add apps/master/components/OfferOverlayMobile.tsx apps/master/components/OfferOverlay.tsx
git commit -m "feat(master): полноэкранный мобильный оффер в паре с десктопной модалкой"
```

---

### Task 8: Сквозная живая проверка на двух вьюпортах

**Files:** нет (только верификация, без изменений кода).

**Interfaces:** н/д.

- [ ] **Step 1: Полный прогон бэкенда**

Run: `pnpm --filter api test -- --runInBand && pnpm --filter api test:e2e`
Expected: все unit и e2e зелёные, включая новые из Task 1-2

- [ ] **Step 2: Полный билд фронтенда**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок

- [ ] **Step 3: Поднять dev-серверы и живьём проверить на мобильном вьюпорте (390px)**

Через `preview_start` (`relaxed-api`, `relaxed-master` — см. `.claude/launch.json`), затем `preview_resize` на 390×844.

Сценарий (мастер с активным профилем, реквизитами и т.д. — по прецеденту `createActiveMaster`, вживую через прямой SQL-сид, как делалось для аналогичных проверок ранее в этом проекте):
1. `/` — виден `BottomTabBar` внизу (5 пунктов), `Sidebar` не виден.
2. Тумблер «На линии»/«Выйти» работает в теле страницы, KPI-карточки показывают числа (0 для свежего мастера).
3. Отправить оффер второму тестовому мастеру или тому же напрямую через сокет/SQL — на экране появляется полноэкранный тёмный оверлей с таймером, категорией, районом+дистанцией, «точный адрес — после принятия», кнопкой «Принять».
4. Принять оффер — оверлей закрывается.
5. Проверить консоль браузера на ошибки (`preview_console_logs`).

Через `preview_snapshot` (не `preview_screenshot` — в этом окружении он ловился ненадёжным в предыдущих циклах этого проекта).

- [ ] **Step 4: Тот же сценарий на десктопном вьюпорте (1280px)**

`preview_resize` на 1280×800. Проверить: `Sidebar` виден, `BottomTabBar` не виден, оффер приходит в виде центрированной модалки (не полноэкранной тёмной), presence-тумблер и KPI-блок из Task 6 не видны (они `md:hidden`).

- [ ] **Step 5: Зафиксировать результат**

Если найдены расхождения с ожидаемым — завести их как самостоятельные шаги фикса перед тем, как считать Фазу A завершённой (не переносить в Фазу B молча).
