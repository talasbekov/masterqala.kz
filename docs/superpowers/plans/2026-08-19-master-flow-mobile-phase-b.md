# Мобильный ретрофит `apps/master`, Фаза B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильные версии трёх экранов флоу мастера — анкета (`/become-master`), активный заказ (`ActiveOrderView`), форма цены (внутри активного заказа) — по той же CSS-парной архитектуре, что Фаза A.

**Architecture:** Десктопные компоненты не меняются функционально. `ActiveOrderView` следует паттерну `OfferOverlay`/`OfferOverlayMobile` из Фазы A: десктопный JSX оборачивается в `hidden md:flex`, рядом безусловно рендерится новый `ActiveOrderViewMobile`. Оба читают один и тот же `ActiveOrder` и вызывают одни и те же функции `lib/activeOrder.ts` — ни один API-вызов не дублируется. `/become-master` — не парные компоненты, а прямая адаптация отступов существующей разметки (уже `mx-auto max-w-[560px]`-центрирована, брейкпоинтов не было вовсе).

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (`@theme` в `packages/ui/src/tokens.css`, без `tailwind.config.js`), существующий `MapView`/`MapViewInner` (Leaflet, `dynamic(ssr:false)`).

## Global Constraints

- Брейкпоинт `md` = 768px, тот же порог, что везде в проекте.
- Видимость десктоп/мобильный переключается CSS (`hidden md:flex` / `md:hidden`), **не** JS `useMediaQuery`/`matchMedia` — избегаем гидратационного мисматча.
- Бэкенд (`apps/api`) не меняется в этой фазе — все нужные поля (`district`, `entrance`, `floor`, `apartment`, `addressComment`, `calloutPrice`, `serviceFee`, `commercialMode`/`freePilot`, `photos`) уже отдаются `GET master/active-order` через `ORDER_INCLUDE` (`apps/api/src/orders/order.constants.ts:25-31`) и `presentValue()` (`apps/api/src/orders/orders.controller.ts`).
- Анкета `/become-master` остаётся одностраничной формой — визард сознательно не делается (решение брейнсторминга, см. спеку).
- Форма цены — тот же вызов `POST /orders/:id/propose-price` (`ProposePriceDto { amount: number, comment?: string }`, `apps/api/src/orders/dto.ts:76`), без новых полей — «чипы длительности» декоративны и, при выборе, добавляются текстом в `comment`.
- Отображение уже прикреплённых к заказу фото (`order.photos`) — **явно вне скоупа этой фазы**: в бэкенде есть эндпоинт (`GET orders/:id/photos/:photoId`, авторизованный), но нигде в кодовой базе нет прецедента их показа (только загрузка) — это новый UI-паттерн, а не ретрофит существующего. Карточка показывает описание + «N фото» текстом без превью, как в остальном совпадает с прототипом.
- Тестирование — без фреймворка фронтенд-тестов (осознанный выбор всего проекта). Проверка: `tsc --noEmit` + `pnpm --filter master build`, затем живая браузерная проверка на 390px и десктопе; для Task 6 — сквозной сценарий через реальный сокет (два браузера).

---

### Task 1: Расширить `ActiveOrder`/`ActiveOrderClient` под данные, которые бэкенд уже отдаёт

**Files:**
- Modify: `apps/master/lib/activeOrder.ts`

**Interfaces:**
- Produces: расширенный `ActiveOrder` (все поля читаются как есть из ответа `GET master/active-order` — бэкенд не меняется, интерфейс просто перестаёт быть уже, чем фактический ответ).

- [ ] **Step 1: Расширить интерфейсы**

Замени блок интерфейсов в начале файла (`ActiveOrderClient`, `ActiveOrderCategory`, `ActiveOrder`) на:

```ts
export interface ActiveOrderClient {
  name: string;
  phone: string;
}

export interface ActiveOrderCategory {
  name: string;
}

export interface ActiveOrder {
  id: string;
  status: string;
  address: string;
  district: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  addressComment: string | null;
  description: string;
  lat: number | null;
  lng: number | null;
  calloutPrice: number;
  serviceFee: number;
  freePilot?: boolean;
  photos: { id: string }[];
  category: ActiveOrderCategory | null;
  client: ActiveOrderClient | null;
}
```

