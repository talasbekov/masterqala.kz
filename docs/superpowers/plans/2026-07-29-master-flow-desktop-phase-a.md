# Флоу мастера (десктоп) — Фаза 1: каркас + анкета — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Стоять новый workspace-пакет `apps/master` (Next.js 15) с рабочим
SMS-OTP входом, десктопным шеллом (сайдбар), анкетой/верификацией мастера
и шелл-уровневой инфраструктурой приёма срочных офферов (presence + overlay,
без вызова реальных экшенов над заявкой — это Фаза 2).

**Architecture:** Точная копия паттерна `apps/client` (RSC корневой layout +
все страницы `'use client'`, JWT в `localStorage`, клиентский `AuthGuard`,
`api()`/`apiUpload()`/`getSocket()` из `lib/`), без i18n-инфраструктуры —
исходные мобильные экраны мастера (`WorkPage`/`BecomeMasterPage`/
`LeadCreditsPage`/`WalletPage` в `apps/web`) не используют `react-i18next`
вообще, поэтому и десктопная версия остаётся на хардкод RU-строках.
Бэкенд (`apps/api`) не меняется — используются уже существующие эндпоинты
и сокет-события.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
(`@masterqala/ui/tokens.css`), `socket.io-client`.

## Global Constraints

- Ни одного нового бэкенд-эндпоинта — только уже существующие в `apps/api`
  (см. спеку, раздел «Данные, ошибки»).
- Без i18n — все строки хардкод на русском (решение спеки, раздел
  «Продукт и платформа» / соответствует исходным `WorkPage`/
  `BecomeMasterPage`, которые не используют `t()`).
- Без фреймворка юнит/e2e-тестов на фронте (тот же выбор, что в
  подпроектах 1-2) — верификация каждой задачи: `pnpm --filter master
  build` (или `dev` для страниц, которых билд не проверит достаточно) +
  ручная проверка в браузере, где явно указано.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css`
  (`bg-background`, `bg-surface`, `text-ink`, `text-ink-soft`, `text-muted`,
  `text-primary`, `text-danger`, `border-border`, `bg-fill-soft`,
  `rounded-md`, `rounded-lg`, `rounded-pill`) — тот же список, что уже
  используется в `apps/client`, не выдумывать новые CSS-переменные.
- Порт `apps/master` dev-сервера — **4300** (site=4100, client=4200, чтобы
  не пересекались при параллельном запуске).

---

## Файловая структура Фазы 1

```
apps/master/
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  global.d.ts
  app/
    globals.css
    layout.tsx                       # RootLayout (Server Component)
    (auth)/login/page.tsx
    (app)/layout.tsx                 # Sidebar + AuthGuard + MasterPresenceProvider + OfferOverlay
    (app)/page.tsx                   # гейт по статусу анкеты
    (app)/become-master/page.tsx
  components/
    Providers.tsx
    AuthGuard.tsx
    Sidebar.tsx
    NavLink.tsx
    OfferOverlay.tsx
  lib/
    api.ts
    socket.ts
    auth.tsx
    commercial-mode.tsx
    masterApplication.ts
    masterPresence.tsx
    useCountdown.ts
