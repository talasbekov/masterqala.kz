# Оператор (desktop), Цикл B — Фаза D (последняя): Споры, Вывод средств, Безопасность — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать в `apps/operator` последние три раздела панели оператора:
«Споры» (список+деталь с контекстом заказа+таймлайном+двухшаговое подтверждение
решения), «Вывод средств» (read-only таблица+клиентский фильтр) и
«Безопасность» (перенос `apps/web/src/pages/AdminSecurityPage.tsx` в новый
шелл с заменой `window.prompt()` на inline-форму) — поверх уже существующего
API. После этой фазы Цикл B (визуальный редизайн панели оператора) и весь
подпроект 4 «Оператор/админка» полностью завершены. Дизайн-документ:
`docs/superpowers/specs/2026-07-31-operator-flow-desktop-phase-d-design.md`.

**Architecture:** Тот же паттерн `lib/<domain>.ts` + `app/(app)/<route>/page.tsx`.
«Споры» переиспользует `fetchOrder` из `lib/orders.ts` (Фаза C) для таймлайна
заказа — не дублирует парсинг и не требует нового бэкенд-эндпоинта. «Споры»
переиспользует `Lightbox` (Фаза B) для фото-доказательств, но с другим
базовым путём (`/disputes/:id/evidence/:docId`, не `/admin/...`). «Безопасность»
— дословный перенос структуры и данных `AdminSecurityPage.tsx`, единственное
отступление — `window.prompt()` заменяется на inline-форму комментария (тот
же паттерн, что уже применяется у решений в «Верификации»/«Спорах» этой
панели).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
(`@masterqala/ui/tokens.css`).

## Global Constraints

- Ни одного нового бэкенд-эндпоинта — только уже существующие
  `/admin/disputes`, `/admin/disputes/:id`, `/admin/disputes/:id/resolve`,
  `/disputes/:id/evidence/:docId` (не под `/admin`), `/admin/withdrawals`,
  `/admin/security/dashboard`, `/admin/security/alerts/:id`,
  `/admin/security/alerts/:id/assignment`,
  `/admin/security/alerts/:id/deliveries/retry`.
- «Вывод средств» остаётся read-only — бэкенд-эндпоинта для approve/reject
  нет и не добавляется.
- «Безопасность» переносит только то, что уже потребляет
  `AdminSecurityPage.tsx` (dashboard: readiness/delivery/metrics/топ-10
  alerts/топ-15 events) — полный курсорный `/admin/security/alerts` и
  `/admin/security/events` НЕ подключаются, это осознанно вне скоупа.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css`: `bg-surface`,
  `text-ink`, `text-ink-soft`, `border-border`, `bg-fill-soft`,
  `bg-fill-faint`, `text-primary`, `border-primary`, `bg-danger-bg`,
  `text-danger`, `text-danger-ink`, `border-danger`, `bg-success-bg`,
  `text-success-ink`, `border-success`, `bg-warning-bg`, `text-warning-ink`,
  `border-warning-ink`, `rounded-md`, `rounded-lg`, `rounded-pill`.
- Severity-цвета алертов безопасности: `CRITICAL` → `danger`-токены,
  `HIGH`/`WARNING` → одинаковые `warning`-токены (в проекте нет отдельного
  третьего оттенка — сознательное упрощение, зафиксировано в дизайн-документе).
- `window.prompt()` нигде не используется в `apps/operator` — раздел
  «Безопасность» заменяет его на inline `textarea`+кнопки Подтвердить/Отмена
  под конкретной карточкой алерта.
- Без фреймворка фронтенд-тестов — верификация каждой задачи: `pnpm
  --filter operator build` + живая браузерная проверка через preview-тул,
  где явно указано.
- **Логин при живой проверке:** тот же путь, что в Фазах A-C — curl
  `request-code`/`verify-code` для оператора `+77000000001`, код из логов
  `relaxed-api`, токен в `localStorage` через `preview_eval`.
- Дискриминированный union `OrderDetail` и функция `fetchOrder(id, type)` из
  `apps/operator/lib/orders.ts` (Фаза C) используются как есть, без правок.
- `Lightbox` из `apps/operator/components/Lightbox.tsx` (Фаза B) используется
  как есть — принимает `path`/`title`/`onClose`, для эвиденс-файлов спора
  `path = \`/disputes/${disputeId}/evidence/${encodeURIComponent(docId)}\`` (не
  `/admin/disputes/...`).
- Каждый `useEffect`, загружающий деталь по `selectedId` (в «Спорах»), должен
  включать `cancelled`-guard против гонки быстрых кликов по списку — тот же
  паттерн, что уже в `verification/page.tsx`, и предотвращает Minor-находку,
  уже всплывавшую в Фазе C (`orders/page.tsx`).

---

## Файловая структура Фазы D

