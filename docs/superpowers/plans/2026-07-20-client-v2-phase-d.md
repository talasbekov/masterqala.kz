# Клиент v2 — Фаза D (финальная): история, профиль, адреса, вспомогательные экраны

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: superpowers:subagent-driven-development.

**Цель:** история заявок с вкладками (`/orders`), профиль с рабочим переключателем языка (`/profile`), полноценный CRUD сохранённых адресов (`/profile/addresses`), честная заглушка способов оплаты (`/profile/payments`), статичная поддержка (`/support`) — последняя фаза Цикла 2. Строго по прототипу (строки 623-833, 763-820 `Этап 5 - Клиент (mobile).dc.html`).

**Архитектура:** `/orders` и `/profile` **переезжают** из старого `Layout` в `AppShell` (теперь v2 конец-в-конец с таб-баром — все 5 таб-бар-маршрутов на новой теме). `/profile/addresses`, `/profile/payments`, `/support` — под старым `Layout` (drill-down без таб-бара, как `/order/:id/dispute`).

**Верификация:** нет фронтенд-тестов. Каждая задача — `pnpm --filter web build` + живая проверка контроллером после всех задач.

## Global Constraints

**API-контракты (сверены напрямую с кодом):**
- `GET /orders` (listMine) и `GET /planned-orders/mine` — уже используются старым кодом, те же формы ответа, что в Фазах B/C (`status`, `category:{name}`, `createdAt`, `calloutPrice`/`workPrice` для срочных, `budget`/`workPrice` для плановых, `master:{name}|null`).
- `GET /users/me` → `{id, phone, name, defaultAddress, role, masterProfile: {blockedUntil, status}|null}`. `PATCH /users/me` body `{name?, defaultAddress?}` — используется только для `name` (см. §2 ниже — `defaultAddress` больше не редактируется здесь, заменяется полноценным CRUD адресов).
- `GET/POST/PATCH/:id/DELETE/:id /addresses` — полный CRUD, поля `{label, address, entrance?, floor?, apartment?, comment?, lat?, lng?, isDefault?}`. `lat`/`lng` не собираются (нет карты на этом экране, как и в прототипе).
- `isTerminalStatus`/`isPlannedTerminalStatus`/`STATUS_LABELS`/`PLANNED_STATUS_LABELS`/`urgentStatusVariant`/`plannedStatusVariant` — переиспользуются из `apps/web/src/orderStatus.ts`, не дублируются.

**Переиспользуемое:** `apps/web/src/api.ts`, `apps/web/src/auth.tsx` (`useAuth`), `apps/web/src/features/client-v2/components/AppShell.tsx`/`BottomTabBar.tsx` (уже ссылаются на `/orders`/`/profile` — менять не нужно, меняется только оболочка в `App.tsx`).

**Токены/язык:** `c2`-префикс, весь текст через `useTranslation()`/`ru.json`, `verbatimModuleSyntax`/`noUnusedLocals`/`noUnusedParameters`. Try/catch + видимая ошибка на КАЖДОМ async-обработчике — обязательное правило с Фазы B, не опция.

**Осознанные отклонения от буквального прототипа (решения приняты, не TBD):**
- `detail` (просмотр закрытой заявки с логом событий) — не строится отдельно, история ведёт на уже готовые `/order/:id`/`/planned/:id`.
- `payments` — честная заглушка «скоро», не показывает несуществующие карты пользователя (решение пользователя).
- FAQ на `support` — только заголовки вопросов (в прототипе у них нет содержимого ответа, не выдумывается).
- `defaultAddress` больше не редактируется на `/profile` напрямую — полностью заменяется полноценным CRUD на `/profile/addresses` (консолидация, не потеря функциональности: раньше был один текстовый адрес, теперь — сколько угодно структурированных).

---

### Task 1: MyOrdersPage v2 — вкладки «Активные»/«История»

**Files:**
- Create: `apps/web/src/features/client-v2/pages/MyOrdersPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/MyOrdersPage.tsx`

Точные тексты — прототип строки 623-651.

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок:
```json
  "myOrders": {
    "title": "Мои заявки",
    "active": "Активные",
    "history": "История",
    "emptyActive": "Активных заявок нет",
    "emptyHistory": "История пуста"
  }
```