`freePilot` необязателен (`presentValue()` в контроллере добавляет его в ответ только когда `commercialMode === 'FREE_PILOT'`, см. `apps/api/src/orders/orders.controller.ts` — метод `presentValue`). `photos` типизирован только по `id` — превью не показываем (см. Global Constraints), но количество (`order.photos.length`) нужно для карточки.

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок (остальные файлы этот интерфейс пока не читают за пределами уже используемых полей).

- [ ] **Step 3: Коммит**

```bash
git add apps/master/lib/activeOrder.ts
git commit -m "feat(master): расширить ActiveOrder под уже отдаваемые бэкендом поля"
```

---

### Task 2: `ConfirmSheet` — переиспользуемый bottom-sheet подтверждения

**Files:**
- Create: `apps/master/components/ConfirmSheet.tsx`

**Interfaces:**
- Produces: `ConfirmSheet` — компонент `{ open: boolean; title: string; body: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }`. Рендерит `null`, когда `open === false`. Используется Task 3 для замены `window.confirm()` на статусных кнопках и для danger-sheet отмены.

Мобильный оверлей поверх всего экрана (не парный компонент — это чисто мобильный паттерн, на десктопе статус-кнопки не используют bottom-sheet, там остаётся `window.confirm()` как решено в спеке).

- [ ] **Step 1: Написать компонент**

```tsx
'use client';

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/40 md:hidden" onClick={onClose}>
      <div
        className="w-full rounded-t-sheet bg-surface px-5 pb-6 pt-3.5 shadow-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9.5 rounded-full bg-border" />
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`w-full rounded-pill p-3.5 text-sm font-extrabold text-white disabled:opacity-40 ${
              danger ? 'bg-danger' : 'bg-primary'
            }`}
          >
            {busy ? 'Подождите…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full rounded-pill border-[1.5px] border-border p-3.5 text-sm font-extrabold text-ink disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

`md:hidden` на корневом оверлее — десктоп никогда не видит это дерево, даже если по ошибке смонтировано (defensive, но дёшево; сам `ActiveOrderViewMobile`, который единственный использует `ConfirmSheet`, и так не рендерится на десктопе через `md:hidden` на своём корне — см. Task 3).

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/components/ConfirmSheet.tsx
git commit -m "feat(master): ConfirmSheet — переиспользуемый bottom-sheet подтверждения"
```

---

### Task 3: `ActiveOrderViewMobile` — карта на весь экран + bottom-sheet + форма цены

**Files:**
- Create: `apps/master/components/ActiveOrderViewMobile.tsx`

**Interfaces:**
- Consumes: `ActiveOrder` (Task 1), `ConfirmSheet` (Task 2), `MapView` (`mode`, `center`, `masterPosition`, `height`, `className` — см. `apps/master/components/MapView.tsx`, без изменений), `useMasterPresence()` → `myPosition` (`apps/master/lib/masterPresence.tsx`, без изменений), `cancelOrder`/`completeOrder`/`proposePrice`/`setOnSite`/`setOnWay` из `apps/master/lib/activeOrder.ts` (без изменений).
- Produces: `ActiveOrderViewMobile` — компонент `{ order: ActiveOrder; onChanged: () => void }`, используется Task 4.

- [ ] **Step 1: Написать компонент**