```
apps/operator/
  lib/
    disputes.ts      # NEW
    withdrawals.ts   # NEW
    security.ts       # NEW
  app/(app)/
    disputes/page.tsx     # NEW
    withdrawals/page.tsx  # NEW
    security/page.tsx     # NEW
```

---

### Task 1: Раздел «Споры» — список, контекст заказа, двухшаговое разрешение

**Files:**
- Create: `apps/operator/lib/disputes.ts`
- Create: `apps/operator/app/(app)/disputes/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts`; `fetchOrder`, типы `OrderDetail`/`OrderType` из `lib/orders.ts` (Фаза C, не трогать); `Lightbox` из `components/Lightbox.tsx`; `useOperatorMetrics` из `lib/operatorMetrics.tsx` (для `refetchMetrics()` бейджа «Споры» после разрешения).

- [ ] **Step 1: Создать `lib/disputes.ts`**

Поля дословно сверены с моделью `Dispute` (`apps/api/prisma/schema.prisma`)
и ответами `admin-disputes.controller.ts`. `refundServiceFee`/
`penalizeMaster`/`resolutionNote`/`resolvedAt` — заполнены только после
разрешения (`null` пока `status === 'OPEN'`).

```ts
import { api } from './api';

export type DisputeStatus = 'OPEN' | 'RESOLVED';
export type DisputeRole = 'CLIENT' | 'MASTER';
export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE' | null;

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Открыт',
  RESOLVED: 'Разрешён',
};

export const DISPUTE_ROLE_LABELS: Record<DisputeRole, string> = {
  CLIENT: 'клиент',
  MASTER: 'мастер',
};

export interface DisputeListRow {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: DisputeRole;
  status: DisputeStatus;
  createdAt: string;
}

export interface DisputeDetail {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: DisputeRole;
  reason: string;
  counterStatement: string | null;
  evidenceDocIds: string[];
  status: DisputeStatus;
  commercialMode: CommercialMode;
  refundServiceFee: boolean | null;
  penalizeMaster: boolean | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export function fetchDisputes(status?: DisputeStatus): Promise<DisputeListRow[]> {
  const query = status ? `?status=${status}` : '';
  return api(`/admin/disputes${query}`);
}

export function fetchDispute(id: string): Promise<DisputeDetail> {
  return api(`/admin/disputes/${id}`);
}

export interface ResolveDisputePayload {
  refundServiceFee: boolean;
  penalizeMaster: boolean;
  resolutionNote: string;
}

export function resolveDispute(id: string, payload: ResolveDisputePayload): Promise<DisputeDetail> {
  return api(`/admin/disputes/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Создать `app/(app)/disputes/page.tsx`**

Раздел по умолчанию открывается на фильтре «Открытые» (`status=OPEN`) —
так уже вело себя предыдущее (mobile-first) поведение раздела, операторы
в первую очередь разбирают активные споры. Layout — список 300px слева
(карточки, как в «Верификации») + правая часть, поделённая на
контекст-колонку (`flex-1`) и панель решения (`w-[360px]`). Панель решения
рендерится только при `status === 'OPEN'`; иначе — баннер с уже принятым
решением.

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  fetchDisputes,
  fetchDispute,
  resolveDispute,
  DISPUTE_STATUS_LABELS,
  DISPUTE_ROLE_LABELS,
  type DisputeListRow,
  type DisputeDetail,
  type DisputeStatus,
} from '@/lib/disputes';
import { fetchOrder, type OrderDetail, type OrderType } from '@/lib/orders';
import { Lightbox } from '@/components/Lightbox';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const STATUS_FILTERS: { value: DisputeStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'OPEN', label: 'открытые' },
  { value: 'RESOLVED', label: 'разрешённые' },
];

const STATUS_PILL: Record<DisputeStatus, string> = {
  OPEN: 'bg-warning-bg text-warning-ink',
  RESOLVED: 'bg-success-bg text-success-ink',
};

