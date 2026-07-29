# Публичный сайт MasterQala.kz (Next.js) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить новый workspace-пакет `apps/site` (Next.js, App Router) — публичный, не требующий входа сайт с 5 страницами: лендинг, страницы категорий услуг, страница для мастеров, «о нас», FAQ.

**Architecture:** Server Components без клиентского состояния. Единственный динамический источник данных — публичный `GET /api/v1/categories` существующего `apps/api` (fetch на этапе сборки/ISR, revalidate раз в сутки). Весь остальной контент — статичный текст в коде. `apps/web` не трогаем — сайт и приложение живут как раздельные origin (`masterqala.kz` / `app.masterqala.kz` в проде, разные dev-порты локально), связаны только обычными `<a href>` ссылками.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS 4, дизайн-токены из `@masterqala/ui/tokens.css` (переиспользуются только CSS-переменные, не React-компоненты пакета).

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-28-public-site-nextjs-design.md`.
- `apps/web` не изменяется в рамках этого плана — ни одного файла в `apps/web/`.
- Никакого экрана авторизации в `apps/site` — все переходы к приложению обычные `<a href>` на `app.masterqala.kz` (или локальный dev-адрес `apps/web`).
- Юнит-тестов нет — контент статичный, без бизнес-логики (решение зафиксировано в спеке). Проверка каждой задачи — через `curl` к запущенному dev/prod-серверу и явные ожидаемые строки в ответе.
- Слаги категорий берутся из `apps/api/prisma/seed.ts` и должны совпадать буквально: `plumbing`/Сантехника, `electrics`/Электрика, `appliances`/Бытовая техника, `locksmith`/Замки и двери, `handyman`/Мелкий ремонт, `other`/Другие услуги.
- Dev-порт `apps/site` — `4100` (не пересекается с `apps/api` на 3000/3001, `apps/web` на 5173/5180/5181, PostgreSQL на 5432/5433).
- Node.js 22.12.0, pnpm 9.15.0 — версии монорепо (см. `docs/technical/DEPLOYMENT_RUNBOOK.md`).
- Прод-деплой (Dockerfile, reverse proxy на реальном домене) — вне скоупа этого плана, отдельная механическая задача.

---

### Task 1: Каркас Next.js-приложения

**Files:**
- Create: `apps/site/package.json`
- Create: `apps/site/tsconfig.json`
- Create: `apps/site/next-env.d.ts`
- Create: `apps/site/next.config.ts`
- Create: `apps/site/app/layout.tsx`
- Create: `apps/site/app/page.tsx`
- Modify: `.gitignore:1-3` (добавить `.next/`)

**Interfaces:**
- Consumes: ничего — первая задача.
- Produces: рабочий Next.js dev-сервер на порту 4100. Task 2 добавляет стили и общий layout поверх этого каркаса.

- [ ] **Step 1: Создать `apps/site/package.json`**

```json
{
  "name": "site",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 4100",
    "build": "next build",
    "start": "next start -p 4100"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "~6.0.2"
  }
}
```

- [ ] **Step 2: Создать `apps/site/tsconfig.json`**

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

- [ ] **Step 3: Создать `apps/site/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: файл переcоздаётся автоматически командой `next dev`/`next build`, не редактировать вручную.
```

- [ ] **Step 4: Создать `apps/site/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Создать `apps/site/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MasterQala',
  description: 'Мастер на дом — быстро и по понятной цене',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Создать `apps/site/app/page.tsx`**

```tsx
export default function HomePage() {
  return <main>MasterQala</main>;
}
```

- [ ] **Step 7: Добавить `.next/` в корневой `.gitignore`**

Открыть `.gitignore`, добавить строку `.next/` рядом с существующей `dist/` (первые строки файла).

- [ ] **Step 8: Установить зависимости и проверить, что pnpm увидел новый пакет**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: в выводе присутствует `site@0.0.0 /path/to/apps/site (PRIVATE)` — `pnpm-workspace.yaml` уже покрывает `apps/*`, менять его не нужно.

- [ ] **Step 9: Запустить dev-сервер и проверить ответ**

Run:
```bash
pnpm --filter site dev &
sleep 3
curl -s http://localhost:4100/
kill %1
```
Expected: HTML-ответ содержит `MasterQala`.

- [ ] **Step 10: Commit**

`pnpm install` в Step 8 обновил корневой `pnpm-lock.yaml` (зарегистрировал `next`/`react`/`react-dom` для нового пакета) — этот файл обязателен в коммите, иначе `pnpm install --frozen-lockfile` на чистом клоне сломается.

```bash
git add apps/site .gitignore pnpm-lock.yaml
git commit -m "feat(site): каркас Next.js-приложения apps/site"
```

---

### Task 2: Дизайн-токены, Tailwind, общий Header/Footer

**Files:**
- Modify: `apps/site/package.json` (добавить зависимости)
- Create: `apps/site/postcss.config.mjs`
- Create: `apps/site/app/globals.css`
- Create: `apps/site/lib/env.ts`
- Create: `apps/site/components/Header.tsx`
- Create: `apps/site/components/Footer.tsx`
- Modify: `apps/site/app/layout.tsx`

**Interfaces:**
- Consumes: каркас из Task 1.
- Produces: `getApiUrl(): string`, `getAppUrl(): string`, `getContactPhone(): string`, `getContactEmail(): string` из `apps/site/lib/env.ts` — используются во всех последующих задачах. `<Header />`/`<Footer />` вшиты в `RootLayout`, отдельно не импортируются другими страницами.

- [ ] **Step 1: Добавить зависимости в `apps/site/package.json`**

Дописать в `"dependencies"`:
```json
    "@masterqala/ui": "workspace:*",
```
Дописать в `"devDependencies"`:
```json
    "@tailwindcss/postcss": "^4.3.2",
    "tailwindcss": "^4.3.2",
```

- [ ] **Step 2: Создать `apps/site/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: Создать `apps/site/app/globals.css`**

```css
@import "tailwindcss";
@import "@masterqala/ui/tokens.css";
@source "../app";
@source "../components";

body {
  background: var(--color-background);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 4: Создать `apps/site/lib/env.ts`**

```ts
export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000/api/v1';
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:5173';
}

export function getContactPhone(): string {
  return process.env.CONTACT_PHONE ?? '+7 700 000 00 01 (заменить на реальный номер оператора перед запуском)';
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL ?? 'support@masterqala.kz (заменить на реальный адрес перед запуском)';
}
```

- [ ] **Step 5: Создать `apps/site/components/Header.tsx`**

```tsx
import Link from 'next/link';
import { getAppUrl } from '@/lib/env';

const NAV_LINKS = [
  { href: '/become-a-master', label: 'Стать мастером' },
  { href: '/about', label: 'О нас' },
  { href: '/faq', label: 'Вопросы' },
];

export function Header() {
  const appUrl = getAppUrl();

  return (
    <header className="relative border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-ink">
          MasterQala
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-ink-soft hover:text-ink">
              {link.label}
            </Link>
          ))}
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Войти
          </a>
        </nav>

        <details className="md:hidden">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">Меню</summary>
          <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-4 border-b border-border bg-surface px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-ink-soft">
                {link.label}
              </Link>
            ))}
            <a
              href={appUrl}
              className="rounded-pill bg-primary px-5 py-2 text-center text-sm font-semibold text-white"
            >
              Войти
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Создать `apps/site/components/Footer.tsx`**

```tsx
import Link from 'next/link';
import { getContactEmail, getContactPhone } from '@/lib/env';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-ink">MasterQala</p>
          <p>Мастер на дом — быстро и по понятной цене</p>
        </div>
        <nav className="flex flex-col gap-2 md:flex-row md:gap-6">
          <Link href="/about" className="hover:text-ink">О нас</Link>
          <Link href="/faq" className="hover:text-ink">Вопросы</Link>
          <Link href="/become-a-master" className="hover:text-ink">Стать мастером</Link>
        </nav>
        <div>
          <p>{getContactPhone()}</p>
          <p>{getContactEmail()}</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7: Обновить `apps/site/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala',
  description: 'Мастер на дом — быстро и по понятной цене',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Установить зависимости, запустить и проверить**

Run:
```bash
pnpm install
pnpm --filter site dev &
sleep 3
curl -s http://localhost:4100/ | grep -o 'rounded-pill bg-primary'
curl -s http://localhost:4100/ | grep -o '+7 700 000 00 01'
kill %1
```
Expected: обе строки найдены — кнопка «Войти» отрендерилась с нужными классами, плейсхолдер телефона оператора виден в футере (сигнал, что `CONTACT_PHONE` ещё не задан реальным значением).

- [ ] **Step 9: Commit**

```bash
git add apps/site package.json pnpm-lock.yaml
git commit -m "feat(site): дизайн-токены, Tailwind, общий Header/Footer"
```

---

### Task 3: Данные категорий, страницы `/categories/[slug]`, 404

**Files:**
- Create: `apps/site/lib/categories.ts`
- Create: `apps/site/lib/category-content.ts`
- Create: `apps/site/components/CategoryTile.tsx`
- Create: `apps/site/app/categories/[slug]/page.tsx`
- Create: `apps/site/app/not-found.tsx`

**Interfaces:**
- Consumes: `getApiUrl()` из `lib/env.ts` (Task 2).
- Produces: `type Category = { id: string; slug: string; name: string }`, `getCategories(): Promise<Category[]>` из `lib/categories.ts`; `getCategoryContent(slug: string): { description: string; typicalWork: string[] }` из `lib/category-content.ts`; `<CategoryTile category={Category} />` — используется в Task 4 (лендинг).

- [ ] **Step 1: Создать `apps/site/lib/categories.ts`**

```ts
import { getApiUrl } from './env';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${getApiUrl()}/categories`, {
    next: { revalidate: 86400 },
  });
  if (!response.ok) {
    throw new Error(`Не удалось получить категории: HTTP ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 2: Создать `apps/site/lib/category-content.ts`**

```ts
interface CategoryContent {
  description: string;
  typicalWork: string[];
}

const FALLBACK_CONTENT: CategoryContent = {
  description: 'Опишите задачу в заявке — подберём подходящего мастера.',
  typicalWork: ['Индивидуальные бытовые задачи', 'Консультация по объёму работ на месте'],
};

const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  plumbing: {
    description:
      'Течи, засоры, установка и замена сантехники — мастер приезжает с инструментом и типовыми запчастями, стоимость выезда известна заранее.',
    typicalWork: [
      'Устранение протечек и засоров',
      'Замена смесителей и труб',
      'Установка стиральных и посудомоечных машин',
      'Ремонт унитазов и бачков',
      'Прочистка канализации',
    ],
  },
  electrics: {
    description:
      'От замены розетки до поиска короткого замыкания — работаем с проводкой, автоматами и освещением в квартирах и частных домах.',
    typicalWork: [
      'Замена розеток и выключателей',
      'Поиск и устранение короткого замыкания',
      'Установка люстр и светильников',
      'Замена автоматов и УЗО',
      'Прокладка новой проводки',
    ],
  },
  appliances: {
    description:
      'Ремонт и подключение бытовой техники на дому — от стиральных машин до холодильников, с диагностикой прямо на месте.',
    typicalWork: [
      'Ремонт стиральных и посудомоечных машин',
      'Ремонт холодильников',
      'Подключение варочных панелей и духовых шкафов',
      'Диагностика неисправностей',
      'Замена комплектующих',
    ],
  },
  locksmith: {
    description: 'Вскрытие, замена и ремонт замков, регулировка и установка входных и межкомнатных дверей.',
    typicalWork: [
      'Аварийное вскрытие замков',
      'Замена личинок и врезных замков',
      'Установка входных дверей',
      'Регулировка дверных петель',
      'Ремонт доводчиков',
    ],
  },
  handyman: {
    description:
      'Мелкие бытовые работы, которые не терпят отлагательств: сборка мебели, навеска карнизов, точечный ремонт стен и потолков.',
    typicalWork: [
      'Сборка и ремонт мебели',
      'Навеска карнизов, полок, техники на стену',
      'Точечная покраска и штукатурка',
      'Установка сантехнических аксессуаров',
      'Мелкий ремонт по дому',
    ],
  },
  other: {
    description: 'Бытовая задача не подошла под категорию выше? Опишите её в заявке — подберём подходящего мастера.',
    typicalWork: ['Индивидуальные бытовые задачи', 'Консультация по объёму работ на месте'],
  },
};

export function getCategoryContent(slug: string): CategoryContent {
  return CATEGORY_CONTENT[slug] ?? FALLBACK_CONTENT;
}
```

- [ ] **Step 3: Создать `apps/site/components/CategoryTile.tsx`**

```tsx
import Link from 'next/link';
import type { Category } from '@/lib/categories';

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-6 shadow-card transition hover:border-primary"
    >
      <span className="text-lg font-semibold text-ink">{category.name}</span>
      <span className="text-sm text-ink-soft">Смотреть →</span>
    </Link>
  );
}
```

- [ ] **Step 4: Создать `apps/site/app/categories/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { getCategories } from '@/lib/categories';
import { getCategoryContent } from '@/lib/category-content';
import { getAppUrl } from '@/lib/env';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }

  const content = getCategoryContent(category.slug);
  const appUrl = getAppUrl();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">{category.name}</h1>
      <p className="mt-4 text-lg text-ink-soft">{content.description}</p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Типовые работы</h2>
      <ul className="mt-4 flex flex-col gap-2 text-ink-soft">
        {content.typicalWork.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>—</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={appUrl}
        className="mt-10 inline-block rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
      >
        Оставить заявку
      </a>
    </main>
  );
}
```

- [ ] **Step 5: Создать `apps/site/app/not-found.tsx`**

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-3xl font-bold text-ink">Страница не найдена</h1>
      <p className="text-ink-soft">Такой страницы нет — возможно, ссылка устарела.</p>
      <Link href="/" className="rounded-pill bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-hover">
        На главную
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Проверить с реальным `apps/api`**

Требуется запущенный `apps/api` (см. `docs/technical/DEVELOPMENT.md`) с засеянными категориями (`prisma db seed`). Если API слушает не на `http://localhost:3000/api/v1`, передать `API_URL` явно.

Run:
```bash
pnpm --filter site build && pnpm --filter site start &
sleep 3
curl -s http://localhost:4100/categories/plumbing | grep -o 'Сантехника'
curl -s -o /dev/null -w '%{http_code}' http://localhost:4100/categories/does-not-exist
kill %1
```
Expected: первая команда находит `Сантехника` (реальное имя категории из API, не из статичного файла), вторая печатает `404`.

- [ ] **Step 7: Commit**

```bash
git add apps/site
git commit -m "feat(site): страницы категорий /categories/[slug] и 404"
```

---

### Task 4: Лендинг `/`

**Files:**
- Create: `apps/site/components/Hero.tsx`
- Create: `apps/site/components/HowItWorks.tsx`
- Modify: `apps/site/app/page.tsx`

**Interfaces:**
- Consumes: `getCategories()` (Task 3), `<CategoryTile />` (Task 3), `getAppUrl()` (Task 2).
- Produces: ничего нового для других задач — конечная страница.

- [ ] **Step 1: Создать `apps/site/components/Hero.tsx`**

```tsx
import { getAppUrl } from '@/lib/env';

export function Hero() {
  const appUrl = getAppUrl();

  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 text-center md:py-28">
        <h1 className="text-4xl font-bold text-ink md:text-5xl">Мастер на дом — быстро и по понятной цене</h1>
        <p className="mx-auto max-w-2xl text-lg text-ink-soft">
          Сантехник, электрик или мастер по ремонту техники приедут в удобное время. Вы видите стоимость выезда
          заранее и платите мастеру напрямую после работы.
        </p>
        <div className="mx-auto flex flex-col gap-4 sm:flex-row">
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
          >
            Оставить заявку
          </a>
          <a
            href="/become-a-master"
            className="rounded-pill border border-primary px-8 py-3 font-semibold text-primary hover:bg-fill-soft"
          >
            Стать мастером
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Создать `apps/site/components/HowItWorks.tsx`**

```tsx
const STEPS = [
  {
    title: 'Опишите проблему',
    description: 'Выберите категорию и укажите адрес — система сразу покажет стоимость выезда.',
  },
  {
    title: 'Мастер принимает заявку',
    description: 'Ближайший свободный мастер откликается и сообщает время приезда.',
  },
  {
    title: 'Оплата после работы',
    description: 'Мастер называет цену на месте, вы её подтверждаете и платите напрямую — без переплат посредникам.',
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center text-3xl font-bold text-ink">Как это работает</h2>
      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex flex-col gap-2 rounded-md bg-surface p-6 shadow-card">
            <span className="text-sm font-semibold text-primary">Шаг {index + 1}</span>
            <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
            <p className="text-sm text-ink-soft">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Обновить `apps/site/app/page.tsx`**

```tsx
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { CategoryTile } from '@/components/CategoryTile';
import { getCategories } from '@/lib/categories';
import { getAppUrl } from '@/lib/env';

export default async function HomePage() {
  const categories = await getCategories();
  const appUrl = getAppUrl();

  return (
    <main>
      <Hero />
      <HowItWorks />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-ink">Категории услуг</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {categories.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="bg-fill-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-ink">Нужен мастер прямо сейчас?</h2>
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
          >
            Оставить заявку
          </a>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Проверить**

Run:
```bash
pnpm --filter site build && pnpm --filter site start &
sleep 3
curl -s http://localhost:4100/ | grep -o 'Мастер на дом — быстро и по понятной цене'
curl -s http://localhost:4100/ | grep -o 'Шаг 3'
curl -s http://localhost:4100/ | grep -c 'categories/'
kill %1
```
Expected: первые две строки находятся, третья команда печатает число ≥6 (ссылки на страницы категорий из сетки тизера).

- [ ] **Step 5: Commit**

```bash
git add apps/site
git commit -m "feat(site): лендинг с хиро, как это работает, сеткой категорий"
```

---

### Task 5: Страница «Стать мастером»

**Files:**
- Create: `apps/site/app/become-a-master/page.tsx`

**Interfaces:**
- Consumes: `getAppUrl()` (Task 2).
- Produces: ничего нового — конечная страница.

- [ ] **Step 1: Создать `apps/site/app/become-a-master/page.tsx`**

```tsx
import { getAppUrl } from '@/lib/env';

const HOW_IT_WORKS = [
  {
    title: 'Срочные заявки — бесплатно',
    description: 'Мастер получает срочные заявки в радиусе поиска без каких-либо платежей — плата берётся с клиента.',
  },
  {
    title: 'Плановые заявки — по lead-кредитам',
    description: 'За отклик на плановую заявку списывается lead-кредит. Если клиент не выбрал вас — кредит возвращается.',
  },
  {
    title: '100% стоимости работ — ваши',
    description: 'Платформа не берёт комиссию с работы. Доход платформы — только сервисный сбор с клиента и lead-кредиты.',
  },
];

const REQUIREMENTS = [
  'Подтверждённые документы и опыт в выбранной категории',
  'Ручная проверка оператором перед первым заказом',
  'Работа в выбранном районе — сами решаете, в каком радиусе принимать заявки',
];

export default function BecomeAMasterPage() {
  const appUrl = getAppUrl();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Станьте мастером MasterQala</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Получайте заявки от клиентов рядом с вами — без ежемесячной платы за рекламу.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Как это работает</h2>
      <div className="mt-4 flex flex-col gap-4">
        {HOW_IT_WORKS.map((item) => (
          <div key={item.title} className="rounded-md border border-border bg-surface p-4">
            <p className="font-semibold text-ink">{item.title}</p>
            <p className="text-sm text-ink-soft">{item.description}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold text-ink">Что нужно для старта</h2>
      <ul className="mt-4 flex flex-col gap-2 text-ink-soft">
        {REQUIREMENTS.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>—</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={`${appUrl}/become-master`}
        className="mt-10 inline-block rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
      >
        Подать заявку
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Проверить**

Run:
```bash
pnpm --filter site build && pnpm --filter site start &
sleep 3
curl -s http://localhost:4100/become-a-master | grep -o 'Станьте мастером MasterQala'
curl -s http://localhost:4100/become-a-master | grep -o 'href="http://localhost:5173/become-master"'
kill %1
```
Expected: обе строки найдены — заголовок и корректная ссылка на `/become-master` в `apps/web`.

- [ ] **Step 3: Commit**

```bash
git add apps/site
git commit -m "feat(site): страница «Стать мастером»"
```

---

### Task 6: Страницы «О нас» и «Вопросы»

**Files:**
- Create: `apps/site/app/about/page.tsx`
- Create: `apps/site/app/faq/page.tsx`

**Interfaces:**
- Consumes: `getContactPhone()`, `getContactEmail()` (Task 2).
- Produces: ничего нового — конечные страницы.

- [ ] **Step 1: Создать `apps/site/app/about/page.tsx`**

```tsx
import { getContactEmail, getContactPhone } from '@/lib/env';

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">О MasterQala</h1>
      <p className="mt-4 text-lg text-ink-soft">
        MasterQala — сервис вызова мастеров бытовых услуг на дом. Мы работаем в Астане (пилотный запуск — Есильский
        район) и соединяем клиентов с проверенными мастерами: сантехниками, электриками, специалистами по ремонту
        бытовой техники и мелкому ремонту.
      </p>
      <p className="mt-4 text-lg text-ink-soft">
        Каждый мастер проходит ручную проверку перед тем, как начать принимать заказы. Мастер оставляет себе 100%
        стоимости выполненных работ — платформа не берёт комиссию с работы.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Контакты</h2>
      <p className="mt-2 text-ink-soft">{getContactPhone()}</p>
      <p className="text-ink-soft">{getContactEmail()}</p>
    </main>
  );
}
```

- [ ] **Step 2: Создать `apps/site/app/faq/page.tsx`**

```tsx
const FAQ_ITEMS = [
  {
    question: 'Как оплатить работу мастера?',
    answer:
      'Вы платите мастеру напрямую после выполнения работы — сервис не участвует в расчёте за саму работу. Сервисный сбор за срочный вызов списывается через приложение.',
  },
  {
    question: 'Что если мастер не приехал?',
    answer:
      'Если мастер не подтвердил приезд или не вышел на связь, заявка автоматически уходит следующему свободному мастеру в радиусе поиска — вы не остаётесь без помощи.',
  },
  {
    question: 'В каких районах вы работаете?',
    answer:
      'Сейчас сервис работает в пилотном режиме в Астане (Есильский район). География расширяется по мере роста числа мастеров.',
  },
  {
    question: 'Как вы проверяете мастеров?',
    answer: 'Каждый мастер проходит ручную проверку документов и опыта оператором перед тем, как получить доступ к заявкам.',
  },
  {
    question: 'Можно ли узнать цену заранее?',
    answer:
      'Стоимость выезда мастера показывается сразу при создании срочной заявки. Итоговая цена работ называется мастером на месте после осмотра и требует вашего подтверждения до начала работ.',
  },
  {
    question: 'Что делать, если возник спор с мастером?',
    answer:
      'В приложении можно открыть спор по заявке — его разбирает оператор поддержки и принимает решение по компенсации при необходимости.',
  },
  {
    question: 'Нужно ли скачивать приложение?',
    answer: 'Нет, MasterQala работает как веб-приложение прямо в браузере — устанавливать ничего не нужно.',
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Частые вопросы</h1>
      <div className="mt-8 flex flex-col divide-y divide-border">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold text-ink">{item.question}</summary>
            <p className="mt-2 text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Проверить**

Run:
```bash
pnpm --filter site build && pnpm --filter site start &
sleep 3
curl -s http://localhost:4100/about | grep -o 'Есильский район'
curl -s http://localhost:4100/faq | grep -c '<summary'
kill %1
```
Expected: первая команда находит строку, вторая печатает `7` (число вопросов).

- [ ] **Step 4: Commit**

```bash
git add apps/site
git commit -m "feat(site): страницы «О нас» и «Вопросы»"
```

---

### Task 7: Полная проверка production-сборки

**Files:** нет создаваемых/изменяемых файлов — задача только на проверку интеграции всех предыдущих задач вместе.

**Interfaces:**
- Consumes: все страницы и компоненты из Task 1-6.
- Produces: ничего — финальный чек-пойнт перед тем, как план считается выполненным.

- [ ] **Step 1: Чистая production-сборка**

Run: `rm -rf apps/site/.next && pnpm --filter site build`
Expected: сборка завершается без ошибок, в выводе перечислены все статичные маршруты: `/`, `/about`, `/faq`, `/become-a-master`, `/categories/plumbing`, `/categories/electrics`, `/categories/appliances`, `/categories/locksmith`, `/categories/handyman`, `/categories/other`.

- [ ] **Step 2: Проверить все маршруты на запущенном production-сервере**

Run:
```bash
pnpm --filter site start &
sleep 3
for path in / /about /faq /become-a-master /categories/plumbing /categories/electrics /categories/appliances /categories/locksmith /categories/handyman /categories/other; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4100${path}")
  echo "${path}: ${code}"
done
curl -s -o /dev/null -w '/categories/unknown-slug: %{http_code}\n' http://localhost:4100/categories/unknown-slug
kill %1
```
Expected: все 10 маршрутов из первого цикла — `200`, последний (`/categories/unknown-slug`) — `404`.

- [ ] **Step 3: Проверить, что ни одна ссылка не ведёт в `apps/site` саму по себе для «Войти»/CTA**

Run: `grep -rn 'appUrl' apps/site/app apps/site/components`
Expected: каждое вхождение — использование `appUrl` в `href` для перехода на внешний `APP_URL` (кнопки «Войти», «Оставить заявку», «Подать заявку»). Ни одного внутреннего `<a href="/...">` для действий, требующих авторизации (создание заявки, кабинет мастера).

Ничего не меняется — коммит не требуется, это финальная проверка.