```tsx
'use client';
import { useState } from 'react';
import MapView from './MapView';
import { ConfirmSheet } from './ConfirmSheet';
import { useMasterPresence } from '@/lib/masterPresence';
import {
  cancelOrder,
  completeOrder,
  proposePrice,
  setOnSite,
  setOnWay,
  type ActiveOrder,
} from '@/lib/activeOrder';

const FALLBACK_CENTER = { lat: 43.2389, lng: 76.8897 };

const DURATION_CHIPS = [
  { key: 'short', label: '~1 час' },
  { key: 'medium', label: '2–3 часа' },
  { key: 'long', label: 'полдня' },
] as const;

type DurationKey = (typeof DURATION_CHIPS)[number]['key'];

type ConfirmKind = 'onway' | 'onsite' | 'complete' | 'cancel' | null;

const CONFIRM_COPY: Record<Exclude<ConfirmKind, null>, { title: string; body: string; confirmLabel: string; danger?: boolean }> = {
  onway: {
    title: 'Едете к клиенту?',
    body: 'Клиент увидит, что вы выехали. Дальше — отметьте «На месте», когда доберётесь.',
    confirmLabel: 'Еду',
  },
  onsite: {
    title: 'Вы на месте?',
    body: 'Клиент получит уведомление, что вы на месте. Дальше — осмотр и отправка цены.',
    confirmLabel: 'Я на месте',
  },
  complete: {
    title: 'Работа выполнена?',
    body: 'Клиент получит запрос на подтверждение. Без ответа заявка закроется автоматически через 24 часа, оплата поступит в кошелёк после подтверждения или автозакрытия.',
    confirmLabel: 'Выполнено',
  },
  cancel: {
    title: 'Отменить заявку?',
    body: 'Спишется 2 кредита, приоритет в подборе снизится на 24 часа. После 3-й отмены за 30 дней аккаунт блокируется на 7 дней.',
    confirmLabel: 'Отменить заявку',
    danger: true,
  },
};

export function ActiveOrderViewMobile({ order, onChanged }: { order: ActiveOrder; onChanged: () => void }) {
  const { myPosition } = useMasterPresence();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [duration, setDuration] = useState<DurationKey | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const center = order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : FALLBACK_CENTER;
  const compensation = order.calloutPrice - order.serviceFee;

  async function run(action: () => Promise<void>) {
    setError('');
    setSubmitting(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      setConfirmKind(null);
    }
  }

  function confirmedAction(kind: Exclude<ConfirmKind, null>) {
    if (kind === 'onway') return () => run(() => setOnWay(order.id));
    if (kind === 'onsite') return () => run(() => setOnSite(order.id));
    if (kind === 'complete') return () => run(() => completeOrder(order.id));
    return () => run(() => cancelOrder(order.id));
  }

  function sendPrice() {
    const amount = Number(price);
    if (!amount) return;
    const durationLabel = duration ? DURATION_CHIPS.find((c) => c.key === duration)?.label : null;
    const fullComment = durationLabel ? `${comment}${comment ? '\n' : ''}Ориентировочно: ${durationLabel}.` : comment;
    run(() => proposePrice(order.id, amount, fullComment || undefined));
  }

  const addressLine = [order.entrance && `подъезд ${order.entrance}`, order.floor && `этаж ${order.floor}`, order.apartment && `кв. ${order.apartment}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex h-full flex-col md:hidden">
      <MapView mode="tracking" center={center} masterPosition={myPosition} height={undefined} className="flex-1 rounded-none" />
      <div className="max-h-[65vh] overflow-y-auto rounded-t-sheet bg-surface px-5 pb-4 pt-3.5 shadow-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9.5 rounded-full bg-border" />

        <h2 className="text-base font-extrabold text-ink">{order.category?.name}</h2>

        <div className="mt-2 rounded-lg border border-border p-3.5">
          <div className="text-sm font-extrabold text-ink">{order.address}</div>
          {addressLine && <div className="mt-0.5 text-xs font-semibold text-ink-soft">{addressLine}</div>}
          {order.addressComment && <div className="mt-0.5 text-xs text-ink-soft">{order.addressComment}</div>}
          <div className="my-2.5 border-t border-border" />
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
              {order.client?.name?.slice(0, 1).toUpperCase() ?? '—'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-ink">{order.client?.name}</div>
              <div className="text-xs text-ink-soft">клиент</div>
            </div>
            {order.client?.phone && (
              <a
                href={`tel:${order.client.phone}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base text-white"
              >
                📞
              </a>
            )}
          </div>
        </div>

        <div className="mt-2.5 rounded-lg bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
          {order.description}
          {order.photos.length > 0 && ` · ${order.photos.length} фото`}
          {order.status !== 'INSPECTION' && order.status !== 'AWAITING_PRICE_CONFIRM' && order.status !== 'IN_PROGRESS' && (
            <>
              {' · '}
              {order.freePilot ? 'бесплатный пилот' : (
                <>
                  Вам за выезд: <b>{compensation} ₸</b>
                </>
              )}
            </>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-3">
          {order.status === 'ACCEPTED' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('onway')}
            >
              Еду
            </button>
          )}
          {order.status === 'MASTER_ON_WAY' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('onsite')}
            >
              На месте
            </button>
          )}
          {order.status === 'INSPECTION' && (
            <div className="space-y-3 rounded-lg border-2 border-primary p-4">
              <div>
                <div className="mb-1 text-[11px] font-bold text-ink-soft">Работы</div>
                <input
                  type="number"
                  min="1"
                  placeholder="Стоимость работ, ₸"
                  className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-[13.5px] font-extrabold text-ink">
                  Что входит <span className="text-[11.5px] font-semibold text-ink-soft">(увидит клиент)</span>
                </div>
                <textarea
                  placeholder="Замена сифона и прокладки, детали есть с собой"
                  className="w-full resize-none rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[13.5px] font-extrabold text-ink">Длительность</div>
                <div className="flex gap-1.5">
                  {DURATION_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setDuration(duration === c.key ? null : c.key)}
                      className={`rounded-pill px-3.5 py-1.5 text-xs font-extrabold ${
                        duration === c.key ? 'bg-primary text-white' : 'border-[1.5px] border-border text-ink-soft'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {Number(price) > 0 && (
                <div className="rounded-lg bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
                  {order.freePilot
                    ? 'Бесплатный пилот — сумма согласовывается с клиентом напрямую.'
                    : (
                      <>
                        Клиент увидит: выезд {order.calloutPrice} ₸ + работы {Number(price)} ₸ = <b>{order.calloutPrice + Number(price)} ₸</b>. На решение у клиента 15 минут.
                      </>
                    )}
                </div>
              )}
              <button
                disabled={submitting || !Number(price)}
                className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
                onClick={sendPrice}
              >
                Отправить клиенту
              </button>
            </div>
          )}
          {order.status === 'AWAITING_PRICE_CONFIRM' && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm font-semibold text-ink-soft">
              Клиент рассматривает цену…
            </p>
          )}
          {order.status === 'IN_PROGRESS' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('complete')}
            >
              Выполнено
            </button>
          )}
          {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
            <button
              disabled={submitting}
              className="mt-2 w-full rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger disabled:opacity-40"
              onClick={() => setConfirmKind('cancel')}
            >
              Отменить
            </button>
          )}
        </div>
      </div>

      {confirmKind && (
        <ConfirmSheet
          open
          busy={submitting}
          title={CONFIRM_COPY[confirmKind].title}
          body={CONFIRM_COPY[confirmKind].body}
          confirmLabel={CONFIRM_COPY[confirmKind].confirmLabel}
          danger={CONFIRM_COPY[confirmKind].danger}
          onConfirm={confirmedAction(confirmKind)}
          onClose={() => setConfirmKind(null)}
        />
      )}
    </div>
  );
}
```

Примечания к реализации:
- `compensation`/breakdown используют `order.calloutPrice`/`order.serviceFee` напрямую (не `nominalCalloutPrice`/`nominalServiceFee`) — при `freePilot` бэкенд уже зануляет `calloutPrice`/`serviceFee` в ответе (`presentValue()`), поэтому ветка `order.freePilot` полностью подменяет текст, вычисленное значение `compensation` в этой ветке не используется.
- `md:hidden` на корневом `<div>` — это парный компонент, десктоп продолжает получать чистый `ActiveOrderView` (Task 4).
- Никаких новых API-вызовов — `setOnWay`/`setOnSite`/`completeOrder`/`cancelOrder`/`proposePrice` те же функции, что использует десктоп.

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/components/ActiveOrderViewMobile.tsx
git commit -m "feat(master): мобильный ActiveOrderView — карта на весь экран + bottom-sheet + форма цены"
```