function formatWaiting(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return hours < 24 ? `ждёт ${hours} ч` : `ждёт ${Math.floor(hours / 24)} дн`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DisputesPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'ALL'>('OPEN');
  const [rows, setRows] = useState<DisputeListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [order, setOrder] = useState<OrderDetail | null>(null);

  const [refundServiceFee, setRefundServiceFee] = useState(false);
  const [penalizeMaster, setPenalizeMaster] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [refundWarning, setRefundWarning] = useState('');
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);

  function loadList() {
    setListLoading(true);
    fetchDisputes(statusFilter === 'ALL' ? undefined : statusFilter)
      .then((data) => {
        setRows(data);
        setListError('');
      })
      .catch((e) => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }

  useEffect(loadList, [statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setOrder(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setRefundServiceFee(false);
    setPenalizeMaster(false);
    setResolutionNote('');
    setConfirming(false);
    setResolveError('');
    setRefundWarning('');
    setOrder(null);

    fetchDispute(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setDetailError('');
        const orderType: OrderType = data.orderId ? 'urgent' : 'planned';
        const orderId = data.orderId ?? data.plannedOrderId;
        if (orderId) {
          fetchOrder(orderId, orderType)
            .then((o) => {
              if (!cancelled) setOrder(o);
            })
            .catch(() => {
              /* контекст заказа необязателен — деталь спора работает и без него */
            });
        }
      })
      .catch((e) => {
        if (!cancelled) setDetailError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function confirmResolve() {
    if (!selectedId) return;
    setResolving(true);
    setResolveError('');
    setRefundWarning('');
    try {
      const updated = await resolveDispute(selectedId, {
        refundServiceFee,
        penalizeMaster,
        resolutionNote: resolutionNote.trim(),
      });
      setDetail(updated);
      setConfirming(false);
      loadList();
      refetchMetrics();
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('возврат сбора не удался')) {
        setRefundWarning(message);
        setConfirming(false);
        try {
          const refreshed = await fetchDispute(selectedId);
          setDetail(refreshed);
        } catch {
          /* деталь уже была разрешена на бэкенде — покажем предупреждение как есть */
        }
        loadList();
        refetchMetrics();
      } else {
        setResolveError(message);
      }
    } finally {
      setResolving(false);
    }
  }

  const canRefundServiceFee = Boolean(detail?.orderId && detail.commercialMode !== 'FREE_PILOT');
  const needComment = !resolutionNote.trim();

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Споры</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {listError && <div className="text-sm text-danger">{listError}</div>}

      <div className="flex gap-4">
        <div className="flex w-[300px] shrink-0 flex-col gap-2">
          {listLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {!listLoading && rows.length === 0 && <div className="text-sm text-ink-soft">Пусто</div>}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`rounded-lg border-2 bg-surface p-3 text-left ${
                selectedId === r.id ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-ink">
                  #{r.id.slice(0, 8)} · {r.orderId ? 'Срочная' : 'Плановая'}
                </span>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[r.status]}`}>
                  {DISPUTE_STATUS_LABELS[r.status]}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-ink-soft">
                открыл {DISPUTE_ROLE_LABELS[r.openedByRole]} · {formatWaiting(r.createdAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-surface p-5">
          {!selectedId && <div className="text-sm text-ink-soft">Выберите спор слева</div>}
          {selectedId && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selectedId && detailError && <div className="text-sm text-danger">{detailError}</div>}
          {selectedId && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-extrabold text-ink">
                  Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке
                </span>
                <span className={`rounded-pill px-3 py-1 text-xs font-extrabold ${STATUS_PILL[detail.status]}`}>
                  {DISPUTE_STATUS_LABELS[detail.status]}
                </span>
              </div>

              {order && (
                <>
                  <div className="text-sm text-ink-soft">
                    {order.category} · {order.address}, {order.district}
                  </div>
                  <div className="text-sm font-extrabold text-ink">Таймлайн заказа</div>
                  <div className="flex flex-col gap-2">
                    {order.timeline.map((event, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                        <span className="font-bold text-ink">{event.event}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">
                  Заявление ({DISPUTE_ROLE_LABELS[detail.openedByRole]})
                </div>
                <div className="mt-1 text-sm text-ink">{detail.reason}</div>
              </div>

              {detail.evidenceDocIds.length > 0 && (
                <>
                  <div className="text-sm font-extrabold text-ink">Доказательства</div>
                  <div className="flex flex-wrap gap-2.5">
                    {detail.evidenceDocIds.map((docId, i) => (
                      <button
                        key={docId}
                        type="button"
                        onClick={() => setOpenDoc({ id: docId, title: `Доказательство ${i + 1}` })}
                        className="rounded-md border border-border bg-fill-faint px-3 py-2 text-xs font-extrabold text-ink"
                      >
                        Фото {i + 1} · открыть ⤢
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">Пояснение второй стороны</div>
                <div className="mt-1 text-sm text-ink">{detail.counterStatement ?? 'пояснение не предоставлено'}</div>
              </div>

              {detail.status !== 'OPEN' ? (
                <div className="rounded-md bg-fill-soft p-3 text-sm font-bold text-ink">
                  ✓ Решено: {detail.refundServiceFee && 'сбор возвращён'}
                  {detail.refundServiceFee && detail.penalizeMaster && ', '}
                  {detail.penalizeMaster && 'мастер оштрафован'}
                  {!detail.refundServiceFee && !detail.penalizeMaster && 'без возврата и без санкции'}
                  {detail.resolutionNote && <div className="mt-1 text-xs font-semibold text-ink-soft">{detail.resolutionNote}</div>}
                  {detail.resolvedAt && (
                    <div className="mt-1 text-xs font-semibold text-ink-soft">{formatDateTime(detail.resolvedAt)}</div>
                  )}
                  {refundWarning && <div className="mt-2 text-xs font-extrabold text-danger">{refundWarning}</div>}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <div className="text-sm font-extrabold text-ink">Решение оператора</div>

                  {canRefundServiceFee ? (
                    <label className="flex items-center gap-2 text-sm font-bold text-ink">
                      <input
                        type="checkbox"
                        checked={refundServiceFee}
                        onChange={(e) => setRefundServiceFee(e.target.checked)}
                      />
                      Вернуть сервисный сбор клиенту
                    </label>
                  ) : detail.orderId ? (
                    <div className="rounded-md bg-fill-faint p-2 text-xs text-ink-soft">
                      В бесплатном пилоте сервисный сбор не взимался, возврат недоступен.
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={penalizeMaster}
                      onChange={(e) => setPenalizeMaster(e.target.checked)}
                    />
                    Санкция мастеру
                  </label>

                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Комментарий решения — обязателен, увидят обе стороны"
                    className="min-h-16 rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
                  />

                  {!confirming ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={needComment}
                        onClick={() => setConfirming(true)}
                        className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                      >
                        Решить спор
                      </button>
                      {needComment && (
                        <span className="text-xs font-bold text-warning-ink">введите комментарий решения</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md bg-warning-bg p-3">
                      <div className="text-xs font-bold text-warning-ink">
                        Подтвердите: {refundServiceFee && 'сбор будет возвращён'}
                        {refundServiceFee && penalizeMaster && ', '}
                        {penalizeMaster && 'мастер получит санкцию'}
                        {!refundServiceFee && !penalizeMaster && 'решение без возврата и без санкции'}.
                        Действие необратимо и попадёт в журнал.
                      </div>
                      {resolveError && <div className="text-xs font-bold text-danger">{resolveError}</div>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={resolving}
                          onClick={confirmResolve}
                          className="rounded-pill bg-danger px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                        >
                          Подтверждаю решение
                        </button>
                        <button
                          type="button"
                          disabled={resolving}
                          onClick={() => setConfirming(false)}
                          className="rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
                        >
                          Назад
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {openDoc && selectedId && (
        <Lightbox
          path={`/disputes/${selectedId}/evidence/${encodeURIComponent(openDoc.id)}`}
          title={openDoc.title}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Споры»**

Войти оператором (curl+localStorage, см. Global Constraints), открыть
`http://localhost:4400/disputes`.

- Если в dev-БД нет открытых споров — создать один живьём: через
  `apps/client`/`apps/master` довести срочную заявку до статуса, где
  доступно открытие спора (например `DONE`), открыть спор с реальным фото
  через `apps/client` UI (страница `/order/:id/dispute`, Фаза B подпроекта
  2 — уже реализована и живьём проверена ранее), затем ответить со стороны
  мастера через `apps/master` (`counterStatement`), если нужно проверить
  оба поля.
- Убедиться: список слева показывает спор с корректным типом
  (Срочная/Плановая), статусной пилюлей, меткой ожидания; клик открывает
  деталь — контекст заказа (таймлайн) появляется через секунду (лениво,
  после основной детали спора).
- Кликнуть по плитке фото-доказательства — должен открыться реальный
  Lightbox с картинкой (не ошибка 403/404) — подтверждает, что путь
  `/disputes/:id/evidence/:docId` (не `/admin/...`) работает для роли
  OPERATOR.
- Ввести комментарий, отметить оба чекбокса (если применимо — для
  срочной заявки не FREE_PILOT), нажать «Решить спор» — должен появиться
  warning-баннер с сводкой и двумя кнопками; нажать «Назад» — форма должна
  вернуться к состоянию редактирования с сохранёнными чекбоксами/
  комментарием.
- Снова нажать «Решить спор» → «Подтверждаю решение» — деталь должна
  показать зелёный баннер решения с сводкой, список слева обновиться
  (статус «Разрешён»), бейдж «Споры» в сайдбаре уменьшиться без ожидания
  поллинга.
- Отдельно проверить (если технически возможно без реального провайдера
  возврата) или хотя бы прочитать код: сценарий `refundWarning` — не
  обязательно форсировать вживую, если это требует ломать мок-провайдер;
  если время/возможности позволяют — form баг-репорт в отчёте, если нет,
  зафиксировать как concern (не блокирует, т.к. мок-провайдер по умолчанию
  синхронно успешен — сценарий 503 нужен только когда провайдер реально
  недоступен).
- Проверить плановый спор (если есть плановая заявка с диспутом в БД, или
  создать через `apps/client` плановый флоу): чекбокс возврата сбора
  должен полностью отсутствовать (не задизейблен, а не отрендерен).

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/disputes.ts apps/operator/app/\(app\)/disputes
git commit -m "feat(operator): раздел Споры — контекст заказа, доказательства, двухшаговое решение"
```

---

### Task 2: Раздел «Вывод средств» — read-only таблица с клиентским фильтром

**Files:**
- Create: `apps/operator/lib/withdrawals.ts`
- Create: `apps/operator/app/(app)/withdrawals/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts`.
- Produces: `interface WithdrawalRow`, `STATUS_LABELS`, `formatMaskedPhone`, `fetchWithdrawals()` из `lib/withdrawals.ts`.

- [ ] **Step 1: Создать `lib/withdrawals.ts`**

Бэкенд отдаёт только последние 4 символа телефона (`master.phone.slice(-4)`
на бэкенде) — форматирование `+7 ··· XX XX` целиком на фронте, большего
бэкенд не даёт и не нужно.

```ts
import { api } from './api';

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface WithdrawalRow {
  id: string;
  masterUserId: string;
  amount: number;
  status: WithdrawalStatus;
  providerRef: string | null;
  requestedAt: string;
  paidAt: string | null;
  master: { phone: string };
}

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'в обработке',
  PAID: 'выплачено',
  FAILED: 'отклонено · возврат',
};

export function fetchWithdrawals(): Promise<WithdrawalRow[]> {
  return api('/admin/withdrawals');
}

export function formatMaskedPhone(last4: string): string {
  const digits = last4.replace(/\D/g, '').padStart(4, '0');
  return `+7 ··· ${digits.slice(0, 2)} ${digits.slice(2)}`;
}
```

- [ ] **Step 2: Создать `app/(app)/withdrawals/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  fetchWithdrawals,
  STATUS_LABELS,
  formatMaskedPhone,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '@/lib/withdrawals';

const STATUS_FILTERS: { value: WithdrawalStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'PENDING', label: 'в обработке' },
  { value: 'PAID', label: 'выплачено' },
  { value: 'FAILED', label: 'отклонено' },
];

const STATUS_PILL: Record<WithdrawalStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-ink',
  PAID: 'bg-success-bg text-success-ink',
  FAILED: 'bg-danger-bg text-danger',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWithdrawals()
      .then((data) => {
        setRows(data);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Вывод средств</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WithdrawalStatus | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_160px_140px_160px_160px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Мастер</span>
          <span>Реквизиты</span>
          <span>Сумма</span>
          <span>Дата</span>
          <span>Статус</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && filtered.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {filtered.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_160px_140px_160px_160px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span className="text-ink-soft">{r.masterUserId.slice(0, 8)}</span>
            <span>{formatMaskedPhone(r.master.phone)}</span>
            <span>{r.amount} ₸</span>
            <span className="text-ink-soft">{formatDate(r.paidAt ?? r.requestedAt)}</span>
            <span>
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="text-xs text-ink-soft">
        Выплаты проходят автоматически через платёжного провайдера; при отказе банка сумма возвращается на баланс
        мастера. Раздел read-only.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Вывод средств»**

Войти оператором, открыть `http://localhost:4400/withdrawals`.

- Если в dev-БД нет заявок на вывод — создать через `apps/master` (Wallet →
  запросить вывод, при необходимости временно переключить
  `COMMERCIAL_MODE=PAID_MOCK` в `apps/api/.env`, как делалось в прошлых
  сессиях для проверки кошелька, и вернуть обратно после проверки).
- Убедиться: таблица показывает маскированный телефон в формате
  `+7 ··· XX XX`, сумму, статус-пилюлю верного цвета; фильтр статуса
  сужает список.
- Убедиться: ни одной кнопки действия в строках — раздел полностью
  read-only.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/withdrawals.ts apps/operator/app/\(app\)/withdrawals
git commit -m "feat(operator): раздел Вывод средств — read-only таблица с фильтром"
```

---

### Task 3: Раздел «Безопасность» — перенос дашборда, алертов и audit-событий

**Files:**
- Create: `apps/operator/lib/security.ts`
- Create: `apps/operator/app/(app)/security/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts`; `useAuth` из `lib/auth.tsx` (для сравнения `assignedToUserId === user?.id`, показ «Вы»).

- [ ] **Step 1: Создать `lib/security.ts`**

Типы дословно перенесены из `apps/web/src/pages/AdminSecurityPage.tsx`
(строки 6-86) — те же поля, тот же контракт `GET /admin/security/dashboard`.

```ts
import { api } from './api';

export interface Dependency {
  status: 'UP' | 'DOWN' | 'DISABLED';
  latencyMs?: number;
  enabled?: boolean;
  mode?: string;
  lastError?: string | null;
}

export interface SecurityAlert {
  id: string;
  ruleKey: string;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  title: string;
  resourceType: string;
  resourceId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  assignedToUserId: string | null;
  assignedAt: string | null;
  acknowledgeBy: string | null;
  resolveBy: string | null;
  escalatedAt: string | null;
  escalationLevel: number;
  operatorNote: string | null;
}

export interface SecurityAuditEvent {
  id: string;
  action: string;
  severity: string;
  outcome: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
}

export interface SecurityDashboard {
  generatedAt: string;
  readiness: {
    status: 'ready' | 'not_ready';
    environment: string;
    dependencies: { database: Dependency; queue: Dependency; scanner: Dependency };
    backlog: {
      pendingScans: number;
      failedScans: number;
      staleScanning: number;
      openCriticalAlerts: number;
      openHighAlerts: number;
    };
    warnings: string[];
  };
  delivery: { enabled: boolean; channel: 'WEBHOOK'; maxAttempts: number; timeoutMs: number };
  metrics: {
    events24h: number;
    infected24h: number;
    scanFailed24h: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    warningAlerts: number;
    overdueAcknowledgementAlerts: number;
    overdueResolutionAlerts: number;
    pendingDeliveries: number;
    exhaustedDeliveries: number;
    oldestOpenAlertAt: string | null;
  };
  alerts: SecurityAlert[];
  recentEvents: SecurityAuditEvent[];
}

export function fetchSecurityDashboard(): Promise<SecurityDashboard> {
  return api('/admin/security/dashboard');
}

export async function transitionAlert(
  id: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  note?: string,
): Promise<void> {
  await api(`/admin/security/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note: note || undefined }),
  });
}

export async function assignAlert(id: string, assigneeUserId: string | null): Promise<void> {
  await api(`/admin/security/alerts/${id}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeUserId }),
  });
}

export async function retryAlertDelivery(id: string): Promise<void> {
  await api(`/admin/security/alerts/${id}/deliveries/retry`, { method: 'POST' });
}
```

- [ ] **Step 2: Создать `app/(app)/security/page.tsx`**

Структура — 7 секций, дословно перенесённые из `AdminSecurityPage.tsx`
(хедер+рефетч, готовность, 8 плиток метрик, открытые alerts, таблица
последних events, футер), автополлинг **15 секунд** (не 30, как на
«Обзоре»). Единственное отступление — `window.prompt()` (строки 150-155
оригинала) заменён на inline-форму под конкретной карточкой алерта.

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchSecurityDashboard,
  transitionAlert,
  assignAlert,
  retryAlertDelivery,
  type SecurityDashboard,
  type SecurityAlert,
  type Dependency,
} from '@/lib/security';

const SEVERITY_CLASS: Record<SecurityAlert['severity'], string> = {
  CRITICAL: 'border-danger bg-danger-bg text-danger-ink',
  HIGH: 'border-warning-ink bg-warning-bg text-warning-ink',
  WARNING: 'border-warning-ink bg-warning-bg text-warning-ink',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function isOverdue(value: string | null): boolean {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function DependencyCard({ title, dependency }: { title: string; dependency: Dependency }) {
  const healthy = dependency.status === 'UP' || dependency.status === 'DISABLED';
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-ink">{title}</span>
        <span
          className={`rounded-pill px-2 py-1 text-[10px] font-extrabold ${
            healthy ? 'bg-success-bg text-success-ink' : 'bg-danger-bg text-danger'
          }`}
        >
          {dependency.status}
        </span>
      </div>
      <div className="mt-2 text-xs text-ink-soft">
        {dependency.latencyMs !== undefined && <span>{dependency.latencyMs} мс</span>}
        {dependency.mode && <span> · {dependency.mode}</span>}
      </div>
      {dependency.lastError && <p className="mt-2 break-words text-xs text-danger">{dependency.lastError}</p>}
    </div>
  );
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<{ alertId: string; status: 'ACKNOWLEDGED' | 'RESOLVED' } | null>(null);
  const [formNote, setFormNote] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await fetchSecurityDashboard();
      setDashboard(result);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function startForm(alert: SecurityAlert, status: 'ACKNOWLEDGED' | 'RESOLVED') {
    setOpenForm({ alertId: alert.id, status });
    setFormNote(alert.operatorNote ?? '');
  }

  function cancelForm() {
    setOpenForm(null);
    setFormNote('');
  }

  async function submitForm() {
    if (!openForm) return;
    setActionId(`${openForm.alertId}:${openForm.status}`);
    try {
      await transitionAlert(openForm.alertId, openForm.status, formNote.trim());
      setOpenForm(null);
      setFormNote('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function assign(alert: SecurityAlert, assigneeUserId: string | null) {
    setActionId(`${alert.id}:assign`);
    try {
      await assignAlert(alert.id, assigneeUserId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function retryDelivery(alert: SecurityAlert) {
    setActionId(`${alert.id}:retry`);
    try {
      await retryAlertDelivery(alert.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) return <div className="p-8 text-sm text-ink-soft">Загрузка security dashboard…</div>;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-ink">Безопасность платформы</div>
          <p className="text-sm text-ink-soft">Инфраструктура, SLA инцидентов, внешняя доставка и audit trail.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border-[1.5px] border-border bg-surface px-4 py-2 text-sm font-extrabold text-ink"
        >
          Обновить
        </button>
      </div>

      {error && <div className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</div>}

      {dashboard && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="text-lg font-extrabold text-ink">Готовность</div>
              <span
                className={`rounded-pill px-3 py-1 text-xs font-extrabold ${
                  dashboard.readiness.status === 'ready' ? 'bg-success-bg text-success-ink' : 'bg-danger-bg text-danger'
                }`}
              >
                {dashboard.readiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </span>
              <span className="text-xs text-ink-soft">{dashboard.readiness.environment}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <DependencyCard title="PostgreSQL" dependency={dashboard.readiness.dependencies.database} />
              <DependencyCard title="pg-boss" dependency={dashboard.readiness.dependencies.queue} />
              <DependencyCard title="ClamAV" dependency={dashboard.readiness.dependencies.scanner} />
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-ink">Alert webhook</span>
                  <span
                    className={`rounded-pill px-2 py-1 text-[10px] font-extrabold ${
                      dashboard.delivery.enabled ? 'bg-success-bg text-success-ink' : 'bg-fill-soft text-ink-soft'
                    }`}
                  >
                    {dashboard.delivery.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  {dashboard.delivery.timeoutMs} мс · {dashboard.delivery.maxAttempts} попыток
                </p>
              </div>
            </div>
            {dashboard.readiness.warnings.length > 0 && (
              <ul className="rounded-md bg-warning-bg p-3 text-sm text-warning-ink">
                {dashboard.readiness.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid grid-cols-4 gap-3">
            {[
              ['Открытые alerts', dashboard.metrics.openAlerts],
              ['Просрочено подтверждение', dashboard.metrics.overdueAcknowledgementAlerts],
              ['Просрочено решение', dashboard.metrics.overdueResolutionAlerts],
              ['Исчерпана доставка', dashboard.metrics.exhaustedDeliveries],
              ['Заражено за 24 ч', dashboard.metrics.infected24h],
              ['Ошибки scan за 24 ч', dashboard.metrics.scanFailed24h],
              ['Ожидают webhook', dashboard.metrics.pendingDeliveries],
              ['Audit events за 24 ч', dashboard.metrics.events24h],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-border bg-surface p-4">
                <div className="text-2xl font-extrabold text-ink">{value}</div>
                <div className="mt-1 text-sm text-ink-soft">{label}</div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-ink">Открытые alerts</div>
              <span className="text-xs text-ink-soft">Старейший: {formatDate(dashboard.metrics.oldestOpenAlertAt)}</span>
            </div>
            <div className="flex flex-col gap-3">
              {dashboard.alerts.map((alert) => {
                const actionPending = actionId?.startsWith(`${alert.id}:`) ?? false;
                const ackOverdue = alert.status === 'OPEN' && isOverdue(alert.acknowledgeBy);
                const resolveOverdue = alert.status === 'ACKNOWLEDGED' && isOverdue(alert.resolveBy);
                const formOpenHere = openForm?.alertId === alert.id;
                return (
                  <article key={alert.id} className={`rounded-lg border-2 p-4 ${SEVERITY_CLASS[alert.severity]}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-pill bg-surface/70 px-2 py-1 text-[10px] font-extrabold">
                            {alert.severity}
                          </span>
                          <span className="rounded-pill bg-surface/70 px-2 py-1 text-[10px] font-bold">{alert.status}</span>
                          {alert.escalationLevel > 0 && (
                            <span className="rounded-pill bg-danger px-2 py-1 text-[10px] font-extrabold text-white">
                              ESC L{alert.escalationLevel}
                            </span>
                          )}
                          {alert.occurrenceCount > 1 && (
                            <span className="text-[10px] font-bold">Повторений: {alert.occurrenceCount}</span>
                          )}
                        </div>
                        <h3 className="mt-2 text-sm font-extrabold">{alert.title}</h3>
                        <p className="mt-1 break-all text-xs opacity-80">
                          {alert.resourceType} · {alert.resourceId}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-1 text-xs opacity-90">
                          <span>Ответственный: {alert.assignedToUserId === user?.id ? 'Вы' : alert.assignedToUserId ?? 'не назначен'}</span>
                          <span>Последнее событие: {formatDate(alert.lastSeenAt)}</span>
                          <span className={ackOverdue ? 'font-extrabold' : ''}>Принять до: {formatDate(alert.acknowledgeBy)}</span>
                          <span className={resolveOverdue ? 'font-extrabold' : ''}>Решить до: {formatDate(alert.resolveBy)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {alert.assignedToUserId !== user?.id && user && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void assign(alert, user.id)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Назначить себе
                          </button>
                        )}
                        {alert.assignedToUserId === user?.id && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void assign(alert, null)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Снять
                          </button>
                        )}
                        {alert.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => startForm(alert, 'ACKNOWLEDGED')}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Принять
                          </button>
                        )}
                        {dashboard.delivery.enabled && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void retryDelivery(alert)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Повторить webhook
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => startForm(alert, 'RESOLVED')}
                          className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                        >
                          Закрыть
                        </button>
                      </div>
                    </div>

                    {formOpenHere && (
                      <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface/70 p-3">
                        <textarea
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          placeholder={
                            openForm.status === 'ACKNOWLEDGED' ? 'Комментарий оператора (необязательно)' : 'Как был устранён инцидент?'
                          }
                          className="min-h-14 rounded-md border-[1.5px] border-current bg-surface p-2 text-sm text-ink"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void submitForm()}
                            className="rounded-pill bg-primary px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
                          >
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            onClick={cancelForm}
                            className="rounded-pill border-[1.5px] border-current px-3 py-1.5 text-xs font-extrabold"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {dashboard.alerts.length === 0 && (
                <div className="rounded-lg border border-border p-6 text-center text-sm text-ink-soft">
                  Открытых alerts нет
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="text-lg font-extrabold text-ink">Последние audit events</div>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <div className="grid grid-cols-[130px_1fr_150px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
                <span>Время</span>
                <span>Событие</span>
                <span>Ресурс</span>
              </div>
              {dashboard.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[130px_1fr_150px] items-start gap-3 border-b border-fill-soft px-4 py-2.5 text-sm"
                >
                  <span className="text-ink-soft">{formatDate(event.createdAt)}</span>
                  <span className="font-bold text-ink">
                    {event.action} <span className="text-ink-soft">· {event.severity} · {event.outcome}</span>
                  </span>
                  <span className="truncate text-xs text-ink-soft">
                    {event.resourceType} · {event.resourceId}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <p className="text-right text-xs text-ink-soft">Обновлено: {formatDate(dashboard.generatedAt)}</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Безопасность»**

Войти оператором, открыть `http://localhost:4400/security`.

- Убедиться: секция «Готовность» показывает реальные статусы зависимостей
  (PostgreSQL/pg-boss/ClamAV, все должны быть `UP`/`DISABLED` в dev-окружении
  при поднятых сервисах), 8 плиток метрик, футер с `generatedAt`.
- Если в dev-БД нет открытых security-алертов — создать один прямым SQL-
  инсертом в таблицу `SecurityAlert` (аналогично прецеденту форсирования
  `canAssign` в Фазе C — минимальный набор колонок: `id`, `ruleKey`,
  `severity`, `title`, `resourceType`, `resourceId`, `status='OPEN'`,
  `occurrenceCount=1`, `firstSeenAt`/`lastSeenAt=now()`, остальное по
  умолчанию/NULL — сверить реальный список колонок через `\d "SecurityAlert"`
  в psql перед вставкой).
- Убедиться: карточка алерта окрашена по severity, кнопка «Принять»
  открывает inline-форму (не браузерный `prompt()`), «Подтвердить» переводит
  алерт в `ACKNOWLEDGED`, кнопка меняется на «Снять»/«Назначить себе» по
  состоянию `assignedToUserId`.
- Нажать «Закрыть» → заполнить/оставить пустым комментарий → «Подтвердить» —
  алерт должен пропасть из списка «Открытые alerts» (или обновиться
  статус), метрика «Открытые alerts» уменьшиться после следующего рефетча
  (ручного «Обновить» или 15-секундного автополлинга).
- Убедиться: 15-секундный автополлинг реально обновляет `generatedAt` без
  перезагрузки страницы (подождать ≥15 сек, проверить, что метка времени
  изменилась).

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/security.ts apps/operator/app/\(app\)/security
git commit -m "feat(operator): раздел Безопасность — перенос дашборда, алертов, audit-событий"
```

---

## Итог Фазы D

После выполнения всех 3 задач: все 9 разделов панели оператора (Обзор,
Верификация, Пользователи, Мастера, Заказы, Споры, Вывод средств, Журнал,
Безопасность) реализованы в `apps/operator`. Цикл B (визуальный редизайн
панели оператора) и весь подпроект 4 «Оператор/админка» веб-редизайна под
десктоп полностью завершены — вслед за подпроектами 1 (сайт), 2 (клиентский
флоу), 3 (флоу мастера). После финального whole-phase review этой фазы
рекомендуется дополнительный whole-cycle review всего Цикла B (все 4 фазы
целиком), по прецеденту цикла «клиент v2» — решение об этом принимается
отдельно после чистого результата этой фазы.
