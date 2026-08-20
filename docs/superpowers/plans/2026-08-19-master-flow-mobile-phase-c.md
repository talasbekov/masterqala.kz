# Мобильный ретрофит `apps/master`, Фаза C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильная вёрстка плановой ленты, формы ставки (с гейтом по lead-кредитам) и страницы `/lead-credits` — три экрана прототипа «Плановая лента», «Форма ставки», «Lead-кредиты».

**Architecture:** В отличие от Фазы B (карта + bottom-sheet — структурно разные раскладки), эти три экрана — просто списки карточек и формы без карты/сайдбара. Раскладки мобильная/десктопная **блочно похожи** (один столбец, `max-w-*` центрирование уже есть на десктопе) — используется **CSS-парность внутри одних и тех же компонентов** (mobile-first классы, которые остаются приемлемыми и на десктопе), а не форк на пару компонентов, как делалось для `ActiveOrderView`/`OfferOverlay`. Единственное структурное дополнение — доступ к плановой ленте с мобильного таб-бара: сейчас это недоступная заглушка (см. `apps/master/components/BottomTabBar.tsx:20-24`, комментарий явно указывает на эту фазу). Плановая лента остаётся внутри роута `/` (переключатель вкладок, как на десктопе) — отдельного роута `/planned` не заводится, чтобы не дублировать `PlannedFeedView`; таб-бар ссылается на `/?tab=planned`, страница читает этот параметр при монтировании (client-only, через `window.location.search` в `useEffect` — не `useSearchParams()`, чтобы не тащить Suspense-обвязку ради одного параметра и не расходиться с уже принятым в проекте паттерном «клиентский `useEffect`, не SSR-чтение», см. Global Constraints).

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (токены в `packages/ui/src/tokens.css`), существующие `lib/plannedFeed.ts`, `lib/commercial-mode.tsx`, `lib/api.ts`.

## Global Constraints

