# Оператор (desktop), Цикл B — Фаза A: каркас + Обзор — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать новый workspace-пакет `apps/operator` (Next.js 15, порт 4400)
с рабочим SMS-OTP входом, гейтом по роли `OPERATOR`, десктопным шеллом
(сайдбар на 9 разделов) и первым полностью рабочим разделом — «Обзор»
(дашборд агрегатов + таблица зависших поисков), опрашивающим
`GET /admin/metrics` каждые 30 секунд.

**Architecture:** Точная копия паттерна `apps/client`/`apps/master` (RSC
корневой layout + все страницы `'use client'`, JWT в `localStorage`,
клиентский `AuthGuard`, `api()` из `lib/`), без i18n и без сокетов —
по решению спеки Цикла B (`docs/superpowers/specs/2026-07-30-operator-flow-desktop-design.md`):
панель оператора обновляет данные поллингом, WS не нужен. `AuthGuard`
дополнительно проверяет `user.role === 'OPERATOR'`, в отличие от
`apps/client`/`apps/master` (там любая роль клиента/мастера легитимна).
Бэкенд (`apps/api`) не меняется — весь нужный API уже есть после Цикла A
(`/admin/metrics`) и был и раньше (`/auth/*`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
(`@masterqala/ui/tokens.css`).

## Global Constraints

- Ни одного нового бэкенд-эндпоинта — только уже существующие в `apps/api`.
- Без i18n — все строки хардкод на русском (решение спеки — та же логика,
  что у `apps/master`: не переусложнять, оператор один язык).
- Без сокетов/realtime-провайдера — панель поллит `/admin/metrics` каждые
  30 секунд и делает явный рефетч после мутирующих действий (в Фазах B-D).
- Без фреймворка юнит/e2e-тестов на фронте (тот же выбор проекта для всех
  Next.js-приложений) — верификация каждой задачи: `pnpm --filter operator
  build` + ручная проверка в браузере, где явно указано.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css`
  (`bg-background`, `bg-surface`, `text-ink`, `text-ink-soft`, `text-muted`,
  `text-primary`, `text-danger`, `text-warning-ink` (используется и для
  текста, и как `bg-warning-ink` — токен один, `--color-warning-ink:
  #B4530A`, у него нет прямого Tailwind-класса `bg-warning-ink` в токенах,
  но Tailwind 4 генерирует `bg-warning-ink`/`text-warning-ink` автоматически
  из CSS-переменной `--color-warning-ink`, объявленной в `@theme` —
  тот же механизм, что уже даёт `bg-danger`/`text-danger` из
  `--color-danger`), `border-border`, `bg-fill-soft`, `rounded-md`,
  `rounded-lg`, `rounded-pill`) — не выдумывать новые CSS-переменные.
- Порт `apps/operator` dev-сервера — **4400** (site=4100, client=4200,
  master=4300 — не пересекаются при параллельном запуске).
- Каждый новый раздел сайдбара (все 9 уже перечислены в Task 2) получает
  свой маршрут сразу, даже если страница появится только в следующей фазе
  — временный `404` для ещё не реализованных разделов ожидаем и не
  является багом (прецедент: `apps/master`/`apps/client` уже делали так
  для `/notifications` и `/planned/new` между фазами).

---

## Файловая структура Фазы A

```
apps/operator/
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  global.d.ts
  app/
    globals.css
    layout.tsx                       # RootLayout (Server Component)
    (auth)/login/page.tsx
    (app)/layout.tsx                 # Sidebar + AuthGuard + OperatorMetricsProvider
    (app)/page.tsx                   # Обзор — дашборд
  components/
    Providers.tsx
    AuthGuard.tsx
    NavLink.tsx
    Sidebar.tsx
  lib/
    api.ts
    auth.tsx
    metrics.ts
    operatorMetrics.tsx
```

---

### Task 1: Workspace-скаффолд `apps/operator` + общая lib-инфраструктура + CORS