```

---

### Task 1: Workspace-скаффолд `apps/master` + общая lib-инфраструктура

**Files:**
- Create: `apps/master/package.json`
- Create: `apps/master/next.config.ts`
- Create: `apps/master/tsconfig.json`
- Create: `apps/master/postcss.config.mjs`
- Create: `apps/master/global.d.ts`
- Create: `apps/master/app/globals.css`
- Create: `apps/master/app/layout.tsx`
- Create: `apps/master/components/Providers.tsx`
- Create: `apps/master/lib/api.ts`
- Create: `apps/master/lib/socket.ts`
- Create: `apps/master/lib/auth.tsx`
- Create: `apps/master/lib/commercial-mode.tsx`
- Modify: `.claude/launch.json` (добавить `relaxed-master`)

**Interfaces:**
- Produces: `api(path, options?)` и `apiUpload(path, formData)` из
  `lib/api.ts` (идентичные сигнатуры `apps/client/lib/api.ts`) — все
  последующие задачи фазы вызывают их для сетевых запросов.
- Produces: `getSocket(): Socket`, `resetSocket(): void` из `lib/socket.ts`.
- Produces: `AuthProvider`, `useAuth(): { user: AuthUser | null; login;
  logout }`, `type AuthUser = { id, phone, name, role: 'CLIENT' |
  'OPERATOR' }` из `lib/auth.tsx`.
- Produces: `CommercialModeProvider`, `useCommercialMode(): {
  commercialMode, paymentsEnabled, leadCreditsEnabled, payoutsEnabled }`
  из `lib/commercial-mode.tsx` (понадобится Фазе 2 для `/lead-credits` и
  `/wallet`, заводится сейчас вместе с остальным shell-контекстом).
- Produces: `<Providers>` (оборачивает `CommercialModeProvider` +
  `AuthProvider`, без i18n-инициализации) — используется в
  `app/layout.tsx`.

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "master",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 4300",
    "build": "next build",
    "start": "next start -p 4300"
  },
  "dependencies": {
    "@masterqala/ui": "workspace:*",
    "leaflet": "^1.9.4",
    "next": "^15.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.2",
    "@types/leaflet": "^1.9.21",
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.3.2",
    "typescript": "~6.0.2"
  }
}
```

`leaflet`/`@types/leaflet` заводятся уже сейчас — Фаза 2 использует карту
в активной заявке, версии должны совпасть с `apps/client/package.json`
(сверено выше). i18n-пакетов (`i18next`/`react-i18next`) нет — не нужны
(см. Global Constraints).

- [ ] **Step 2: Создать `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Создать `tsconfig.json`**

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

- [ ] **Step 4: Создать `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 5: Создать `global.d.ts`**

```ts
// Next.js не даёт типов для side-effect импорта CSS (import './globals.css')
// из коробки в этой конфигурации TypeScript — без этого объявления сборка
// падает с TS2882 на каждом импорте *.css.
declare module '*.css';
```

- [ ] **Step 6: Создать `app/globals.css`**

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

- [ ] **Step 7: Создать `lib/api.ts`** (идентично `apps/client/lib/api.ts`,
  включая ожидание антивирус-скана после `apiUpload` — понадобится
  Task 4 этой фазы для загрузки документов анкеты)

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

type UploadScanResponse = {
  path: string;
  statusPath?: string;
  scanStatus: 'PENDING_SCAN' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
  [key: string]: unknown;
};

function isUploadScanResponse(value: unknown): value is UploadScanResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.path === 'string' && typeof candidate.scanStatus === 'string';
}

async function waitForUploadScan(initial: UploadScanResponse): Promise<UploadScanResponse> {
  let current = initial;
  const deadline = Date.now() + 30_000;

  while (true) {
    if (current.scanStatus === 'CLEAN') return current;
    if (current.scanStatus === 'INFECTED') {
      throw new Error('Файл отклонён проверкой безопасности');
    }
    if (current.scanStatus === 'SCAN_FAILED') {
      throw new Error('Не удалось проверить файл. Повторите загрузку');
    }
    if (Date.now() >= deadline) {
      throw new Error('Проверка файла занимает слишком много времени. Повторите попытку позже');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 750));
    const statusPath = current.statusPath ?? `/uploads/${encodeURIComponent(current.path)}/status`;
    current = await api(statusPath);
  }
}

export async function apiUpload(path: string, formData: FormData) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  const result = await handle(res);
  return isUploadScanResponse(result) ? waitForUploadScan(result) : result;
}
```

- [ ] **Step 8: Создать `lib/socket.ts`** (идентично `apps/client/lib/socket.ts`)

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

- [ ] **Step 9: Создать `lib/auth.tsx`** (идентично `apps/client/lib/auth.tsx`)

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

- [ ] **Step 10: Создать `lib/commercial-mode.tsx`** (идентично
  `apps/client/lib/commercial-mode.tsx`)

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

- [ ] **Step 11: Создать `components/Providers.tsx`** (без i18n-импорта,
  в отличие от `apps/client`)

```tsx
'use client';
import type { ReactNode } from 'react';
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