- Брейкпоинт `md` = 768px. Для этой фазы это не обязательно к применению внутри самих карточек/форм (раскладки не форкаются), но остаётся в силе там, где уже используется (`BottomTabBar` сам целиком `md:hidden`, `page.tsx`'s мобильный presence-блок — `md:hidden`).
- **Не** JS `useMediaQuery`/`matchMedia` для переключения видимости раскладок — не актуально в этой фазе (нет форкнутых пар компонентов), но `window.location.search`-чтение для таба обязано быть client-only (`useEffect`, не `useState`-инициализатор) — та же причина: SSR не видит `window`, а `useState(() => window...)` выполнился бы и на сервере, дав гидратационный мисматч.
- Бэкенд (`apps/api`) не меняется. Все нужные поля для ленты уже отдаются `GET planned-orders/feed` (`FEED_SELECT`, `apps/api/src/planned-orders/planned-order.constants.ts:26-37`) — включая `budget`, которого сейчас нет во фронтенд-интерфейсе `PlannedFeedItem`. Адрес (`PlannedOrder.address`) уже осознанно исключён из `FEED_SELECT` — «без адреса до выбора» уже реализовано на бэкенде, ничего добавлять не нужно.
- **Явно вне скоупа: история операций lead-кредитов** (`SPEND`/`REFUND`/`PENALTY`/`PURCHASE`). Спека этой фазы и прототип (`scr.credits` в `apps/MasterQala/design_handoff_masterqala/Этап 5 - Мастер (mobile).dc.html`) показывают историю операций на странице `/lead-credits`, но при инвентаризации кода выяснилось: **такой истории нет нигде** — ни бэкенд-эндпоинта, отдающего `LeadCreditTransaction`, ни фронтенд-компонента на десктопе. Это не ретрофит существующего, а новая фича (новый эндпоинт + новый UI-паттерн), что нарушает установленный по всему мобильному треку принцип «бэкенд не меняется». Решение (тот же прецедент, что фото на карточке заказа в Фазе B): не строить историю сейчас, `/lead-credits` получает только баланс + пакеты покупки в мобильной вёрстке.
- **Явно вне скоупа: количество фото на карточке ленты.** Прототип показывает «· 1 фото» в описании карточки; `FEED_SELECT` не включает `_count.photos` (только `_count.bids`). Добавление — тривиальный один-строчный бэкенд-селект, но по тому же принципу «бэкенд не меняется» в этой фазе — не делается.
- `PLANNED_MAX_BIDS = 5` (`apps/api/src/planned-orders/planned-order.constants.ts:4`) — источник цифры «5» в бейдже «N/5 ставок» и порога для UI-состояния «Лимит откликов достигнут».
- Тестирование — без фреймворка фронтенд-тестов (осознанный выбор всего проекта). Проверка: `tsc --noEmit` + `pnpm --filter master build`, затем живая браузерная проверка на 390px и десктопе.

---

### Task 1: Расширить `PlannedFeedItem` под поле `budget`

**Files:**
- Modify: `apps/master/lib/plannedFeed.ts`

**Interfaces:**
- Produces: `PlannedFeedItem.budget: number | null` — читается из уже существующего backend-поля (`FEED_SELECT.budget`, бэкенд не меняется).

- [ ] **Step 1: Добавить поле в интерфейс**

Замени интерфейс `PlannedFeedItem` (сейчас — блок без `budget`) на:

```ts
export interface PlannedFeedItem {
  id: string;
  commercialMode: CommercialMode;
  category: { name: string } | null;
  district: string;
  description: string;
  budget: number | null;
  slotStart: string;
  slotEnd: string;
  _count: { bids: number };
}
```

`PlannedOrderDetail extends PlannedFeedItem { budget: number | null }` строкой ниже — раз `budget` теперь есть в базовом интерфейсе, поле-дублёр в `PlannedOrderDetail` становится избыточным. Убери его — `PlannedOrderDetail` должен остаться:

```ts
export interface PlannedOrderDetail extends PlannedFeedItem {}
```

Пустой `extends`-интерфейс без добавленных полей вызывает ESLint-предупреждение `@typescript-eslint/no-empty-object-type` в некоторых конфигурациях — если сборка (Step 2) покажет такую ошибку, замени на псевдоним типа: `export type PlannedOrderDetail = PlannedFeedItem;`.

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/lib/plannedFeed.ts
git commit -m "feat(master): добавить budget в PlannedFeedItem"
```

---

### Task 2: Мобильная вёрстка `PlannedFeedView` + гейт по lead-кредитам в форме ставки

**Files:**
- Modify: `apps/master/components/PlannedFeedView.tsx`

**Interfaces:**
- Consumes: `PlannedFeedItem`/`PlannedOrderDetail` (Task 1), `fetchPlannedFeed`/`fetchPlannedOrder`/`submitBid` (без изменений, `apps/master/lib/plannedFeed.ts`), `useCommercialMode()` (без изменений, `apps/master/lib/commercial-mode.tsx`), `api` (без изменений, `apps/master/lib/api.ts`, для нового вызова `GET /lead-credits/balance` — тот же эндпоинт, что уже использует `apps/master/app/(app)/lead-credits/page.tsx:20`).

Полностью замени содержимое файла:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';
import {
  fetchPlannedFeed,
  fetchPlannedOrder,
  submitBid,
  type PlannedFeedItem,
  type PlannedOrderDetail,
} from '@/lib/plannedFeed';

const MAX_BIDS = 5;

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  const startTime = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime}–${endTime}`;
}

