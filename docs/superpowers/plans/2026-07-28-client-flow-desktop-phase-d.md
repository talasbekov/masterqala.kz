# Клиентский флоу (десктоп) — Фаза D: история, профиль, адреса, поддержка, платежи — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести 5 оставшихся экранов клиентского флоу (история заказов,
профиль, адреса, поддержка, платежи) из `apps/web/src/features/client-v2`
в `apps/client` под десктопную раскладку — последняя фаза подпроекта 2.

**Architecture:** Продолжение Фаз A/B/C — тот же общий `(app)`-layout с
сайдбаром для всех страниц (нет разделения AppShell/старый Layout, как в
`apps/web`). Три десктоп-специфичных layout-решения: `/orders` —
настоящая HTML-таблица вместо списка карточек; `/profile` — 2 колонки
(личные данные+язык слева, навигация справа); `/addresses` — список и
форма редактирования одновременно видны рядом (не полноэкранный свап, как
в мобильной версии). `/payments` и `/support` — почти дословный порт в
узкой колонке, как большинство non-map экранов предыдущих фаз.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind
CSS 4, `react-i18next` (все — уже есть с Фаз A/B/C, новых зависимостей не
требуется).

## Global Constraints

- Бэкенд (`apps/api`) не меняется — используются только существующие
  эндпоинты: `GET /orders`, `GET /planned-orders/mine`, `GET/PATCH
  /users/me`, `GET/POST/PATCH/DELETE /addresses`.
- Юнит-тестов на фронте нет (та же практика Фаз A/B/C) — верификация
  каждой задачи через `pnpm --filter client build`.
- Маршруты — top-level: `/orders`, `/profile`, `/addresses`, `/payments`,
  `/support` (НЕ `/profile/addresses`/`/profile/payments` — это
  соглашение из другого, более раннего мобильного цикла и сюда не
  переносится, см. спеку). `Sidebar.tsx`/`NavLink.tsx` уже содержат ссылки
  на `/orders` и `/profile` с Фазы A — не трогать эти файлы.
- Каждый перенесённый файл сверяется с оригиналом в
  `apps/web/src/features/client-v2/pages/` — логика/тексты/i18n-ключи не
  меняются (все нужные ключи `myOrders.*`, `profile.*`, `addresses.*`,
  `support.*`, `payments.*` уже присутствуют в
  `apps/client/lib/locales/ru.json`, ничего добавлять не нужно). Меняется
  только: (а) адаптации Next.js (`react-router-dom` → `next/navigation`),
  (б) три десктоп-специфичных layout-решения этой фазы (см. каждую
  задачу), (в) заголовки колонок таблицы `/orders` — новый UI-элемент,
  которого не было в оригинале, поэтому текст хардкодится напрямую (не
  через `t()`) — тот же паттерн, что уже используют хардкод-строки
  free-pilot фолбэков в `NewOrderPage`/`DoneView`/`PriceView` из Фазы B.
- Импорты — через alias `@/...` (как во всех предыдущих фазах), не
  относительные пути.
- Ссылки на ещё не перенесённые маршруты (`/become-master`, `/wallet`,
  `/admin`) остаются как есть — ожидаемое переходное состояние (прецедент
  всех предыдущих фаз, эти роли — вне скоупа подпроекта 2).

---

### Task 1: `/orders` — таблица истории заказов

**Files:**
- Create: `apps/client/app/(app)/orders/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`), `STATUS_LABELS`, `PLANNED_STATUS_LABELS`,
  `urgentStatusVariant`, `plannedStatusVariant`, `isTerminalStatus`,
  `isPlannedTerminalStatus` (все — `@/lib/orderStatus`, уже существуют с
  Фазы B).
- Produces: маршрут `/orders`.

