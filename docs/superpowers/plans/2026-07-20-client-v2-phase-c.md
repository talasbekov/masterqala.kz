# Клиент v2 — Фаза C: плановый режим

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: superpowers:subagent-driven-development.

**Цель:** визард плановой заявки (`/planned/new`, 3 шага), статус-driven детальная страница (`/planned/:id`, список ставок/сравнение/ожидание/активна/завершена), `/planned/:id/compare`, `/planned/:id/dispute` — строго по прототипу (строки 424-621, 691-729 `Этап 5 - Клиент (mobile).dc.html`).

**Архитектура:** новые файлы в `apps/web/src/features/client-v2/`. Полностью заменяет `apps/web/src/pages/PlannedNewOrderPage.tsx` (который **сейчас физически сломан** — отправляет несуществующее поле `scheduledAt` вместо `slotStart`/`slotEnd`) и `apps/web/src/pages/PlannedOrderPage.tsx`. `DisputePage.tsx` (Фаза B) рефакторится на приём `kind`-пропа, не дублируется.

**Верификация:** нет фронтенд-тестов. Каждая задача — `pnpm --filter web build` + живая проверка контроллером после всех задач.

## Global Constraints

**API-контракты (сверены напрямую с кодом):**
- `POST /planned-orders` body `{categoryId, description, address, district, entrance?, floor?, apartment?, addressComment?, slotStart, slotEnd, budget?, photoPaths?}` → полная заявка. **`slotStart`/`slotEnd` обязательны, ISO8601** — старый фронтенд их не отправлял вообще, отправлял несуществующий `scheduledAt`.
- `GET /planned-orders/:id` → полная заявка + `dispute` + `confirmDeadline` (ISO или `null`, только при `status='MASTER_SELECTED'`) + `review:{rating,comment}|null` (только что добавлено в `PLANNED_ORDER_INCLUDE`, эта же сессия — до этого поле отсутствовало, тот же класс бага, что был в Фазе B для `Order`). Поля: `id, status, category:{id,name}, description, address, district, entrance, floor, apartment, addressComment, slotStart, slotEnd, budget, masterId, master:{id,name,phone,rating,reviewCount}|null, selectedBidId, selectedAt, workPrice, cancelReason, createdAt, bids:[{id,price,term,comment,createdAt,master:{id,name,experienceYears,completedCount,verified,rating,reviewCount}}]`.
- `POST /planned-orders/:id/bids` — мастерский эндпоинт, клиенту не нужен.
- `POST /planned-orders/:id/select` body `{bidId}` → полная заявка (редактированный `master.phone`, т.к. статус ещё не `CONFIRMED`).
- `POST /planned-orders/:id/cancel`, `/confirm-completion` — без тела, полная заявка. (`/confirm`, `/decline`, `/on-site`, `/complete` — мастерские, клиенту не нужны.)
- `POST /planned-orders/:id/review` body `{rating: 1..5, comment?}` (уже реализовано, Rating-фича этой же сессии).
- `POST /planned-orders/:id/disputes` body `{reason}` — идентично `/orders/:id/disputes` по форме, разный префикс пути.
- Редакция телефона: `master.phone` пустая строка до статусов `CONFIRMED`/`IN_PROGRESS`/`DONE`/`CLOSED` (`redactMasterContact()`, `planned-orders.service.ts`) — уже готово на бэке, фронтенд просто показывает то, что пришло (пустая строка → не рендерить кнопку звонка).
- Инвариант «✓ проверен» безусловен при наличии `order.master` — тот же принцип, что в Фазе B (только ACTIVE-мастера доходят до выбора).
- Лид-кредиты клиенту не показываются — не относится к Фазе C вообще.

**Переиспользуемое (не дублировать):**
- `apps/web/src/orderStatus.ts` — `PLANNED_STATUS_LABELS`, `plannedStatusVariant`, `isPlannedTerminalStatus`.
- `apps/web/src/features/client-v2/categoryMeta.ts` (Фаза A).
- `apps/web/src/api.ts` — `api()`, `apiUpload()`.
- `apps/web/src/socket.ts` — `getSocket()`, события `bid:new`/`planned:status` (уже используются старым кодом, те же имена).
- Паттерн try/catch + error-state на каждый async-обработчик — обязателен с первого же коммита (Фаза B получила Important-находку именно за его пропуск, не повторять).