**Files:**
- Create: `apps/operator/package.json`
- Create: `apps/operator/next.config.ts`
- Create: `apps/operator/tsconfig.json`
- Create: `apps/operator/postcss.config.mjs`
- Create: `apps/operator/global.d.ts`
- Create: `apps/operator/app/globals.css`
- Create: `apps/operator/app/layout.tsx`
- Create: `apps/operator/components/Providers.tsx`
- Create: `apps/operator/lib/api.ts`
- Create: `apps/operator/lib/auth.tsx`
- Modify: `.claude/launch.json` (добавить `relaxed-operator`)
- Modify: `apps/api/.env.example` (добавить порт 4400 в `CORS_ORIGINS`)
- Modify: `apps/api/.env` (локальный, не в git — та же строка, нужна для
  живой проверки; сейчас в этом файле `CORS_ORIGINS` вообще отсутствует,
  из-за чего используется узкий дефолт `DEFAULT_LOCAL_ORIGINS` только с
  портом 5173 — фактически без этой правки живая проверка любого из
  Next.js-приложений на 4xxx-портах вообще не может работать через
  браузер; фиксируем и это заодно)
- Modify: `docs/technical/DEPLOYMENT_RUNBOOK.md` (добавить порт 4400 в
  список портов разработки)

**Interfaces:**
- Produces: `api(path, options?)` из `lib/api.ts` (идентичная сигнатура
  `apps/client/lib/api.ts`/`apps/master/lib/api.ts`) — все последующие
  задачи вызывают её для сетевых запросов.
- Produces: `AuthProvider`, `useAuth(): { user: AuthUser | null; login;
  logout }`, `type AuthUser = { id: string; phone: string; name: string |
  null; role: 'CLIENT' | 'OPERATOR' }` из `lib/auth.tsx`.
