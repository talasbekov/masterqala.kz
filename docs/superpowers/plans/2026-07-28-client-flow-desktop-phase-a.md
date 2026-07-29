# Клиентский флоу (десктоп) — Фаза A: шелл + auth + главная + каталог

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать новый workspace-пакет `apps/client` (Next.js 15) с рабочим
входом по SMS-коду, десктопным шеллом (левый сайдбар) и первыми двумя
экранами (главная, каталог категорий) — первая из 4 фаз подпроекта 2.

**Architecture:** Гибрид RSC-шелл + клиентский контент: корневой
`app/layout.tsx` и `app/(app)/layout.tsx` — Server Components (статичная
структура, сайдбар), все страницы и интерактивные части (`Sidebar` — из-за
`useTranslation`, `NavLink`, `AuthGuard`, сами страницы) — `'use client'`.
Авторизация — JWT в `localStorage`, тот же паттерн, что в `apps/web`
(`useAuth()`-хук + гард-компонент), без серверного middleware. Бизнес-логика
и вёрстка страниц переносятся из `apps/web/src/features/client-v2` с
минимальными правками под Next.js (react-router → next/navigation,
`import.meta.env` → `process.env`, SSR-safe чтение `localStorage`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4,
`react-i18next`/`i18next`, `socket.io-client`, `@masterqala/ui` (только
`tokens.css`).

## Global Constraints

- Бэкенд (`apps/api`) не меняется — используются только существующие
  эндпоинты (`POST /auth/request-code`, `POST /auth/verify-code`,
  `GET /categories`, `GET /orders/active`, `GET /config/public`,
  Socket.IO `order:status`).
- Юнит/компонентных тестов на фронте не пишем (осознанная практика проекта,
  см. `docs/superpowers/specs/2026-07-28-client-flow-desktop-design.md`) —
  верификация каждой задачи через `pnpm --filter client build` и (где
  применимо) живую проверку в браузере через дев-сервер.
- Каждый перенесённый файл сверяется с оригиналом в
  `apps/web/src/features/client-v2/` — правки только там, где того требует
  Next.js (роутинг, SSR), логика и вёрстка не меняются в этой фазе.
- Импорты внутри `apps/client` — через alias `@/...` (как в `apps/site`), не
  относительные пути.
- Ссылки на ещё не перенесённые маршруты (`/order/new`, `/planned/new`,
  `/support`, `/orders`, `/profile`, `/notifications`) в этой фазе намеренно
  ведут в никуда (404) — они появятся в фазах B/C/D. Это ожидаемое переходное
  состояние, не баг (прецедент — Фаза A цикла «клиент v2» в `apps/web`).

---

### Task 1: Scaffold `apps/client` (пустой Next.js пакет)

**Files:**
- Create: `apps/client/package.json`
- Create: `apps/client/next.config.ts`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/postcss.config.mjs`
- Create: `apps/client/next-env.d.ts`
- Create: `apps/client/app/globals.css`
- Create: `apps/client/app/layout.tsx`
- Create: `apps/client/app/page.tsx`

**Interfaces:**
- Produces: workspace-пакет `client` (`pnpm --filter client <script>`),
  alias `@/*` → корень `apps/client`, глобальные токены из
  `@masterqala/ui/tokens.css` доступны как CSS-переменные (`--color-primary`
  и т.д.) и Tailwind-классы (`bg-primary`, `text-ink` и т.п. — уже
  сконфигурированы в `packages/ui` через `@theme`).

- [ ] **Step 1: Создать `apps/client/package.json`**

```json
{
  "name": "client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 4200",
    "build": "next build",
    "start": "next start -p 4200"
  },
  "dependencies": {
    "@masterqala/ui": "workspace:*",
    "i18next": "^26.3.6",
    "next": "^15.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-i18next": "^17.0.10",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.2",
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.3.2",
    "typescript": "~6.0.2"
  }
}
```

- [ ] **Step 2: Создать `apps/client/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Создать `apps/client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Создать `apps/client/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 5: Создать `apps/client/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 6: Создать `apps/client/app/globals.css`**

```css
@import "tailwindcss";
@import "@masterqala/ui/tokens.css";
@source "../app";
@source "../components";
@source "../lib";

body {
  background: var(--color-background);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 7: Создать временный `apps/client/app/layout.tsx` (будет заменён в Task 3)**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala — личный кабинет',
  description: 'Заказ услуг мастера на дом',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Создать временный `apps/client/app/page.tsx` (будет заменён в Task 5)**

```tsx
export default function Placeholder() {
  return <div className="p-6">apps/client scaffold OK</div>;
}
```

- [ ] **Step 9: Установить зависимости и собрать**

Run: `pnpm install && pnpm --filter client build`
Expected: сборка проходит без ошибок, в выводе — маршрут `/`.

- [ ] **Step 10: Commit**

```bash
git add apps/client pnpm-lock.yaml
git commit -m "feat(client): каркас Next.js-приложения apps/client"
```

---

### Task 2: Общие клиентские модули (`lib/`)

Переносит из `apps/web/src` не-UI логику, нужную главной/каталогу/логину:
API-клиент, сокет, авторизация, коммерческий режим, метаданные категорий,
статусные лейблы, i18n. Правки минимальны и только там, где Next.js SSR
требует иного (см. ниже по каждому файлу).

**Files:**
- Create: `apps/client/lib/api.ts`
- Create: `apps/client/lib/socket.ts`
- Create: `apps/client/lib/auth.tsx`
- Create: `apps/client/lib/commercial-mode.tsx`
- Create: `apps/client/lib/categoryMeta.ts`
- Create: `apps/client/lib/orderStatus.ts`
- Create: `apps/client/lib/i18n.ts`
- Create: `apps/client/lib/locales/ru.json`
- Create: `apps/client/lib/locales/kk.json`
- Create: `apps/client/lib/locales/en.json`

**Interfaces:**
- Produces: `api(path, options?)`, `apiUpload` — НЕ переносится в этой фазе
  (нужен только `NewOrderPage` в Фазе B, YAGNI); `getSocket()`,
  `resetSocket()`; `AuthProvider`, `useAuth()` → `{ user: AuthUser | null,
  login(token, user), logout() }`; `CommercialModeProvider`,
  `useCommercialMode()` → `CommercialConfig`; `categoryMeta(slug)` →
  `{ icon, subtitle }`; `STATUS_LABELS`, `PLANNED_STATUS_LABELS` и весь
  остальной экспорт `orderStatus.ts` (используется целиком последующими
  фазами, переносится одним файлом); default export `i18n`-инстанс.
- Consumes: ничего (это базовый слой).

- [ ] **Step 1: Создать `apps/client/lib/api.ts`**

Порт `apps/web/src/api.ts` без `apiUpload`/`waitForUploadScan` (не нужны до
Фазы B) и с заменой Vite-переменной окружения на Next.js:

```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Ошибка ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  return handle(res);
}
```

- [ ] **Step 2: Создать `apps/client/lib/socket.ts`**

Порт `apps/web/src/socket.ts`, та же замена переменной окружения:

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(
      /\/api\/v1$/,
      '',
    );
    socket = io(base, { auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : null } });
  }
  return socket;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

- [ ] **Step 3: Создать `apps/client/lib/auth.tsx`**

Порт `apps/web/src/auth.tsx`. Next.js рендерит клиентские компоненты один
раз на сервере (SSR) перед гидратацией — там `localStorage` недоступен,
поэтому чтение обёрнуто в проверку `typeof window`. Ленивый инициализатор
`useState` всё равно подхватывает реальное значение сразу при гидратации на
клиенте (без асинхронного `useEffect` и без гонки с `AuthGuard` из Task 3) —
это единственное отличие от оригинала:

```tsx
'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { resetSocket } from './socket';

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'CLIENT' | 'OPERATOR';
}

interface AuthCtx {
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const login = (token: string, u: AuthUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.clear();
    resetSocket();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
```

- [ ] **Step 4: Создать `apps/client/lib/commercial-mode.tsx`**

Порт `apps/web/src/commercial-mode.tsx` без изменений логики, добавлена
`'use client'`:

```tsx
'use client';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';

export interface CommercialConfig {
  commercialMode: CommercialMode;
  paymentsEnabled: boolean;
  leadCreditsEnabled: boolean;
  payoutsEnabled: boolean;
}

const SAFE_DEFAULT: CommercialConfig = {
  commercialMode: 'FREE_PILOT',
  paymentsEnabled: false,
  leadCreditsEnabled: false,
  payoutsEnabled: false,
};

const CommercialModeContext = createContext<CommercialConfig>(SAFE_DEFAULT);

export function CommercialModeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CommercialConfig>(SAFE_DEFAULT);

  useEffect(() => {
    api('/config/public')
      .then((value) => setConfig(value as CommercialConfig))
      .catch(() => setConfig(SAFE_DEFAULT));
  }, []);

  return <CommercialModeContext.Provider value={config}>{children}</CommercialModeContext.Provider>;
}

export function useCommercialMode() {
  return useContext(CommercialModeContext);
}
```

- [ ] **Step 5: Создать `apps/client/lib/categoryMeta.ts`**

Копия `apps/web/src/features/client-v2/categoryMeta.ts` без изменений:

```ts
interface CategoryMeta {
  icon: string;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { icon: '🔧', subtitle: 'течи, засоры, смесители' },
  electrics: { icon: '⚡', subtitle: 'розетки, проводка, свет' },
  appliances: { icon: '🧊', subtitle: 'стиральные, холодильники' },
  locksmith: { icon: '🔐', subtitle: 'вскрытие, замена, установка' },
  handyman: { icon: '🔨', subtitle: 'полки, карнизы, мебель' },
  other: { icon: '🧹', subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { icon: '🛠️', subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
```

- [ ] **Step 6: Создать `apps/client/lib/orderStatus.ts`**

Копия `apps/web/src/orderStatus.ts` без изменений (используется целиком в
Фазах A-C, но переносится одним файлом сейчас — расщеплять по фазам не
имеет смысла, это плоский набор констант):

```ts
export type StatusVariant = 'info' | 'active' | 'success' | 'danger';

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

export const STEPPER_STEPS = [
  { status: 'ACCEPTED', label: 'Принята' },
  { status: 'MASTER_ON_WAY', label: 'Мастер в пути' },
  { status: 'INSPECTION', label: 'Осмотр' },
  { status: 'AWAITING_PRICE_CONFIRM', label: 'Согласование цены' },
  { status: 'IN_PROGRESS', label: 'В работе' },
  { status: 'DONE', label: 'Выполнена' },
  { status: 'CLOSED', label: 'Закрыта' },
];

export function isTerminalStatus(s: string): boolean {
  return ['CLOSED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}

export const WAVE_TEXTS: Record<number, string> = {
  0: 'Начинаем поиск…',
  1: 'Ищем мастера в радиусе 3 км…',
  2: 'Расширяем поиск до 6 км…',
  3: 'Расширяем поиск до 10 км…',
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

export function isPlannedTerminalStatus(s: string): boolean {
  return ['CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}

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
  DISPUTE: 'danger',
};

export function urgentStatusVariant(status: string): StatusVariant {
  return URGENT_VARIANTS[status] ?? 'info';
}

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
  DISPUTE: 'danger',
};

export function plannedStatusVariant(status: string): StatusVariant {
  return PLANNED_VARIANTS[status] ?? 'info';
}
```

- [ ] **Step 7: Скопировать локали**

Скопировать файл-в-файл (без изменений):
- `apps/web/src/features/client-v2/i18n/locales/ru.json` →
  `apps/client/lib/locales/ru.json`
- `apps/web/src/features/client-v2/i18n/locales/kk.json` →
  `apps/client/lib/locales/kk.json` (содержимое — пустой объект `{}`)
- `apps/web/src/features/client-v2/i18n/locales/en.json` →
  `apps/client/lib/locales/en.json` (содержимое — пустой объект `{}`)

Run: `cp apps/web/src/features/client-v2/i18n/locales/ru.json apps/client/lib/locales/ru.json && cp apps/web/src/features/client-v2/i18n/locales/kk.json apps/client/lib/locales/kk.json && cp apps/web/src/features/client-v2/i18n/locales/en.json apps/client/lib/locales/en.json`

- [ ] **Step 8: Создать `apps/client/lib/i18n.ts`**

Порт `apps/web/src/features/client-v2/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import kk from './locales/kk.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 9: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок (модули `lib/*` пока никем не
импортируются кроме друг друга — ошибок типов быть не должно).

- [ ] **Step 10: Commit**

```bash
git add apps/client/lib
git commit -m "feat(client): перенести общие модули (api, auth, socket, i18n, статусы)"
```

---

### Task 3: RSC-шелл — провайдеры, сайдбар, гард авторизации

**Files:**
- Create: `apps/client/components/Providers.tsx`
- Create: `apps/client/components/NavLink.tsx`
- Create: `apps/client/components/Sidebar.tsx`
- Create: `apps/client/components/AuthGuard.tsx`
- Modify: `apps/client/app/layout.tsx` (заменить временную версию из Task 1)
- Create: `apps/client/app/(auth)/layout.tsx`
- Create: `apps/client/app/(app)/layout.tsx`
- Modify: `apps/client/app/page.tsx` → перенести в `apps/client/app/(app)/page.tsx` (пустая заглушка, реальный контент — Task 5)

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth()`, `CommercialModeProvider` из Task 2
  (`@/lib/auth`, `@/lib/commercial-mode`), побочный импорт `@/lib/i18n`.
- Produces: `Providers` (обёртка над `children`), `NavLink({ href, children
  })`, `Sidebar()` (использует `NavLink`), `AuthGuard({ children })` —
  рендерит `children` только когда `useAuth().user` не `null`, иначе
  редиректит на `/login`.

- [ ] **Step 1: Создать `apps/client/components/Providers.tsx`**

```tsx
'use client';
import type { ReactNode } from 'react';
import '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { CommercialModeProvider } from '@/lib/commercial-mode';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CommercialModeProvider>
      <AuthProvider>{children}</AuthProvider>
    </CommercialModeProvider>
  );
}
```

- [ ] **Step 2: Создать `apps/client/components/NavLink.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
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
      {children}
    </Link>
  );
}
```

- [ ] **Step 3: Создать `apps/client/components/Sidebar.tsx`**

Список пунктов меню — статичный (не зависит от данных пользователя),
`useTranslation` требует клиентского контекста, поэтому весь компонент —
`'use client'`. `/order/new`, `/notifications`, `/orders`, `/profile`
появятся в фазах B/D — пункты меню уже ведут на будущие маршруты (404 до
соответствующей фазы, ожидаемо):

```tsx
'use client';
import { useTranslation } from 'react-i18next';
import { NavLink } from './NavLink';

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="⌂">
        {t('tabs.home')}
      </NavLink>
      <NavLink href="/catalog" icon="🗂️">
        {t('catalog.title')}
      </NavLink>
      <NavLink href="/orders" icon="☰">
        {t('tabs.orders')}
      </NavLink>
      <NavLink href="/order/new" icon="＋">
        {t('home.urgentButton')}
      </NavLink>
      <NavLink href="/notifications" icon="🔔">
        {t('tabs.notifications')}
      </NavLink>
      <NavLink href="/profile" icon="◉">
        {t('tabs.profile')}
      </NavLink>
    </aside>
  );
}
```

- [ ] **Step 4: Создать `apps/client/components/AuthGuard.tsx`**

Рендерит `null` на первом рендере и на сервере (без флеша неавторизованного
контента, без гидрационного мисматча), затем после монтирования либо
показывает `children`, либо редиректит на `/login`:

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [user, router]);

  if (!checked) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;
  return <>{children}</>;
}
```

- [ ] **Step 5: Заменить `apps/client/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala — личный кабинет',
  description: 'Заказ услуг мастера на дом',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Создать `apps/client/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 7: Создать `apps/client/app/(app)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Перенести заглушку главной под `(app)`**

Run: `mkdir -p "apps/client/app/(app)" && git mv apps/client/app/page.tsx "apps/client/app/(app)/page.tsx"`

- [ ] **Step 9: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/` теперь рендерится внутри
`(app)`-группы.

- [ ] **Step 10: Commit**

```bash
git add apps/client
git commit -m "feat(client): RSC-шелл — сайдбар, гард авторизации, провайдеры"
```

---

### Task 4: Страница входа (`/login`)

**Files:**
- Create: `apps/client/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`), `useAuth` (`@/lib/auth`).
- Produces: маршрут `/login`, вызывает `login(token, user)` из
  `useAuth()` при успехе — используется `AuthGuard` (Task 3) и всеми
  дальнейшими фазами неявно (через `useAuth().user`).

- [ ] **Step 1: Создать `apps/client/app/(auth)/login/page.tsx`**

Порт `apps/web/src/features/client-v2/pages/LoginPage.tsx`: `useNavigate` →
`useRouter` из `next/navigation`, `navigate('/')` → `router.push('/')`,
остальная логика/вёрстка — без изменений:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('splash');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'splash') return;
    const timer = setTimeout(() => setStep('phone'), 1200);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'sms' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);

  const normalizedPhone = `+7${phone.replace(/\D/g, '').slice(-10)}`;

  async function requestCode() {
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone }) });
      setResendIn(60);
      setStep('sms');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    setError('');
    setSubmitting(true);
    try {
      const res = await api('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      login(res.accessToken, res.user);
      router.push('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'splash') {
    return (
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="flex min-h-screen w-full flex-col items-center justify-center gap-4.5 bg-primary"
      >
        <div className="flex h-22 w-22 items-center justify-center rounded-lg bg-white text-4xl font-extrabold text-primary">
          M
        </div>
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala</div>
        <div className="text-sm text-fill">{t('auth.splashTagline')}</div>
        <div className="mt-3 h-6.5 w-6.5 animate-spin rounded-full border-[3px] border-fill border-t-white" />
      </button>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3.5 bg-background px-6 py-5.5">
      {step === 'sms' && (
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="self-start text-sm font-extrabold text-primary"
        >
          ← {t('auth.changeNumber')}
        </button>
      )}

      {step === 'phone' && (
        <>
          <div className="mt-6 text-[26px] font-extrabold leading-tight text-ink">{t('auth.phoneTitle')}</div>
          <div className="text-sm text-ink-soft">{t('auth.phoneSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 rounded-md border-[1.5px] border-border bg-surface px-4 py-3.5">
            <span className="text-[17px] font-extrabold text-ink">+7</span>
            <input
              className="flex-1 bg-transparent text-[17px] font-bold text-ink outline-none placeholder:text-muted"
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="text-xs leading-normal text-ink-soft">
            {t('auth.termsPrefix')} <span className="font-bold text-primary">{t('auth.termsLink')}</span>
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={requestCode}
            disabled={submitting || phone.replace(/\D/g, '').length < 10}
            className="rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.getCodeButton')}
          </button>
        </>
      )}

      {step === 'sms' && (
        <>
          <div className="mt-2.5 text-[26px] font-extrabold leading-tight text-ink">{t('auth.smsTitle')}</div>
          <div className="text-sm text-ink-soft">{t('auth.smsSubtitle', { phone: `+7 ${phone}` })}</div>
          <div className="relative mt-2 w-fit" onClick={() => codeInputRef.current?.focus()}>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`flex h-14 w-10 items-center justify-center rounded-md border-[1.5px] bg-surface text-xl font-extrabold text-ink ${
                    code[i] ? 'border-primary' : 'border-border'
                  }`}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="absolute inset-0 opacity-0"
            />
          </div>
          <div className="text-[13px] text-ink-soft">
            {resendIn > 0 ? (
              t('auth.resendIn', { time: formatTime(resendIn) })
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-primary">
                {t('auth.resendNow')}
              </button>
            )}
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={verify}
            disabled={submitting || code.length < 6}
            className="rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.loginButton')}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, появляется маршрут `/login`.

- [ ] **Step 3: Commit**

```bash
git add apps/client/app/\(auth\)/login
git commit -m "feat(client): страница входа /login"
```

---

### Task 5: Главная и каталог (`/`, `/catalog`)

**Files:**
- Modify: `apps/client/app/(app)/page.tsx` (заменить заглушку из Task 3)
- Create: `apps/client/app/(app)/catalog/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`), `useAuth` (`@/lib/auth`),
  `useCommercialMode` (`@/lib/commercial-mode`), `getSocket` (`@/lib/socket`),
  `STATUS_LABELS` (`@/lib/orderStatus`), `categoryMeta` (`@/lib/categoryMeta`).
- Produces: маршруты `/` и `/catalog`, оба используют `GET /categories`
  (форма ответа: `{ id: string; slug: string; name: string }[]`).

- [ ] **Step 1: Заменить `apps/client/app/(app)/page.tsx`**

Порт `apps/web/src/features/client-v2/pages/HomePage.tsx`: `useNavigate` →
`useRouter`, `Link to=` → `Link href=` из `next/link`, остальное без
изменений:

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCommercialMode } from '@/lib/commercial-mode';
import { getSocket } from '@/lib/socket';
import { STATUS_LABELS } from '@/lib/orderStatus';
import { categoryMeta } from '@/lib/categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ActiveOrder {
  id: string;
  status: string;
  category: { name: string } | null;
}

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { paymentsEnabled } = useCommercialMode();
  const router = useRouter();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api('/categories').then(setCategories);
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-extrabold text-ink">
          {t('home.greeting', { name: user?.name ?? t('home.guestName') })}
        </div>
        <Link
          href="/support"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-base"
        >
          ?
        </Link>
      </div>

      {order && (
        <button
          type="button"
          onClick={() => router.push(`/order/${order.id}`)}
          className="flex items-center gap-3 rounded-lg bg-primary p-4 text-left"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-fill text-[13px] font-extrabold text-ink">
            {order.category?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-white">{order.category?.name}</div>
            <div className="truncate text-xs font-semibold text-fill">{STATUS_LABELS[order.status]}</div>
          </div>
          <span className="text-lg text-fill">›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => router.push('/order/new')}
        className="rounded-lg border-2 border-primary bg-surface p-4 text-left shadow-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-ink">⚡ {t('home.urgentTitle')}</span>
          <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-primary">
            {t('home.urgentEta')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">
          {paymentsEnabled
            ? t('home.urgentDescription')
            : 'Найдём ближайшего мастера. Выезд бесплатный, стоимость работ подтвердите после осмотра и оплатите мастеру напрямую.'}
        </div>
        <div className="mt-2.5 rounded-pill bg-primary p-2.5 text-center text-sm font-extrabold text-white">
          {t('home.urgentButton')}
        </div>
      </button>

      <Link
        href="/planned/new"
        className="rounded-lg border-2 border-border bg-surface p-4 text-left shadow-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-ink">📅 {t('home.plannedTitle')}</span>
          <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-primary">
            {t('home.plannedBadge')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">{t('home.plannedDescription')}</div>
        <div className="mt-2.5 rounded-pill border-[1.5px] border-primary p-2.5 text-center text-sm font-extrabold text-primary">
          {t('home.plannedButton')}
        </div>
      </Link>

      {categories.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold text-ink">{t('home.categoriesTitle')}</span>
            <Link href="/catalog" className="text-[12.5px] font-extrabold text-primary">
              {t('home.categoriesAll')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => {
              const meta = categoryMeta(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push('/order/new')}
                  className="rounded-md border border-border bg-surface px-1.5 py-3 text-center"
                >
                  <div className="mb-1 text-xl">{meta.icon}</div>
                  <div className="text-[11.5px] font-bold text-ink">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-md bg-fill px-3.5 py-3">
        <span className="text-lg">🛡️</span>
        <div className="text-xs font-semibold leading-snug text-ink">
          {paymentsEnabled
            ? t('home.trustBanner')
            : 'Все мастера проходят проверку документов. В пилоте расчёт происходит напрямую с мастером; при проблеме доступны спор и поддержка.'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Создать `apps/client/app/(app)/catalog/page.tsx`**

Порт `apps/web/src/features/client-v2/pages/CatalogPage.tsx`: `useNavigate`
→ `useRouter`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api('/categories').then(setCategories);
  }, []);

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.push('/')} className="text-xl text-primary">
          ←
        </button>
        <span className="text-xl font-extrabold text-ink">{t('catalog.title')}</span>
      </div>
      <div className="rounded-md border-[1.5px] border-border bg-surface px-3.5 py-3 text-sm text-muted">
        {t('catalog.searchPlaceholder')}
      </div>
      {categories.map((c) => {
        const meta = categoryMeta(c.slug);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push('/order/new')}
            className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3.5 text-left"
          >
            <span className="text-xl">{meta.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-extrabold text-ink">{c.name}</div>
              <div className="text-[11.5px] text-ink-soft">{meta.subtitle}</div>
            </div>
            <span className="text-ink-soft">›</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршруты `/`, `/catalog`, `/login`
все присутствуют в выводе `next build`.

- [ ] **Step 4: Commit**

```bash
git add "apps/client/app/(app)"
git commit -m "feat(client): главная и каталог категорий"
```

---

### Task 6: Сквозная проверка Фазы A

**Files:**
- Modify: `.claude/launch.json` (добавить конфигурацию дев-сервера
  `apps/client` для текущего ворктри, по образцу уже существующих
  `relaxed-api`/`relaxed-web`)

**Interfaces:**
- Consumes: всё из Task 1-5.
- Produces: ничего нового в коде — финальная живая проверка перед тем, как
  считать Фазу A завершённой.

- [ ] **Step 1: Добавить конфигурацию дев-сервера в `.claude/launch.json`**

Добавить в массив `configurations` (рядом с существующими `relaxed-api`/
`relaxed-web`, тот же абсолютный путь текущего ворктри, порт `4200` — не
занят другими записями в этом файле):

```json
{
  "name": "relaxed-client",
  "runtimeExecutable": "bash",
  "runtimeArgs": [
    "-c",
    "cd '/home/erda/Музыка/MasterQala.kz/.claude/worktrees/relaxed-pike-c226a7/apps/client' && NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npx next dev -p 4200"
  ],
  "port": 4200
}
```

- [ ] **Step 2: Запустить `relaxed-api` и `relaxed-client` через preview-тул**

Убедиться, что оба поднялись (используйте уже известный обход из
`preview-tool-worktree-quirks`, если `preview_click`/`preview_screenshot`
не срабатывают в этой среде — прямой `fetch()`/`preview_snapshot`).

- [ ] **Step 3: Пройти логин живьём**

- Открыть `http://localhost:4200/login` — дождаться сплэша, ввести номер,
  нажать «Получить код».
- Прочитать 6-значный код из логов `relaxed-api` (поиск по `SMS`).
- Ввести код, нажать «Войти» — ожидается редирект на `/`.

- [ ] **Step 4: Проверить главную и каталог**

- На `/` — приветствие с именем/«Гость», карточки «Срочно»/«Запланировать»,
  сетка категорий (реальные данные с `GET /categories`).
- Кликнуть категорию в сайдбаре («Каталог») — маршрут `/catalog` открывает
  список категорий с иконками/подзаголовками.
- Убедиться, что активный пункт сайдбара подсвечивается (`bg-fill-soft
  text-primary`) на `/` и на `/catalog` соответственно.

- [ ] **Step 5: Проверить гард авторизации**

- Открыть `/` в новой приватной вкладке без токена в `localStorage` —
  ожидается редирект на `/login` (без флеша содержимого главной).

- [ ] **Step 6: Commit**

```bash
git add .claude/launch.json
git commit -m "chore(client): dev-конфигурация для сквозной проверки Фазы A"
```