---

### Task 4: Спарить `ActiveOrderView` с мобильным вариантом

**Files:**
- Modify: `apps/master/components/ActiveOrderView.tsx`

**Interfaces:**
- Consumes: `ActiveOrderViewMobile` (Task 3).

- [ ] **Step 1: Обернуть десктопный JSX и добавить мобильный рядом**

Замени тело функции `ActiveOrderView` (весь `return (...)` блок с корневым `<div className="flex h-full">`) на:

```tsx
import { ActiveOrderViewMobile } from './ActiveOrderViewMobile';

// ...внутри компонента, после всех существующих хуков/handler'ов (run, price, comment, error, submitting, center, myPosition) — без изменений:

return (
  <>
    <div className="hidden h-full md:flex">
      <MapView mode="tracking" center={center} masterPosition={myPosition} height={undefined} className="flex-1 rounded-none" />
      <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto border-l border-border bg-surface p-6">
        <h2 className="text-lg font-extrabold text-ink">{order.category?.name}</h2>
        <div className="space-y-1 rounded-lg border border-border p-4">
          <div className="text-sm text-ink">{order.address}</div>
          <div className="text-sm text-ink-soft">{order.description}</div>
          {order.client?.phone && (
            <a href={`tel:${order.client.phone}`} className="text-sm font-bold text-primary underline">
              {order.client.phone}
            </a>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}

        {order.status === 'ACCEPTED' && (
          <button disabled={submitting} className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40" onClick={() => run(() => setOnWay(order.id))}>Еду</button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <button disabled={submitting} className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40" onClick={() => run(() => setOnSite(order.id))}>На месте</button>
        )}
        {order.status === 'INSPECTION' && (
          <div className="space-y-2">
            <input type="number" min="1" placeholder="Стоимость работ, ₸" className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input placeholder="Комментарий (необязательно)" className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button disabled={submitting || !Number(price)} className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40" onClick={() => run(() => proposePrice(order.id, Number(price), comment))}>Отправить цену</button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <p className="text-center text-sm text-ink-soft">Ожидание подтверждения цены клиентом…</p>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button disabled={submitting} className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40" onClick={() => run(() => completeOrder(order.id))}>Выполнено</button>
        )}
        {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
          <button disabled={submitting} className="w-full rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger disabled:opacity-40" onClick={() => run(() => cancelOrder(order.id), 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}>Отменить</button>
        )}
      </div>
    </div>
    <ActiveOrderViewMobile order={order} onChanged={onChanged} />
  </>
);
```