- Produces: `<Providers>` (оборачивает только `AuthProvider` — без
  `CommercialModeProvider`, панели оператора коммерческий режим не нужен)
  — используется в `app/layout.tsx`.

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "operator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 4400",
    "build": "next build",
    "start": "next start -p 4400"
  },
  "dependencies": {
    "@masterqala/ui": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
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

Версии идентичны `apps/master/package.json` (сверено напрямую по файлу).
Без `leaflet`/`socket.io-client`/`react-i18next` — панели оператора не
нужна карта, сокеты или i18n в этом цикле (см. Global Constraints).

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

- [ ] **Step 7: Создать `lib/api.ts`** (тот же паттерн, что в
  `apps/client`/`apps/master`, без ветки `apiUpload`/сканирования файлов —
  панели оператора в Фазе A загрузка файлов не нужна; если понадобится в
  Фазе B для документов верификации — добавится отдельной задачей там)

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

- [ ] **Step 8: Создать `lib/auth.tsx`** (идентично
  `apps/client/lib/auth.tsx`/`apps/master/lib/auth.tsx`)

```tsx
'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

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
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
```

- [ ] **Step 9: Создать `components/Providers.tsx`**

```tsx
'use client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

- [ ] **Step 10: Создать `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala — панель оператора',
  description: 'Заявки, пользователи, мастера, споры и журнал действий оператора MasterQala',
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

- [ ] **Step 11: Добавить порт 4400 в `apps/api/.env.example`**

Открыть `apps/api/.env.example`, найти строку `CORS_ORIGINS=` и заменить
на (добавлены `http://localhost:4400`/`http://127.0.0.1:4400` в конец):

```
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5181,http://127.0.0.1:5181,http://localhost:4200,http://127.0.0.1:4200,http://localhost:4300,http://127.0.0.1:4300,http://localhost:4400,http://127.0.0.1:4400"
```

- [ ] **Step 12: Добавить `CORS_ORIGINS` в локальный `apps/api/.env`**

Открыть `apps/api/.env` (не в git) и добавить новую строку со **всем**
списком из Step 11 (в текущем файле строки `CORS_ORIGINS` нет вообще —
без неё сервер использует узкий встроенный дефолт только для порта 5173,
и живая проверка любого Next.js-приложения через браузер получала бы
`Failed to fetch` из-за CORS):

```
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5181,http://127.0.0.1:5181,http://localhost:4200,http://127.0.0.1:4200,http://localhost:4300,http://127.0.0.1:4300,http://localhost:4400,http://127.0.0.1:4400"
```

- [ ] **Step 13: Добавить порт `apps/operator` в список портов
  `docs/technical/DEPLOYMENT_RUNBOOK.md`**

Найти список «Порты разработки» (после строки `` `apps/master` (Next.js):
`4300`; ``) и добавить новую строку:

```
- `apps/operator` (Next.js): `4400`;
```

- [ ] **Step 14: Добавить запись `relaxed-operator` в `.claude/launch.json`**

Открыть `.claude/launch.json` (в корне репозитория, единый на все ворктри)
и добавить в массив `configurations` (после `relaxed-master`):

```json
{
  "name": "relaxed-operator",
  "runtimeExecutable": "bash",
  "runtimeArgs": [
    "-c",
    "cd '/home/erda/Музыка/MasterQala.kz/.claude/worktrees/relaxed-pike-c226a7/apps/operator' && NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npx next dev -p 4400"
  ],
  "port": 4400
}
```

- [ ] **Step 15: Установить зависимости и проверить сборку**

Run: `pnpm install && pnpm --filter operator build`
Expected: сборка падает с ошибкой отсутствия `app/page.tsx` (в Next.js App
Router нужен хотя бы один маршрут) — это ожидаемо, реальный `page.tsx`
появится в Task 2. Убедиться, что ошибка именно про отсутствующую
страницу, а не про конфиг/зависимости/токены.

- [ ] **Step 16: Commit**

```bash
git add apps/operator/package.json apps/operator/next.config.ts apps/operator/tsconfig.json \
  apps/operator/postcss.config.mjs apps/operator/global.d.ts apps/operator/app/globals.css \
  apps/operator/app/layout.tsx apps/operator/components/Providers.tsx apps/operator/lib/api.ts \
  apps/operator/lib/auth.tsx .claude/launch.json apps/api/.env.example \
  docs/technical/DEPLOYMENT_RUNBOOK.md pnpm-lock.yaml
git commit -m "feat(operator): workspace-скаффолд apps/operator + общая lib-инфраструктура"
```

(`apps/api/.env` не коммитится — он в `.gitignore`.)

---

### Task 2: Auth-шелл с гейтом по роли — `/login`, `AuthGuard`, сайдбар на 9 разделов

**Files:**
- Create: `apps/operator/app/(auth)/login/page.tsx`
- Create: `apps/operator/components/AuthGuard.tsx`
- Create: `apps/operator/components/NavLink.tsx`
- Create: `apps/operator/components/Sidebar.tsx`
- Create: `apps/operator/app/(app)/layout.tsx`
- Create: `apps/operator/app/(app)/page.tsx` (временное содержимое —
  заменяется в Task 4 реальным дашбордом «Обзор»)

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Task 1), `useAuth`/`AuthProvider` из
  `lib/auth.tsx` (Task 1).
- Produces: маршрут `/login` (SMS-OTP, вызывает `login(token, user)` из
  `useAuth()` и делает `router.push('/')`).
- Produces: `<AuthGuard>` — редиректит на `/login`, если `useAuth().user`
  пуст; если `user.role !== 'OPERATOR'` — показывает экран «доступ
  запрещён» с кнопкой выхода вместо контента; используется во всех
  последующих фазах.
- Produces: `<NavLink href icon badge? children>` — пункт навигации с
  опциональным числовым бейджем (используется `<Sidebar>`, а в Фазах B-D
  для новых пунктов меню бейдж не нужен — паттерн уже даёт такую
  возможность).
- Produces: `<Sidebar>` с 9 пунктами (Обзор/Верификация/Пользователи/
  Мастера/Заказы/Споры/Вывод средств/Журнал/Безопасность) и кнопкой
  «Выйти» — маршруты фиксированы сразу для всех 9, страницы появятся по
  фазам (см. Global Constraints про временный 404).

- [ ] **Step 1: Создать `app/(auth)/login/page.tsx`** (порт
  `apps/master/app/(auth)/login/page.tsx`, тот же флоу сплэш→телефон→код,
  текст сплэша адаптирован под оператора)

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
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala · Панель оператора</div>
        <div className="text-sm text-fill">Заявки, пользователи, мастера и споры в одной панели</div>
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
              placeholder="700 000 00 01"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
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