- [ ] **Step 2: Компонент**

`apps/web/src/features/client-v2/pages/MyOrdersPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import {
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  urgentStatusVariant,
  plannedStatusVariant,
  isTerminalStatus,
  isPlannedTerminalStatus,
} from '../../../orderStatus';

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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="text-[22px] font-extrabold text-c2-ink">{t('myOrders.title')}</div>
      <div className="flex rounded-c2-pill bg-c2-fill p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`flex-1 rounded-c2-pill py-2 text-[13px] font-extrabold ${
            tab === 'active' ? 'bg-c2-surface text-c2-ink shadow-c2-card' : 'text-c2-ink-soft'
          }`}
        >
          {t('myOrders.active')}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 rounded-c2-pill py-2 text-[13px] font-extrabold ${
            tab === 'history' ? 'bg-c2-surface text-c2-ink shadow-c2-card' : 'text-c2-ink-soft'
          }`}
        >
          {t('myOrders.history')}
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      {!loading && shown.length === 0 && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-6 text-center text-sm font-semibold text-c2-ink-soft">
          {tab === 'active' ? t('myOrders.emptyActive') : t('myOrders.emptyHistory')}
        </div>
      )}
      {shown.map((it) => {
        const label = it.kind === 'urgent' ? STATUS_LABELS[it.status] : PLANNED_STATUS_LABELS[it.status];
        const variant = it.kind === 'urgent' ? urgentStatusVariant(it.status) : plannedStatusVariant(it.status);
        const price = it.kind === 'urgent' ? (it.workPrice ?? it.calloutPrice) : (it.workPrice ?? it.budget);
        return (
          <Link
            key={it.id}
            to={it.kind === 'urgent' ? `/order/${it.id}` : `/planned/${it.id}`}
            className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-extrabold text-c2-ink">
                {it.kind === 'urgent' ? '⚡' : '📅'} {it.category?.name} · №{it.id.slice(0, 8)}
              </span>
              <span
                className={`shrink-0 rounded-c2-pill px-2.5 py-1 text-[10.5px] font-extrabold ${
                  variant === 'success'
                    ? 'bg-c2-success-bg text-c2-success-ink'
                    : variant === 'danger'
                      ? 'bg-c2-danger-bg text-c2-danger-ink'
                      : 'bg-c2-fill-soft text-c2-primary'
                }`}
              >
                {label}
              </span>
            </div>
            <div className="mt-1 text-xs text-c2-ink-soft">
              {new Date(it.createdAt).toLocaleDateString('ru-RU')}
              {price != null && ` · ${price} ₸`}
              {it.master?.name && ` · ${it.master.name}`}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Маршрут — переезд из Layout в AppShell**

В `App.tsx`: заменить `import MyOrdersPage from './pages/MyOrdersPage';` на `import MyOrdersPage from './features/client-v2/pages/MyOrdersPage';`. Перенести `<Route path="/orders" element={<MyOrdersPage />} />` из блока `<Route element={<Layout />}>` в блок `<Route element={<AppShell />}>` (рядом с `/`, `/notifications`, `/catalog`).

```bash
rm apps/web/src/pages/MyOrdersPage.tsx
```

- [ ] **Step 4: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: `/orders` показывает нижний таб-бар v2 (был бы виден старый стиль, если оболочка не переехала), вкладки переключаются, активная заявка (если есть) ведёт на `/order/:id`/`/planned/:id`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2/pages/MyOrdersPage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git rm apps/web/src/pages/MyOrdersPage.tsx
git commit -m "feat(web): MyOrdersPage v2 — вкладки Активные/История, переезд на AppShell"
```

---

### Task 2: ProfilePage v2 — рабочий переключатель языка

**Files:**
- Create: `apps/web/src/features/client-v2/pages/ProfilePage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`user`, `logout`), `api()`.

Точные тексты — прототип строки 763-785.

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок:
```json
  "profile": {
    "noName": "Без имени",
    "editName": "Изменить",
    "save": "Сохранить",
    "items": {
      "addresses": "Адреса",
      "payments": "Способы оплаты",
      "notifications": "Уведомления",
      "support": "Поддержка"
    },
    "becomeMasterTitle": "Стать мастером",
    "becomeMasterSubtitle": "Зарабатывайте на своих навыках — верификация за 1–2 дня.",
    "becomeMasterLink": "Подробнее",
    "wallet": "Кошелёк",
    "adminPanel": "Панель оператора",
    "logout": "Выйти из аккаунта",
    "blockedUntil": "Доступ к новым заявкам временно ограничен до {{date}}"
  }
```

- [ ] **Step 2: Компонент**

`apps/web/src/features/client-v2/pages/ProfilePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { useAuth } from '../../../auth';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS = [
  { icon: '📍', key: 'addresses', to: '/profile/addresses' },
  { icon: '💳', key: 'payments', to: '/profile/payments' },
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
  const navigate = useNavigate();
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
    navigate('/login');
  }

  const blocked = me?.masterProfile?.blockedUntil && new Date(me.masterProfile.blockedUntil) > new Date();

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-c2-primary text-lg font-extrabold text-white">
          {(me?.name || user?.phone || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface px-2.5 py-1.5 text-sm font-extrabold text-c2-ink outline-none"
                autoFocus
              />
              <button type="button" onClick={saveName} disabled={saving} className="shrink-0 text-sm font-extrabold text-c2-primary">
                {t('profile.save')}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block text-left">
              <span className="text-lg font-extrabold text-c2-ink">{me?.name || t('profile.noName')}</span>
              <span className="ml-1.5 text-xs font-bold text-c2-primary">{t('profile.editName')}</span>
            </button>
          )}
          <div className="text-xs font-semibold text-c2-ink-soft">{me?.phone ?? user?.phone}</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            className={`rounded-c2-pill border-[1.5px] px-3.5 py-1.5 text-xs font-extrabold ${
              i18n.language === l.code ? 'border-c2-primary bg-c2-primary text-white' : 'border-c2-border text-c2-ink-soft'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      {blocked && me?.masterProfile?.blockedUntil && (
        <div className="rounded-c2-md bg-c2-danger-bg p-3 text-xs font-semibold text-c2-danger-ink">
          {t('profile.blockedUntil', { date: new Date(me.masterProfile.blockedUntil).toLocaleDateString('ru-RU') })}
        </div>
      )}
      {PROFILE_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className="flex items-center justify-between rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5"
        >
          <span className="text-sm font-extrabold text-c2-ink">
            {item.icon} {t(`profile.items.${item.key}`)}
          </span>
          <span className="text-c2-ink-soft">›</span>
        </Link>
      ))}
      <div className="rounded-c2-lg bg-c2-fill p-3.5">
        <div className="text-sm font-extrabold text-c2-ink">🔧 {t('profile.becomeMasterTitle')}</div>
        <div className="mt-1 text-xs font-semibold leading-relaxed text-c2-on-fill">{t('profile.becomeMasterSubtitle')}</div>
        <Link to="/become-master" className="mt-2 inline-block text-xs font-extrabold text-c2-primary">
          {t('profile.becomeMasterLink')} →
        </Link>
      </div>
      <Link to="/wallet" className="text-center text-sm font-bold text-c2-primary underline">
        {t('profile.wallet')}
      </Link>
      {user?.role === 'OPERATOR' && (
        <Link to="/admin" className="text-center text-sm font-bold text-c2-primary underline">
          {t('profile.adminPanel')}
        </Link>
      )}
      <button type="button" onClick={doLogout} className="p-2 text-center text-[13.5px] font-extrabold text-c2-danger">
        {t('profile.logout')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Маршрут — переезд из Layout в AppShell**

В `App.tsx`: заменить `import ProfilePage from './pages/ProfilePage';` на `import ProfilePage from './features/client-v2/pages/ProfilePage';`. Перенести `<Route path="/profile" element={<ProfilePage />} />` из блока `Layout` в блок `AppShell`.

```bash
rm apps/web/src/pages/ProfilePage.tsx
```

- [ ] **Step 4: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: `/profile` под таб-баром v2; тап по имени → инлайн-редактирование → сохранение реально меняет `GET /users/me`; переключатель языка реально вызывает `i18n.changeLanguage` (проверить `i18n.language` в консоли после клика).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2/pages/ProfilePage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git rm apps/web/src/pages/ProfilePage.tsx
git commit -m "feat(web): ProfilePage v2 — рабочий переключатель языка, переезд на AppShell"
```

---

### Task 3: AddressesPage — полноценный CRUD

**Files:**
- Create: `apps/web/src/features/client-v2/pages/AddressesPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`

Точные тексты списка — прототип строки 787-803 (форма добавления/редактирования — новый элемент, в прототипе не показана детально, форма строится по образцу уже проверенных полей адреса из Фазы B).

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок:
```json
  "addresses": {
    "title": "Адреса",
    "addNew": "Добавить адрес",
    "empty": "Сохранённых адресов пока нет",
    "change": "изменить",
    "addTitle": "Новый адрес",
    "editTitle": "Изменить адрес",
    "labelPlaceholder": "Название (Дом, Работа…)",
    "addressPlaceholder": "Адрес",
    "entrance": "Подъезд",
    "floor": "Этаж",
    "apartment": "Квартира",
    "commentPlaceholder": "Комментарий",
    "setDefault": "Сделать основным",
    "save": "Сохранить",
    "delete": "Удалить"
  }
```

- [ ] **Step 2: Компонент**

`apps/web/src/features/client-v2/pages/AddressesPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';

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
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => api('/addresses').then(setAddresses).catch((e) => setError((e as Error).message));

  useEffect(() => {
    load();
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
        await api('/addresses', { method: 'POST', body });
      } else if (editingId) {
        await api(`/addresses/${editingId}`, { method: 'PATCH', body });
      }
      setEditingId(null);
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
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (editingId) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setEditingId(null)} className="text-xl text-c2-primary">
            ←
          </button>
          <span className="text-lg font-extrabold text-c2-ink">
            {editingId === 'new' ? t('addresses.addTitle') : t('addresses.editTitle')}
          </span>
        </div>
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder={t('addresses.labelPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder={t('addresses.addressPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            value={form.entrance}
            onChange={(e) => setForm({ ...form, entrance: e.target.value })}
            placeholder={t('addresses.entrance')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
            placeholder={t('addresses.floor')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={form.apartment}
            onChange={(e) => setForm({ ...form, apartment: e.target.value })}
            placeholder={t('addresses.apartment')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
        </div>
        <input
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder={t('addresses.commentPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-c2-ink">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          {t('addresses.setDefault')}
        </label>
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={save}
          disabled={submitting || !form.label || !form.address}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('addresses.save')}
        </button>
        {editingId !== 'new' && (
          <button
            type="button"
            onClick={() => remove(editingId)}
            className="rounded-c2-pill border-[1.5px] border-c2-danger p-3 text-sm font-extrabold text-c2-danger"
          >
            {t('addresses.delete')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/profile')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="text-xl font-extrabold text-c2-ink">{t('addresses.title')}</span>
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      {addresses.length === 0 && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-6 text-center text-sm font-semibold text-c2-ink-soft">
          {t('addresses.empty')}
        </div>
      )}
      {addresses.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => startEdit(a)}
          className="rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-c2-ink">
              {a.label} {a.isDefault && '★'}
            </span>
            <span className="text-xs font-extrabold text-c2-primary">{t('addresses.change')}</span>
          </div>
          <div className="mt-0.5 text-xs text-c2-ink-soft">
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
        className="rounded-c2-md border-[1.5px] border-dashed border-c2-primary p-3.5 text-center text-sm font-extrabold text-c2-primary"
      >
        ＋ {t('addresses.addNew')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Маршрут**

В `App.tsx`: добавить `import AddressesPage from './features/client-v2/pages/AddressesPage';` и `<Route path="/profile/addresses" element={<AddressesPage />} />` в блок `Layout`.

- [ ] **Step 4: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: создать адрес, отредактировать, удалить — все три операции реально меняют `GET /addresses`; проверить, что новый адрес появляется как чип быстрого выбора в визарде срочной заявки (Фаза B), подтверждая сквозную интеграцию.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2/pages/AddressesPage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git commit -m "feat(web): AddressesPage — первый полноценный CRUD для /addresses"
```

---

### Task 4: SupportPage + PaymentsPage

**Files:**
- Create: `apps/web/src/features/client-v2/pages/SupportPage.tsx`
- Create: `apps/web/src/features/client-v2/pages/PaymentsPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`

Точные тексты — прототип строки 731-743 (support), 805-820 (payments, с осознанным отклонением — без выдуманных карт, см. Global Constraints).

- [ ] **Step 1: Переводы**

В `ru.json`, новые блоки:
```json
  "support": {
    "title": "Поддержка",
    "call": "📞 Позвонить: 7666 (бесплатно)",
    "faqTitle": "Частые вопросы",
    "faq1": "Из чего складывается цена срочного вызова?",
    "faq2": "Что будет, если я отклоню цену мастера?",
    "faq3": "Как работает выбор мастера в плановой заявке?",
    "faq4": "Как открыть спор и что он даёт?"
  },
  "payments": {
    "title": "Способы оплаты",
    "comingSoon": "Управление способами оплаты скоро появится",
    "note": "Выезд резервируется при создании заявки и списывается только после принятия мастером. Работы оплачиваются после вашего подтверждения."
  }
```

- [ ] **Step 2: SupportPage**

`apps/web/src/features/client-v2/pages/SupportPage.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SupportPage() {
  const { t } = useTranslation();
  const faq = [t('support.faq1'), t('support.faq2'), t('support.faq3'), t('support.faq4')];

  return (
    <div className="flex flex-col gap-2.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link to="/" className="text-xl text-c2-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-c2-ink">{t('support.title')}</span>
      </div>
      <a
        href="tel:7666"
        className="flex items-center justify-between rounded-c2-md bg-c2-primary p-4 text-[14.5px] font-extrabold text-white"
      >
        {t('support.call')} <span>›</span>
      </a>
      <div className="mt-1 text-[13.5px] font-extrabold text-c2-ink">{t('support.faqTitle')}</div>
      {faq.map((q) => (
        <div
          key={q}
          className="flex items-center justify-between rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5"
        >
          <span className="text-[13px] font-bold leading-snug text-c2-ink">{q}</span>
          <span className="text-c2-ink-soft">›</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: PaymentsPage**

`apps/web/src/features/client-v2/pages/PaymentsPage.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PaymentsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link to="/profile" className="text-xl text-c2-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-c2-ink">{t('payments.title')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">💳</div>
        <div className="text-base font-extrabold text-c2-ink">{t('payments.comingSoon')}</div>
        <p className="max-w-[260px] text-xs leading-relaxed text-c2-ink-soft">{t('payments.note')}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Маршруты**

В `App.tsx`:
- Добавить `import SupportPage from './features/client-v2/pages/SupportPage';` и `import PaymentsPage from './features/client-v2/pages/PaymentsPage';`.
- **Заменить** `<Route path="/support" element={<Navigate to="/" replace />} />` (временная заглушка из Фазы A) на `<Route path="/support" element={<SupportPage />} />`.
- Добавить `<Route path="/profile/payments" element={<PaymentsPage />} />` в блок `Layout` (рядом с `/profile/addresses`).

- [ ] **Step 5: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка: `/support` показывает реальный экран (не редирект на главную), `/profile/payments` показывает заглушку без выдуманных карт.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/client-v2/pages/SupportPage.tsx apps/web/src/features/client-v2/pages/PaymentsPage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git commit -m "feat(web): SupportPage (заменяет заглушку-редирект) + PaymentsPage (честная заглушка «скоро»)"
```

---

## После завершения всех задач (контроллер)

1. `pnpm --filter web build` + `pnpm --filter api build`.
2. Живая браузерная проверка: полный обход таб-бара (Главная→Заявки→Профиль, все теперь на `AppShell`/v2), история с вкладками, CRUD адресов целиком, поддержка, заглушка оплаты, переключатель языка.
3. Финальный whole-branch review (opus) диапазона коммитов Фазы D.
4. Финальный **whole-cycle** review — Цикл 2 (все 4 фазы, диапазон от начала Фазы A до конца Фазы D) — раз это последняя фаза, стоит одна сквозная проверка целиком, не только диапазона Фазы D.
5. Обновить память проекта и `.superpowers/sdd/progress.md` — Цикл 2 полностью завершён.