- [ ] **Step 12: Создать `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala — кабинет мастера',
  description: 'Работа с заявками, lead-кредиты и кошелёк мастера MasterQala',
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

- [ ] **Step 13: Добавить запись `relaxed-master` в `.claude/launch.json`**

Открыть `.claude/launch.json` (в корне репозитория, единый на все ворктри
— см. известную причуду в памяти `preview-tool-worktree-quirks`) и
добавить в массив `configurations` (после `relaxed-client`):

```json
{
  "name": "relaxed-master",
  "runtimeExecutable": "bash",
  "runtimeArgs": [
    "-c",
    "cd '/home/erda/Музыка/MasterQala.kz/.claude/worktrees/relaxed-pike-c226a7/apps/master' && NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npx next dev -p 4300"
  ],
  "port": 4300
}
```

- [ ] **Step 14: Установить зависимости и проверить сборку**

Run: `pnpm install && pnpm --filter master build`
Expected: сборка падает с ошибкой отсутствия `app/page.tsx` (в Next.js App
Router нужен хотя бы один маршрут) — это ожидаемо, реальный `page.tsx`
появится в Task 2. Убедиться, что ошибка именно про отсутствующую
страницу, а не про конфиг/зависимости/токены.

- [ ] **Step 15: Commit**

```bash
git add apps/master/package.json apps/master/next.config.ts apps/master/tsconfig.json \
  apps/master/postcss.config.mjs apps/master/global.d.ts apps/master/app/globals.css \
  apps/master/app/layout.tsx apps/master/components/Providers.tsx apps/master/lib/api.ts \
  apps/master/lib/socket.ts apps/master/lib/auth.tsx apps/master/lib/commercial-mode.tsx \
  .claude/launch.json pnpm-lock.yaml
git commit -m "feat(master): workspace-скаффолд apps/master + общая lib-инфраструктура"
```

---

### Task 2: Auth-шелл — `/login`, `AuthGuard`, сайдбар

**Files:**
- Create: `apps/master/app/(auth)/login/page.tsx`
- Create: `apps/master/components/AuthGuard.tsx`
- Create: `apps/master/components/NavLink.tsx`
- Create: `apps/master/components/Sidebar.tsx`
- Create: `apps/master/app/(app)/layout.tsx`
- Create: `apps/master/app/(app)/page.tsx` (временное содержимое —
  заменяется в Task 5 гейтом по статусу анкеты)

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Task 1), `useAuth`/`AuthProvider` из
  `lib/auth.tsx` (Task 1).
- Produces: маршрут `/login` (SMS-OTP, вызывает `login(token, user)` из
  `useAuth()` и делает `router.push('/')`).
- Produces: `<AuthGuard>` — компонент-обёртка, редиректит на `/login`,
  если `useAuth().user` пуст; используется во всех Фазе 2 задачах.
- Produces: `<Sidebar>` со фиксированными пунктами меню (используется в
  `(app)/layout.tsx`, не меняется по данным пользователя).

- [ ] **Step 1: Создать `app/(auth)/login/page.tsx`** (порт
  `apps/client/app/(auth)/login/page.tsx`, i18n-ключи заменены на
  хардкод RU-строки один в один по значениям из `apps/client/lib/locales/ru.json`)

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
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
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala для мастеров</div>
        <div className="text-sm text-fill">Заявки, ставки и выплаты в одном кабинете</div>
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
          ← Изменить номер
        </button>
      )}

      {step === 'phone' && (
        <>
          <div className="mt-6 text-[26px] font-extrabold leading-tight text-ink">Вход по номеру телефона</div>
          <div className="text-sm text-ink-soft">Отправим SMS с кодом подтверждения</div>
          <div className="mt-2 flex items-center gap-2 rounded-md border-[1.5px] border-border bg-surface px-4 py-3.5">
            <span className="text-[17px] font-extrabold text-ink">+7</span>
            <input
              className="flex-1 bg-transparent text-[17px] font-bold text-ink outline-none placeholder:text-muted"
              placeholder="707 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="text-xs leading-normal text-ink-soft">
            Продолжая, вы соглашаетесь с <span className="font-bold text-primary">условиями сервиса</span>
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={requestCode}
            disabled={submitting || phone.replace(/\D/g, '').length < 10}
            className="rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            Получить код
          </button>
        </>
      )}

      {step === 'sms' && (
        <>
          <div className="mt-2.5 text-[26px] font-extrabold leading-tight text-ink">Код из SMS</div>
          <div className="text-sm text-ink-soft">Отправили на +7 {phone}</div>
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
              `Отправить снова через ${formatTime(resendIn)}`
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-primary">
                Отправить код повторно
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
            Войти
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Создать `components/AuthGuard.tsx`** (без i18n)

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
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

  if (!checked) return <div className="p-6 text-ink-soft">Загрузка…</div>;
  return <>{children}</>;
}
```