export function PlannedFeedView() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [feed, setFeed] = useState<PlannedFeedItem[]>([]);
  const [selected, setSelected] = useState<PlannedOrderDetail | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    fetchPlannedFeed()
      .then(setFeed)
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = () => load();
    socket.on('bid:closed', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:closed', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [load]);

  async function open(item: PlannedFeedItem) {
    if (item._count.bids >= MAX_BIDS) return;
    setError('');
    setBalance(null);
    try {
      const detail = await fetchPlannedOrder(item.id);
      setSelected(detail);
      if (detail.commercialMode !== 'FREE_PILOT' && leadCreditsEnabled) {
        api('/lead-credits/balance')
          .then((r) => setBalance(r.balance))
          .catch(() => setBalance(null));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!selected || !Number(bidPrice) || !bidTerm) return;
    setError('');
    setSubmitting(true);
    try {
      await submitBid(selected.id, { price: Number(bidPrice), term: bidTerm, comment: bidComment });
      setSelected(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasFreeOrders = feed.some((item) => item.commercialMode === 'FREE_PILOT');
  const hasPaidOrders = feed.some((item) => item.commercialMode !== 'FREE_PILOT');

  if (selected) {
    const free = selected.commercialMode === 'FREE_PILOT';
    const creditsGated = !free && leadCreditsEnabled;
    const creditsLow = creditsGated && balance !== null && balance < 1;
    const creditsKnown = !creditsGated || balance !== null;

    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-4 md:p-8">
        <button className="text-sm font-bold text-primary" onClick={() => setSelected(null)}>
          ← Назад к ленте
        </button>
        <div className="rounded-lg bg-fill-soft p-3 text-sm font-semibold text-ink">
          {selected.category?.name} · {selected.district} · {formatSlot(selected.slotStart, selected.slotEnd)}
          {' · без точного адреса до выбора'}
        </div>
        <div className="text-sm text-ink">{selected.description}</div>
        {selected.budget != null && (
          <div className="text-sm text-ink-soft">Бюджет клиента: ~{selected.budget} ₸</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border-[1.5px] border-primary p-3">
            <div className="text-[11px] font-bold text-ink-soft">Цена, ₸</div>
            <input
              type="number"
              min="1"
              placeholder="0"
              className="w-full bg-transparent text-base font-extrabold text-ink outline-none"
              value={bidPrice}
              onChange={(e) => setBidPrice(e.target.value)}
            />
          </div>
          <div className="rounded-lg border-[1.5px] border-border p-3">
            <div className="text-[11px] font-bold text-ink-soft">Срок</div>
            <input
              placeholder="напр. сегодня до 18:00"
              className="w-full bg-transparent text-base font-extrabold text-ink outline-none placeholder:text-xs placeholder:font-semibold placeholder:text-muted"
              value={bidTerm}
              onChange={(e) => setBidTerm(e.target.value)}
            />
          </div>
        </div>

        <textarea
          placeholder="Комментарий для клиента (необязательно)"
          rows={3}
          className="w-full resize-none rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidComment}
          onChange={(e) => setBidComment(e.target.value)}
        />

        {creditsGated && creditsKnown && !creditsLow && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-bold text-ink">
            <span>Спишется: 1 ⬡</span>
            <span className="text-ink-soft">останется: {(balance ?? 1) - 1}</span>
          </div>
        )}
        {creditsGated && creditsLow && (
          <>
            <div className="rounded-lg bg-danger-bg p-3 text-sm font-semibold leading-relaxed text-danger">
              Недостаточно кредитов (баланс: {balance}). Купите пакет — вернём вас в эту форму.
            </div>
            <Link
              href="/lead-credits"
              className="block w-full rounded-pill bg-primary p-3.5 text-center text-sm font-extrabold text-white"
            >
              Купить кредиты
            </Link>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {!creditsLow && (
          <button
            className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
            disabled={submitting || !Number(bidPrice) || !bidTerm || (creditsGated && !creditsKnown)}
            onClick={submit}
          >
            {free ? 'Откликнуться бесплатно' : 'Откликнуться · −1 ⬡'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-3 p-4 md:p-8">
      {(leadCreditsEnabled || hasPaidOrders) && (
        <Link href="/lead-credits" className="block text-center text-sm font-bold text-primary underline">
          Баланс кредитов — нужен для платных заявок
        </Link>
      )}
      {(!leadCreditsEnabled || hasFreeOrders) && (
        <div className="rounded-md bg-fill-soft p-3 text-center text-sm font-semibold text-ink">
          Заявки с отметкой «Бесплатно» не расходуют lead-кредиты.
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {feed.length === 0 && <p className="text-center text-sm text-ink-soft">Пока нет заявок в ваших категориях</p>}
      {feed.map((item) => {
        const free = item.commercialMode === 'FREE_PILOT';
        const full = item._count.bids >= MAX_BIDS;
        return (
          <button
            key={item.id}
            disabled={full}
            onClick={() => open(item)}
            className={`block w-full rounded-lg border border-border bg-surface p-4 text-left ${full ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-ink">{item.category?.name}</span>
              <span
                className={`rounded-pill px-2 py-0.5 text-xs font-extrabold ${
                  full ? 'bg-danger-bg text-danger' : 'bg-fill-soft text-primary'
                }`}
              >
                {item._count.bids}/{MAX_BIDS} ставок
              </span>
            </div>
            <div className="mt-1 text-sm text-ink-soft">{item.district}</div>
            <div className="text-sm text-ink-soft">{formatSlot(item.slotStart, item.slotEnd)}</div>
            {item.budget != null && <div className="text-xs text-ink-soft">бюджет ~{item.budget} ₸</div>}
            {full ? (
              <div className="mt-2 text-xs font-semibold text-ink-soft">Лимит откликов достигнут</div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-pill px-2 py-0.5 text-[11px] font-extrabold ${
                    free ? 'bg-fill-soft text-primary' : 'bg-warning-bg text-warning-ink'
                  }`}
                >
                  {free ? 'Бесплатно' : 'отклик: 1 ⬡'}
                </span>
              </div>
            )}
          </button>
        );
      })}
      {feed.length > 0 && (
        <div className="rounded-md bg-fill-soft p-3 text-xs font-semibold leading-relaxed text-ink">
          Проиграли отклик? Кредит не возвращается. Клиент отменил после выбора вас — кредит вернётся автоматически.
        </div>
      )}
    </div>
  );
}
```

Примечания к реализации:
- `bg-warning-bg`/`text-warning-ink` — оба токена подтверждены в `packages/ui/src/tokens.css` (`--color-warning-bg`, `--color-warning-ink`). Не `text-warning` (такого токена нет — только `-ink`-вариант, в отличие от `danger`, где есть и `--color-danger`, и `--color-danger-bg`).
- Гейт по кредитам **проактивный**: баланс запрашивается сразу при открытии карточки (`open()`), а не после неудачной попытки отправки — кнопка «Купить кредиты» показывается ДО того, как мастер потратит время на заполнение формы, если кредитов уже 0. Это соответствует прототипу (`creditsLow`/`creditsOk` — заранее известные ветки, не реакция на ошибку).
- Серверная проверка (`Недостаточно lead-кредитов`, `apps/api/src/planned-orders/planned-orders.service.ts:234`) остаётся последней линией защиты (гонка: баланс мог измениться между открытием карточки и отправкой) — `catch` в `submit()` покажет `error` как обычный текст, кнопка не скрывается заново клиентским стейтом задним числом (не критично: пользователь просто увидит текст ошибки и должен будет вручную перейти в `/lead-credits`, что уже возможно через баннер выше формы или через явную ссылку в ленте).
- `item._count.bids >= MAX_BIDS` блокирует `open()` целиком (карточка `disabled`) — соответствует прототипу, где переполненная заявка визуально приглушена (`opacity-60`) и не имеет кнопки «Предложить цену».

- [ ] **Step 1: Записать файл и проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 2: Собрать**

Run: `pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/components/PlannedFeedView.tsx
git commit -m "feat(master): мобильная лента + гейт по lead-кредитам в форме ставки"
```

---

### Task 3: Доступ к плановой ленте с мобильного таб-бара

**Files:**
- Modify: `apps/master/components/BottomTabBar.tsx`
- Modify: `apps/master/app/(app)/page.tsx`

**Interfaces:**
- Consumes: ничего нового — существующий `Tab` union (`'urgent' | 'planned'`) и `setTab` в `page.tsx`.

- [ ] **Step 1: Заменить заглушку в `BottomTabBar.tsx`**

Замени блок (строки 20-24, disabled-кнопка «Плановые» с комментарием про Фазу C):

```tsx
      {/* Роут /planned появится в Фазе C — пока некликабельная заглушка, не мёртвая ссылка */}
      <button type="button" disabled className={`${tabClass(false)} opacity-40 cursor-default`} aria-label="Плановые — скоро">
        <span className="text-lg leading-5">📅</span>
        Плановые
      </button>
```

на:

```tsx
      <Link href="/?tab=planned" className={tabClass(false)}>
        <span className="text-lg leading-5">📅</span>
        Плановые
      </Link>
```

`tabClass(false)` (не `active`-подсветка) — таб-бар не знает текущего значения `tab` внутри `page.tsx` (оно живёт в другом компоненте дерева, не в URL постоянно), поэтому «Плановые» не подсвечивается как активный пункт даже когда лента открыта. Это осознанное упрощение: `Работа` (`href="/"`) тоже не отличает «плановые открыты» от «плановые закрыты» — оба ведут на один и тот же роут `/`, различие только в клиентском стейте `tab`, который таб-бар не читает. Не делай точнее — усложнение (поднимать `tab` в контекст, читаемый и `page.tsx`, и `BottomTabBar.tsx`, живущими в разных файлах дерева) не оправдано ради подсветки одной кнопки.

- [ ] **Step 2: Прочитать `?tab=planned` при монтировании `page.tsx`**

В `apps/master/app/(app)/page.tsx` добавь `useEffect` сразу после существующего блока с `useState`-объявлениями (после строки `const [stats, setStats] = useState<MasterStats | null>(null);`, до первого `useEffect`):

```tsx
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'planned') {
      setTab('planned');
    }
  }, []);
```

Это клиентский `useEffect`, не `useState`-инициализатор — `window` недоступен при серверном рендере, а `useState(() => window...)` выполнился бы и там, дав гидратационный мисматч (тот же класс проблемы, что уже задокументирован в спеке мобильного трека). `typeof window !== 'undefined'`-проверка избыточна внутри `useEffect` (он и так выполняется только на клиенте), но оставлена для единообразия с остальным чтением `window`/`localStorage` в проекте (см. `apps/master/lib/api.ts:13`, `authHeaders()`).

- [ ] **Step 3: Проверить типы и собрать**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add apps/master/components/BottomTabBar.tsx "apps/master/app/(app)/page.tsx"
git commit -m "feat(master): доступ к плановой ленте с мобильного таб-бара"
```

---

### Task 4: Мобильная вёрстка `/lead-credits`

**Files:**
- Modify: `apps/master/app/(app)/lead-credits/page.tsx`

Логика (`load`, `purchase`, состояние баланса/пакетов) не меняется — только отступы и текст подписи под балансом, приближающий вёрстку к прототипу (`apps/MasterQala/design_handoff_masterqala/Этап 5 - Мастер (mobile).dc.html`, экран `scr.credits`: «кредиты — не деньги: тратятся только на отклики»).

- [ ] **Step 1: Сузить внешние отступы**

В обоих `return`-блоках (`!leadCreditsEnabled` и основной) замени `p-8` на `p-4 md:p-8`:

```tsx
      <div className="mx-auto max-w-[480px] space-y-4 p-4 md:p-8">
```

(это меняет обе строки — `apps/master/app/(app)/lead-credits/page.tsx:47` и `:60` — оба сейчас читаются как `className="mx-auto max-w-[480px] space-y-4 p-8"`.)

- [ ] **Step 2: Добавить подпись под балансом**

Замени блок баланса (строки 62-65):

```tsx
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance}</div>
        <div className="text-sm text-ink-soft">кредитов на балансе</div>
      </div>
```

на:

```tsx
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">⬡ {balance}</div>
        <div className="text-sm text-ink-soft">кредитов на балансе</div>
        <div className="mt-1 text-xs text-ink-soft">кредиты — не деньги: тратятся только на отклики</div>
      </div>
```

- [ ] **Step 3: Проверить типы и собрать**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add "apps/master/app/(app)/lead-credits/page.tsx"
git commit -m "fix(master): мобильная вёрстка /lead-credits"
```

---

### Task 5: Живая проверка — оба вьюпорта, реальный отклик на плановую заявку

**Files:** нет (только проверка).

- [ ] **Step 1: Доступ к ленте с мобильного таб-бара**

`preview_resize` → 390×844, залогиниться мастером с активной анкетой и хотя бы одной категорией. Кликнуть «Плановые» в нижнем таб-баре (`preview_eval` с прямым `.click()` на ссылке, отфильтрованной по `href` — не по видимому тексту, чтобы не перепутать со скрытой десктопной версией, см. project gotcha из Фазы B про `hidden`/`md:hidden`-дубли в DOM). `preview_snapshot` — открылась лента (`tab === 'planned'`), URL стал `/?tab=planned`.

- [ ] **Step 2: Тестовые данные — плановая заявка с известным `budget`**

Через `docker exec -i` (проверенный в Фазе B контейнер `masterqala-relaxed-pg` или актуальный на момент выполнения — см. `apps/api/.env` в рабочем ворктри) вставить `PlannedOrder` в статусе `PUBLISHED` с `commercialMode='PAID_MOCK'`, `budget` не `NULL`, `categoryId`, совпадающим с категорией тестового мастера, и `slotStart`/`slotEnd` в будущем. Обновить `LeadCreditAccount` тестового мастера: один сценарий с `balance >= 1`, другой (отдельная заявка или сброс баланса) — с `balance = 0`.

- [ ] **Step 3: Проверить карточку ленты и бюджет**

`preview_snapshot` на 390px — карточка показывает категорию, район, дату/время (`formatSlot`), «бюджет ~N ₸», бейдж «0/5 ставок», бейдж «отклик: 1 ⬡» (для `PAID_MOCK`). На 1280px — тот же список читаем, не переполнен (тот же компонент, без брейкпоинт-форка).

- [ ] **Step 4: Форма ставки — гейт по кредитам**

С `balance >= 1`: открыть карточку, `preview_snapshot` — плашка «Спишется: 1 ⬡ · останется: {balance-1}» видна, кнопка «Откликнуться · −1 ⬡» активна после заполнения цены и срока. Заполнить (`preview_fill`, не ручной DOM-хак — см. project gotcha про React-controlled inputs из Фазы B) цену и срок, отправить, `preview_network` — `POST .../bids` вернул успех, `docker exec` — `PlannedOrderBid` создан, `LeadCreditTransaction` с `type='SPEND', amount=1` создан.

- [ ] **Step 5: Форма ставки — 0 кредитов**

С `balance = 0` (вторая заявка или после списания из Step 4, если баланс изначально был ровно 1): открыть карточку, `preview_snapshot` — красная плашка «Недостаточно кредитов (баланс: 0)…» видна вместо плашки списания, кнопка «Купить кредиты» ведёт на `/lead-credits`, обычная кнопка «Откликнуться» не отрендерена.

- [ ] **Step 6: Лимит откликов**

Обновить `_count.bids` тестовой заявки до 5 (создать 5 `PlannedOrderBid` от разных мастеров через `docker exec`, либо один мастер + 4 фиктивных). `preview_snapshot` — карточка в ленте показывает бейдж «5/5 ставок» с danger-стилем, текст «Лимит откликов достигнут», приглушена (`opacity-60`), клик не открывает форму (`preview_network` — нет нового запроса `GET planned-orders/:id`).

- [ ] **Step 7: `/lead-credits` — оба вьюпорта**

`preview_resize` → 390×844 и 1280×800, открыть `/lead-credits` напрямую. На обоих — баланс с «⬡» и подписью «кредиты — не деньги…», список пакетов кликабелен, покупка одного пакета (`preview_eval`/`preview_network`) увеличивает баланс на клиенте (ответ `purchase` возвращает новый `balance`).

- [ ] **Step 8: Зафиксировать результат**

Проверочная задача, без отдельного коммита. Расхождения — находка, возврат в Task 2/3/4 по месту.

---

## Self-Review (проведено при написании плана)

- **Покрытие спеки:** мобильные карточки ленты без адреса до выбора, N/5 ставок, «отклик: 1 ⬡» (Task 2); плашка «спишется 1 ⬡ · останется N» и красная плашка + переход к покупке при 0 кредитов, тот же `commercialMode`-гейт, что на десктопе (Task 2); мобильная вёрстка `/lead-credits` (баланс, пакеты), логика не меняется (Task 4) — всё покрыто. История SPEND/REFUND/PENALTY/PURCHASE и счётчик фото на карточке — явно исключены (Global Constraints), с обоснованием, не пробел.
- **Плейсхолдеры:** не найдены.
- **Согласованность типов:** `PlannedFeedItem`/`PlannedOrderDetail` (Task 1) используются без изменений в Task 2 (`selected.budget`, `item.budget`, `item._count.bids`). Доступ к ленте (Task 3) не меняет типы, только маршрутизацию/чтение URL.