- [ ] **Step 2: Создать `components/AuthGuard.tsx`** (с дополнительной
  проверкой роли — отличие от `apps/client`/`apps/master`)

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecked(false);
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [user, router]);

  if (!checked || !user) return <div className="p-6 text-ink-soft">Загрузка…</div>;

  if (user.role !== 'OPERATOR') {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <div className="text-lg font-extrabold text-danger">Доступ запрещён</div>
        <div className="text-sm text-ink-soft">
          Панель оператора доступна только пользователям с ролью «Оператор». Ваш аккаунт не имеет такой роли.
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
        >
          Выйти и войти другим аккаунтом
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

`logout()` очищает `user` в контексте, компонент перерендерится,
`useEffect` увидит `!user` и сделает `router.replace('/login')` —
отдельный явный редирект в обработчике кнопки не нужен.

**Исправлено при реализации (найдено живой проверкой Task 2):** более
ранняя версия этого файла не сбрасывала `checked` в `false` при выходе и
проверяла `user!.role` без явной защиты от `null` — на повторном рендере
после `logout()` (`user` уже `null`, `checked` ещё `true` из прошлого
рендера) это падало с `Cannot read properties of null (reading 'role')`.
Текущая версия (`if (!checked || !user) return …`, `setChecked(false)` в
ветке `!user`, обычный `user.role` без `!`) не даёт рендеру дойти до
`user.role`, пока `user` реально не `null` — баг воспроизводился дважды
детерминированно, пофикшено в рамках Task 2 до коммита.

- [ ] **Step 3: Создать `components/NavLink.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: ReactNode;
  badge?: number;
  children: ReactNode;
}) {
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
      <span className="flex-1">{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="rounded-pill bg-warning-ink px-2 py-0.5 text-[10px] font-extrabold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Создать `components/Sidebar.tsx`** (пока без бейджей —
  `useOperatorMetrics` появится в Task 3, бейджи подключаются в Task 4)

```tsx
'use client';
import { NavLink } from './NavLink';
import { useAuth } from '@/lib/auth';

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
      <div className="mb-3 px-2 text-base font-extrabold text-primary">MasterQala · Оператор</div>
      <NavLink href="/" icon="◫">
        Обзор
      </NavLink>
      <NavLink href="/verification" icon="🛡">
        Верификация
      </NavLink>
      <NavLink href="/users" icon="👤">
        Пользователи
      </NavLink>
      <NavLink href="/masters" icon="🛠">
        Мастера
      </NavLink>
      <NavLink href="/orders" icon="☰">
        Заказы
      </NavLink>
      <NavLink href="/disputes" icon="⚖️">
        Споры
      </NavLink>
      <NavLink href="/withdrawals" icon="₸">
        Вывод средств
      </NavLink>
      <NavLink href="/journal" icon="▤">
        Журнал
      </NavLink>
      <NavLink href="/security" icon="🔒">
        Безопасность
      </NavLink>
      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↩</span>
          Выйти
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Создать `app/(app)/layout.tsx`** (пока без
  `OperatorMetricsProvider` — добавляется в Task 4)

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

Это временное содержимое — Task 4 этой же фазы заменит его дашбордом
«Обзор». Сейчас нужен рабочий маршрут, чтобы `AuthGuard`/`Sidebar` были
проверяемы end-to-end.

```tsx
'use client';
import { useAuth } from '@/lib/auth';

export default function OverviewPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <div className="text-xl font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
    </div>
  );
}
```

- [ ] **Step 7: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок (`✓ Compiled successfully`).

- [ ] **Step 8: Создать тестового оператора в локальной БД**

Run (из корня репозитория):

```bash
cd apps/api && pnpm seed
```

Expected: скрипт использует `OPERATOR_PHONE` из `apps/api/.env`
(`+77000000001`) и создаёт/обновляет пользователя с ролью `OPERATOR` —
это тестовый аккаунт для живой проверки ниже и всех последующих фаз.

- [ ] **Step 9: Живая проверка входа и гейта по роли**

Запустить `relaxed-api` и `relaxed-operator` (`preview_start`), открыть
`http://localhost:4400` — должен произойти редирект на `/login`. Пройти
сплэш → ввод телефона `7000000001` → получить код из логов `relaxed-api`
(см. память `masterqala-local-dev-testing` — `ConsoleSmsSender` логирует
6-значный код) → ввести код → редирект на `/` с текстом «Здравствуйте,
+7…». Проверить, что все 9 пунктов сайдбара видны, пункт «Обзор»
подсвечен как активный, кнопка «Выйти» разлогинивает и возвращает на
`/login`.

Отдельно проверить гейт по роли: войти повторно любым **не**-операторским
номером (например `7011112233` — обычный клиент/тестовый аккаунт из
других приложений этого ворктри), убедиться, что вместо контента
показывается экран «Доступ запрещён» с кнопкой «Выйти и войти другим
аккаунтом», и что клик по кнопке возвращает на `/login`.

- [ ] **Step 10: Commit**

```bash
git add apps/operator/app apps/operator/components
git commit -m "feat(operator): auth-шелл с гейтом по роли — /login, AuthGuard, сайдбар на 9 разделов"
```

---

### Task 3: `lib/metrics.ts` + `lib/operatorMetrics.tsx` — типы, API-вызов и поллинг-провайдер

**Files:**
- Create: `apps/operator/lib/metrics.ts`
- Create: `apps/operator/lib/operatorMetrics.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Task 1), `useAuth` из `lib/auth.tsx`
  (Task 1).
- Produces: `interface StuckSearch { id: string; category: string; address:
  string; wave: number; waitingSeconds: number }`, `interface
  DashboardMetrics { activeUrgentCount: number; publishedPlannedCount:
  number; foundMasterRate: number | null; medianSearchSeconds: number |
  null; openDisputesCount: number; pendingVerificationCount: number;
  pendingWithdrawalsCount: number; stuckSearches: StuckSearch[] }`,
  `fetchMetrics(): Promise<DashboardMetrics>` из `lib/metrics.ts`.
- Produces: `<OperatorMetricsProvider>`, `useOperatorMetrics(): { metrics:
  DashboardMetrics | null; loading: boolean; error: string | null;
  refetch: () => void }` из `lib/operatorMetrics.tsx` — используется
  Task 4 (Sidebar-бейджи и страница «Обзор»), а в Фазах B-D — везде, где
  после мутирующего действия (блокировка, назначение, решение спора)
  нужно обновить счётчики в сайдбаре через `refetch()`.

- [ ] **Step 1: Создать `lib/metrics.ts`**

Типы соответствуют дословно ответу `GET /admin/metrics`
(`apps/api/src/admin-metrics/admin-metrics.service.ts`, метод
`getDashboard()` — сверено напрямую по коду бэкенда).

```ts
import { api } from './api';

export interface StuckSearch {
  id: string;
  category: string;
  address: string;
  wave: number;
  waitingSeconds: number;
}

export interface DashboardMetrics {
  activeUrgentCount: number;
  publishedPlannedCount: number;
  foundMasterRate: number | null;
  medianSearchSeconds: number | null;
  openDisputesCount: number;
  pendingVerificationCount: number;
  pendingWithdrawalsCount: number;
  stuckSearches: StuckSearch[];
}

export function fetchMetrics(): Promise<DashboardMetrics> {
  return api('/admin/metrics');
}
```

- [ ] **Step 2: Создать `lib/operatorMetrics.tsx`**

```tsx
'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMetrics, type DashboardMetrics } from './metrics';
import { useAuth } from './auth';

const POLL_INTERVAL_MS = 30_000;

interface OperatorMetricsCtx {
  metrics: DashboardMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const Ctx = createContext<OperatorMetricsCtx>({
  metrics: null,
  loading: true,
  error: null,
  refetch: () => {},
});

export function OperatorMetricsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'OPERATOR') return;
    let cancelled = false;
    setLoading(true);
    fetchMetrics()
      .then((data) => {
        if (!cancelled) {
          setMetrics(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  useEffect(() => {
    if (!user || user.role !== 'OPERATOR') return;
    const interval = setInterval(() => setTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  const refetch = () => setTick((t) => t + 1);

  return <Ctx.Provider value={{ metrics, loading, error, refetch }}>{children}</Ctx.Provider>;
}

export function useOperatorMetrics() {
  return useContext(Ctx);
}
```

Провайдер сам проверяет `user`/роль перед запросом — безопасно монтировать
его выше `AuthGuard` (Task 4 так и сделает), не дублируя проверку роли.

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок (новые файлы пока никем не
импортируются, но должны компилироваться сами по себе).

- [ ] **Step 4: Commit**

```bash
git add apps/operator/lib/metrics.ts apps/operator/lib/operatorMetrics.tsx
git commit -m "feat(operator): типы и поллинг-провайдер /admin/metrics"
```

---

### Task 4: Раздел «Обзор» — дашборд, живые бейджи в сайдбаре

**Files:**
- Modify: `apps/operator/app/(app)/layout.tsx` (подключить
  `OperatorMetricsProvider`)
- Modify: `apps/operator/components/Sidebar.tsx` (подключить реальные
  бейджи из `useOperatorMetrics()`)
- Modify: `apps/operator/app/(app)/page.tsx` (заменить временное
  содержимое на полный дашборд)

**Interfaces:**
- Consumes: `useOperatorMetrics`, `DashboardMetrics` из
  `lib/operatorMetrics.tsx`/`lib/metrics.ts` (Task 3).

- [ ] **Step 1: Подключить `OperatorMetricsProvider` в `app/(app)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { OperatorMetricsProvider } from '@/lib/operatorMetrics';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorMetricsProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </OperatorMetricsProvider>
  );
}
```

- [ ] **Step 2: Подключить бейджи в `components/Sidebar.tsx`**

Заменить содержимое файла целиком:

```tsx
'use client';
import { NavLink } from './NavLink';
import { useAuth } from '@/lib/auth';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

export function Sidebar() {
  const { logout } = useAuth();
  const { metrics } = useOperatorMetrics();

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
      <div className="mb-3 px-2 text-base font-extrabold text-primary">MasterQala · Оператор</div>
      <NavLink href="/" icon="◫">
        Обзор
      </NavLink>
      <NavLink href="/verification" icon="🛡" badge={metrics?.pendingVerificationCount}>
        Верификация
      </NavLink>
      <NavLink href="/users" icon="👤">
        Пользователи
      </NavLink>
      <NavLink href="/masters" icon="🛠">
        Мастера
      </NavLink>
      <NavLink href="/orders" icon="☰" badge={metrics?.stuckSearches.length}>
        Заказы
      </NavLink>
      <NavLink href="/disputes" icon="⚖️" badge={metrics?.openDisputesCount}>
        Споры
      </NavLink>
      <NavLink href="/withdrawals" icon="₸" badge={metrics?.pendingWithdrawalsCount}>
        Вывод средств
      </NavLink>
      <NavLink href="/journal" icon="▤">
        Журнал
      </NavLink>
      <NavLink href="/security" icon="🔒">
        Безопасность
      </NavLink>
      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↩</span>
          Выйти
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Заменить `app/(app)/page.tsx` на полный дашборд**

Клик по строке «зависшего поиска» ведёт на `/orders/${id}` — этот маршрут
появится только в Фазе C, до тех пор клик даёт ожидаемый `404` (см. Global
Constraints).

```tsx
'use client';
import Link from 'next/link';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function AttentionCard({
  href,
  count,
  label,
  danger,
}: {
  href: string;
  count: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border-[1.5px] bg-surface p-4 text-left ${danger ? 'border-danger' : 'border-warning-ink'}`}
    >
      <div className={`text-2xl font-extrabold ${danger ? 'text-danger' : 'text-warning-ink'}`}>{count}</div>
      <div className="text-xs font-bold text-ink-soft">{label}</div>
    </Link>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs font-bold text-ink-soft">{label}</div>
    </div>
  );
}

export default function OverviewPage() {
  const { metrics, loading, error } = useOperatorMetrics();

  if (loading && !metrics) return <div className="p-8 text-ink-soft">Загрузка…</div>;
  if (error) return <div className="p-8 text-danger">Ошибка загрузки: {error}</div>;
  if (!metrics) return null;

  const needsAttention = metrics.stuckSearches.length > 0 || metrics.openDisputesCount > 0;

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="text-2xl font-extrabold text-ink">Обзор</div>

      {needsAttention && <div className="text-sm font-extrabold text-danger">Требует внимания</div>}
      <div className="grid grid-cols-4 gap-3">
        <AttentionCard href="/orders" count={metrics.stuckSearches.length} label="поиск без мастера > 5 мин" danger />
        <AttentionCard href="/disputes" count={metrics.openDisputesCount} label="открытых спора" />
        <AttentionCard href="/verification" count={metrics.pendingVerificationCount} label="анкеты на верификации" />
        <AttentionCard href="/withdrawals" count={metrics.pendingWithdrawalsCount} label="заявки на вывод" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard value={String(metrics.activeUrgentCount)} label="активных срочных" />
        <MetricCard value={String(metrics.publishedPlannedCount)} label="плановых опубликовано" />
        <MetricCard
          value={metrics.foundMasterRate === null ? '—' : `${metrics.foundMasterRate}%`}
          label="заказов нашли мастера"
        />
        <MetricCard value={formatSeconds(metrics.medianSearchSeconds)} label="медиана времени поиска" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-extrabold text-ink">Поиск без мастера — вмешательство оператора</div>
        {metrics.stuckSearches.length === 0 ? (
          <div className="text-sm text-ink-soft">Нет заявок, требующих вмешательства</div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[80px_130px_1fr_110px_150px] gap-3 border-b border-fill-soft pb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              <span>ID</span>
              <span>Категория</span>
              <span>Адрес</span>
              <span>Волна</span>
              <span></span>
            </div>
            {metrics.stuckSearches.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[80px_130px_1fr_110px_150px] items-center gap-3 border-b border-fill-soft py-2.5 text-sm font-bold"
              >
                <span>#{s.id.slice(0, 6)}</span>
                <span>{s.category}</span>
                <span>{s.address}</span>
                <span className="text-danger">
                  волна {s.wave} · {formatSeconds(s.waitingSeconds)}
                </span>
                <Link
                  href={`/orders/${s.id}`}
                  className="rounded-pill bg-primary px-3 py-1.5 text-center text-xs font-extrabold text-white"
                >
                  Перейти к заказу
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 5: Живая проверка дашборда**

Запустить `relaxed-api`+`relaxed-operator` (если ещё не запущены),
залогиниться оператором (`7000000001`, как в Task 2). Проверить:

- На «Обзоре» отображаются 4 карточки «требует внимания» и 4 карточки
  метрик с реальными числами (если в локальной БД нет данных — все счётчики
  будут `0`, а метрики со средним/долей — `—`, это ожидаемо и корректно
  отображает пустое состояние).
- Бейджи в сайдбаре у «Верификация»/«Заказы»/«Споры»/«Вывод средств»
  показывают те же числа, что карточки на «Обзоре» (или отсутствуют, если
  число равно `0` — по логике `NavLink`).
- Создать через `apps/client` (или напрямую curl/API) одну срочную заявку,
  дождаться (или через Prisma-обновление в БД смоделировать) статус
  `SEARCHING`, `wave: 3`, `createdAt` больше 5 минут назад — обновить
  страницу (или подождать 30 секунд поллинга) и убедиться, что заявка
  появилась в таблице «Поиск без мастера» с корректными категорией/адресом/
  временем ожидания, а клик по «Перейти к заказу» даёт `404` (ожидаемо до
  Фазы C).

- [ ] **Step 6: Commit**

```bash
git add apps/operator/app apps/operator/components
git commit -m "feat(operator): раздел Обзор — дашборд /admin/metrics + живые бейджи в сайдбаре"
```

---

## Итог Фазы A

После выполнения всех 4 задач: рабочее приложение `apps/operator` на порту
4400 с SMS-OTP входом, гейтом по роли `OPERATOR`, сайдбаром на 9 разделов
(1 рабочий — «Обзор», 8 ведут на пока не реализованные страницы — ожидаемый
`404`) и живым дашбордом агрегатов, поллящим `/admin/metrics` каждые 30
секунд. Следующая фаза (Фаза B — Верификация/Пользователи/Мастера)
получит свой отдельный план непосредственно перед реализацией, как решено
в спеке Цикла B.
