# Клиентский флоу (десктоп) — Фаза C: плановый режим — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести плановый режим заявки (визард `/planned/new`, статус-driven
`/planned/:id`, таблица сравнения ставок `/planned/:id/compare`, спор) из
`apps/web/src/features/client-v2` в `apps/client` под десктопную раскладку.

**Architecture:** Продолжение Фаз A/B — гибрид RSC-шелл (не трогается) +
клиентские страницы. В отличие от Фазы B, здесь **нет карты вообще**
(плановый режим не использует геоданные) — все экраны узкая центрированная
колонка (`mx-auto w-full max-w-[560px]`), кроме таблицы сравнения, которая
растягивается на всю ширину контента. `PlannedOrderDetail`/`PlannedBid`/
`PlannedBidMaster`/`PlannedOrderMaster` выносятся в отдельный
`lib/plannedOrderTypes.ts` (тот же приём, что `lib/orderTypes.ts` в Фазе B).
`DisputeView` (Фаза B, проп `kind`) переиспользуется без единой правки —
только новая тонкая страница-обёртка с `kind="planned-orders"`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind
CSS 4, `react-i18next`, `socket.io-client` (все — уже есть с Фаз A/B, новых
зависимостей не требуется).

## Global Constraints

- Бэкенд (`apps/api`) не меняется — используются только существующие
  эндпоинты: `GET /planned-orders/:id`, `POST /planned-orders`,
  `POST /planned-orders/:id/{cancel, select, confirm-completion, review}`,
  `GET /addresses`, `GET /categories`, `POST /uploads`. Мастер-side (только
  для финальной живой проверки, не для кода клиента): `POST
  /planned-orders/:id/bids`, `POST /planned-orders/:id/confirm`. Сокет-события
  `bid:new` и `planned:status` (оба эмитятся `apps/api/src/planned-orders/planned-orders.service.ts`).
- Константы бэкенда (не менять, только читать на фронте как обычные числа):
  `PLANNED_HORIZON_DAYS = 14`, `PLANNED_MAX_BIDS = 5`,
  `PLANNED_CONFIRM_TIMEOUT_S = 2 * 3600` (`apps/api/src/planned-orders/planned-order.constants.ts`).
- Юнит-тестов на фронте нет (та же практика Фаз A/B) — верификация каждой
  задачи через `pnpm --filter client build`.
- Каждый перенесённый файл сверяется построчно с оригиналом в
  `apps/web/src/features/client-v2/` — логика/тексты/i18n-ключи не меняются
  (все нужные ключи `plannedNew.*`/`plannedDetail.*` уже присутствуют в
  `apps/client/lib/locales/ru.json`, перенесены в Фазе A вместе со всей
  структурой файла — новых ключей добавлять не нужно). Меняется только:
  (а) адаптации Next.js (`react-router-dom` → `next/navigation`), (б)
  раскладка — узкая центрированная колонка везде (кроме compare), (в) явно
  оговорённые в задачах отступления.
- Импорты — через alias `@/...` (как в Фазах A/B), не относительные пути.
- Ссылки на ещё не перенесённые маршруты (`/support`, `/profile/addresses`)
  остаются как есть — ожидаемое переходное состояние (прецедент Фаз A/B).

---

### Task 1: `lib/plannedOrderTypes.ts`

**Files:**
- Create: `apps/client/lib/plannedOrderTypes.ts`

**Interfaces:**
- Produces: `PlannedBidMaster`, `PlannedBid`, `PlannedOrderMaster`,
  `PlannedOrderDetail` — используются задачами 2-5.
- Consumes: ничего.

- [ ] **Step 1: Создать `apps/client/lib/plannedOrderTypes.ts`**

Порт типов из мобильного `PlannedOrderPage.tsx` (там жили в файле страницы,
здесь выносятся в `lib/` — тот же приём, что `orderTypes.ts` в Фазе B):

