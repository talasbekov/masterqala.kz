# Оператор (desktop), Цикл B — Фаза C: Заказы + Журнал — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать в `apps/operator` два раздела панели оператора:
«Заказы» (список с фильтрами тип/статус/поиск + деталь с таймлайном и
сводкой платежей + список кандидатов + ручное назначение мастера на
зависшую срочную заявку) и «Журнал» (список аудит-записей с реальной
серверной пагинацией) — поверх уже существующего API (`/admin/orders`,
`/admin/journal`). Дизайн-документ: `docs/superpowers/specs/2026-07-31-operator-flow-desktop-phase-c-design.md`.

**Architecture:** Тот же паттерн `lib/<domain>.ts` (типы + функции запросов)
+ `app/(app)/<route>/page.tsx` (client component, сам управляет своим
состоянием), что уже установлен Фазами A-B. «Заказы» — двухпанельный layout
(полноширинная таблица слева, кликабельные строки + фиксированная панель
деталей 400px справа), в отличие от узкого списка карточек «Верификации» —
записей до 100 и полей больше, чем помещается в карточку. «Журнал» —
единственный раздел панели с настоящей серверной пагинацией (остальные
разделы полагаются на фильтры без пейджера).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
(`@masterqala/ui/tokens.css`).

## Global Constraints

- Ни одного нового бэкенд-эндпоинта — только уже существующие
  `/admin/orders`, `/admin/orders/:id`, `/admin/orders/:id/candidates`,
  `/admin/orders/:id/assign`, `/admin/journal`.
- Без i18n, без сокетов, без клиентской пагинации там, где бэкенд её не
  поддерживает (тот же выбор, что в Фазах A-B) — «Заказы» полагаются на
  фильтры/поиск, без пейджера; «Журнал» — единственное исключение,
  использует реальный `page`-параметр бэкенда.
- Не переносится из прототипа: фильтр «период» (нет query-параметра
  диапазона дат в `GET /admin/orders`), поле «внутренний комментарий»
  оператора к заказу (нет backend-поля) — см. «Решения по
  неоднозначностям» в дизайн-документе.
- Пилюля статуса `DISPUTE` — цвет `warning` (`bg-warning-bg`/
  `text-warning-ink`), не `danger`, вопреки классификации в
  `apps/web/src/orderStatus.ts` — сознательное расхождение только в цвете,
  см. дизайн-документ.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css` (тот же
  список, что в Фазах A-B: `bg-background`, `bg-surface`, `text-ink`,
  `text-ink-soft`, `text-primary`, `bg-primary`, `text-danger`,
  `bg-danger-bg`, `text-success-ink`, `bg-success-bg`, `text-warning-ink`,
  `bg-warning-bg`, `border-border`, `bg-fill-soft`, `bg-fill-faint`,
  `rounded-md`, `rounded-lg`, `rounded-pill`).
- Без фреймворка фронтенд-тестов — верификация каждой задачи: `pnpm
  --filter operator build` + живая браузерная проверка через preview-тул,
  где явно указано.
- **Логин при живой проверке:** тот же путь, что в Фазах A-B — один `curl
  -X POST http://localhost:3001/api/v1/auth/verify-code` с кодом из логов
  `relaxed-api` для оператора `+77000000001`, затем
  `localStorage.setItem('token', ...)`/`localStorage.setItem('user', ...)`
  через `preview_eval` — экономит SMS-OTP квоту (3 отправки/10 мин), форма
  логина уже проверена в Фазе A.
- **Форсирование `canAssign` для живой проверки ручного назначения:**
  `canAssign` в детали заказа вычисляется чисто по времени/волне
  (`order.status === 'SEARCHING' && order.wave === 3 &&
  Date.now() - order.createdAt.getTime() > 5 * 60_000`, см. `apps/api/src/admin-orders/admin-orders.service.ts`)
  — не завязано ни на какой другой инвариант, поэтому для живой проверки
  безопасно создать реальную срочную заявку через `apps/client` (без
  доступных онлайн-мастеров той же категории — иначе волна матчинга сама
  назначит), затем напрямую обновить эту строку в dev-БД (`docker exec -it
  masterqalakz-db-1 psql -U postgres -d masterqala -c "UPDATE \"Order\" SET
  wave=3, \"createdAt\"=now() - interval '10 minutes' WHERE id='<id>'"`) —
  после обновления открыть деталь заказа в панели, `canAssign` должно стать
  `true`. Как минимум один реальный кандидат для назначения должен быть
  онлайн (мастер той же категории, `MasterPresence.isOnline=true`,
  `MasterProfile.status='ACTIVE'`) — использовать уже существующего
  тестового мастера из прошлых живых проверок сессии.