Ключевое: десктопный JSX **байт-в-байт идентичен** прежнему содержимому (только обёрнут `hidden md:flex` вместо `flex h-full` на корневом `<div>`), логика/хендлеры (`run`, `price`, `comment`, `error`, `submitting`, `center`, `myPosition`) не трогаются. `ActiveOrderViewMobile` получает те же `order`/`onChanged`, что пришли в `ActiveOrderView`, и сам управляет своим состоянием независимо (Task 3) — оба компонента смонтированы всегда, десктопный/мобильный `run()` не пересекаются.

- [ ] **Step 2: Проверить типы и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/components/ActiveOrderView.tsx
git commit -m "feat(master): спарить ActiveOrderView с мобильным вариантом по брейкпоинту"
```

---

### Task 5: Мобильные отступы `/become-master`

**Files:**
- Modify: `apps/master/app/(app)/become-master/page.tsx`

Форма уже `mx-auto max-w-[560px]` — центрирована и функционально корректна на любом вьюпорте, но нигде не имеет `md:`-брейкпоинтов: `p-8` (32px) на 390px-экране оставляет только 326px полезной ширины, что ощутимо у́же, чем принятый в проекте мобильный паттерн отступов (`px-5` = 20px, см. `apps/web/src/features/client-v2/components/order-views/TrackView.tsx:42`). Логика формы (`load`, `submit`, `upload`, состояние) не меняется — только классы контейнеров.

- [ ] **Step 1: Сузить отступы на мобильном**

В `apps/master/app/(app)/become-master/page.tsx` замени:

```tsx
    <div className="mx-auto max-w-[560px] space-y-4 p-8">
```

на:

```tsx
    <div className="mx-auto max-w-[560px] space-y-4 p-4 md:p-8">
```

И в трёх местах, где карточки используют `p-4`/`p-5` внутри (строки со `space-y-2 rounded-lg border border-border bg-surface p-4`, `space-y-3 rounded-lg border border-border bg-surface p-5` ×2), сократи горизонтальный отступ на мобильном, сохранив вертикальный — замени каждое такое `p-4`/`p-5` на `p-4 md:p-4`/`px-4 py-5 md:p-5` не нужно (эффект минимален при уже суженном внешнем контейнере); **фактически меняется только внешний контейнер** — внутренние карточки трогать не нужно, 16px внутренних отступов при 358px полезной ширины (390 − 2×16 внешних) не требуют дополнительного сужения.

- [ ] **Step 2: Проверить типы и билд**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add "apps/master/app/(app)/become-master/page.tsx"
git commit -m "fix(master): мобильные отступы анкеты мастера"
```

---

### Task 6: Живая проверка — оба вьюпорта, сквозной сценарий через сокет

**Files:** нет (только проверка), опционально: `scratch/phase-b-live-*.mjs` во временной scratchpad-директории для сокет-скрипта — не коммитится.

- [ ] **Step 1: `become-master` на 390px и десктопе**

