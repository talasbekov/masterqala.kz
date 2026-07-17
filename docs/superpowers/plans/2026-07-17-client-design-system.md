# Client Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the 7 client-facing screens of MasterQala.kz's web PWA (`apps/web`) with a warm, cozy, category-driven visual language, built on a small reusable component library — visual layer only, no changes to API calls, hooks, or routing.

**Architecture:** Design tokens (colors, radii, shadow, font) defined once via Tailwind 4's CSS-first `@theme` in `apps/web/src/index.css`. A small component library lives in `apps/web/src/components/ui/` (Button, Card, Avatar, StatusPill, CategoryTile, EmptyState, plus an SVG icon set) — built bottom-up, each component independently buildable before any page consumes it. The 7 pages are then redesigned one at a time, reusing these primitives, with all existing state/handlers/API calls copied verbatim.

**Tech Stack:** React 19, Vite, Tailwind CSS 4 (`@theme` CSS-first config, no `tailwind.config.js`), TypeScript, React Router 7.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-client-design-system-design.md` — read it for full rationale before starting.
- Visual layer only. Do not change: API endpoints called, request/response shapes, state variable names/types, event handler logic, routing paths. Every task's JSX changes are restyling + swapping raw HTML elements for the new `components/ui/*` primitives — the underlying behavior must be identical to what exists today.
- No frontend test framework exists in this repo and adding one is explicitly out of scope (see spec). **Verification for every task is `pnpm --filter web build` (runs `tsc -b && vite build`) passing with zero errors** — this catches type errors, unused-import errors (`noUnusedLocals`/`noUnusedParameters` are enabled in `apps/web/tsconfig.app.json`), and build failures. Run it from the repo root: `/home/erda/Музыка/MasterQala.kz`.
- Do not fabricate data. The backend has confirmed **no master rating field and no order ETA field anywhere in the schema** (`apps/api/prisma/schema.prisma`) — `ORDER_INCLUDE`/`PLANNED_ORDER_INCLUDE` only ever expose `master: { id, name, phone }`. Do not add a rating badge, star rating, or "N min" ETA text anywhere — these were present only in the throwaway HTML mockup used during brainstorming and must not leak into real code.
- Design tokens (exact values, from the spec) — every task below uses these names, defined in Task 1:
  - Colors: `--color-primary: #1E40AF`, `--color-primary-light: #3B82F6`, `--color-accent: #EA580C`, `--color-background: #FFFCF5`, `--color-surface: #FFFFFF`, `--color-foreground: #1B1B1F`, `--color-muted: #8A8A8F`, `--color-border: #F0EAE0`, `--color-success: #059669`, `--color-destructive: #DC2626`
  - Radii: `--radius-sm: 10px`, `--radius-md: 14px`, `--radius-lg: 18px`
  - Shadow: `--shadow-card: 0 2px 8px rgba(20, 20, 30, 0.06)`
  - Font: Manrope (via Google Fonts), applied through `--font-sans`
- Only two categories currently exist in the seed data (`apps/api/prisma/seed.ts`): `plumbing` ("Сантехника") and `electrics` ("Электрика"). The category icon map (Task 7) must cover exactly these two, plus a generic fallback icon for any future category — never invent icons for categories that don't exist in the seed.

---

### Task 1: Design tokens

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Tailwind utility classes available to every later task: `bg-primary`/`text-primary`/`border-primary` (and `-light`/`-accent`/`-background`/`-surface`/`-foreground`/`-muted`/`-border`/`-success`/`-destructive` variants), `rounded-sm`/`rounded-md`/`rounded-lg` (overridden to 10/14/18px), `shadow-card`. Body font is Manrope app-wide — no utility class needed to opt in.

- [ ] **Step 1: Replace `apps/web/src/index.css`**

```css
@import "tailwindcss";

@theme {
  --color-primary: #1E40AF;
  --color-primary-light: #3B82F6;
  --color-accent: #EA580C;
  --color-background: #FFFCF5;
  --color-surface: #FFFFFF;
  --color-foreground: #1B1B1F;
  --color-muted: #8A8A8F;
  --color-border: #F0EAE0;
  --color-success: #059669;
  --color-destructive: #DC2626;

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;

  --shadow-card: 0 2px 8px rgba(20, 20, 30, 0.06);

  --font-sans: 'Manrope', ui-sans-serif, system-ui, sans-serif;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Add the Manrope font link to `apps/web/index.html`**

Insert these three lines inside `<head>`, right after the `viewport` meta tag (before `<title>`):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0, no TypeScript or Vite errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css apps/web/index.html
git commit -m "feat(web): design tokens for client redesign (colors, radii, shadow, Manrope)"
```

---

### Task 2: Icon set

**Files:**
- Create: `apps/web/src/components/ui/icons.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `WrenchIcon`, `BoltIcon`, `MoreIcon`, `HomeIcon`, `ListIcon`, `UserIcon`, `ChevronRightIcon` — each `(props: SVGProps<SVGSVGElement>) => JSX.Element`, monoline stroke, sized via `className` (e.g. `className="h-5 w-5"`), color via `text-*` (uses `currentColor`).

- [ ] **Step 1: Create `apps/web/src/components/ui/icons.tsx`**

```tsx
import type { SVGProps } from 'react';

function iconProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  };
}

export function WrenchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function ListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/icons.tsx
git commit -m "feat(web): monoline SVG icon set for client redesign"
```

---

### Task 3: Button component

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `Button` default export. Props: `variant?: 'primary' | 'secondary' | 'danger-outline'` (default `'primary'`), plus every native `<button>` prop (`onClick`, `disabled`, `type`, etc.), `children: ReactNode`. Always full width (`w-full`) — every consuming page in this plan uses it full-width.

- [ ] **Step 1: Create `apps/web/src/components/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger-outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'border-2 border-primary text-primary bg-transparent',
  'danger-outline': 'border-2 border-destructive/40 text-destructive bg-transparent',
};

export default function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`w-full rounded-full px-6 py-3.5 text-[15px] font-bold transition active:scale-[0.97] disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx
git commit -m "feat(web): Button primitive (primary/secondary/danger-outline)"
```

---

### Task 4: Card component

**Files:**
- Create: `apps/web/src/components/ui/Card.tsx`

**Interfaces:**
- Consumes: `--radius-lg`, `--shadow-card`, `--color-surface` tokens (Task 1)
- Produces: `Card` default export. Props: every native `<div>` prop plus `children: ReactNode`. Renders `rounded-lg bg-surface p-4 shadow-card` plus any passed `className` appended (only use `className` for additive layout classes like `flex items-center gap-3` — do not try to override `bg-surface`/`shadow-card` via className, Tailwind's generated CSS order does not guarantee a later class in the string wins).

- [ ] **Step 1: Create `apps/web/src/components/ui/Card.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`rounded-lg bg-surface p-4 shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Card.tsx
git commit -m "feat(web): Card primitive"
```

---

### Task 5: Avatar component

**Files:**
- Create: `apps/web/src/components/ui/Avatar.tsx`

**Interfaces:**
- Consumes: `--color-primary` token (Task 1)
- Produces: `Avatar` default export. Props: `name?: string | null`, `size?: number` (default `44`). Renders a colored circle with the first letters of up to two words in `name`, or `?` if `name` is missing.

- [ ] **Step 1: Create `apps/web/src/components/ui/Avatar.tsx`**

```tsx
interface AvatarProps {
  name?: string | null;
  size?: number;
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function Avatar({ name, size = 44 }: AvatarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Avatar.tsx
git commit -m "feat(web): Avatar primitive (initials-based)"
```

---

### Task 6: Status variant mapping + StatusPill component

**Files:**
- Modify: `apps/web/src/orderStatus.ts` (append to end of file)
- Create: `apps/web/src/components/ui/StatusPill.tsx`

**Interfaces:**
- Consumes: `--color-primary`, `--color-accent`, `--color-success`, `--color-destructive` tokens (Task 1)
- Produces: `orderStatus.ts` exports a new type `StatusVariant = 'info' | 'active' | 'success' | 'danger'` and two functions `urgentStatusVariant(status: string): StatusVariant`, `plannedStatusVariant(status: string): StatusVariant`. `StatusPill` default export takes `variant: StatusVariant` and `children: ReactNode`.

- [ ] **Step 1: Append to `apps/web/src/orderStatus.ts`**

Add this to the end of the existing file (do not remove or change anything already there):

```ts
export type StatusVariant = 'info' | 'active' | 'success' | 'danger';

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

- [ ] **Step 2: Create `apps/web/src/components/ui/StatusPill.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { StatusVariant } from '../../orderStatus';

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  info: 'bg-primary/10 text-primary',
  active: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
};

interface StatusPillProps {
  variant: StatusVariant;
  children: ReactNode;
}

export default function StatusPill({ variant, children }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/orderStatus.ts apps/web/src/components/ui/StatusPill.tsx
git commit -m "feat(web): status→color semantic mapping + StatusPill primitive"
```

---

### Task 7: Category icon map + CategoryTile component

**Files:**
- Create: `apps/web/src/components/ui/categoryIcons.tsx`
- Create: `apps/web/src/components/ui/CategoryTile.tsx`

**Interfaces:**
- Consumes: `WrenchIcon`, `BoltIcon`, `MoreIcon` from Task 2; `--radius-lg`, `--shadow-card`, `--color-surface`, `--color-foreground` tokens from Task 1
- Produces: `categoryIcon(slug: string): { Icon: ComponentType<SVGProps<SVGSVGElement>>; bg: string; color: string }` — used by any page rendering a category grid. `CategoryTile` default export, props: `label: string`, `icon: ReactNode`, `iconBg: string`, `iconColor: string`, `onClick?: () => void`.

- [ ] **Step 1: Create `apps/web/src/components/ui/categoryIcons.tsx`**

```tsx
import type { ComponentType, SVGProps } from 'react';
import { WrenchIcon, BoltIcon, MoreIcon } from './icons';

interface CategoryIconInfo {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  bg: string;
  color: string;
}

const CATEGORY_ICONS: Record<string, CategoryIconInfo> = {
  plumbing: { Icon: WrenchIcon, bg: '#DBEAFE', color: '#1E40AF' },
  electrics: { Icon: BoltIcon, bg: '#FEF3C7', color: '#B45309' },
};

const DEFAULT_ICON: CategoryIconInfo = { Icon: MoreIcon, bg: '#EDEAE2', color: '#8A8A8F' };

export function categoryIcon(slug: string): CategoryIconInfo {
  return CATEGORY_ICONS[slug] ?? DEFAULT_ICON;
}
```

- [ ] **Step 2: Create `apps/web/src/components/ui/CategoryTile.tsx`**

```tsx
import type { ReactNode } from 'react';

interface CategoryTileProps {
  label: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}

export default function CategoryTile({ label, icon, iconBg, iconColor, onClick }: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg bg-surface p-3 text-center shadow-card"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-md"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
    </button>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/categoryIcons.tsx apps/web/src/components/ui/CategoryTile.tsx
git commit -m "feat(web): CategoryTile primitive + slug→icon map"
```

---

### Task 8: EmptyState component

**Files:**
- Create: `apps/web/src/components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: `--radius-lg`, `--shadow-card`, `--color-surface`, `--color-muted`, `--color-foreground` tokens (Task 1)
- Produces: `EmptyState` default export. Props: `icon: ReactNode`, `title: string`, `subtitle?: string`.

- [ ] **Step 1: Create `apps/web/src/components/ui/EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-surface py-12 text-center shadow-card">
      <span className="text-muted">{icon}</span>
      <p className="font-bold text-foreground">{title}</p>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/EmptyState.tsx
git commit -m "feat(web): EmptyState primitive"
```

---

### Task 9: BottomTabBar redesign + Layout spacing

**Files:**
- Modify: `apps/web/src/components/TabBar.tsx` (full replace)
- Modify: `apps/web/src/Layout.tsx` (full replace)

**Interfaces:**
- Consumes: `HomeIcon`, `ListIcon`, `UserIcon`, `WrenchIcon` from Task 2; `--color-primary`, `--color-muted`, `--color-border`, `--color-surface`, `--color-background` tokens from Task 1. `useMasterActive` export is unchanged and still used by `WorkPage`/other consumers — do not rename or remove it.
- Produces: nothing new consumed by later tasks — this is a leaf UI change.

- [ ] **Step 1: Replace `apps/web/src/components/TabBar.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { HomeIcon, ListIcon, UserIcon, WrenchIcon } from './ui/icons';

export function useMasterActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    api('/masters/application')
      .then((p) => setActive(p?.status === 'ACTIVE'))
      .catch(() => setActive(false));
  }, []);
  return active;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${isActive ? 'text-primary' : 'text-muted'}`;

export default function TabBar() {
  const isMaster = useMasterActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface">
      <NavLink to="/" end className={tabClass}>
        <HomeIcon className="h-5 w-5" />
        Главная
      </NavLink>
      <NavLink to="/orders" className={tabClass}>
        <ListIcon className="h-5 w-5" />
        Заявки
      </NavLink>
      {isMaster && (
        <NavLink to="/work" className={tabClass}>
          <WrenchIcon className="h-5 w-5" />
          Работа
        </NavLink>
      )}
      <NavLink to="/profile" className={tabClass}>
        <UserIcon className="h-5 w-5" />
        Профиль
      </NavLink>
    </nav>
  );
}
```

- [ ] **Step 2: Replace `apps/web/src/Layout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 4: Manual visual check**

Run: `cd /home/erda/Музыка/MasterQala.kz/apps/web && pnpm dev`
Open the printed local URL, log in, confirm the bottom tab bar shows icon+label for each tab and the active tab is colored `primary` blue. Stop the dev server after checking (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TabBar.tsx apps/web/src/Layout.tsx
git commit -m "feat(web): redesign bottom tab bar with icons"
```

---

### Task 10: LoginPage redesign

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx` (full replace)

**Interfaces:**
- Consumes: `Button`, `Card` from Tasks 3–4
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace `apps/web/src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function requestCode() {
    setError('');
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone }) });
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError('');
    try {
      const res = await api('/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone, code }) });
      login(res.accessToken, res.user);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 bg-background p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">MasterQala</h1>
        <p className="mt-1 text-sm text-muted">Мастер на дом за пару минут</p>
      </div>
      <Card className="space-y-4">
        {step === 'phone' ? (
          <>
            <input
              className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
              placeholder="+7 707 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={requestCode}>Получить код</Button>
          </>
        ) : (
          <>
            <input
              className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
              placeholder="Код из SMS"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verify}>Войти</Button>
          </>
        )}
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/LoginPage.tsx
git commit -m "feat(web): redesign LoginPage"
```

---

### Task 11: HomePage redesign

**Files:**
- Modify: `apps/web/src/pages/HomePage.tsx` (full replace)

**Interfaces:**
- Consumes: `Card`, `Avatar`, `StatusPill`, `CategoryTile` (Tasks 3–8), `categoryIcon` (Task 7), `ChevronRightIcon` (Task 2), `urgentStatusVariant` (Task 6)
- Produces: nothing consumed by later tasks
- New behavior vs. today: fetches `/categories` (same endpoint `NewOrderPage` already calls) to render a category grid. Tapping a category tile navigates to `/order/new` (same destination as the existing "Вызвать мастера" action) — it does **not** preselect the category, since `NewOrderPage` has no query-param support and adding one would be a logic change outside this plan's visual-only scope.

- [ ] **Step 1: Replace `apps/web/src/pages/HomePage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { useAuth } from '../auth';
import { STATUS_LABELS, urgentStatusVariant } from '../orderStatus';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';
import CategoryTile from '../components/ui/CategoryTile';
import { categoryIcon } from '../components/ui/categoryIcons';
import { ChevronRightIcon } from '../components/ui/icons';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
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

  if (loading) return <div className="p-6 text-muted">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm space-y-6 p-6">
      <div>
        <p className="text-sm text-muted">Добрый день</p>
        <h1 className="text-xl font-extrabold text-foreground">{user?.name ?? 'Гость'}</h1>
      </div>

      {order && (
        <Link to={`/order/${order.id}`}>
          <Card className="flex items-center gap-3">
            <Avatar name={order.master?.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-foreground">{order.category?.name}</div>
              <div className="truncate text-sm text-muted">{order.address}</div>
              <div className="mt-1.5">
                <StatusPill variant={urgentStatusVariant(order.status)}>{STATUS_LABELS[order.status]}</StatusPill>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {categories.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-extrabold text-foreground">Категории услуг</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {categories.map((c) => {
              const { Icon, bg, color } = categoryIcon(c.slug);
              return (
                <CategoryTile
                  key={c.id}
                  label={c.name}
                  icon={<Icon className="h-6 w-6" />}
                  iconBg={bg}
                  iconColor={color}
                  onClick={() => navigate('/order/new')}
                />
              );
            })}
          </div>
        </div>
      )}

      {!order && (
        <button
          onClick={() => navigate('/order/new')}
          className="flex w-full items-center justify-between gap-3 rounded-lg bg-primary p-4 text-left text-white"
        >
          <div>
            <div className="font-bold">Срочно нужен мастер?</div>
            <div className="mt-0.5 text-[13px] opacity-85">Найдём ближайшего свободного</div>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-bold">Вызвать</span>
        </button>
      )}

      <Link
        to="/planned/new"
        className="flex items-center justify-between rounded-md border-2 border-dashed border-primary-light/40 bg-surface p-3.5"
      >
        <div>
          <div className="text-[13px] font-bold text-primary">Запланировать на удобное время</div>
          <div className="text-xs text-muted">Ставки от мастеров, вы выбираете</div>
        </div>
        <ChevronRightIcon className="h-4 w-4 text-primary" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Manual visual check**

Run: `cd /home/erda/Музыка/MasterQala.kz/apps/web && pnpm dev`, open the app, log in as a client with no active order. Confirm: greeting shows your name, category grid shows "Сантехника" and "Электрика" with distinct colored icons, "Срочно нужен мастер?" banner and "Запланировать" row both render. Stop the dev server after (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/HomePage.tsx
git commit -m "feat(web): redesign HomePage with category grid"
```

---

### Task 12: NewOrderPage redesign

**Files:**
- Modify: `apps/web/src/pages/NewOrderPage.tsx` (full replace)

**Interfaces:**
- Consumes: `Button` (Task 3)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace `apps/web/src/pages/NewOrderPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Button from '../components/ui/Button';

interface Geo {
  lat: number;
  lng: number;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function detectGeo() {
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Не удалось определить геолокацию — разрешите доступ и нажмите «Обновить»'),
    );
  }

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
    detectGeo();
  }, []);

  useEffect(() => {
    if (!categoryId || !geo) return setPreview(null);
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, ...geo }) })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [categoryId, geo]);

  async function submit() {
    if (!categoryId || !geo || !description || !address) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ categoryId, description, address, ...geo }),
      });
      navigate(`/order/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  const canSubmit = categoryId && geo && description && address && preview?.available && !submitting;

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-extrabold text-foreground">Вызвать мастера</h1>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
              categoryId === c.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
        rows={3}
        placeholder="Опишите проблему"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={geo ? 'font-semibold text-primary' : 'text-muted'}>
            {geo ? 'Геолокация определена' : 'Определяем геолокацию…'}
          </span>
          <button className="font-semibold text-primary underline" onClick={detectGeo}>
            Обновить
          </button>
        </div>
        {geoError && <p className="text-sm text-destructive">{geoError}</p>}
        <input
          className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
          placeholder="Адрес (улица, дом, квартира)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {preview && preview.available && (
        <div className="rounded-lg bg-primary/5 p-4">
          <div className="text-lg font-extrabold text-primary">Выезд: {preview.calloutPrice} ₸</div>
          <p className="text-sm text-muted">Работа оплачивается мастеру напрямую после согласования цены.</p>
        </div>
      )}
      {preview && !preview.available && (
        <div className="rounded-lg bg-accent/10 p-4 text-sm text-accent">Мастеров рядом нет — попробуйте позже.</div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Создаём…' : 'Вызвать мастера'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/NewOrderPage.tsx
git commit -m "feat(web): redesign NewOrderPage"
```

---

### Task 13: OrderPage redesign

**Files:**
- Modify: `apps/web/src/pages/OrderPage.tsx` (full replace)

**Interfaces:**
- Consumes: `Card`, `Button`, `Avatar`, `StatusPill` (Tasks 3–6), `urgentStatusVariant` (Task 6)
- Produces: nothing consumed by later tasks
- Refactor note: the dispute UI block was duplicated verbatim twice in the original file (terminal-status branch and active-order branch). This task extracts it into a local `DisputeCard` component at the top of the file — same JSX, same behavior, defined once. This is a pre-existing duplication noted in the stage 5 review backlog; fixing it here is low-risk since every line touched by the redesign anyway.

- [ ] **Step 1: Replace `apps/web/src/pages/OrderPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS, STEPPER_STEPS, WAVE_TEXTS, isTerminalStatus, urgentStatusVariant } from '../orderStatus';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function DisputeCard({
  dispute,
  counterStatement,
  onCounterStatementChange,
  onSubmitCounterStatement,
  onUploadEvidence,
}: {
  dispute: any;
  counterStatement: string;
  onCounterStatementChange: (v: string) => void;
  onSubmitCounterStatement: () => void;
  onUploadEvidence: (file: File) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-accent/30 bg-accent/5 p-4 text-left">
      <div className="font-bold text-accent">Спор {dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
      <p className="text-sm text-foreground">{dispute.reason}</p>
      {dispute.counterStatement && <p className="text-sm text-muted">Пояснение: {dispute.counterStatement}</p>}
      {dispute.status === 'RESOLVED' && (
        <p className="text-sm text-muted">
          Решение: {dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
        </p>
      )}
      {dispute.status === 'OPEN' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0])}
          />
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Пояснение (для второй стороны)"
            value={counterStatement}
            onChange={(e) => onCounterStatementChange(e.target.value)}
          />
          <button
            className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-foreground"
            onClick={onSubmitCounterStatement}
          >
            Отправить пояснение
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');
  const now = useNow();

  const load = useCallback(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = (p: any) => {
      if (p.orderId === id) load();
    };
    socket.on('order:status', onStatus);
    socket.io.on('reconnect', load); // fallback: рефетч при переподключении
    return () => {
      socket.off('order:status', onStatus);
      socket.io.off('reconnect', load);
    };
  }, [id, load]);

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  const [disputeReason, setDisputeReason] = useState('');
  const [counterStatement, setCounterStatement] = useState('');
  const canDispute = order && ['DONE', 'IN_PROGRESS', 'CLOSED'].includes(order.status) && !order.dispute;

  async function openDispute() {
    if (!disputeReason.trim()) return;
    try {
      await api(`/orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
      setDisputeReason('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submitCounterStatement() {
    if (!order?.dispute || !counterStatement.trim()) return;
    try {
      await api(`/disputes/${order.dispute.id}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
      setCounterStatement('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function uploadEvidence(file: File) {
    if (!order?.dispute) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${order.dispute.id}/evidence`, fd);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !order) return <div className="p-6 text-destructive">{error}</div>;
  if (!order) return <div className="p-6 text-muted">Загрузка…</div>;

  if (order.status === 'SEARCHING') {
    return (
      <div className="mx-auto max-w-sm space-y-6 p-6 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-semibold text-foreground">{WAVE_TEXTS[order.wave] ?? 'Ищем мастера…'}</p>
        <p className="text-muted">Прошло {mmss(now - new Date(order.createdAt).getTime())}</p>
        <Button variant="secondary" onClick={() => action('cancel', 'Отменить поиск? Это бесплатно.')}>
          Отменить
        </Button>
      </div>
    );
  }

  if (order.status === 'NO_MASTERS') {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">Никто не откликнулся</h1>
        <p className="text-muted">Сервисный сбор не списан. Попробуйте ещё раз.</p>
        <Button onClick={() => action('retry-search')}>Повторить поиск</Button>
        <Button variant="secondary" onClick={() => action('cancel')}>
          Отменить
        </Button>
      </div>
    );
  }

  if (isTerminalStatus(order.status)) {
    return (
      <div className="mx-auto max-w-sm space-y-3 p-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">{STATUS_LABELS[order.status]}</h1>
        {order.cancelReason && <p className="text-muted">{order.cancelReason}</p>}
        {order.dispute && (
          <DisputeCard
            dispute={order.dispute}
            counterStatement={counterStatement}
            onCounterStatementChange={setCounterStatement}
            onSubmitCounterStatement={submitCounterStatement}
            onUploadEvidence={uploadEvidence}
          />
        )}
        <button className="font-semibold text-primary underline" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);
  const priceDeadline = order.priceProposedAt ? new Date(order.priceProposedAt).getTime() + 15 * 60 * 1000 : 0;

  return (
    <div className="mx-auto max-w-sm space-y-5 p-6 pb-32">
      <h1 className="text-xl font-extrabold text-foreground">{order.category?.name}</h1>

      {order.master && (
        <Card className="flex items-center gap-3">
          <Avatar name={order.master.name} />
          <div>
            <div className="font-bold text-foreground">{order.master.name ?? 'Мастер'}</div>
            <a href={`tel:${order.master.phone}`} className="text-sm font-semibold text-primary underline">
              {order.master.phone}
            </a>
          </div>
        </Card>
      )}

      <div>
        <StatusPill variant={urgentStatusVariant(order.status)}>{STATUS_LABELS[order.status]}</StatusPill>
      </div>

      <ol className="space-y-2">
        {STEPPER_STEPS.map((s, i) => (
          <li
            key={s.status}
            className={`flex items-center gap-3 ${
              i === currentIdx ? 'font-bold text-primary' : i < currentIdx ? 'text-foreground' : 'text-muted'
            }`}
          >
            <span className={`h-3 w-3 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-border'}`} />
            {s.label}
          </li>
        ))}
      </ol>

      {order.dispute && (
        <DisputeCard
          dispute={order.dispute}
          counterStatement={counterStatement}
          onCounterStatementChange={setCounterStatement}
          onSubmitCounterStatement={submitCounterStatement}
          onUploadEvidence={uploadEvidence}
        />
      )}
      {canDispute && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Причина спора"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <Button variant="secondary" onClick={openDispute}>
            Открыть спор
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-background p-4">
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <>
            <div className="rounded-lg bg-primary/5 p-3">
              <div className="font-bold text-foreground">Стоимость работ: {order.workPrice} ₸</div>
              {order.workComment && <div className="text-sm text-muted">{order.workComment}</div>}
              <div className="text-sm text-muted">Осталось {mmss(priceDeadline - now)}</div>
            </div>
            <Button onClick={() => action('confirm-price')}>Подтвердить цену {order.workPrice} ₸</Button>
            <Button
              variant="secondary"
              onClick={() => action('reject-price', 'Отклонить цену? Заявка будет отменена, сервисный сбор удержан.')}
            >
              Отклонить
            </Button>
          </>
        )}
        {order.status === 'DONE' && <Button onClick={() => action('confirm-completion')}>Подтвердить выполнение</Button>}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <Button
            variant="danger-outline"
            onClick={() => action('cancel', 'Отменить заявку? Стоимость выезда будет удержана полностью.')}
          >
            Отменить заявку
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/OrderPage.tsx
git commit -m "feat(web): redesign OrderPage, dedupe dispute block into DisputeCard"
```

---

### Task 14: MyOrdersPage redesign

**Files:**
- Modify: `apps/web/src/pages/MyOrdersPage.tsx` (full replace)

**Interfaces:**
- Consumes: `StatusPill` (Task 6), `EmptyState` (Task 8), `ListIcon` (Task 2), `urgentStatusVariant`/`plannedStatusVariant` (Task 6)
- Produces: nothing consumed by later tasks
- Behavior note: adds a `loading` flag so `EmptyState` doesn't flash before the first fetch resolves (original code had no loading state and could briefly show "Заявок пока нет" before data arrived — this fixes that incidentally while touching every line anyway). Also renames the trailing label from "Сейчас"/"Запланировать" to "Срочная"/"Плановая" — the original phrasing described an action, not what kind of item it is; this is a copy-only fix within the redesign's scope.

- [ ] **Step 1: Replace `apps/web/src/pages/MyOrdersPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS, PLANNED_STATUS_LABELS, urgentStatusVariant, plannedStatusVariant } from '../orderStatus';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import { ListIcon } from '../components/ui/icons';

export default function MyOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')])
      .then(([urgent, planned]) => {
        const merged = [
          ...urgent.map((o: any) => ({ ...o, kind: 'urgent' as const })),
          ...planned.map((o: any) => ({ ...o, kind: 'planned' as const })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-xl font-extrabold text-foreground">Мои заявки</h1>
      {!loading && items.length === 0 && (
        <EmptyState
          icon={<ListIcon className="h-8 w-8" />}
          title="Заявок пока нет"
          subtitle="Здесь появится история ваших вызовов"
        />
      )}
      {items.map((o) => (
        <Link
          key={o.id}
          to={o.kind === 'urgent' ? `/order/${o.id}` : `/planned/${o.id}`}
          className="block rounded-lg bg-surface p-4 shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground">{o.category?.name}</span>
            <StatusPill variant={o.kind === 'urgent' ? urgentStatusVariant(o.status) : plannedStatusVariant(o.status)}>
              {o.kind === 'urgent' ? STATUS_LABELS[o.status] : PLANNED_STATUS_LABELS[o.status]}
            </StatusPill>
          </div>
          <div className="mt-1 text-sm text-muted">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · {o.kind === 'urgent' ? 'Срочная' : 'Плановая'}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/MyOrdersPage.tsx
git commit -m "feat(web): redesign MyOrdersPage"
```

---

### Task 15: PlannedNewOrderPage redesign

**Files:**
- Modify: `apps/web/src/pages/PlannedNewOrderPage.tsx` (full replace)

**Interfaces:**
- Consumes: `Button` (Task 3)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace `apps/web/src/pages/PlannedNewOrderPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Button from '../components/ui/Button';

function minDateTimeLocal(): string {
  const d = new Date(Date.now() + 3600_000);
  return d.toISOString().slice(0, 16);
}

function maxDateTimeLocal(): string {
  const d = new Date(Date.now() + 14 * 24 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export default function PlannedNewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [scheduledAt, setScheduledAt] = useState(minDateTimeLocal());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
  }, []);

  const canSubmit = categoryId && description && address && district && scheduledAt && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/planned-orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address,
          district,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      navigate(`/planned/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-extrabold text-foreground">Запланировать заявку</h1>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
              categoryId === c.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
        rows={3}
        placeholder="Опишите проблему"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
        placeholder="Адрес (улица, дом, квартира)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
        placeholder="Район"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
      />
      <div className="space-y-1">
        <label className="text-sm font-semibold text-muted">Дата и время</label>
        <input
          type="datetime-local"
          className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
          value={scheduledAt}
          min={minDateTimeLocal()}
          max={maxDateTimeLocal()}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      <p className="text-sm text-muted">
        Мастера увидят категорию, район и описание и предложат свою цену. Вы выбираете лучшую ставку.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Публикуем…' : 'Опубликовать заявку'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/PlannedNewOrderPage.tsx
git commit -m "feat(web): redesign PlannedNewOrderPage"
```

---

### Task 16: PlannedOrderPage redesign

**Files:**
- Modify: `apps/web/src/pages/PlannedOrderPage.tsx` (full replace)

**Interfaces:**
- Consumes: `Card`, `Button`, `Avatar`, `StatusPill` (Tasks 3–6), `plannedStatusVariant` (Task 6)
- Produces: nothing (last task)
- Same `DisputeCard` extraction as Task 13 — defined locally in this file too (kept page-local rather than shared across files, to keep this task self-contained and match the existing precedent where the two pages' dispute JSX independently duplicated each other rather than sharing a module).

- [ ] **Step 1: Replace `apps/web/src/pages/PlannedOrderPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { getSocket } from '../socket';
import { PLANNED_STATUS_LABELS, isPlannedTerminalStatus, plannedStatusVariant } from '../orderStatus';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';

function DisputeCard({
  dispute,
  counterStatement,
  onCounterStatementChange,
  onSubmitCounterStatement,
  onUploadEvidence,
}: {
  dispute: any;
  counterStatement: string;
  onCounterStatementChange: (v: string) => void;
  onSubmitCounterStatement: () => void;
  onUploadEvidence: (file: File) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-accent/30 bg-accent/5 p-4 text-left">
      <div className="font-bold text-accent">Спор {dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
      <p className="text-sm text-foreground">{dispute.reason}</p>
      {dispute.counterStatement && <p className="text-sm text-muted">Пояснение: {dispute.counterStatement}</p>}
      {dispute.status === 'RESOLVED' && (
        <p className="text-sm text-muted">
          Решение: {dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
        </p>
      )}
      {dispute.status === 'OPEN' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0])}
          />
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Пояснение (для второй стороны)"
            value={counterStatement}
            onChange={(e) => onCounterStatementChange(e.target.value)}
          />
          <button
            className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-foreground"
            onClick={onSubmitCounterStatement}
          >
            Отправить пояснение
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlannedOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: any) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [id, load]);

  async function selectBid(bidId: string) {
    try {
      await api(`/planned-orders/${id}/select`, { method: 'POST', body: JSON.stringify({ bidId }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/planned-orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  const [disputeReason, setDisputeReason] = useState('');
  const [counterStatement, setCounterStatement] = useState('');
  const canDispute = order && ['DONE', 'IN_PROGRESS', 'CLOSED'].includes(order.status) && !order.dispute;

  async function openDispute() {
    if (!disputeReason.trim()) return;
    try {
      await api(`/planned-orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
      setDisputeReason('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submitCounterStatement() {
    if (!order?.dispute || !counterStatement.trim()) return;
    try {
      await api(`/disputes/${order.dispute.id}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
      setCounterStatement('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function uploadEvidence(file: File) {
    if (!order?.dispute) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${order.dispute.id}/evidence`, fd);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !order) return <div className="p-6 text-destructive">{error}</div>;
  if (!order) return <div className="p-6 text-muted">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6 pb-32">
      <h1 className="text-xl font-extrabold text-foreground">{order.category?.name}</h1>
      <StatusPill variant={plannedStatusVariant(order.status)}>{PLANNED_STATUS_LABELS[order.status]}</StatusPill>
      <div className="text-sm text-muted">{new Date(order.scheduledAt).toLocaleString('ru-RU')}</div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {order.status === 'PUBLISHED' && (
        <div className="space-y-2">
          <h2 className="font-bold text-foreground">Ставки ({order.bids.length}/5)</h2>
          {order.bids.length === 0 && <p className="text-muted">Пока никто не откликнулся</p>}
          {order.bids.map((b: any) => (
            <Card key={b.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{b.price} ₸</span>
                <span className="text-sm text-muted">{b.term}</span>
              </div>
              {b.comment && <div className="text-sm text-muted">{b.comment}</div>}
              <Button onClick={() => selectBid(b.id)}>Выбрать</Button>
            </Card>
          ))}
        </div>
      )}

      {['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CLOSED'].includes(order.status) && order.master && (
        <Card className="flex items-center gap-3">
          <Avatar name={order.master.name} />
          <div>
            <div className="font-bold text-foreground">{order.master.name ?? 'Мастер'}</div>
            {order.master.phone ? (
              <a href={`tel:${order.master.phone}`} className="text-sm font-semibold text-primary underline">
                {order.master.phone}
              </a>
            ) : (
              <div className="text-sm text-muted">Ждём подтверждения…</div>
            )}
          </div>
        </Card>
      )}

      {isPlannedTerminalStatus(order.status) && (
        <button className="font-semibold text-primary underline" onClick={() => navigate('/')}>
          На главную
        </button>
      )}

      {order.dispute && (
        <DisputeCard
          dispute={order.dispute}
          counterStatement={counterStatement}
          onCounterStatementChange={setCounterStatement}
          onSubmitCounterStatement={submitCounterStatement}
          onUploadEvidence={uploadEvidence}
        />
      )}
      {canDispute && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Причина спора"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <Button variant="secondary" onClick={openDispute}>
            Открыть спор
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-background p-4">
        {order.status === 'DONE' && <Button onClick={() => action('confirm-completion')}>Подтвердить выполнение</Button>}
        {['CREATED', 'PUBLISHED', 'MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && (
          <Button variant="danger-outline" onClick={() => action('cancel', 'Отменить заявку?')}>
            Отменить
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/erda/Музыка/MasterQala.kz && pnpm --filter web build`
Expected: exits 0.

- [ ] **Step 3: Full manual walkthrough**

Run: `cd /home/erda/Музыка/MasterQala.kz/apps/web && pnpm dev`. With the API running (`pnpm --filter api start:dev` in another terminal), walk through: login → home (category grid + CTA) → new urgent order → order tracking page (SEARCHING spinner → stepper once accepted) → my orders list → new planned order → planned order page (bids list once a master bids). Confirm no console errors, all colors/fonts/spacing match the tokens from Task 1, and every button still performs its original action (compare against `git diff` if in doubt — behavior must be unchanged). Stop the dev server after (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/PlannedOrderPage.tsx
git commit -m "feat(web): redesign PlannedOrderPage, dedupe dispute block into DisputeCard"
```

---

## Self-Review

**Spec coverage:** Tokens → Task 1. All 8 components from spec (minus `RatingBadge`, dropped — see spec's corrected component table) → Tasks 2–8. `BottomTabBar` replacing `TabBar.tsx` → Task 9. All 7 pages in the spec's stated order → Tasks 10–16. Data/no-fabrication constraint → enforced explicitly in Global Constraints and by omitting rating/ETA from every page. Testing section (no frontend tests exist, build is the gate) → stated in Global Constraints and every task's Step 2/3.

**Placeholder scan:** No TBD/TODO; every step has complete, runnable code; no "similar to Task N" — dispute block code is repeated in full in both Task 13 and Task 16 since each task's implementer only sees their own task.

**Type consistency:** `StatusVariant` type defined once in Task 6 (`orderStatus.ts`), imported identically by `StatusPill.tsx` (Task 6), `HomePage.tsx` (Task 11), `OrderPage.tsx` (Task 13), `MyOrdersPage.tsx` (Task 14), `PlannedOrderPage.tsx` (Task 16) — same import path (`'../../orderStatus'` from `components/ui/`, `'../orderStatus'` from `pages/`) and same function names (`urgentStatusVariant`, `plannedStatusVariant`) throughout. `categoryIcon(slug: string)` return shape (`{ Icon, bg, color }`) matches its one consumer in Task 11 exactly. `Avatar`'s `name` prop accepts `string | null | undefined` everywhere it's called (`order.master?.name`, `order.master.name`) — matches `AuthUser.name: string | null` and optional-chained master objects.