- Тестовый оператор `+77000000001` уже существует в локальной БД (Фаза A).

---

## Файловая структура Фазы C

```
apps/operator/
  lib/
    orders.ts    # NEW
    journal.ts   # NEW
  app/(app)/
    orders/page.tsx   # NEW
    journal/page.tsx  # NEW
```

---

### Task 1: `lib/orders.ts` — типы, API-вызовы, словари статусов

**Files:**
- Create: `apps/operator/lib/orders.ts`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза A).
- Produces: типы `OrderType`, `OrderListRow`, `OrderDetail`,
  `OrderTimelineEvent`, `AssignCandidate`, `StatusVariant`; словари
  `TYPE_LABELS`, `STATUS_LABELS`, `PLANNED_STATUS_LABELS`; функции
  `statusLabel`, `statusPillClass`, `fetchOrders`, `fetchOrder`,
  `fetchCandidates`, `assignMaster` — используются Task 2.

- [ ] **Step 1: Создать `lib/orders.ts`**

Лейблы статусов дословно перенесены из `apps/web/src/orderStatus.ts`
(`STATUS_LABELS`/`PLANNED_STATUS_LABELS`) — единственное отличие от
источника: вариант цвета `DISPUTE` переопределён на `warning` вместо
`danger` (см. дизайн-документ §«Решения по неоднозначностям» — прототип
рисует спор оранжевым, отличая «активный разбор» от «заявка провалилась»).
`OrderDetail` — дискриминированное объединение по `type`, т.к. `urgent`
(`calloutPrice`/`serviceFee`) и `planned` (`budget`) отдают разные наборы
денежных полей (сверено с `AdminOrdersService.urgentDetail`/
`plannedDetail`).

```ts
import { api } from './api';

export type OrderType = 'urgent' | 'planned';

export const TYPE_LABELS: Record<OrderType, string> = {
  urgent: 'Срочный',
  planned: 'Плановый',
};

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

export type StatusVariant = 'info' | 'active' | 'success' | 'danger' | 'warning';

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  info: 'bg-fill-soft text-primary',
  active: 'bg-fill-soft text-primary',
  success: 'bg-success-bg text-success-ink',
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-bg text-warning-ink',
};

const URGENT_VARIANTS: Record<string, StatusVariant> = {
  CREATED: 'info',
  SEARCHING: 'info',
  ACCEPTED: 'active',
  MASTER_ON_WAY: 'active',
  INSPECTION: 'active',
  AWAITING_PRICE_CONFIRM: 'active',
  IN_PROGRESS: 'active',
  DONE: 'success',
  CLOSED: 'success',
  NO_MASTERS: 'danger',
  CANCELLED_BY_CLIENT: 'danger',
  CANCELLED_BY_MASTER: 'danger',
  DISPUTE: 'warning',
};

const PLANNED_VARIANTS: Record<string, StatusVariant> = {
  CREATED: 'info',
  PUBLISHED: 'info',
  MASTER_SELECTED: 'active',
  CONFIRMED: 'active',
  IN_PROGRESS: 'active',
  DONE: 'success',
  CLOSED: 'success',
  EXPIRED: 'danger',
  CANCELLED_BY_CLIENT: 'danger',
  CANCELLED_BY_MASTER: 'danger',
  DISPUTE: 'warning',
};

export function statusLabel(type: OrderType, status: string): string {
  return (type === 'planned' ? PLANNED_STATUS_LABELS : STATUS_LABELS)[status] ?? status;
}

export function statusPillClass(type: OrderType, status: string): string {
  const variant = (type === 'planned' ? PLANNED_VARIANTS : URGENT_VARIANTS)[status] ?? 'info';
  return VARIANT_CLASSES[variant];
}

export interface OrderListRow {
  id: string;
  type: OrderType;
  client: string;
  master: string | null;
  category: string;
  status: string;
  createdAt: string;
}

export interface OrderTimelineEvent {
  at: string;
  event: string;
}

interface OrderDetailBase {
  id: string;
  status: string;
  address: string;
  district: string;
  createdAt: string;
  client: { name: string | null; phone: string };
  master: { name: string | null; phone: string } | null;
  category: string;
  workPrice: number | null;
  timeline: OrderTimelineEvent[];
  canAssign: boolean;
}

export type OrderDetail =
  | (OrderDetailBase & { type: 'urgent'; calloutPrice: number; serviceFee: number })
  | (OrderDetailBase & { type: 'planned'; budget: number | null });

export interface AssignCandidate {
  masterUserId: string;
  name: string;
  distanceKm: number;
  isOnline: boolean;
}

export function fetchOrders(params: { type?: OrderType; status?: string; search?: string }): Promise<OrderListRow[]> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  const query = q.toString() ? `?${q.toString()}` : '';
  return api(`/admin/orders${query}`);
}

export function fetchOrder(id: string, type: OrderType): Promise<OrderDetail> {
  return api(`/admin/orders/${id}?type=${type}`);
}

export function fetchCandidates(id: string): Promise<AssignCandidate[]> {
  return api(`/admin/orders/${id}/candidates?type=urgent`);
}

export async function assignMaster(id: string, masterUserId: string): Promise<void> {
  await api(`/admin/orders/${id}/assign?type=urgent`, {
    method: 'POST',
    body: JSON.stringify({ masterUserId }),
  });
}
```