**Токены/язык:** `c2`-префикс, весь текст через `useTranslation()`/`ru.json`, `verbatimModuleSyntax`/`noUnusedLocals`/`noUnusedParameters`.

**Осознанное отличие от прототипа:** pw1 в прототипе показывает категорию как уже выбранный фиксированный чип (демо предзаполнено) — в реальном флоу категория ещё не выбрана, поэтому шаг 1 показывает интерактивный ряд чипов-категорий (тот же паттерн, что уже был в старом `PlannedNewOrderPage.tsx` и в шаге 1 Фазы B), не заблокированный чип. Адрес — простые текстовые поля (адрес, район), без карты/сохранённых адресов и без подъезда/этажа/квартиры — прототип показывает только упрощённую сводку на этом экране, а `entrance`/`floor`/`apartment`/`addressComment` в DTO необязательны.

---

### Task 1: PlannedNewOrderPage v2 — визард 3 шага

**Files:**
- Create: `apps/web/src/features/client-v2/pages/PlannedNewOrderPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/PlannedNewOrderPage.tsx`

Точные тексты — прототип строки 424-491 (pw1-pw3).

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок (после `newOrder`):
```json
  "plannedNew": {
    "step1Title": "Запланировать",
    "step2Title": "Когда удобно?",
    "step2Slot": "Временной интервал",
    "step2Budget": "Бюджет",
    "step2BudgetHint": "(необязательно — ориентир для мастеров)",
    "step2BudgetPlaceholder": "~ 20 000 ₸",
    "step2Next": "Далее — предпросмотр",
    "step3Title": "Предпросмотр",
    "step3Note": "Так вашу заявку увидят мастера — без точного адреса и телефона:",
    "step3Offers": "{{n}}/5 предложений",
    "step3Footer": "Заявка активна до даты работ. Вы получите до 5 предложений и выберете мастера сами. Публикация бесплатна.",
    "publish": "Опубликовать заявку",
    "addressLabel": "Адрес",
    "districtLabel": "Район"
  }
```

- [ ] **Step 2: Компонент визарда**

`apps/web/src/features/client-v2/pages/PlannedNewOrderPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';
import { categoryMeta } from '../categoryMeta';

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
  const navigate = useNavigate();
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
      navigate(`/planned/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (title: string, back: () => void, n: number) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-c2-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-c2-ink">{title}</span>
      <span className="text-xs font-bold text-c2-ink-soft">{t('common.stepOf', { n, total: 3 })}</span>
    </div>
  );
  const progress = (n: number) => (
    <div className="flex gap-1.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= n ? 'bg-c2-primary' : 'bg-c2-border'}`} />
      ))}
    </div>
  );

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step1Title'), () => navigate('/'), 1)}
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
                className={`rounded-c2-pill border-2 px-3.5 py-2 text-sm font-bold ${
                  active ? 'border-c2-primary bg-c2-primary text-white' : 'border-c2-border bg-c2-surface text-c2-ink'
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
          className="min-h-24 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-16 w-16 rounded-c2-md bg-c2-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-xl text-c2-primary">
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
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t('plannedNew.districtLabel')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId || !description || !address || !district}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step2Title'), () => setStep(1), 2)}
        {progress(2)}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {dates.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDateIdx(i)}
              className={`flex-none rounded-c2-md border-2 px-0 py-2.5 text-center ${
                i === dateIdx ? 'border-c2-primary bg-c2-fill-soft' : 'border-c2-border bg-c2-surface'
              }`}
              style={{ width: 64 }}
            >
              <div className="text-[10.5px] font-bold text-c2-ink-soft">{DOW[d.getDay()]}</div>
              <div className="text-base font-extrabold text-c2-ink">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-c2-ink">{t('plannedNew.step2Slot')}</div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlotIdx(i)}
              className={`rounded-c2-md border-2 p-2.5 text-center text-[13px] font-bold ${
                i === slotIdx ? 'border-c2-primary bg-c2-fill-soft text-c2-primary' : 'border-c2-border text-c2-ink-soft'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-c2-ink">
          {t('plannedNew.step2Budget')} <span className="text-xs font-semibold text-c2-ink-soft">{t('plannedNew.step2BudgetHint')}</span>
        </div>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={t('plannedNew.step2BudgetPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm font-extrabold text-c2-ink outline-none placeholder:text-c2-muted placeholder:font-normal"
        />
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white"
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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('plannedNew.step3Title'), () => setStep(2), 3)}
      {progress(3)}
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('plannedNew.step3Note')}</p>
      <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5 shadow-c2-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-c2-ink">
            {meta.icon} {categories.find((c) => c.id === categoryId)?.name}
          </span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
            {t('plannedNew.step3Offers', { n: 0 })}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed text-c2-on-fill">
          «{description}» {photoPaths.length > 0 && `· ${t('common.photosCount', { n: photoPaths.length })}`}
        </div>
        <div className="mt-1.5 text-xs text-c2-ink-soft">
          📍 {district} · 🗓 {DOW[day.getDay()]}, {day.getDate()} · {slot.label}
          {budget && ` · бюджет ~${budget} ₸`}
        </div>
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('plannedNew.step3Footer')}</div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedNew.publish')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Маршрут**