**Отступление от оригинала (обосновано дизайном, решение пользователя):**
вместо списка карточек — HTML `<table>`. Вкладки Активные/История
остаются сверху без изменений. Строка таблицы — `<tr onClick={...}>`
(не `<a>`, т.к. `<a>` нельзя корректно вложить в `<tr>`), колонки: Режим
(иконка) / Категория / № / Статус (цветная плашка) / Дата / Цена /
Мастер. Заголовки колонок — новый текст, хардкодится напрямую (см. Global
Constraints).

- [ ] **Step 1: Создать `apps/client/app/(app)/orders/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import {
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  urgentStatusVariant,
  plannedStatusVariant,
  isTerminalStatus,
  isPlannedTerminalStatus,
} from '@/lib/orderStatus';

interface UrgentOrder {
  id: string;
  status: string;
  category: { name: string } | null;
  createdAt: string;
  calloutPrice: number;
  workPrice: number | null;
  master: { name: string | null } | null;
}
interface PlannedOrderItem {
  id: string;
  status: string;
  category: { name: string } | null;
  createdAt: string;
  budget: number | null;
  workPrice: number | null;
  master: { name: string | null } | null;
}
type Item = (UrgentOrder & { kind: 'urgent' }) | (PlannedOrderItem & { kind: 'planned' });

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')])
      .then(([urgent, planned]: [UrgentOrder[], PlannedOrderItem[]]) => {
        const merged: Item[] = [
          ...urgent.map((o) => ({ ...o, kind: 'urgent' as const })),
          ...planned.map((o) => ({ ...o, kind: 'planned' as const })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(merged);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const isActive = (it: Item) =>
    it.kind === 'urgent' ? !isTerminalStatus(it.status) : !isPlannedTerminalStatus(it.status);
  const shown = items.filter((it) => (tab === 'active' ? isActive(it) : !isActive(it)));

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div className="text-[22px] font-extrabold text-ink">{t('myOrders.title')}</div>
      <div className="flex w-fit rounded-pill bg-fill p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-pill px-6 py-2 text-[13px] font-extrabold ${
            tab === 'active' ? 'bg-surface text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          {t('myOrders.active')}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded-pill px-6 py-2 text-[13px] font-extrabold ${
            tab === 'history' ? 'bg-surface text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          {t('myOrders.history')}
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {!loading && shown.length === 0 && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-6 text-center text-sm font-semibold text-ink-soft">
          {tab === 'active' ? t('myOrders.emptyActive') : t('myOrders.emptyHistory')}
        </div>
      )}
      {shown.length > 0 && (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
          <thead>
            <tr className="bg-fill-soft text-left text-xs font-extrabold text-ink-soft">
              <th className="p-3">Режим</th>
              <th className="p-3">Категория</th>
              <th className="p-3">№</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Дата</th>
              <th className="p-3">Цена</th>
              <th className="p-3">Мастер</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              const label = it.kind === 'urgent' ? STATUS_LABELS[it.status] : PLANNED_STATUS_LABELS[it.status];
              const variant = it.kind === 'urgent' ? urgentStatusVariant(it.status) : plannedStatusVariant(it.status);
              const price = it.kind === 'urgent' ? (it.workPrice ?? it.calloutPrice) : (it.workPrice ?? it.budget);
              return (
                <tr
                  key={it.id}
                  onClick={() => router.push(it.kind === 'urgent' ? `/order/${it.id}` : `/planned/${it.id}`)}
                  className="cursor-pointer border-t border-border hover:bg-fill-faint"
                >
                  <td className="p-3">{it.kind === 'urgent' ? '⚡' : '📅'}</td>
                  <td className="p-3 font-bold text-ink">{it.category?.name ?? '—'}</td>
                  <td className="p-3 text-ink-soft">№{it.id.slice(0, 8)}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-pill px-2.5 py-1 text-[10.5px] font-extrabold ${
                        variant === 'success'
                          ? 'bg-success-bg text-success-ink'
                          : variant === 'danger'
                            ? 'bg-danger-bg text-danger-ink'
                            : 'bg-fill-soft text-primary'
                      }`}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="p-3 text-ink-soft">{new Date(it.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td className="p-3 font-bold text-ink">{price != null ? `${price} ₸` : '—'}</td>
                  <td className="p-3 text-ink-soft">{it.master?.name ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/orders` присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/orders"
git commit -m "feat(client): MyOrdersPage v2 — таблица истории заказов"
```

---

### Task 2: `/profile` — 2 колонки (личные данные + навигация)

**Files:**
- Create: `apps/client/app/(app)/profile/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`), `useAuth` (`@/lib/auth`).
- Produces: маршрут `/profile`; ссылки на `/addresses`, `/payments`,
  `/notifications` (уже готов, Фаза A), `/support` (Task 4 этого плана —
  ссылка добавляется независимо от порядка задач, страница появится
  позже в этой же фазе).

**Отступление от оригинала (обосновано дизайном, решение пользователя):**
левая колонка (`shrink-0`, `w-[380px]`) — аватар+имя (инлайн-
редактирование как в оригинале)+телефон, переключатель языка, баннер
блокировки (если применимо). Правая колонка (`flex-1`) — 4 пункта-ссылки,
карточка «стать мастером», ссылки на кошелёк/админ-панель. Кнопка «Выйти»
— под обеими колонками на всю ширину.

- [ ] **Step 1: Создать `apps/client/app/(app)/profile/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS = [
  { icon: '📍', key: 'addresses', to: '/addresses' },
  { icon: '💳', key: 'payments', to: '/payments' },
  { icon: '🔔', key: 'notifications', to: '/notifications' },
  { icon: '🛟', key: 'support', to: '/support' },
] as const;

const LANGS = [
  { code: 'ru', label: 'Рус' },
  { code: 'kk', label: 'Қаз' },
  { code: 'en', label: 'Eng' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/users/me')
      .then((m: Me) => {
        setMe(m);
        setName(m.name ?? '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function saveName() {
    setSaving(true);
    setError('');
    try {
      const updated = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setMe(updated);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function doLogout() {
    logout();
    router.push('/login');
  }

  const blocked = me?.masterProfile?.blockedUntil && new Date(me.masterProfile.blockedUntil) > new Date();

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div className="flex gap-8">
        <div className="flex w-[380px] shrink-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white">
              {(me?.name || user?.phone || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-2.5 py-1.5 text-sm font-extrabold text-ink outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={saveName} disabled={saving} className="shrink-0 text-sm font-extrabold text-primary">
                    {t('profile.save')}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className="block text-left">
                  <span className="text-lg font-extrabold text-ink">{me?.name || t('profile.noName')}</span>
                  <span className="ml-1.5 text-xs font-bold text-primary">{t('profile.editName')}</span>
                </button>
              )}
              <div className="text-xs font-semibold text-ink-soft">{me?.phone ?? user?.phone}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => i18n.changeLanguage(l.code)}
                className={`rounded-pill border-[1.5px] px-3.5 py-1.5 text-xs font-extrabold ${
                  i18n.language === l.code ? 'border-primary bg-primary text-white' : 'border-border text-ink-soft'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          {blocked && me?.masterProfile?.blockedUntil && (
            <div className="rounded-md bg-danger-bg p-3 text-xs font-semibold text-danger-ink">
              {t('profile.blockedUntil', { date: new Date(me.masterProfile.blockedUntil).toLocaleDateString('ru-RU') })}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {PROFILE_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.to}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-3.5 py-3.5"
            >
              <span className="text-sm font-extrabold text-ink">
                {item.icon} {t(`profile.items.${item.key}`)}
              </span>
              <span className="text-ink-soft">›</span>
            </Link>
          ))}
          <div className="rounded-lg bg-fill p-3.5">
            <div className="text-sm font-extrabold text-ink">🔧 {t('profile.becomeMasterTitle')}</div>
            <div className="mt-1 text-xs font-semibold leading-relaxed text-on-fill">{t('profile.becomeMasterSubtitle')}</div>
            <Link href="/become-master" className="mt-2 inline-block text-xs font-extrabold text-primary">
              {t('profile.becomeMasterLink')} →
            </Link>
          </div>
          <Link href="/wallet" className="text-center text-sm font-bold text-primary underline">
            {t('profile.wallet')}
          </Link>
          {user?.role === 'OPERATOR' && (
            <Link href="/admin" className="text-center text-sm font-bold text-primary underline">
              {t('profile.adminPanel')}
            </Link>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={doLogout}
        className="rounded-pill border-[1.5px] border-danger p-3 text-center text-[13.5px] font-extrabold text-danger"
      >
        {t('profile.logout')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/profile` присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/profile"
git commit -m "feat(client): ProfilePage v2 — 2-колоночная раскладка"
```

---

### Task 3: `/addresses` — список + форма редактирования рядом

**Files:**
- Create: `apps/client/app/(app)/addresses/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`).
- Produces: маршрут `/addresses`.

**Отступление от оригинала (обосновано дизайном, решение пользователя):**
вместо полноэкранного свапа список↔форма — 2 постоянно видимые колонки.
Левая (`w-[360px]`, `shrink-0`) — список адресов-кнопок + «+ Добавить
адрес» снизу. Правая (`flex-1`) — форма, которая либо редактирует
выбранный адрес, либо создаёт новый (`editingId` инициализируется первым
адресом из списка при загрузке, если список непуст, иначе — `'new'`).

- [ ] **Step 1: Создать `apps/client/app/(app)/addresses/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

interface Address {
  id: string;
  label: string;
  address: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  comment: string | null;
  isDefault: boolean;
}

const emptyForm = { label: '', address: '', entrance: '', floor: '', apartment: '', comment: '', isDefault: false };

export default function AddressesPage() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    api('/addresses')
      .then((list: Address[]) => {
        setAddresses(list);
        if (!loaded) {
          if (list.length > 0) startEdit(list[0]);
          else startNew();
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(a: Address) {
    setForm({
      label: a.label,
      address: a.address,
      entrance: a.entrance ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      comment: a.comment ?? '',
      isDefault: a.isDefault,
    });
    setError('');
    setEditingId(a.id);
  }
  function startNew() {
    setForm(emptyForm);
    setError('');
    setEditingId('new');
  }

  async function save() {
    setError('');
    setSubmitting(true);
    try {
      const body = JSON.stringify({
        label: form.label,
        address: form.address,
        entrance: form.entrance || undefined,
        floor: form.floor || undefined,
        apartment: form.apartment || undefined,
        comment: form.comment || undefined,
        isDefault: form.isDefault,
      });
      if (editingId === 'new') {
        const created = await api('/addresses', { method: 'POST', body });
        setEditingId(created.id);
      } else if (editingId) {
        await api(`/addresses/${editingId}`, { method: 'PATCH', body });
      }
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await api(`/addresses/${id}`, { method: 'DELETE' });
      setEditingId(null);
      const rest = addresses.filter((a) => a.id !== id);
      if (rest.length > 0) startEdit(rest[0]);
      else startNew();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <span className="text-xl font-extrabold text-ink">{t('addresses.title')}</span>
      <div className="flex gap-6">
        <div className="flex w-[360px] shrink-0 flex-col gap-2">
          {addresses.length === 0 && (
            <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-6 text-center text-sm font-semibold text-ink-soft">
              {t('addresses.empty')}
            </div>
          )}
          {addresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => startEdit(a)}
              className={`rounded-md border px-3.5 py-3.5 text-left ${
                editingId === a.id ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-ink">
                  {a.label} {a.isDefault && '★'}
                </span>
                <span className="text-xs font-extrabold text-primary">{t('addresses.change')}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-soft">
                {a.address}
                {a.entrance && ` · под. ${a.entrance}`}
                {a.floor && `, эт. ${a.floor}`}
                {a.apartment && `, кв. ${a.apartment}`}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={startNew}
            className="rounded-md border-[1.5px] border-dashed border-primary p-3.5 text-center text-sm font-extrabold text-primary"
          >
            ＋ {t('addresses.addNew')}
          </button>
        </div>
        <div className="flex w-[420px] flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <span className="text-sm font-extrabold text-ink">
            {editingId === 'new' ? t('addresses.addTitle') : t('addresses.editTitle')}
          </span>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={t('addresses.labelPlaceholder')}
            className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={t('addresses.addressPlaceholder')}
            className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.entrance}
              onChange={(e) => setForm({ ...form, entrance: e.target.value })}
              placeholder={t('addresses.entrance')}
              className="rounded-md border-[1.5px] border-border bg-surface p-2.5 text-center text-sm text-ink outline-none placeholder:text-muted"
            />
            <input
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              placeholder={t('addresses.floor')}
              className="rounded-md border-[1.5px] border-border bg-surface p-2.5 text-center text-sm text-ink outline-none placeholder:text-muted"
            />
            <input
              value={form.apartment}
              onChange={(e) => setForm({ ...form, apartment: e.target.value })}
              placeholder={t('addresses.apartment')}
              className="rounded-md border-[1.5px] border-border bg-surface p-2.5 text-center text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <input
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder={t('addresses.commentPlaceholder')}
            className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            {t('addresses.setDefault')}
          </label>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={submitting || !form.label || !form.address}
            className="rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {t('addresses.save')}
          </button>
          {editingId !== 'new' && editingId != null && (
            <button
              type="button"
              onClick={() => remove(editingId)}
              className="rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger"
            >
              {t('addresses.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/addresses` присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/addresses"
git commit -m "feat(client): AddressesPage v2 — список и форма рядом"
```

---

### Task 4: `/payments` + `/support` — узкие страницы-порты

**Files:**
- Create: `apps/client/app/(app)/payments/page.tsx`
- Create: `apps/client/app/(app)/support/page.tsx`

**Interfaces:**
- Consumes: `useCommercialMode` (`@/lib/commercial-mode`, `/payments`
  only).
- Produces: маршруты `/payments`, `/support` (уже ссылались на него 3
  места в Фазах A/B — начинают резолвиться).

- [ ] **Step 1: Создать `apps/client/app/(app)/payments/page.tsx`**

Порт `PaymentsPage.tsx`: `Link`+`to` → `next/link`+`href`, узкая колонка
добавлена:

```tsx
'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useCommercialMode } from '@/lib/commercial-mode';

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-6">
      <div className="flex items-center gap-2.5">
        <Link href="/profile" className="text-xl text-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-ink">{t('payments.title')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">{paymentsEnabled ? '💳' : '🎁'}</div>
        <div className="text-base font-extrabold text-ink">
          {paymentsEnabled ? t('payments.comingSoon') : 'Бесплатный пилот'}
        </div>
        <p className="max-w-[280px] text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('payments.note')
            : 'Платформа не списывает оплату за выезд и сервисный сбор. Стоимость работ согласуется с мастером после осмотра, расчёт происходит напрямую.'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Создать `apps/client/app/(app)/support/page.tsx`**

Порт `SupportPage.tsx`: `Link`+`to` → `next/link`+`href`, узкая колонка
добавлена:

```tsx
'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function SupportPage() {
  const { t } = useTranslation();
  const faq = [t('support.faq1'), t('support.faq2'), t('support.faq3'), t('support.faq4')];

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2.5 px-5 pb-3.5 pt-6">
      <div className="flex items-center gap-2.5">
        <Link href="/" className="text-xl text-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-ink">{t('support.title')}</span>
      </div>
      <a
        href="tel:7666"
        className="flex items-center justify-between rounded-md bg-primary p-4 text-[14.5px] font-extrabold text-white"
      >
        {t('support.call')} <span>›</span>
      </a>
      <div className="mt-1 text-[13.5px] font-extrabold text-ink">{t('support.faqTitle')}</div>
      {faq.map((q) => (
        <div
          key={q}
          className="flex items-center justify-between rounded-md border border-border bg-surface px-3.5 py-3.5"
        >
          <span className="text-[13px] font-bold leading-snug text-ink">{q}</span>
          <span className="text-ink-soft">›</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршруты `/payments` и `/support`
присутствуют.

- [ ] **Step 4: Commit**

```bash
git add "apps/client/app/(app)/payments" "apps/client/app/(app)/support"
git commit -m "feat(client): PaymentsPage + SupportPage v2"
```

---

### Task 5: Сквозная проверка Фазы D (и подпроекта 2 целиком)

**Files:** нет изменений кода — только живая браузерная проверка.

**Interfaces:** нет (финальная задача фазы и подпроекта 2).

- [ ] **Step 1: Запустить окружение**

Run: `docker compose up -d` (если ещё не подняты), `pnpm --filter api
start:dev`, `pnpm --filter client dev`.
Expected: API на `:3000`(или использующемся для ворктри порту), клиент —
на `:4200`.

- [ ] **Step 2: `/orders` — таблица с реальными заявками**

Через существующего тестового клиента (или новый SMS-OTP логин): создать
по одной срочной и плановой заявке (можно переиспользовать уже готовые
визарды `/order/new`/`/planned/new`), перейти на `/orders`. Убедиться:
обе заявки видны во вкладке «Активные» с правильными иконками режима/
категорией/статусом; клик по строке ведёт на `/order/:id` или
`/planned/:id` соответственно; после закрытия одной из заявок (или на уже
существующей закрытой заявке из Фаз B/C) — вкладка «История» показывает
её.

- [ ] **Step 3: `/profile` — редактирование, язык, навигация**

Перейти на `/profile`. Изменить имя (инлайн-редактирование), убедиться,
что оно сохранилось (перезагрузка страницы показывает новое имя).
Переключить язык на KK, затем EN, затем обратно на RU — кнопка активного
языка подсвечивается верно на каждом шаге (видимый текст остаётся
русским — ожидаемо, KK/EN — заглушки). Перейти по каждой из 4 ссылок
(адреса/платежи/уведомления/поддержка) — все резолвятся без 404.

- [ ] **Step 4: `/addresses` — полный CRUD + интеграция с визардом**

На `/addresses`: создать новый адрес (заполнить все поля формы, включая
подъезд/этаж/квартиру/комментарий, отметить «сделать основным») —
убедиться, что он появился в списке слева с ★. Отредактировать его текст
адреса — сохранить — убедиться, что список слева обновился. Создать
второй адрес, затем удалить первый — убедиться, что форма справа
переключилась на оставшийся адрес. Затем перейти на `/order/new` (визард
срочной заявки, шаг 3) — убедиться, что оставшийся адрес появляется
чипом быстрого выбора (сквозная интеграция с уже готовым кодом Фазы B).

- [ ] **Step 5: `/payments`, `/support` — визуальная проверка**

Открыть оба маршрута напрямую — контент отображается (заглушка платежей
с верным сообщением под текущий `commercialMode`, FAQ с 4 вопросами и
`tel:7666`-ссылкой), кнопка «назад» на `/support` ведёт на `/`, на
`/payments` — на `/profile`.

- [ ] **Step 6: Зафиксировать находки**

Если живая проверка выявит расхождение с бэкендом/планом — исправить
точечно (тот же процесс, что в Фазах A/B/C — эскалация находки, не
самостоятельный обход вне скоупа задачи) и повторить проверку
соответствующего шага. Это последняя задача последней фазы подпроекта 2
— по завершении зафиксировать в памяти сессии, что весь клиентский флоу
(Фазы A-D) реализован, отревьюен и живьём проверен целиком.