`preview_resize` → 390×844, открыть `/become-master`, `preview_snapshot` — форма читаема, инпуты не переполняют экран, кнопки внутри `max-w-[560px]` контейнера полной ширины. `preview_resize` → 1280×800 — форма визуально не изменилась (отступы `md:p-8` вернулись).

- [ ] **Step 2: Активный заказ — оба вьюпорта, статичный снимок**

Через `docker exec -i` (см. project gotcha — heredoc без `-i` тихо проглатывается) создать/использовать тестовый заказ мастера в статусе `ACCEPTED` (по образцу Фазы A e2e-подготовки: см. `apps/api/test/masters-stats.e2e-spec.ts` для паттерна прямых SQL-вставок с `gen_random_uuid()::text`). Открыть `/` мастера на 390×844 — `preview_snapshot` подтверждает: карта сверху, bottom-sheet снизу с адресом/клиентом/кнопкой «Еду». На 1280×800 — прежний десктопный layout (карта + сайдбар 380px) не изменился.

- [ ] **Step 3: Bottom-sheet подтверждения на мобильном**

`preview_eval` → клик по кнопке «Еду» (прямой `.click()` вместо `preview_click`, см. project gotcha) — открывается `ConfirmSheet` с текстом про клиента, не `window.confirm()`. Клик «Не отменять»-аналог (кнопка `cancelLabel`) закрывает шторку без вызова API (`preview_network` — не появилось нового запроса к `/on-way`). Повторный клик «Еду» → подтвердить → `preview_network` показывает `POST .../on-way`, `preview_snapshot` — статус сменился на «На месте»-кнопку.

- [ ] **Step 4: Danger-sheet отмены**

С заказом в `ACCEPTED`/`MASTER_ON_WAY` — клик «Отменить» на мобильном открывает `ConfirmSheet` с `danger` (красная кнопка подтверждения), текст содержит «2 кредита» и «24 часа» и «3-й отмены». Не подтверждать (закрыть) — заказ остаётся активным.

- [ ] **Step 5: Форма цены — сквозной сценарий через сокет**

По образцу Фазы A (`docs/superpowers/plans/2026-08-19-master-flow-mobile-phase-a.md`, Task 8): два браузера/контекста — клиент создаёт заказ, мастер принимает через реальный сокет (`socket.io-client`, `run_in_background: true`, не shell `&` — см. project gotcha), доводит до `INSPECTION`. На 390px — заполнить цену, «Что входит», выбрать чип «2–3 часа», проверить, что появляется пилюля «Клиент увидит: выезд {X} ₸ + работы {Y} ₸ = {X+Y} ₸», отправить. `preview_network` — тело запроса `POST .../propose-price` содержит `comment`, оканчивающийся на `Ориентировочно: 2–3 часа.`. На десктопе (1280px, тот же заказ до отправки, если сценарий позволяет параллельно проверить) — старая форма (два простых инпута) не изменилась.

- [ ] **Step 6: Зафиксировать результат**

Если все пункты подтверждены — задача считается пройденной без отдельного коммита (проверочная, не код-задача). Любое расхождение — завести находку и вернуться в Task 3/4/5 по месту.

---

## Self-Review (проведено при написании плана)

- **Покрытие спеки:** анкета без визарда (Task 5), мобильный `ActiveOrderView` с картой на весь экран + bottom-sheet (Task 3–4), per-status confirm-sheets вместо `window.confirm()` (Task 2–3), danger-sheet с текстом −2 кредита/приоритет/блокировка (Task 3, копия сверена с `apps/api/src/common/master-penalty.service.ts`), форма цены с «что входит» + чипами длительности, тот же API-вызов (Task 3) — все пункты Фазы B из спеки покрыты. Фото — явно из скоупа исключены (Global Constraints), это осознанное решение, не пробел.
- **Плейсхолдеры:** не найдены — весь код в задачах полный, без `TODO`/«добавить обработку».
- **Согласованность типов:** `ActiveOrder` (Task 1) → используется в `ActiveOrderViewMobile` (Task 3) и остаётся неизменным для `ActiveOrderView` (Task 4, десктопная часть не читает новые поля, но принимает тот же объект). `ConfirmSheet` пропсы (Task 2) совпадают с использованием в Task 3 (`open`, `title`, `body`, `confirmLabel`, `danger`, `busy`, `onConfirm`, `onClose`).