В `App.tsx`: заменить `import PlannedNewOrderPage from './pages/PlannedNewOrderPage';` на `import PlannedNewOrderPage from './features/client-v2/pages/PlannedNewOrderPage';`. Маршрут `/planned/new` остаётся в блоке старого `Layout` (как и `/order/new` в Фазе B — визарды не показывают нижний таб-бар).

```bash
rm apps/web/src/pages/PlannedNewOrderPage.tsx
```

- [ ] **Step 4: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: пройти все 3 шага, опубликовать, убедиться что редирект на `/planned/:id` происходит и заявка реально создана (проверить в БД `slotStart`/`slotEnd` — не должны быть `null`/ошибкой валидации).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2/pages/PlannedNewOrderPage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git rm apps/web/src/pages/PlannedNewOrderPage.tsx
git commit -m "feat(web): визард плановой заявки v2 (3 шага) — чинит баг с scheduledAt→slotStart/slotEnd"
```

---

### Task 2: PlannedOrderPage v2 — каркас + PwaitView + SelectBidConfirm

**Files:**
- Create: `apps/web/src/features/client-v2/pages/PlannedOrderPage.tsx`
- Create: `apps/web/src/features/client-v2/components/planned-order-views/PwaitView.tsx`
- Create: `apps/web/src/features/client-v2/components/planned-order-views/SelectBidConfirm.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/PlannedOrderPage.tsx`

**Interfaces:**
- Produces: `PlannedOrderDetail`/`PlannedBid` типы (экспортируются из `PlannedOrderPage.tsx`, единый источник для Task 3). `SelectBidConfirm` — переиспользуется и в `PwaitView` (эта задача), и в `PlannedComparePage` (Task 3): пропы `{plannedOrderId, bid, onBack}` — при успехе сам вызывает `navigate` на `/planned/:id` (перемонтирует `PlannedOrderPage` заново), отдельный колбэк не нужен.

Точные тексты — прототип строки 493-536 (pwait), 576-589 (pconfirm).

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок:
```json
  "plannedDetail": {
    "publishedBadge": "Опубликована",
    "summary": "{{icon}} {{category}} · {{when}} · {{district}} · {{budget}}",
    "offersCount": "Предложения: {{n}} из 5",
    "activeUntil": "активна до {{date}}",
    "noBidsYet": "Мастера уже видят вашу заявку.\nПервые предложения — обычно в течение часа.",
    "bestPrice": "Лучшая цена",
    "ordersShort": "заказов",
    "termLabel": "срок: {{term}}",
    "select": "Выбрать",
    "compare": "Сравнить ({{n}})",
    "cancel": "Отменить",
    "confirmTitle": "Подтвердите выбор",
    "confirmNote": "После подтверждения мастер получит ваш точный адрес и телефон и должен подтвердить заказ в течение 2 часов. Остальные предложения будут закрыты.",
    "confirmChoice": "Подтвердить выбор",
    "backToBids": "Назад к предложениям"
  }
```

- [ ] **Step 2: PlannedOrderPage — каркас**

`apps/web/src/features/client-v2/pages/PlannedOrderPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import PwaitView from '../components/planned-order-views/PwaitView';
import PactiveView from '../components/planned-order-views/PactiveView';
import PlannedDoneView from '../components/planned-order-views/PlannedDoneView';
import PlannedClosedView from '../components/planned-order-views/PlannedClosedView';

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

const ACTIVE_STATUSES = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