- [ ] **Step 3: Создать `components/NavLink.tsx`** (идентично `apps/client`)

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

- [ ] **Step 4: Создать `components/Sidebar.tsx`**

```tsx
'use client';
import { NavLink } from './NavLink';

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="🛠">
        Работа
      </NavLink>
      <NavLink href="/become-master" icon="📋">
        Анкета
      </NavLink>
      <NavLink href="/lead-credits" icon="🎫">
        Lead-кредиты
      </NavLink>
      <NavLink href="/wallet" icon="💳">
        Кошелёк
      </NavLink>
      <div className="mt-auto border-t border-border pt-3">
        <a
          href="https://client.masterqala.kz"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↗</span>
          Личный кабинет клиента
        </a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Создать `app/(app)/layout.tsx`**

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

- [ ] **Step 6: Создать временный `app/(app)/page.tsx`**

Это временное содержимое — Task 5 этой же фазы заменит его гейтом по
статусу анкеты. Сейчас нужен рабочий маршрут, чтобы `AuthGuard`/`Sidebar`
были проверяемы end-to-end.

```tsx
'use client';
import { useAuth } from '@/lib/auth';

export default function WorkDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <div className="text-xl font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
    </div>
  );
}
```

- [ ] **Step 7: Проверить сборку**

Run: `pnpm --filter master build`
Expected: сборка проходит без ошибок (`✓ Compiled successfully`).

- [ ] **Step 8: Живая проверка входа**

Запустить `relaxed-api` и `relaxed-master` (`preview_start`), открыть
`http://localhost:4300` — должен произойти редирект на `/login`. Пройти
сплэш → ввод телефона (любой тестовый, например `7011112233`) → получить
код из логов `relaxed-api` (см. память `masterqala-local-dev-testing` —
`ConsoleSmsSender` логирует 6-значный код) → ввести код → редирект на `/`
с текстом «Здравствуйте, +7…». Проверить, что пункты сайдбара
подсвечивают активный маршрут и ссылка на `client.masterqala.kz`
присутствует.

- [ ] **Step 9: Commit**

```bash
git add apps/master/app apps/master/components
git commit -m "feat(master): auth-шелл — /login, AuthGuard, сайдбар"
```

---

### Task 3: `lib/masterApplication.ts` — типы и API-вызовы анкеты

**Files:**
- Create: `apps/master/lib/masterApplication.ts`

**Interfaces:**
- Consumes: `api`, `apiUpload` из `lib/api.ts` (Task 1).
- Produces: `type ApplicationStatus`, `interface Application`, `interface
  Category`, `interface ApplicationDocument`, `APPLICATION_STATUS_RU:
  Record<ApplicationStatus, string>`, `DOCUMENT_TYPES`,
  `fetchCategories(): Promise<Category[]>`, `fetchApplication():
  Promise<Application | null>`, `submitApplication(values:
  ApplicationFormValues): Promise<Application>`,
  `uploadApplicationDocument(type: string, file: File): Promise<unknown>`
  — использует Task 4 (страница анкеты) и Task 5 (гейт `/`).

- [ ] **Step 1: Создать `lib/masterApplication.ts`**