`fetchCandidates`/`assignMaster` жёстко используют `type=urgent` в query —
`canAssign` для `planned` всегда `false` (сверено с
`AdminOrdersService.plannedDetail`), поэтому кнопка ручного назначения в
Task 2 просто не рендерится для плановых заказов и эти функции никогда не
вызываются с `type=planned`.

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок (файл пока никем не импортируется, но
должен компилироваться сам по себе).

- [ ] **Step 3: Commit**

```bash
git add apps/operator/lib/orders.ts
git commit -m "feat(operator): типы и API-вызовы раздела Заказы"
```

---

### Task 2: Раздел «Заказы» — список, деталь, кандидаты, ручное назначение

**Files:**
- Create: `apps/operator/app/(app)/orders/page.tsx`

**Interfaces:**
- Consumes: всё из `lib/orders.ts` (Task 1), `useOperatorMetrics` из
  `lib/operatorMetrics.tsx` (Фаза A, для `refetch()` бейджа «Заказы» после
  назначения).

- [ ] **Step 1: Создать `app/(app)/orders/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  fetchOrders,
  fetchOrder,
  fetchCandidates,
  assignMaster,
  statusLabel,
  statusPillClass,
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  TYPE_LABELS,
  type OrderListRow,
  type OrderDetail,
  type OrderType,
  type AssignCandidate,
} from '@/lib/orders';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const TYPE_FILTERS: { value: OrderType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все типы' },
  { value: 'urgent', label: 'срочные' },
  { value: 'planned', label: 'плановые' },
];

function statusOptionsFor(type: OrderType | 'ALL'): { value: string; label: string }[] {
  if (type === 'urgent') return Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  if (type === 'planned') return Object.entries(PLANNED_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const merged = new Map<string, string>();
  Object.entries(STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  Object.entries(PLANNED_STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  return Array.from(merged.entries()).map(([value, label]) => ({ value, label }));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrdersPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [typeFilter, setTypeFilter] = useState<OrderType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<{ id: string; type: OrderType } | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<AssignCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);

  function loadList() {
    setListLoading(true);
    fetchOrders({
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter || undefined,
      search: search.trim() || undefined,
    })
      .then((data) => {
        setRows(data);
        setListError('');
      })
      .catch((e) => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadList, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    setStatusFilter('');
  }, [typeFilter]);

  function loadDetail(target: { id: string; type: OrderType }) {
    setDetailLoading(true);
    fetchOrder(target.id, target.type)
      .then((data) => {
        setDetail(data);
        setDetailError('');
      })
      .catch((e) => setDetailError((e as Error).message))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function openAssignModal() {
    if (!selected) return;
    setAssignOpen(true);
    setAssignError('');
    setCandidates(null);
    setCandidatesLoading(true);
    try {
      const data = await fetchCandidates(selected.id);
      setCandidates(data);
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function confirmAssign(masterUserId: string) {
    if (!selected) return;
    setAssigning(true);
    setAssignError('');
    try {
      await assignMaster(selected.id, masterUserId);
      setAssignOpen(false);
      setCandidates(null);
      loadDetail(selected);
      loadList();
      refetchMetrics();
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Заказы</div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as OrderType | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">все статусы</option>
          {statusOptionsFor(typeFilter).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ID заказа или телефону клиента"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {listError && <div className="text-sm text-danger">{listError}</div>}

      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-[100px_90px_1fr_1fr_140px_160px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
            <span>ID</span>
            <span>Тип</span>
            <span>Клиент</span>
            <span>Мастер</span>
            <span>Категория</span>
            <span>Статус</span>
          </div>
          {listLoading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
          {!listLoading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
          {rows.map((row) => (
            <button
              key={`${row.type}-${row.id}`}
              type="button"
              onClick={() => setSelected({ id: row.id, type: row.type })}
              className={`grid w-full grid-cols-[100px_90px_1fr_1fr_140px_160px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-left text-sm font-bold ${
                selected?.id === row.id ? 'bg-fill-soft' : 'bg-transparent'
              }`}
            >
              <span className="truncate text-ink-soft">{row.id.slice(0, 8)}</span>
              <span>{TYPE_LABELS[row.type]}</span>
              <span className="truncate">{row.client}</span>
              <span className="truncate text-ink-soft">{row.master ?? '—'}</span>
              <span className="truncate text-ink-soft">{row.category}</span>
              <span>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${statusPillClass(row.type, row.status)}`}
                >
                  {statusLabel(row.type, row.status)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="w-[400px] shrink-0 rounded-lg border border-border bg-surface p-5">
          {!selected && <div className="text-sm text-ink-soft">Выберите заказ слева</div>}
          {selected && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selected && detailError && <div className="text-sm text-danger">{detailError}</div>}
          {selected && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-extrabold text-ink">
                  #{detail.id.slice(0, 8)} · {detail.category}
                </span>
                <span
                  className={`rounded-pill px-3 py-1 text-xs font-extrabold ${statusPillClass(detail.type, detail.status)}`}
                >
                  {statusLabel(detail.type, detail.status)}
                </span>
              </div>

              <div className="text-sm text-ink-soft">
                {detail.address} · {detail.district}
              </div>
              <div className="text-xs text-ink-soft">Создана {formatDateTime(detail.createdAt)}</div>

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">Платежи</div>
                {detail.type === 'urgent' ? (
                  <div className="mt-1 text-sm font-extrabold text-ink">
                    Выезд {detail.calloutPrice} ₸ · Сбор {detail.serviceFee} ₸
                    {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-extrabold text-ink">
                    Бюджет {detail.budget ?? '—'} ₸
                    {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
                  </div>
                )}
              </div>

              <div className="text-sm font-extrabold text-ink">Клиент</div>
              <div className="text-sm text-ink-soft">
                {detail.client.name ?? detail.client.phone} · {detail.client.phone}
              </div>

              {detail.master && (
                <>
                  <div className="text-sm font-extrabold text-ink">Мастер</div>
                  <div className="text-sm text-ink-soft">
                    {detail.master.name ?? detail.master.phone} · {detail.master.phone}
                  </div>
                </>
              )}

              <div className="text-sm font-extrabold text-ink">Таймлайн</div>
              <div className="flex flex-col gap-2">
                {detail.timeline.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                    <span className="font-bold text-ink">{event.event}</span>
                  </div>
                ))}
              </div>

              {detail.canAssign && (
                <button
                  type="button"
                  onClick={openAssignModal}
                  className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
                >
                  Назначить мастера вручную
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {assignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setAssignOpen(false)}
        >
          <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-base font-extrabold text-ink">Выберите мастера</div>
            {candidatesLoading && <div className="text-sm text-ink-soft">Загрузка кандидатов…</div>}
            {assignError && <div className="mb-2 text-sm text-danger">{assignError}</div>}
            {!candidatesLoading && candidates && candidates.length === 0 && (
              <div className="text-sm text-ink-soft">Нет доступных кандидатов онлайн.</div>
            )}
            {!candidatesLoading && candidates && candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <div
                    key={c.masterUserId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <span className="text-sm font-bold text-ink">
                      {c.name} · {c.distanceKm} км · {c.isOnline ? 'онлайн' : 'офлайн'}
                    </span>
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => confirmAssign(c.masterUserId)}
                      className="rounded-pill bg-primary px-3 py-1 text-xs font-extrabold text-white disabled:opacity-40"
                    >
                      Назначить
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="mt-3 rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Живая проверка раздела «Заказы» — базовый флоу**

Войти оператором (curl+localStorage, см. Global Constraints), открыть
`http://localhost:4400/orders`.

- Убедиться, что список непустой (заказы из прошлых живых проверок
  сессии), фильтр «тип» сужает список до срочных/плановых, фильтр
  «статус» (список опций меняется при смене типа) сужает дальше, поиск по
  части телефона клиента находит нужную строку.
- Кликнуть по срочной заявке — деталь справа показывает блок «Платежи» с
  Выезд/Сбор (и Работа, если согласована), таймлайн, клиента; если мастер
  уже назначен — блок «Мастер».
- Кликнуть по плановой заявке — блок «Платежи» показывает Бюджет вместо
  Выезд/Сбор (без поля «Сбор» — его нет у планового режима).
- Убедиться, что для обычных (не зависших) заказов кнопки «Назначить
  мастера вручную» нет вообще.

- [ ] **Step 4: Живая проверка ручного назначения (форсированный `canAssign`)**

Следуя инструкции из Global Constraints:
1. Через `apps/client` создать новую срочную заявку в категории, где есть
   хотя бы один онлайн-мастер той же категории в БД (использовать
   существующего тестового мастера из прошлых проверок сессии — включить
   ему онлайн-режим через `apps/master`, если он сейчас офлайн).
2. Прямым SQL-обновлением выставить у этой заявки `wave=3` и `createdAt`
   на 10+ минут в прошлое.
3. Открыть деталь заказа в `/orders` (или обновить уже открытую) —
   убедиться, что появилась кнопка «Назначить мастера вручную».
4. Кликнуть — модалка должна показать хотя бы одного кандидата
   (`{имя} · {расстояние} км · онлайн`); кликнуть «Назначить».
5. Убедиться: модалка закрылась, деталь заказа обновилась (статус
   `ACCEPTED`, появился блок «Мастер», кнопка назначения пропала), строка
   в списке слева тоже показывает новый статус, а бейдж «Заказы» в
   сайдбаре (если был >0 из-за этой заявки) уменьшился без ожидания
   30-секундного поллинга.
6. Отдельно проверить путь ошибки: открыть модалку кандидатов у другой
   такой же форсированной заявки, но перед кликом «Назначить» вручную
   освободить/занять того же мастера другой активной заявкой через прямой
   API-вызов (гонка) — подтвердить, что ошибка 409 показывается текстом в
   модалке, не роняя страницу.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/app/\(app\)/orders
git commit -m "feat(operator): раздел Заказы — список, деталь, кандидаты, ручное назначение"
```

---

### Task 3: Раздел «Журнал» — список с серверной пагинацией

**Files:**
- Create: `apps/operator/lib/journal.ts`
- Create: `apps/operator/app/(app)/journal/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза A).
- Produces: `interface AuditLogRow`, `interface JournalPage`,
  `ACTION_LABELS`, `fetchJournal(page)` из `lib/journal.ts`.

- [ ] **Step 1: Создать `lib/journal.ts`**

`action` — свободная строка на бэкенде (не Prisma-enum), полный список
фактически используемых значений сверен по всему `apps/api/src`
(`admin/admin.service.ts`, `admin-users/admin-users.service.ts`,
`orders/orders.service.ts`, `common/master-penalty.service.ts`,
`disputes/disputes.service.ts`). `ACTION_LABELS` — словарь для рендера;
неизвестное будущее значение `action` не ломает страницу — рендерится как
есть (fallback в `whatLabel` внутри Task 2).

```ts
import { api } from './api';

export type AuditActorType = 'OPERATOR' | 'SYSTEM';
export type AuditTargetType = 'MASTER_PROFILE' | 'USER' | 'ORDER' | 'PLANNED_ORDER' | 'DISPUTE';

export interface AuditLogRow {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  comment: string | null;
  createdAt: string;
  actor: { name: string | null; phone: string } | null;
}

export interface JournalPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const ACTION_LABELS: Record<string, string> = {
  MASTER_APPROVED: 'Верификация: одобрено',
  MASTER_REJECTED: 'Верификация: отклонено',
  MASTER_NEEDS_INFO: 'Верификация: запрошены данные',
  MASTER_AUTO_BLOCKED: 'Мастер заблокирован автоматически',
  USER_BLOCKED: 'Пользователь заблокирован',
  USER_UNBLOCKED: 'Пользователь разблокирован',
  ORDER_MANUALLY_ASSIGNED: 'Заказ: ручное назначение мастера',
  AUTO_CLOSED: 'Заказ закрыт автоматически',
  DISPUTE_RESOLVED: 'Спор разрешён',
};

export function fetchJournal(page: number): Promise<JournalPage> {
  return api(`/admin/journal?page=${page}`);
}
```

- [ ] **Step 2: Создать `app/(app)/journal/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetchJournal, ACTION_LABELS, type AuditLogRow } from '@/lib/journal';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `сегодня ${time}` : `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function whoLabel(row: AuditLogRow): string {
  if (row.actorType === 'SYSTEM' || !row.actor) return 'система';
  return row.actor.name ?? row.actor.phone;
}

function whatLabel(row: AuditLogRow): string {
  const label = ACTION_LABELS[row.action] ?? row.action;
  return row.comment ? `${label}: ${row.comment}` : label;
}

export default function JournalPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchJournal(page)
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
        setPageSize(data.pageSize);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [page]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="text-2xl font-extrabold text-ink">Журнал</div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[130px_170px_1fr] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Время</span>
          <span>Кто</span>
          <span>Что</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Пусто</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[130px_170px_1fr] items-start gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span className="text-ink-soft">{formatWhen(row.createdAt)}</span>
            <span>{whoLabel(row)}</span>
            <span className="text-ink-soft">{whatLabel(row)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-pill border-[1.5px] border-border px-3 py-1 text-xs font-extrabold text-ink-soft disabled:opacity-40"
        >
          ‹ Назад
        </button>
        <span className="text-xs font-bold text-ink-soft">
          Стр. {page} из {lastPage}
        </span>
        <button
          type="button"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-pill border-[1.5px] border-border px-3 py-1 text-xs font-extrabold text-ink-soft disabled:opacity-40"
        >
          Вперёд ›
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Журнал»**

Войти оператором, открыть `http://localhost:4400/journal`.

- Убедиться, что список непустой — в dev-БД уже накопились
  `AuditLog`-записи от прошлых живых проверок Фаз A-B и Task 4 этой фазы
  (верификации, блокировки, ручное назначение). Если записей меньше 31
  (одной страницы недостаточно, чтобы проверить пагинацию) — сгенерировать
  ещё несколько: заблокировать/разблокировать тестового пользователя пару
  раз через `/users`, либо решить ещё одну анкету через `/verification`.
- Проверить, что запись `ORDER_MANUALLY_ASSIGNED` из Task 2 отображается с
  правильным лейблом и именем оператора-актёра (не «система»).
- Проверить, что хотя бы одна системная запись (`AUTO_CLOSED` или
  `MASTER_AUTO_BLOCKED`, если такие есть в БД от прошлых сессий) отображает
  «система» в колонке «Кто».
- Если записей больше 30 — нажать «Вперёд», убедиться, что список
  сменился и кнопка «Назад» стала активна; на последней странице кнопка
  «Вперёд» задизейблена.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/journal.ts apps/operator/app/\(app\)/journal
git commit -m "feat(operator): раздел Журнал — список с серверной пагинацией"
```

---

## Итог Фазы C

После выполнения всех 3 задач: разделы «Заказы» (список+фильтры+деталь с
разной сводкой платежей для срочного/планового режима+кандидаты+ручное
назначение) и «Журнал» (пагинированный аудит-лог с человеко-читаемыми
лейблами действий) полностью рабочие поверх уже существующего API.
Оставшиеся 3 раздела («Споры», «Вывод средств», «Безопасность» — Фаза D,
последняя фаза Цикла B) получат свой план непосредственно перед
реализацией, как решено в спеке Цикла B.