export default function PlannedOrderPage() {
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

  if (loading) return <div className="p-6 text-c2-ink-soft">Загрузка…</div>;

  if (error || !order || !id) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm font-semibold text-c2-danger">{error || 'Заявка не найдена'}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-sm font-extrabold text-c2-primary"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (order.status === 'PUBLISHED') return <PwaitView order={order} orderId={id} onChanged={load} />;
  if (ACTIVE_STATUSES.includes(order.status)) return <PactiveView order={order} orderId={id} />;
  if (order.status === 'DONE') return <PlannedDoneView order={order} orderId={id} onChanged={load} />;
  return <PlannedClosedView order={order} onChanged={load} />;
}
```

- [ ] **Step 3: SelectBidConfirm (переиспользуемый)**

`apps/web/src/features/client-v2/components/planned-order-views/SelectBidConfirm.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { PlannedBid } from '../../pages/PlannedOrderPage';

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
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirmChoice() {
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${plannedOrderId}/select`, { method: 'POST', body: JSON.stringify({ bidId: bid.id }) });
      navigate(`/planned/${plannedOrderId}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-3.5 px-6 py-5.5">
      <div className="text-center text-xl font-extrabold text-c2-ink">{t('plannedDetail.confirmTitle')}</div>
      <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-c2-fill text-base font-extrabold text-c2-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </div>
        <div className="text-base font-extrabold text-c2-ink">{bid.master.name} ✓</div>
        <div className="mt-0.5 text-xs font-semibold text-c2-ink-soft">
          ★ {bid.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </div>
        <div className="mt-2.5 text-[22px] font-extrabold text-c2-primary">{bid.price} ₸</div>
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3.5 text-xs font-semibold leading-relaxed text-c2-ink">
        {t('plannedDetail.confirmNote')}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <button
        type="button"
        onClick={confirmChoice}
        disabled={submitting}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedDetail.confirmChoice')}
      </button>
      <button type="button" onClick={onBack} className="text-center text-[13.5px] font-bold text-c2-ink-soft">
        {t('plannedDetail.backToBids')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: PwaitView**

`apps/web/src/features/client-v2/components/planned-order-views/PwaitView.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { categoryMeta } from '../../categoryMeta';
import SelectBidConfirm from './SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '../../pages/PlannedOrderPage';

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
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-c2-ink">{order.category?.name}</span>
        <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
          {t('plannedDetail.publishedBadge')}
        </span>
      </div>
      <div className="rounded-c2-md bg-c2-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-c2-ink">
        {categoryMeta(order.category?.slug ?? '').icon} {order.category?.name} · {when} · {order.district}
        {order.budget && ` · ~${order.budget} ₸`}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-extrabold text-c2-ink">
          {t('plannedDetail.offersCount', { n: order.bids.length })}
        </span>
      </div>
      {order.bids.length === 0 && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-5.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-c2-border border-t-c2-primary" />
          <div className="whitespace-pre-line text-[13px] font-bold leading-relaxed text-c2-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </div>
        </div>
      )}
      {order.bids.map((b) => (
        <div key={b.id} className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-c2-fill text-[13px] font-extrabold text-c2-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <div className="text-sm font-extrabold text-c2-ink">
                  {b.master.name} <span className="text-xs text-c2-success">✓</span>
                </div>
                <div className="text-[11.5px] font-semibold text-c2-ink-soft">
                  ★ {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })} ·{' '}
                  {b.master.experienceYears} лет
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-c2-primary">{b.price} ₸</div>
              <div className="text-[11px] font-semibold text-c2-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</div>
            </div>
          </div>
          {b.comment && <div className="my-2 text-[12.5px] leading-snug text-c2-on-fill">«{b.comment}»</div>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && (
              <span className="rounded-c2-pill bg-c2-success-bg px-2.5 py-1 text-[10.5px] font-extrabold text-c2-success-ink">
                {t('plannedDetail.bestPrice')}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(b)}
              className="ml-auto rounded-c2-pill bg-c2-primary px-4.5 py-2 text-xs font-extrabold text-white"
            >
              {t('plannedDetail.select')}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/planned/${orderId}/compare`)}
          disabled={order.bids.length === 0}
          className="flex-1 rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-[13.5px] font-extrabold text-c2-primary disabled:opacity-40"
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-c2-pill border-[1.5px] border-c2-danger p-3 text-[13.5px] font-extrabold text-c2-danger"
        >
          {t('plannedDetail.cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Маршрут (частично — PactiveView/PlannedDoneView/PlannedClosedView создаются в Task 3, но импорт в PlannedOrderPage.tsx уже на них ссылается)**

Т.к. `PlannedOrderPage.tsx` из Step 2 уже импортирует `PactiveView`/`PlannedDoneView`/`PlannedClosedView`, для чистой сборки в конце ЭТОЙ задачи нужны временные минимальные заглушки — создать их прямо сейчас как заглушки (заменяются полностью в Task 3, тот же паттерн, что `TrackView`-заглушка в Task 3 плана Фазы B):

`apps/web/src/features/client-v2/components/planned-order-views/PactiveView.tsx`:
```tsx
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PactiveView({ order }: { order: PlannedOrderDetail; orderId: string }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
```

`apps/web/src/features/client-v2/components/planned-order-views/PlannedDoneView.tsx`:
```tsx
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedDoneView({ order }: { order: PlannedOrderDetail; orderId: string; onChanged: () => void }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
```

`apps/web/src/features/client-v2/components/planned-order-views/PlannedClosedView.tsx`:
```tsx
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedClosedView({ order }: { order: PlannedOrderDetail; onChanged: () => void }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
```

В `App.tsx`: заменить `import PlannedOrderPage from './pages/PlannedOrderPage';` на `import PlannedOrderPage from './features/client-v2/pages/PlannedOrderPage';`.

```bash
rm apps/web/src/pages/PlannedOrderPage.tsx
```

- [ ] **Step 6: Собрать**

```bash
pnpm --filter web build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/client-v2 apps/web/src/App.tsx
git rm apps/web/src/pages/PlannedOrderPage.tsx
git commit -m "feat(web): PlannedOrderPage v2 — каркас + PwaitView + SelectBidConfirm (переиспользуемый выбор ставки)"
```

---

### Task 3: PlannedComparePage + PactiveView + PlannedDoneView + PlannedClosedView

**Files:**
- Create: `apps/web/src/features/client-v2/pages/PlannedComparePage.tsx`
- Modify: `apps/web/src/features/client-v2/components/planned-order-views/PactiveView.tsx` (полная замена заглушки)
- Modify: `apps/web/src/features/client-v2/components/planned-order-views/PlannedDoneView.tsx` (полная замена)
- Modify: `apps/web/src/features/client-v2/components/planned-order-views/PlannedClosedView.tsx` (полная замена)
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`

Точные тексты — прототип строки 538-621 (compare, pconfirm уже в Task 2, pactive).

- [ ] **Step 1: Переводы**

В `ru.json`, в блок `plannedDetail` добавить:
```json
    "comparePrice": "Цена",
    "compareRating": "Рейтинг",
    "compareOrders": "Заказов",
    "compareExperience": "Опыт",
    "compareTerm": "Срок",
    "compareComment": "Комментарий",
    "compareHint": "Цена — не единственный критерий: смотрите на рейтинг и число заказов",
    "waitingConfirm": "Ждём подтверждения от {{name}}",
    "waitingConfirmHint": "обычно отвечают за 10–20 минут",
    "confirmed": "{{name}} подтвердил заказ — контакты открыты",
    "workLabel": "Работы",
    "whenLabel": "Когда",
    "doneTitle": "Мастер завершил работу",
    "doneNote": "Проверьте результат. Если всё в порядке — подтвердите. Если нет — откройте спор, оператор разберётся.",
    "confirmDone": "Подтвердить выполнение",
    "openDispute": "Открыть спор",
    "closedTitle": "Заказ выполнен",
    "closedCancelledTitle": "Заявка отменена",
    "closedExpiredTitle": "Заявка истекла",
    "rateTitle": "Оцените мастера",
    "rateThanks": "Спасибо за отзыв!",
    "toHome": "На главную"
```

- [ ] **Step 2: PlannedComparePage**

`apps/web/src/features/client-v2/pages/PlannedComparePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import SelectBidConfirm from '../components/planned-order-views/SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from './PlannedOrderPage';

export default function PlannedComparePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  if (error) return <div className="p-6 text-sm font-semibold text-c2-danger">{error}</div>;
  if (!order || !id) return <div className="p-6 text-c2-ink-soft">Загрузка…</div>;

  const rows: { label: string; render: (b: PlannedBid) => string }[] = [
    { label: t('plannedDetail.comparePrice'), render: (b) => `${b.price} ₸` },
    { label: t('plannedDetail.compareRating'), render: (b) => `★ ${b.master.rating?.toFixed(1) ?? '—'}` },
    { label: t('plannedDetail.compareOrders'), render: (b) => String(b.master.completedCount) },
    { label: t('plannedDetail.compareExperience'), render: (b) => `${b.master.experienceYears} лет` },
    { label: t('plannedDetail.compareTerm'), render: (b) => b.term },
    { label: t('plannedDetail.compareComment'), render: (b) => b.comment ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate(`/planned/${id}`)} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="text-lg font-extrabold text-c2-ink">Сравнение мастеров</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse overflow-hidden rounded-c2-lg border border-c2-border text-[12.5px]">
          <thead>
            <tr>
              <th className="bg-c2-fill-soft p-3" />
              {order.bids.map((b) => (
                <th key={b.id} className="border-l border-c2-border bg-c2-fill-soft p-2 text-center">
                  <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-c2-fill text-xs font-extrabold text-c2-ink">
                    {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
                  </div>
                  <span className="font-extrabold text-c2-ink">{b.master.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-t border-c2-border p-2.5 font-bold text-c2-ink-soft">{row.label}</td>
                {order.bids.map((b) => (
                  <td key={b.id} className="border-l border-t border-c2-border p-2.5 text-center font-extrabold text-c2-ink">
                    {row.render(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11.5px] text-c2-ink-soft">{t('plannedDetail.compareHint')}</p>
      <div className="mt-auto" />
      <div className="flex gap-2">
        {order.bids.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b)}
            className="flex-1 rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-[12.5px] font-extrabold text-c2-primary"
          >
            {t('plannedDetail.select')} {b.master.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: PactiveView**

`apps/web/src/features/client-v2/components/planned-order-views/PactiveView.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { PLANNED_STATUS_LABELS } from '../../../../orderStatus';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PactiveView({ order, orderId }: { order: PlannedOrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-c2-ink">{order.category?.name}</span>
        <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
          {PLANNED_STATUS_LABELS[order.status]}
        </span>
      </div>

      {!confirmed && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-4.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-c2-border border-t-c2-primary" />
          <div className="text-[13.5px] font-bold leading-relaxed text-c2-ink">
            {t('plannedDetail.waitingConfirm', { name: order.master?.name })}
          </div>
          <div className="mt-1 text-xs font-semibold text-c2-ink-soft">
            {t('plannedDetail.waitingConfirmHint')} · {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
      )}

      {confirmed && (
        <>
          <div className="rounded-c2-md bg-c2-success-bg p-3.5 text-[13px] font-bold text-c2-success-ink">
            ✓ {t('plannedDetail.confirmed', { name: order.master?.name })}
          </div>
          <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-c2-fill text-sm font-extrabold text-c2-ink">
                {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-extrabold text-c2-ink">
                  {order.master?.name} <span className="text-xs text-c2-success">✓</span>
                </div>
              </div>
              {order.master?.phone && (
                <a
                  href={`tel:${order.master.phone}`}
                  className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-c2-primary text-base text-white"
                >
                  📞
                </a>
              )}
            </div>
            <div className="my-2.5 border-t border-c2-fill-soft" />
            <div className="flex justify-between text-[13px] font-bold">
              <span className="text-c2-ink-soft">{t('plannedDetail.workLabel')}</span>
              <span className="text-c2-ink">{price} ₸</span>
            </div>
            <div className="mt-1 flex justify-between text-[13px] font-bold">
              <span className="text-c2-ink-soft">{t('plannedDetail.whenLabel')}</span>
              <span className="text-c2-ink">{new Date(order.slotStart).toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </>
      )}

      <div className="rounded-c2-md bg-c2-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-c2-ink">
        {order.category?.name} · «{order.description.slice(0, 40)}» · {order.address}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={cancel}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('plannedDetail.cancel')}
      </button>
    </div>
  );
}
```

Примечание: обратный отсчёт показывается только в подсостоянии «ждём подтверждения» (`MASTER_SELECTED`) — реальный `confirmDeadline` от бэкенда, тот же паттерн, что `priceDeadline` в `PriceView` Фазы B.

- [ ] **Step 4: PlannedDoneView**

`apps/web/src/features/client-v2/components/planned-order-views/PlannedDoneView.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

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
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-c2-ink">{t('plannedDetail.doneTitle')}</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="mb-1.5 text-sm font-extrabold text-c2-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-c2-ink">
          <span className="text-c2-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-c2-pill bg-c2-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('plannedDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/planned/${orderId}/dispute`)}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('plannedDetail.openDispute')}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: PlannedClosedView**

`apps/web/src/features/client-v2/components/planned-order-views/PlannedClosedView.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedClosedView({ order, onChanged }: { order: PlannedOrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isClosed ? 'bg-c2-success' : 'bg-c2-ink-soft'
        }`}
      >
        {isClosed ? '✓' : '×'}
      </div>
      <div className="text-xl font-extrabold text-c2-ink">{title}</div>
      {!isClosed && order.cancelReason && <div className="text-sm text-c2-ink-soft">{order.cancelReason}</div>}
      {isClosed && (
        <div className="w-full rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-c2-ink">{t('plannedDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-c2-ink">{t('plannedDetail.rateTitle')}</div>
              <div className="flex justify-center gap-1 text-[28px]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    className={s <= rating ? 'text-c2-primary' : 'text-c2-border'}
                  >
                    ★
                  </button>
                ))}
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-c2-danger">{error}</div>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="w-full rounded-c2-pill bg-c2-primary p-4 text-sm font-extrabold text-white"
      >
        {t('plannedDetail.toHome')}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Маршрут для compare**

В `App.tsx`: добавить `import PlannedComparePage from './features/client-v2/pages/PlannedComparePage';` и `<Route path="/planned/:id/compare" element={<PlannedComparePage />} />` в тот же блок старого `Layout`, что и `/planned/:id`.

- [ ] **Step 7: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: полный цикл плановой заявки (создание→ожидание ставок→сравнение→выбор→подтверждение мастером→завершение→закрытие+рейтинг), см. общий чеклист в конце плана.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/client-v2 apps/web/src/App.tsx
git commit -m "feat(web): PlannedComparePage + PactiveView + PlannedDoneView/PlannedClosedView"
```

---

### Task 4: DisputePage — рефакторинг под оба типа заявок

**Files:**
- Modify: `apps/web/src/features/client-v2/pages/DisputePage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- `DisputePage` принимает проп `kind: 'orders' | 'planned-orders'` вместо жёсткого пути `/orders`.

- [ ] **Step 1: Рефакторинг DisputePage**

В `apps/web/src/features/client-v2/pages/DisputePage.tsx`:

Заменить сигнатуру компонента:
```tsx
export default function DisputePage({ kind }: { kind: 'orders' | 'planned-orders' }) {
```

Заменить оба места с жёстко закодированным `/orders/`:
```tsx
  useEffect(() => {
    api(`/${kind}/${id}`)
      .then((o) => setDispute(o.dispute ?? null))
      .catch((e) => setError((e as Error).message));
  }, [id, kind]);
```
и
```tsx
      const created = await api(`/${kind}/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) });
```

Остальное содержимое файла (категории, textarea, апрувед-эвиденс, статус-таймлайн) не меняется — идентично для обоих типов заявок.

- [ ] **Step 2: Маршруты**

В `App.tsx`:
```tsx
<Route path="/order/:id/dispute" element={<DisputePage kind="orders" />} />
...
<Route path="/planned/:id/dispute" element={<DisputePage kind="planned-orders" />} />
```
(первая строка уже существует — заменить `<DisputePage />` на `<DisputePage kind="orders" />`; вторая — новая, в тот же блок, что `/planned/:id/compare`).

- [ ] **Step 3: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: открыть спор и на срочной, и на плановой заявке — оба должны работать (не сломать уже проверенный в Фазе B сценарий).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/client-v2/pages/DisputePage.tsx apps/web/src/App.tsx
git commit -m "refactor(web): DisputePage — общий компонент для orders/planned-orders через kind-проп"
```

---

## После завершения всех задач (контроллер)

1. `pnpm --filter web build` + `pnpm --filter api build`.
2. Живая браузерная проверка полного цикла плановой заявки (два аккаунта — клиент через UI, мастер через прямые API-вызовы, как в Фазе B): визард(3 шага)→pwait(0 ставок→спиннер, после ставки — карточка с рейтингом)→compare(таблица)→выбор→pconfirm→select()→pactive(ждём подтверждения, реальный отсчёт confirmDeadline)→мастер подтверждает→pactive(контакты открыты)→on-site→complete→done→confirm-completion→closed(звёзды рейтинга, подтвердить в БД)→dispute на плановой заявке.
3. Финальный whole-branch review (opus) диапазона коммитов Фазы C.
4. Обновить память проекта и `.superpowers/sdd/progress.md`.