```ts
import { api, apiUpload } from './api';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface ApplicationDocument {
  id: string;
  type: string;
  originalName: string;
}

export type ApplicationStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';

export interface Application {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: ApplicationStatus;
  rejectionReason: string | null;
  latestDecisionComment: string | null;
  categories: { category: Category }[];
  documents: ApplicationDocument[];
}

export const APPLICATION_STATUS_RU: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны дополнительные данные',
  ACTIVE: 'Активен — вы мастер!',
  REJECTED: 'Отклонена',
};

export const DOCUMENT_TYPES = [
  { value: 'ID_CARD', label: 'Удостоверение личности' },
  { value: 'QUALIFICATION', label: 'Подтверждение квалификации' },
] as const;

export async function fetchCategories(): Promise<Category[]> {
  return api('/categories');
}

export async function fetchApplication(): Promise<Application | null> {
  try {
    return await api('/masters/application');
  } catch {
    return null;
  }
}

export interface ApplicationFormValues {
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  categoryIds: string[];
}

export async function submitApplication(values: ApplicationFormValues): Promise<Application> {
  return api('/masters/application', {
    method: 'POST',
    body: JSON.stringify(values),
  });
}

export async function uploadApplicationDocument(type: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append('type', type);
  fd.append('file', file);
  return apiUpload('/masters/application/documents', fd);
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: сборка проходит (файл пока никем не импортируется, но должен
типоchecking-проходить как часть `tsc` внутри `next build`).

- [ ] **Step 3: Commit**

```bash
git add apps/master/lib/masterApplication.ts
git commit -m "feat(master): типы и API-вызовы анкеты мастера"
```

---

### Task 4: Страница `/become-master`

**Files:**
- Create: `apps/master/app/(app)/become-master/page.tsx`

**Interfaces:**
- Consumes: всё из `lib/masterApplication.ts` (Task 3).

- [ ] **Step 1: Создать `app/(app)/become-master/page.tsx`** (порт
  `apps/web/src/pages/BecomeMasterPage.tsx` — раскладка адаптирована под
  десктоп: узкая центрированная колонка `max-w-[560px]`, без кнопки
  «Назад» на `/` — уже есть сайдбар)

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  APPLICATION_STATUS_RU,
  DOCUMENT_TYPES,
  fetchApplication,
  fetchCategories,
  submitApplication,
  uploadApplicationDocument,
  type Application,
  type Category,
} from '@/lib/masterApplication';

export default function BecomeMasterPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ fullName: '', iin: '', district: '', experienceYears: 0 });
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const cats = await fetchCategories();
    setCategories(cats);
    const a = await fetchApplication();
    setApp(a);
    if (a) {
      setForm({ fullName: a.fullName, iin: a.iin, district: a.district, experienceYears: a.experienceYears });
      setSelectedCats(a.categories.map((c) => c.category.id));
    }
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setError('');
    try {
      await submitApplication({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats });
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(type: string, file: File) {
    setError('');
    try {
      await uploadApplicationDocument(type, file);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!loaded) return <p className="p-8 text-ink-soft">Загрузка…</p>;

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto max-w-[560px] space-y-4 p-8">
      <h1 className="text-xl font-extrabold text-ink">Анкета мастера</h1>

      {app && !editing && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <p className="font-extrabold text-ink">Статус: {APPLICATION_STATUS_RU[app.status]}</p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <p className="text-sm text-danger">Причина: {app.rejectionReason}</p>
          )}
          {app.status === 'NEEDS_INFO' && app.latestDecisionComment && (
            <p className="text-sm text-ink-soft">Что нужно дополнить: {app.latestDecisionComment}</p>
          )}
          {canResubmit && (
            <button
              className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
              onClick={() => setEditing(true)}
            >
              Подать заново
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="ФИО полностью"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="ИИН (12 цифр)"
            value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="Район"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            type="number"
            placeholder="Опыт, лет"
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
          />
          <fieldset className="space-y-1">
            <legend className="text-sm font-extrabold text-ink">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={(e) =>
                    setSelectedCats(
                      e.target.checked ? [...selectedCats, c.id] : selectedCats.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <button
            className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white"
            onClick={submit}
          >
            Отправить на проверку
          </button>
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-extrabold text-ink">Документы</h2>
          {DOCUMENT_TYPES.map((dt) => (
            <div key={dt.value}>
              <label className="block text-sm text-ink-soft">{dt.label}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload(dt.value, file);
                }}
              />
              <ul className="text-sm text-ink-soft">
                {app!.documents.filter((d) => d.type === dt.value).map((d) => (
                  <li key={d.id}>✓ {d.originalName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Живая проверка**

В браузере (мастер уже вошёл из Task 2) открыть `/become-master`,
заполнить форму (ФИО, ИИН, район, опыт, минимум одну категорию),
отправить — статус должен стать «На проверке». Загрузить документ
(любой JPEG/PNG) в оба типа — после прохождения антивирус-скана файл
должен появиться в списке с «✓».

- [ ] **Step 4: Commit**

```bash
git add apps/master/app/\(app\)/become-master
git commit -m "feat(master): страница анкеты /become-master"
```

---

### Task 5: Гейт `/` по статусу анкеты

**Files:**
- Modify: `apps/master/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `fetchApplication`, `APPLICATION_STATUS_RU`, `type
  Application` из `lib/masterApplication.ts` (Task 3).