```ts
export interface PlannedBidMaster {
  id: string;
  name: string | null;
  experienceYears: number;
  completedCount: number;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
}

export interface PlannedBid {
  id: string;
  price: number;
  term: string;
  comment: string | null;
  createdAt: string;
  master: PlannedBidMaster;
}

export interface PlannedOrderMaster {
  id: string;
  name: string | null;
  phone: string;
  rating: number | null;
  reviewCount: number;
}

export interface PlannedOrderDetail {
  id: string;
  status: string;
  category: { name: string; slug: string } | null;
  description: string;
  address: string;
  district: string;
  slotStart: string;
  slotEnd: string;
  budget: number | null;
  master: PlannedOrderMaster | null;
  selectedBidId: string | null;
  workPrice: number | null;
  cancelReason: string | null;
  confirmDeadline: string | null;
  bids: PlannedBid[];
  review: { rating: number; comment: string | null } | null;
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок (типы пока никем не используются).

- [ ] **Step 3: Commit**

```bash
git add apps/client/lib/plannedOrderTypes.ts
git commit -m "feat(client): типы планового режима (lib/plannedOrderTypes.ts)"
```

---

### Task 2: Визард `/planned/new`

**Files:**
- Create: `apps/client/app/(app)/planned/new/page.tsx`

**Interfaces:**
- Consumes: `api`, `apiUpload` (`@/lib/api`), `categoryMeta`
  (`@/lib/categoryMeta`).
- Produces: маршрут `/planned/new`; на успешной публикации — редирект на
  `/planned/:id` (маршрут появится в Task 3).

**Отступление от оригинала (обосновано дизайном):** узкая центрированная
колонка (`mx-auto w-full max-w-[560px]`) вместо полноширинной мобильной
раскладки на всех 3 шагах — единственная правка. Логика/тексты/i18n-ключи
не меняются.

- [ ] **Step 1: Создать `apps/client/app/(app)/planned/new/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

const TIME_SLOTS = [
  { startH: 8, endH: 10, label: '08:00–10:00' },
  { startH: 10, endH: 13, label: '10:00–13:00' },
  { startH: 13, endH: 16, label: '13:00–16:00' },
  { startH: 16, endH: 19, label: '16:00–19:00' },
];

function nextDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function PlannedNewOrderPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');

  const dates = nextDays(5);
  const [dateIdx, setDateIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(1);
  const [budget, setBudget] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError((e as Error).message));
  }, []);

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload('/uploads', fd);
      setPhotoPaths((prev) => [...prev, res.path].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function slotRange(): { slotStart: string; slotEnd: string } {
    const day = dates[dateIdx];
    const slot = TIME_SLOTS[slotIdx];
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.startH, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.endH, 0, 0);
    return { slotStart: start.toISOString(), slotEnd: end.toISOString() };
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const { slotStart, slotEnd } = slotRange();
      const order = await api('/planned-orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address,
          district,
          slotStart,
          slotEnd,
          budget: budget ? Number(budget) : undefined,
          photoPaths,
        }),
      });
      router.push(`/planned/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (title: string, back: () => void, n: number) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-ink">{title}</span>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n, total: 3 })}</span>
    </div>
  );
  const progress = (n: number) => (
    <div className="flex gap-1.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= n ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );

  if (step === 1) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step1Title'), () => router.push('/'), 1)}
        {progress(1)}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-pill border-2 px-3.5 py-2 text-sm font-bold ${
                  active ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-ink'
                }`}
              >
                {meta.icon} {c.name}
              </button>
            );
          })}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-24 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
        />
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-16 w-16 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-xl text-primary">
              ＋
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('plannedNew.addressLabel')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t('plannedNew.districtLabel')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId || !description || !address || !district}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step2Title'), () => setStep(1), 2)}
        {progress(2)}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {dates.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDateIdx(i)}
              className={`flex-none rounded-md border-2 px-0 py-2.5 text-center ${
                i === dateIdx ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
              }`}
              style={{ width: 64 }}
            >
              <div className="text-[10.5px] font-bold text-ink-soft">{DOW[d.getDay()]}</div>
              <div className="text-base font-extrabold text-ink">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-ink">{t('plannedNew.step2Slot')}</div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlotIdx(i)}
              className={`rounded-md border-2 p-2.5 text-center text-[13px] font-bold ${
                i === slotIdx ? 'border-primary bg-fill-soft text-primary' : 'border-border text-ink-soft'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-ink">
          {t('plannedNew.step2Budget')} <span className="text-xs font-semibold text-ink-soft">{t('plannedNew.step2BudgetHint')}</span>
        </div>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={t('plannedNew.step2BudgetPlaceholder')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm font-extrabold text-ink outline-none placeholder:text-muted placeholder:font-normal"
        />
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('plannedNew.step2Next')}
        </button>
      </div>
    );
  }

  const meta = categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '');
  const slot = TIME_SLOTS[slotIdx];
  const day = dates[dateIdx];

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('plannedNew.step3Title'), () => setStep(2), 3)}
      {progress(3)}
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedNew.step3Note')}</p>
      <div className="rounded-lg border border-border bg-surface p-3.5 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-ink">
            {meta.icon} {categories.find((c) => c.id === categoryId)?.name}
          </span>
          <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-primary">
            {t('plannedNew.step3Offers', { n: 0 })}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed text-on-fill">
          «{description}» {photoPaths.length > 0 && `· ${t('common.photosCount', { n: photoPaths.length })}`}
        </div>
        <div className="mt-1.5 text-xs text-ink-soft">
          📍 {district} · 🗓 {DOW[day.getDay()]}, {day.getDate()} · {slot.label}
          {budget && ` · бюджет ~${budget} ₸`}
        </div>
      </div>
      <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">{t('plannedNew.step3Footer')}</div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedNew.publish')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/planned/new` присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/planned"
git commit -m "feat(client): визард плановой заявки /planned/new"
```

---

### Task 3: `/planned/[id]` — шелл + `PwaitView` + `SelectBidConfirm`

**Files:**
- Create: `apps/client/app/(app)/planned/[id]/page.tsx`
- Create: `apps/client/components/planned-order-views/PwaitView.tsx`
- Create: `apps/client/components/planned-order-views/SelectBidConfirm.tsx`

**Interfaces:**
- Consumes: `PlannedOrderDetail`/`PlannedBid` (`@/lib/plannedOrderTypes`,
  Task 1), `api` (`@/lib/api`), `getSocket` (`@/lib/socket`), `categoryMeta`
  (`@/lib/categoryMeta`).
- Produces: маршрут `/planned/:id` (шелл ссылается на `PactiveView`/
  `PlannedDoneView`/`PlannedClosedView` — Task 4, ещё не существуют на
  диске после этого таска).

**Важно (тот же приём, что Task 4 Фазы B):** после этого таска
`pnpm --filter client build` **должен упасть** ровно на трёх импортах
(`PactiveView`, `PlannedDoneView`, `PlannedClosedView` — Task 4). Это
ожидаемо и подтверждает, что типы/шелл/`PwaitView`/`SelectBidConfirm`
написаны корректно — финальная зелёная сборка для этого маршрута будет в
конце Task 4.

- [ ] **Step 1: Создать `apps/client/app/(app)/planned/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';
import PwaitView from '@/components/planned-order-views/PwaitView';
import PactiveView from '@/components/planned-order-views/PactiveView';
import PlannedDoneView from '@/components/planned-order-views/PlannedDoneView';
import PlannedClosedView from '@/components/planned-order-views/PlannedClosedView';

const ACTIVE_STATUSES = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

export default function PlannedOrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    return api(`/planned-orders/${id}`)
      .then(setOrder)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: { plannedOrderId: string }) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  if (error || !order || !id) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm font-semibold text-danger">{error || t('orderDetail.notFound')}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-pill border-[1.5px] border-primary p-3 text-sm font-extrabold text-primary"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (order.status === 'PUBLISHED') return <PwaitView order={order} orderId={id} onChanged={load} />;
  if (ACTIVE_STATUSES.includes(order.status)) return <PactiveView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'DONE') return <PlannedDoneView order={order} orderId={id} onChanged={load} />;
  return <PlannedClosedView order={order} onChanged={load} />;
}
```

- [ ] **Step 2: Создать `apps/client/components/planned-order-views/SelectBidConfirm.tsx`**

Порт `SelectBidConfirm.tsx` (нужен раньше `PwaitView`, т.к. импортируется
им): `useNavigate` → `useRouter`, тип из `@/lib/plannedOrderTypes`, узкая
колонка добавлена:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { PlannedBid } from '@/lib/plannedOrderTypes';

export default function SelectBidConfirm({
  plannedOrderId,
  bid,
  onBack,
}: {
  plannedOrderId: string;
  bid: PlannedBid;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirmChoice() {
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${plannedOrderId}/select`, { method: 'POST', body: JSON.stringify({ bidId: bid.id }) });
      router.push(`/planned/${plannedOrderId}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-3.5 px-6 py-5.5">
      <div className="text-center text-xl font-extrabold text-ink">{t('plannedDetail.confirmTitle')}</div>
      <div className="rounded-lg border border-border bg-surface p-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-base font-extrabold text-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </div>
        <div className="text-base font-extrabold text-ink">{bid.master.name} ✓</div>
        <div className="mt-0.5 text-xs font-semibold text-ink-soft">
          ★ {bid.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </div>
        <div className="mt-2.5 text-[22px] font-extrabold text-primary">{bid.price} ₸</div>
      </div>
      <div className="rounded-md bg-fill p-3.5 text-xs font-semibold leading-relaxed text-ink">
        {t('plannedDetail.confirmNote')}
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <button
        type="button"
        onClick={confirmChoice}
        disabled={submitting}
        className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedDetail.confirmChoice')}
      </button>
      <button type="button" onClick={onBack} className="text-center text-[13.5px] font-bold text-ink-soft">
        {t('plannedDetail.backToBids')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Создать `apps/client/components/planned-order-views/PwaitView.tsx`**

Порт `PwaitView.tsx`: `useNavigate` → `useRouter`, тип из
`@/lib/plannedOrderTypes`, узкая колонка добавлена (вертикальный список
карточек — решение пользователя, без grid):

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';
import SelectBidConfirm from './SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '@/lib/plannedOrderTypes';

export default function PwaitView({
  order,
  orderId,
  onChanged,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState('');

  async function cancel() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (selected) {
    return <SelectBidConfirm plannedOrderId={orderId} bid={selected} onBack={() => setSelected(null)} />;
  }

  const cheapestId = order.bids.length ? order.bids.reduce((a, b) => (b.price < a.price ? b : a)).id : null;
  const slotDate = new Date(order.slotStart);
  const when = `${slotDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.push('/')} className="text-xl text-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-ink">{order.category?.name}</span>
        <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-primary">
          {t('plannedDetail.publishedBadge')}
        </span>
      </div>
      <div className="rounded-md bg-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-ink">
        {categoryMeta(order.category?.slug ?? '').icon} {order.category?.name} · {when} · {order.district}
        {order.budget && ` · ~${order.budget} ₸`}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-extrabold text-ink">
          {t('plannedDetail.offersCount', { n: order.bids.length })}
        </span>
      </div>
      {order.bids.length === 0 && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-5.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-border border-t-primary" />
          <div className="whitespace-pre-line text-[13px] font-bold leading-relaxed text-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </div>
        </div>
      )}
      {order.bids.map((b) => (
        <div key={b.id} className="rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-[13px] font-extrabold text-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <div className="text-sm font-extrabold text-ink">
                  {b.master.name} <span className="text-xs text-success">✓</span>
                </div>
                <div className="text-[11.5px] font-semibold text-ink-soft">
                  ★ {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })} ·{' '}
                  {b.master.experienceYears} лет
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-primary">{b.price} ₸</div>
              <div className="text-[11px] font-semibold text-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</div>
            </div>
          </div>
          {b.comment && <div className="my-2 text-[12.5px] leading-snug text-on-fill">«{b.comment}»</div>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && (
              <span className="rounded-pill bg-success-bg px-2.5 py-1 text-[10.5px] font-extrabold text-success-ink">
                {t('plannedDetail.bestPrice')}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(b)}
              className="ml-auto rounded-pill bg-primary px-4.5 py-2 text-xs font-extrabold text-white"
            >
              {t('plannedDetail.select')}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/planned/${orderId}/compare`)}
          disabled={order.bids.length === 0}
          className="flex-1 rounded-pill border-[1.5px] border-primary p-3 text-[13.5px] font-extrabold text-primary disabled:opacity-40"
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-pill border-[1.5px] border-danger p-3 text-[13.5px] font-extrabold text-danger"
        >
          {t('plannedDetail.cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Проверить сборку (ожидаемо падает на 3 импортах)**

Run: `pnpm --filter client build`
Expected: сборка падает с `Module not found` ровно на трёх импортах —
`@/components/planned-order-views/PactiveView`,
`@/components/planned-order-views/PlannedDoneView`,
`@/components/planned-order-views/PlannedClosedView` (появятся в Task 4).
Никаких других ошибок компиляции быть не должно — если есть другие
ошибки, это баг этого таска, не ожидаемое падение.

- [ ] **Step 5: Commit**

```bash
git add "apps/client/app/(app)/planned/[id]/page.tsx" apps/client/components/planned-order-views
git commit -m "feat(client): PlannedOrderPage-шелл + PwaitView + SelectBidConfirm"
```

---

### Task 4: `/planned/[id]/compare` + `PactiveView` + `PlannedDoneView` + `PlannedClosedView`

**Files:**
- Create: `apps/client/app/(app)/planned/[id]/compare/page.tsx`
- Create: `apps/client/components/planned-order-views/PactiveView.tsx`
- Create: `apps/client/components/planned-order-views/PlannedDoneView.tsx`
- Create: `apps/client/components/planned-order-views/PlannedClosedView.tsx`

**Interfaces:**
- Consumes: `PlannedOrderDetail`/`PlannedBid` (`@/lib/plannedOrderTypes`),
  `PLANNED_STATUS_LABELS` (`@/lib/orderStatus`), `SelectBidConfirm`
  (Task 3), `api` (`@/lib/api`).
- Produces: маршрут `/planned/:id/compare`; завершает набор видов шелла
  Task 3 — после этого таска сборка маршрута `/planned/:id` полностью
  зелёная.

**Отступление от оригинала (обосновано дизайном, решение пользователя):**
таблица сравнения растягивается на всю ширину контентной области
(`w-full`, без `max-w-[560px]`, без `min-w-[420px]`) — единственный экран
фазы без узкой колонки. Горизонтальный скролл-контейнер (`overflow-x-auto`)
остаётся как страховка на случай тесного окна, а не основной паттерн.

- [ ] **Step 1: Создать `apps/client/components/planned-order-views/PactiveView.tsx`**

Порт `PactiveView.tsx`: `useNavigate` → `useRouter`, тип из
`@/lib/plannedOrderTypes`, узкая колонка добавлена:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { PLANNED_STATUS_LABELS } from '@/lib/orderStatus';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

export default function PactiveView({
  order,
  orderId,
  onChanged,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order.confirmDeadline) return;
    const deadline = new Date(order.confirmDeadline).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.confirmDeadline]);

  async function cancel() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const confirmed = order.status !== 'MASTER_SELECTED';
  const selectedBid = order.bids.find((b) => b.id === order.selectedBidId);
  const price = confirmed ? order.workPrice : selectedBid?.price;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.push('/')} className="text-xl text-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-ink">{order.category?.name}</span>
        <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-primary">
          {PLANNED_STATUS_LABELS[order.status]}
        </span>
      </div>

      {!confirmed && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-4.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-border border-t-primary" />
          <div className="text-[13.5px] font-bold leading-relaxed text-ink">
            {t('plannedDetail.waitingConfirm', { name: order.master?.name })}
          </div>
          <div className="mt-1 text-xs font-semibold text-ink-soft">
            {t('plannedDetail.waitingConfirmHint')} · {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
      )}

      {confirmed && (
        <>
          <div className="rounded-md bg-success-bg p-3.5 text-[13px] font-bold text-success-ink">
            ✓ {t('plannedDetail.confirmed', { name: order.master?.name })}
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-sm font-extrabold text-ink">
                {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-extrabold text-ink">
                  {order.master?.name} <span className="text-xs text-success">✓</span>
                </div>
              </div>
              {order.master?.phone && (
                <a
                  href={`tel:${order.master.phone}`}
                  className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-primary text-base text-white"
                >
                  📞
                </a>
              )}
            </div>
            <div className="my-2.5 border-t border-fill-soft" />
            <div className="flex justify-between text-[13px] font-bold">
              <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
              <span className="text-ink">{price} ₸</span>
            </div>
            <div className="mt-1 flex justify-between text-[13px] font-bold">
              <span className="text-ink-soft">{t('plannedDetail.whenLabel')}</span>
              <span className="text-ink">{new Date(order.slotStart).toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </>
      )}

      <div className="rounded-md bg-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-ink">
        {order.category?.name} · «{order.description.slice(0, 40)}» · {order.address}
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={cancel}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('plannedDetail.cancel')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Создать `apps/client/components/planned-order-views/PlannedDoneView.tsx`**

Порт `PlannedDoneView.tsx`: `useNavigate` → `useRouter`, тип из
`@/lib/plannedOrderTypes`, узкая колонка добавлена:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

export default function PlannedDoneView({
  order,
  orderId,
  onChanged,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('plannedDetail.doneTitle')}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-1.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-pill bg-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('plannedDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => router.push(`/planned/${orderId}/dispute`)}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('plannedDetail.openDispute')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Создать `apps/client/components/planned-order-views/PlannedClosedView.tsx`**

Порт `PlannedClosedView.tsx`: `useNavigate` → `useRouter`, тип из
`@/lib/plannedOrderTypes`, узкая колонка добавлена:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

export default function PlannedClosedView({ order, onChanged }: { order: PlannedOrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isClosed = order.status === 'CLOSED';
  const isExpired = order.status === 'EXPIRED';

  async function submitRating(stars: number) {
    setRating(stars);
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ rating: stars }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isClosed
    ? t('plannedDetail.closedTitle')
    : isExpired
      ? t('plannedDetail.closedExpiredTitle')
      : t('plannedDetail.closedCancelledTitle');

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-[560px] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isClosed ? 'bg-success' : 'bg-ink-soft'
        }`}
      >
        {isClosed ? '✓' : '×'}
      </div>
      <div className="text-xl font-extrabold text-ink">{title}</div>
      {!isClosed && order.cancelReason && <div className="text-sm text-ink-soft">{order.cancelReason}</div>}
      {isClosed && (
        <div className="w-full rounded-md border border-border bg-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-ink">{t('plannedDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-ink">{t('plannedDetail.rateTitle')}</div>
              <div className="flex justify-center gap-1 text-[28px]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    className={s <= rating ? 'text-primary' : 'text-border'}
                  >
                    ★
                  </button>
                ))}
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => router.push('/')}
        className="w-full rounded-pill bg-primary p-4 text-sm font-extrabold text-white"
      >
        {t('plannedDetail.toHome')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Создать `apps/client/app/(app)/planned/[id]/compare/page.tsx`**

Порт `PlannedComparePage.tsx`: `useNavigate`/`useParams` →
`useRouter`/`useParams` из `next/navigation`, тип из
`@/lib/plannedOrderTypes`; таблица растянута на всю ширину (единственное
дизайн-отклонение фазы — `w-full` вместо `max-w-[560px]`, без `min-w`):

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import SelectBidConfirm from '@/components/planned-order-views/SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '@/lib/plannedOrderTypes';

export default function PlannedComparePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError((e as Error).message));
  }, [id]);

  if (selected && id) {
    return <SelectBidConfirm plannedOrderId={id} bid={selected} onBack={() => setSelected(null)} />;
  }

  if (error) return <div className="p-6 text-sm font-semibold text-danger">{error}</div>;
  if (!order || !id) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  const rows: { label: string; render: (b: PlannedBid) => string }[] = [
    { label: t('plannedDetail.comparePrice'), render: (b) => `${b.price} ₸` },
    { label: t('plannedDetail.compareRating'), render: (b) => `★ ${b.master.rating?.toFixed(1) ?? '—'}` },
    { label: t('plannedDetail.compareOrders'), render: (b) => String(b.master.completedCount) },
    { label: t('plannedDetail.compareExperience'), render: (b) => `${b.master.experienceYears} лет` },
    { label: t('plannedDetail.compareTerm'), render: (b) => b.term },
    { label: t('plannedDetail.compareComment'), render: (b) => b.comment ?? '—' },
  ];

  return (
    <div className="flex w-full flex-col gap-3 px-8 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.push(`/planned/${id}`)} className="text-xl text-primary">
          ←
        </button>
        <span className="text-lg font-extrabold text-ink">{t('plannedDetail.compareTitle')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-[12.5px]">
          <thead>
            <tr>
              <th className="bg-fill-soft p-3" />
              {order.bids.map((b) => (
                <th key={b.id} className="border-l border-border bg-fill-soft p-2 text-center">
                  <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
                    {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
                  </div>
                  <span className="font-extrabold text-ink">{b.master.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-t border-border p-2.5 font-bold text-ink-soft">{row.label}</td>
                {order.bids.map((b) => (
                  <td key={b.id} className="border-l border-t border-border p-2.5 text-center font-extrabold text-ink">
                    {row.render(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11.5px] text-ink-soft">{t('plannedDetail.compareHint')}</p>
      <div className="flex gap-2">
        {order.bids.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b)}
            className="flex-1 rounded-pill border-[1.5px] border-primary p-3 text-[12.5px] font-extrabold text-primary"
          >
            {t('plannedDetail.select')} {b.master.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка полностью зелёная (все импорты шелла Task 3 теперь
разрешаются), маршруты `/planned/:id` и `/planned/:id/compare`
присутствуют.

- [ ] **Step 6: Commit**

```bash
git add "apps/client/app/(app)/planned/[id]/compare" apps/client/components/planned-order-views
git commit -m "feat(client): compare + PactiveView + PlannedDoneView + PlannedClosedView"
```

---

### Task 5: `/planned/[id]/dispute` — тонкая обёртка

**Files:**
- Create: `apps/client/app/(app)/planned/[id]/dispute/page.tsx`

**Interfaces:**
- Consumes: `DisputeView` (`@/components/DisputeView`, готов с Фазы B,
  проп `kind` без изменений).
- Produces: маршрут `/planned/:id/dispute`.

- [ ] **Step 1: Создать `apps/client/app/(app)/planned/[id]/dispute/page.tsx`**

Точная копия `app/(app)/order/[id]/dispute/page.tsx` (Фаза B) с другим
значением `kind`:

```tsx
'use client';
import DisputeView from '@/components/DisputeView';

export default function PlannedOrderDisputePage() {
  return <DisputeView kind="planned-orders" />;
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/planned/:id/dispute`
присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/planned/[id]/dispute"
git commit -m "feat(client): /planned/:id/dispute — обёртка DisputeView(kind=planned-orders)"
```

---

### Task 6: Сквозная проверка Фазы C

**Files:** нет изменений кода — только живая браузерная проверка.

**Interfaces:** нет (финальная задача фазы).

- [ ] **Step 1: Запустить окружение**

Run: `docker compose up -d` (Postgres/Redis, если ещё не подняты),
`pnpm --filter api start:dev`, `pnpm --filter client dev`.
Expected: API на `:3000`, клиент на `:4200`.

- [ ] **Step 2: Живой цикл плановой заявки (все 9 статусов)**

Через реального клиента (браузер, `client.masterqala.kz`/`localhost:4200`)
и мастера (прямые API-вызовы, т.к. роль мастера ещё не редизайнена —
подпроект 3):

1. Залогиниться клиентом (SMS-OTP, код из логов `apps/api`).
2. Пройти визард `/planned/new` (3 шага, включая загрузку фото) →
   публикация → редирект на `/planned/:id`, статус `PUBLISHED` → вид pwait.
3. За мастера (реального или другого тестового пользователя с
   `MasterProfile`) отправить 2-3 ставки через `POST
   /planned-orders/:id/bids` — убедиться, что `bid:new` доходит на клиента
   и список ставок обновляется без перезагрузки страницы (сокет).
4. Открыть `/planned/:id/compare` — убедиться, что таблица показывает все
   ставки в одну строку без обрезания на обычном desktop-окне, бейдж
   «Лучшая цена» не отображается в таблице (только в pwait — по дизайну).
5. Выбрать ставку из compare → `pconfirm` → подтвердить → `POST
   /planned-orders/:id/select` → статус `MASTER_SELECTED` → вид pactive,
   реальный обратный отсчёт от `confirmDeadline` тикает.
6. За мастера подтвердить (`POST /planned-orders/:id/confirm`) → статус
   `CONFIRMED` → клиент видит карточку мастера, кнопку звонка `tel:`,
   таймер исчезает — без перезагрузки страницы (сокет `planned:status`).
7. За мастера перевести в `IN_PROGRESS`, затем `DONE` → клиент видит
   `PlannedDoneView`, жмёт «Подтвердить выполнение» → `POST
   /planned-orders/:id/confirm-completion` → статус `CLOSED`.
8. `PlannedClosedView` — поставить 5★, подтвердить сохранение через
   `GET /planned-orders/:id` (поле `review`).
9. Отдельно, на новой плановой заявке: открыть спор через
   `/planned/:id/dispute` (после `DONE`), приложить фото-доказательство,
   убедиться что форма и таймлайн идентичны `/order/:id/dispute`
   (Фаза B) с точностью до `kind`.

Expected: каждый переход статуса отражается в UI без ручной перезагрузки
(сокеты `bid:new`/`planned:status`), узкая колонка выглядит корректно на
типичном desktop-окне (≥1280px), таблица compare не обрезается.

- [ ] **Step 3: Зафиксировать находки**

Если живая проверка выявит расхождение с бэкендом/планом — исправить
точечно (тот же процесс, что в Фазах A/B — эскалация находки, не
самостоятельный обход вне скоупа задачи) и повторить проверку
соответствующего шага.