- [ ] **Step 1: Заменить содержимое `app/(app)/page.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { APPLICATION_STATUS_RU, fetchApplication, type Application } from '@/lib/masterApplication';

export default function WorkDashboardPage() {
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchApplication().then((app) => {
      setApplication(app);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div className="p-8 text-ink-soft">Загрузка…</div>;

  if (!application || application.status !== 'ACTIVE') {
    return (
      <div className="mx-auto max-w-[480px] p-8">
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <div className="text-lg font-extrabold text-ink">
            {application ? APPLICATION_STATUS_RU[application.status] : 'Вы ещё не подали анкету мастера'}
          </div>
          {application?.status === 'REJECTED' && application.rejectionReason && (
            <p className="mt-2 text-sm text-danger">Причина: {application.rejectionReason}</p>
          )}
          {application?.status === 'NEEDS_INFO' && application.latestDecisionComment && (
            <p className="mt-2 text-sm text-ink-soft">Что нужно дополнить: {application.latestDecisionComment}</p>
          )}
          <Link
            href="/become-master"
            className="mt-4 inline-block rounded-pill bg-primary px-5 py-3 text-sm font-extrabold text-white"
          >
            {application ? 'Открыть анкету' : 'Подать анкету'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="text-xl font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
      <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-ink-soft">
        Рабочая лента (срочные и плановые заявки) появится в Фазе 2.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Живая проверка гейта**

Два сценария в браузере: (а) мастер без анкеты — `/` показывает «Вы ещё
не подали анкету мастера» + кнопку «Подать анкету»; (б) после отправки
анкеты (Task 4) — `/` показывает «На проверке» + «Открыть анкету»; (в)
перевести тестовую анкету в `ACTIVE` напрямую в БД (см. память
`masterqala-local-dev-testing` — паттерн одноразовых `ts-node`-скриптов
в `apps/api`, обновить `MasterApplication.status='ACTIVE'` и создать
связанный `MasterProfile`, либо переиспользовать
`createActiveMaster`-хелпер) → обновить `/` → должно показаться
«Здравствуйте, …» + заглушка про Фазу 2.

- [ ] **Step 4: Commit**

```bash
git add apps/master/app/\(app\)/page.tsx
git commit -m "feat(master): гейт / по статусу анкеты мастера"
```

---

### Task 6: `MasterPresenceProvider` + `OfferOverlay` (шелл-уровень)

**Files:**
- Create: `apps/master/lib/useCountdown.ts`
- Create: `apps/master/lib/masterPresence.tsx`
- Create: `apps/master/components/OfferOverlay.tsx`
- Modify: `apps/master/app/(app)/layout.tsx`
- Modify: `apps/master/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `getSocket` из `lib/socket.ts` (Task 1).
- Produces: `MasterPresenceProvider`, `useMasterPresence(): { online,
  connected, geoDenied, offer, offerNote, goOnline(), goOffline(),
  dismissOfferNote() }`, `interface UrgentOffer` — Фаза 2 расширяет этот
  контекст реальными действиями над принятой заявкой (accept и весь
  стейт-машина активного заказа), сохраняя те же имена полей.
- Produces: `useCountdown(deadline: string | null): number` из
  `lib/useCountdown.ts`.

- [ ] **Step 1: Создать `lib/useCountdown.ts`**

```ts
import { useEffect, useState } from 'react';

export function useCountdown(deadline: string | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);
  return left;
}
```

- [ ] **Step 2: Создать `lib/masterPresence.tsx`**

Presence-тумблер (`goOnline`/`goOffline`) реализован по-настоящему уже в
Фазе 1 — без него провайдер и оффер-оверлей нечем было бы проверить живьём
(мёртвый код). Полноценный UI-виджет тумблера с вкладками «Срочные»/
«Плановые» переезжает в рабочий дашборд в Фазе 2 — в Фазе 1 у него есть
только минимальный элемент управления в сайдбаре (Step 5 этой задачи).

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSocket } from './socket';

export interface UrgentOffer {
  orderId: string;
  category: string;
  description: string;
  address?: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string;
}

interface MasterPresenceCtx {
  online: boolean;
  connected: boolean;
  geoDenied: boolean;
  offer: UrgentOffer | null;
  offerNote: string;
  goOnline: () => void;
  goOffline: () => void;
  dismissOfferNote: () => void;
}

const Ctx = createContext<MasterPresenceCtx>({
  online: false,
  connected: false,
  geoDenied: false,
  offer: null,
  offerNote: '',
  goOnline: () => {},
  goOffline: () => {},
  dismissOfferNote: () => {},
});

function beepAndVibrate() {
  try {
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Звук недоступен — вибрация остаётся резервным уведомлением.
  }
  navigator.vibrate?.([200, 100, 200]);
}

export function MasterPresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<UrgentOffer | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const geoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOffer = (incoming: UrgentOffer) => {
      setOffer(incoming);
      setOfferNote('');
      beepAndVibrate();
    };
    const onOfferClosed = (payload: { orderId: string; reason: string }) => {
      setOffer((current) => (current?.orderId === payload.orderId ? null : current));
      setOfferNote(payload.reason);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer:new', onOffer);
    socket.on('offer:closed', onOfferClosed);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('offer:new', onOffer);
      socket.off('offer:closed', onOfferClosed);
      if (geoTimer.current) clearInterval(geoTimer.current);
    };
  }, []);

  const goOnline = useCallback(() => {
    setGeoDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const socket = getSocket();
        socket.emit('presence:online', { lat: position.coords.latitude, lng: position.coords.longitude });
        setOnline(true);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((next) =>
            socket.emit('geo:update', { lat: next.coords.latitude, lng: next.coords.longitude }),
          );
        }, 30000);
      },
      () => setGeoDenied(true),
    );
  }, []);

  const goOffline = useCallback(() => {
    getSocket().emit('presence:offline');
    setOnline(false);
    if (geoTimer.current) clearInterval(geoTimer.current);
  }, []);

  const dismissOfferNote = useCallback(() => setOfferNote(''), []);

  return (
    <Ctx.Provider value={{ online, connected, geoDenied, offer, offerNote, goOnline, goOffline, dismissOfferNote }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMasterPresence = () => useContext(Ctx);
```

- [ ] **Step 3: Создать `components/OfferOverlay.tsx`**

Оффер показывается на любой странице приложения (см. спеку, раздел
«Шелл: presence и глобальный оффер»). Реальное действие «Принять» —
Фаза 2 (там же появится полная стейт-машина активной заявки, на которую
нужно перейти после приёма).

```tsx
'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlay() {
  const { offer } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
      <div className="w-full max-w-[420px] space-y-3 rounded-lg bg-surface p-6 text-center shadow-xl">
        <div className="text-xs font-extrabold uppercase text-ink-soft">
          Новая заявка · {offer.distanceKm} км
        </div>
        <h2 className="text-xl font-extrabold text-ink">{offer.category}</h2>
        <p className="text-sm text-ink-soft">{offer.description}</p>
        {offer.address && <p className="text-sm text-ink-soft">{offer.address}</p>}
        {offer.freePilot ? (
          <div className="rounded-md bg-fill-soft p-3 text-sm font-semibold text-ink">
            Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
          </div>
        ) : (
          <div className="text-lg font-extrabold text-primary">Компенсация выезда: {offer.compensation} ₸</div>
        )}
        <div className="text-sm font-bold text-ink-soft">Осталось {secondsLeft} с</div>
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-ink-soft">
          Приём заявки появится в Фазе 2 — сейчас можно только просмотреть оффер.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Обновить `app/(app)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterPresenceProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
```

- [ ] **Step 5: Добавить минимальный presence-тумблер в `components/Sidebar.tsx`**

```tsx
'use client';
import { NavLink } from './NavLink';
import { useMasterPresence } from '@/lib/masterPresence';

export function Sidebar() {
  const { online, connected, geoDenied, goOnline, goOffline } = useMasterPresence();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="🛠">
        Работа
      </NavLink>
      <NavLink href="/become-master" icon="📋">
        Анкета
      </NavLink>
      <NavLink href="/lead-credits" icon="🎫">
        Lead-кредиты
      </NavLink>
      <NavLink href="/wallet" icon="💳">
        Кошелёк
      </NavLink>
      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <div className="rounded-md bg-fill-soft px-3 py-2 text-xs">
          <div className="font-extrabold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
          <div className="text-ink-soft">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
          {geoDenied && <div className="mt-1 text-danger">Нет доступа к геолокации</div>}
        </div>
        <button
          type="button"
          onClick={online ? goOffline : goOnline}
          className={`w-full rounded-pill px-3 py-2 text-xs font-extrabold text-white ${
            online ? 'bg-ink-soft' : 'bg-primary'
          }`}
        >
          {online ? 'Выйти' : 'Стать онлайн'}
        </button>
        <a
          href="https://client.masterqala.kz"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↗</span>
          Личный кабинет клиента
        </a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Проверить сборку**

Run: `pnpm --filter master build`
Expected: сборка проходит без ошибок.

- [ ] **Step 7: Живая проверка presence + оффера**

В браузере (мастер с `ACTIVE`-анкетой, залогинен): нажать «Стать онлайн»
в сайдбаре → браузер запросит геолокацию → разрешить → статус сменится
на «Вы онлайн». Не уходя со страницы `/lead-credits` (или любой другой,
кроме `/`), с бэкенда сгенерировать реальный `offer:new` — создать
срочную заявку от тестового клиента через реальный API (см. память
`masterqala-local-dev-testing`, `createActiveMaster`/`setMasterOnline`
как образец подготовки мастера с гео) так, чтобы матчинг адресовал её
этому онлайн-мастеру. Убедиться, что `OfferOverlay` появляется поверх
`/lead-credits` (не только на `/`), показывает корректные категорию/
адрес/сумму компенсации и обратный отсчёт, и закрывается по истечении
таймаута (сервер шлёт `offer:closed`).

- [ ] **Step 8: Commit**

```bash
git add apps/master/lib/useCountdown.ts apps/master/lib/masterPresence.tsx \
  apps/master/components/OfferOverlay.tsx apps/master/app/\(app\)/layout.tsx \
  apps/master/components/Sidebar.tsx
git commit -m "feat(master): MasterPresenceProvider + глобальный OfferOverlay"
```

---

## Self-Review Checklist (для исполнителя финальной задачи ревью Фазы 1)

- Все 5 маршрутов Фазы 1 (`/login`, `/`, `/become-master`, плюс layout-
  обёртки) собираются и открываются без ошибок консоли.
- Гейт `/` корректно разделяет неактивного и активного мастера.
- `OfferOverlay` монтируется в `(app)/layout.tsx`, а не в отдельной
  странице — виден на любом маршруте под `(app)`.
- Ни один файл не импортирует `react-i18next`/`i18next` (проверить
  `grep -rn "i18n" apps/master`).
- `pnpm --filter master build` зелёный на последнем коммите фазы.
