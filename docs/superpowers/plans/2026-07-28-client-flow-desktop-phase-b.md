# Клиентский флоу (десктоп) — Фаза B: срочный режим — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести срочный режим заявки (визард `/order/new`, статус-driven
`/order/:id` с картой и трекингом мастера, форма спора) из
`apps/web/src/features/client-v2` в `apps/client` под десктопную
раскладку (2-колоночный кадр визарда, карта+панель для статусов с картой).

**Architecture:** Продолжение Фазы A — гибрид RSC-шелл (уже есть, не
трогаем) + клиентские страницы. `MapView` оборачивается через
`next/dynamic({ ssr: false })`, т.к. Leaflet императивно трогает DOM/
`window` и не может рендериться на сервере. `OrderDetail`/`OrderMaster`
выносятся в отдельный `lib/orderTypes.ts` (в оригинале жили в `OrderPage.tsx`
и импортировались из других файлов — в Next.js App Router импорт типов из
`page.tsx`-файлов не является принятой практикой). `DisputeView` — общий
компонент с `kind`-пропом, тонкая страница-обёртка на маршрут.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind
CSS 4, Leaflet (императивно, без `react-leaflet`), `react-i18next`,
`socket.io-client` (уже есть с Фазы A).

## Global Constraints

- Бэкенд (`apps/api`) не меняется — используются только существующие
  эндпоинты: `GET /categories`, `GET /addresses`, `POST /orders/preview`,
  `POST /orders`, `GET /orders/:id`, `POST /orders/:id/{cancel,
  retry-search, confirm-price, reject-price, confirm-completion, review}`,
  `POST /uploads`, `GET /uploads/:path/status`, `POST
  /orders/:id/disputes`, `POST /disputes/:id/evidence`. Мастер-side (для
  финальной живой проверки, не для кода клиента): `POST /orders/:id/{accept,
  on-way, on-site, propose-price, complete}`, сокет-событие `geo:update`
  (`{lat, lng}`, эмитится мастером, сервер релеит клиенту как
  `master:location`).
- Юнит-тестов на фронте нет (осознанная практика проекта) — верификация
  каждой задачи через `pnpm --filter client build`.
- Каждый перенесённый файл сверяется построчно с оригиналом в
  `apps/web/src/features/client-v2/` — логика/тексты/i18n-ключи не
  меняются, меняется только: (а) адаптации Next.js (`react-router-dom` →
  `next/navigation`/`next/link`, `import.meta.env` → `process.env`), (б)
  раскладка (2-колоночный кадр визарда и статус-экранов с картой, узкая
  центрированная колонка `mx-auto w-full max-w-[560px]` для остальных
  статус-экранов), (в) явно оговорённые в этом плане отступления (см.
  каждую задачу).
- Импорты — через alias `@/...` (как в Фазе A), не относительные пути.
- Ссылки на ещё не перенесённые маршруты (`/planned/*`, `/support` со
  своей полноценной страницей — сейчас 404) остаются как есть — ожидаемое
  переходное состояние (прецедент Фазы A).

---

### Task 1: `apiUpload` в `lib/api.ts` + зависимость `leaflet`

**Files:**
- Modify: `apps/client/lib/api.ts`
- Modify: `apps/client/package.json`

**Interfaces:**
- Produces: `apiUpload(path: string, formData: FormData): Promise<unknown>`
  — используется задачами 3 (фото заявки) и 6 (доказательства спора).
- Consumes: ничего нового (тот же файл, что уже экспортирует `api()` с
  Фазы A).

- [ ] **Step 1: Заменить `apps/client/lib/api.ts` целиком**

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

- [ ] **Step 2: Добавить `leaflet` в `apps/client/package.json`**

В секцию `"dependencies"` добавить (по образцу `apps/web/package.json`,
та же версия):

```json
"leaflet": "^1.9.4",
```

В секцию `"devDependencies"` добавить:

```json
"@types/leaflet": "^1.9.21",
```

Итоговые секции (полный файл, для сверки — вставить строки в
существующие объекты, не создавать новые):

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
    "leaflet": "^1.9.4",
    "next": "^15.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-i18next": "^17.0.10",
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

- [ ] **Step 3: Установить зависимости и проверить сборку**

Run: `pnpm install && pnpm --filter client build`
Expected: сборка проходит без ошибок (новые экспорты пока никем не
используются — важна только успешная компиляция и то, что `leaflet`
физически установлен для Task 2).

- [ ] **Step 4: Commit**

```bash
git add apps/client/lib/api.ts apps/client/package.json pnpm-lock.yaml
git commit -m "feat(client): apiUpload + зависимость leaflet"
```

---

### Task 2: `MapView` — порт + `next/dynamic({ssr:false})`

**Files:**
- Create: `apps/client/components/MapViewInner.tsx`
- Create: `apps/client/components/MapView.tsx`

**Interfaces:**
- Produces: `MapView` (default export компонент, пропы: `mode: 'pin' |
  'pulse' | 'tracking'`, `center: LatLng`, `onCenterChange?: (coords:
  LatLng) => void`, `masterPosition?: LatLng | null`, `height?: number`,
  `className?: string`), тип `LatLng` (`{ lat: number; lng: number }`) —
  оба реэкспортируются из `@/components/MapView` для задач 3, 4, 5.
- Consumes: ничего (чистый UI-компонент, зависит только от `leaflet` из
  Task 1).

- [ ] **Step 1: Создать `apps/client/components/MapViewInner.tsx`**

Порт `apps/web/src/features/client-v2/components/MapView.tsx` без
изменений логики — только переименование дефолтного экспорта в
`MapViewInner` (сам файл `MapView.tsx` в Task 2 Step 2 станет тонкой
`next/dynamic`-обёрткой):

```tsx
'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapViewProps {
  mode: 'pin' | 'pulse' | 'tracking';
  center: LatLng;
  onCenterChange?: (coords: LatLng) => void;
  masterPosition?: LatLng | null;
  height?: number;
  className?: string;
}

function divIcon(html: string, size: number) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size] });
}

const pinIcon = divIcon(
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#166088;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(20,48,60,0.4)"></div>',
  22,
);
const masterIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;border-radius:50%;background:#FFFFFF;border:3px solid #166088;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(20,48,60,0.3)">🚗</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapViewInner({ mode, center, onCenterChange, masterPosition, height = 220, className = '' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const masterMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mode === 'pulse') return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(
      [center.lat, center.lng],
      15,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    if (mode === 'pin') {
      const marker = L.marker([center.lat, center.lng], { icon: pinIcon }).addTo(map);
      map.on('move', () => {
        const c = map.getCenter();
        marker.setLatLng(c);
      });
      map.on('moveend', () => {
        const c = map.getCenter();
        onCenterChange?.({ lat: c.lat, lng: c.lng });
      });
    }

    if (mode === 'tracking') {
      L.marker([center.lat, center.lng], { icon: pinIcon }).addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      masterMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== 'tracking' || !mapRef.current || !masterPosition) return;
    if (!masterMarkerRef.current) {
      masterMarkerRef.current = L.marker([masterPosition.lat, masterPosition.lng], { icon: masterIcon }).addTo(mapRef.current);
    } else {
      masterMarkerRef.current.setLatLng([masterPosition.lat, masterPosition.lng]);
    }
  }, [mode, masterPosition]);

  if (mode === 'pulse') {
    return (
      <div style={{ height }} className={`relative overflow-hidden rounded-lg bg-fill ${className}`}>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/25" />
          <div className="relative h-4.5 w-4.5 rounded-full border-[3px] border-white bg-primary shadow-card" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className={`overflow-hidden rounded-lg ${className}`} />;
}
```

- [ ] **Step 2: Создать `apps/client/components/MapView.tsx`**

```tsx
'use client';
import dynamic from 'next/dynamic';

export type { LatLng } from './MapViewInner';

const MapView = dynamic(() => import('./MapViewInner'), { ssr: false });

export default MapView;
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок (компонент пока никем не
импортируется, важна только компиляция).

- [ ] **Step 4: Commit**

```bash
git add apps/client/components/MapViewInner.tsx apps/client/components/MapView.tsx
git commit -m "feat(client): MapView (Leaflet, next/dynamic ssr:false)"
```

---

### Task 3: Визард `/order/new`

**Files:**
- Create: `apps/client/app/(app)/order/new/page.tsx`

**Interfaces:**
- Consumes: `api`, `apiUpload` (`@/lib/api`), `useCommercialMode`
  (`@/lib/commercial-mode`), `categoryMeta` (`@/lib/categoryMeta`),
  `MapView`, `LatLng` (`@/components/MapView`, из Task 2).
- Produces: маршрут `/order/new`; на успешной отправке — редирект на
  `/order/:id` (маршрут появится в Task 4).

**Отступление от оригинала (обосновано дизайном, не случайность):**
оригинальный шаг 3 (адрес) не показывал общий header с кнопкой «назад» и
4-точечный прогресс-бар — только шаги 1/2/4 их показывали (особенность
мобильной вёрстки: карта на шаге 3 занимала верх экрана). В едином
2-колоночном каркасе header+progress рендерятся один раз над всеми 4
шагами одинаково (включая шаг 3) — это и есть цель десктопной
перекомпоновки, а не отдельная правка. Кнопка «Моё место» на шаге 3 в
оригинале была абсолютным оверлеем поверх карты (`position: absolute` на
самой карте) — т.к. карта переехала в общую правую колонку и присутствует
на всех шагах, кнопка становится обычной кнопкой действия внутри формы
шага 3, а не оверлеем.

- [ ] **Step 1: Создать `apps/client/app/(app)/order/new/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';
import { categoryMeta } from '@/lib/categoryMeta';
import MapView, { type LatLng } from '@/components/MapView';

interface Category {
  id: string;
  slug: string;
  name: string;
}
interface Address {
  id: string;
  label: string;
  address: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  lat: number | null;
  lng: number | null;
}
interface Preview {
  available: boolean;
  calloutPrice?: number;
  serviceFee?: number;
}

const ASTANA_CENTER: LatLng = { lat: 51.1605, lng: 71.4704 };

export default function NewOrderPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');

  const [description, setDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [geo, setGeo] = useState<LatLng>(ASTANA_CENTER);
  const [addressText, setAddressText] = useState('');
  const [district, setDistrict] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [addressComment, setAddressComment] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError((e as Error).message));
    api('/addresses').then(setSavedAddresses).catch(() => {});
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('newOrder.geoError')),
    );
  }, [t]);

  useEffect(() => {
    if (step !== 4 || !categoryId) return;
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, lat: geo.lat, lng: geo.lng }) })
      .then(setPreview)
      .catch((e) => setError((e as Error).message));
  }, [step, categoryId, geo]);

  function selectAddress(a: Address) {
    setAddressText(a.address);
    setEntrance(a.entrance ?? '');
    setFloor(a.floor ?? '');
    setApartment(a.apartment ?? '');
    if (a.lat != null && a.lng != null) setGeo({ lat: a.lat, lng: a.lng });
  }

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const res = await apiUpload('/uploads', (() => {
        const fd = new FormData();
        fd.append('file', file);
        return fd;
      })());
      setPhotoPaths((prev) => [...prev, res.path].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address: addressText,
          district,
          entrance: entrance || undefined,
          floor: floor || undefined,
          apartment: apartment || undefined,
          addressComment: addressComment || undefined,
          photoPaths,
          lat: geo.lat,
          lng: geo.lng,
        }),
      });
      router.push(`/order/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );

  const stepTitles: Record<1 | 2 | 3 | 4, string> = {
    1: t('newOrder.step1Title'),
    2: t('newOrder.step2Title'),
    3: t('newOrder.step3Title'),
    4: t('newOrder.step4Title'),
  };

  const goBack = () => {
    if (step === 1) router.push('/');
    else setStep((step - 1) as 1 | 2 | 3);
  };

  const header = (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={goBack} className="text-xl text-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-ink">{stepTitles[step]}</span>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n: step, total: 4 })}</span>
    </div>
  );

  let stepContent: React.ReactNode;

  if (step === 1) {
    stepContent = (
      <>
        <div className="text-xl font-extrabold text-ink">{t('newOrder.step1Question')}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-md border-2 p-3.5 text-left ${
                  active ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
                }`}
              >
                <div className="mb-1.5 text-xl">{meta.icon}</div>
                <div className="text-sm font-extrabold text-ink">{c.name}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => router.push('/support')}
          className="rounded-md border-[1.5px] border-dashed border-border p-3 text-[13px] font-bold text-ink-soft"
        >
          {t('newOrder.step1Unknown')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </>
    );
  } else if (step === 2) {
    stepContent = (
      <>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-28 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
        />
        <div className="text-sm font-extrabold text-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-18 w-18 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-2xl text-primary">
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
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('newOrder.step2Next')}
        </button>
      </>
    );
  } else if (step === 3) {
    stepContent = (
      <>
        <input
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder={t('newOrder.step3Title')}
          className="rounded-md border-[1.5px] border-primary bg-surface p-3 text-sm font-bold text-ink outline-none"
        />
        {savedAddresses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedAddresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAddress(a)}
                className="rounded-pill border-[1.5px] border-border px-3 py-1.5 text-xs font-bold text-ink-soft"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Entrance')}</div>
            <input
              value={entrance}
              onChange={(e) => setEntrance(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Floor')}</div>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Apartment')}</div>
            <input
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
        </div>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t('newOrder.step3District')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        <input
          value={addressComment}
          onChange={(e) => setAddressComment(e.target.value)}
          placeholder={t('newOrder.step3Comment')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            )
          }
          className="rounded-pill border-[1.5px] border-border p-2.5 text-xs font-extrabold text-ink-soft"
        >
          ◎ {t('newOrder.step3MyLocation')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={!addressText || !district}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('newOrder.step3Next')}
        </button>
      </>
    );
  } else {
    stepContent = (
      <>
        <div className="rounded-md bg-fill p-3.5">
          <div className="text-sm font-extrabold text-ink">
            {categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '').icon}{' '}
            {categories.find((c) => c.id === categoryId)?.name} · «{description.slice(0, 40)}» ·{' '}
            {t('common.photosCount', { n: photoPaths.length })}
          </div>
          <div className="mt-1 text-xs font-semibold text-on-fill">
            {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} · {t('newOrder.step3Apartment')} {apartment}
          </div>
        </div>
        {preview?.available === false && <p className="text-sm font-semibold text-danger">{t('newOrder.unavailable')}</p>}
        {preview?.available && (
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex justify-between text-sm font-bold text-ink">
              <span>{t('newOrder.step4CalloutLabel')}</span>
              <span className="font-extrabold">{preview.calloutPrice} ₸</span>
            </div>
            {paymentsEnabled && (
              <div className="mt-1 flex justify-between text-xs text-ink-soft">
                <span>{t('newOrder.step4FeeLabel')}</span>
                <span>{preview.serviceFee} ₸</span>
              </div>
            )}
            <div className="my-2.5 border-t border-dashed border-border" />
            <div className="text-xs leading-relaxed text-on-fill">
              {paymentsEnabled
                ? t('newOrder.step4Note')
                : 'Выезд в бесплатном пилоте не оплачивается. Стоимость работ мастер назовёт после осмотра; вы подтвердите её и рассчитаетесь с мастером напрямую.'}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
          <span className="text-sm font-extrabold text-ink">
            {paymentsEnabled ? t('newOrder.step4PaymentMethod') : 'Бесплатный пилот · без привязки карты'}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('newOrder.step4CancelNote')
            : 'Отмена до начала работ не вызывает списаний со стороны платформы. Договорённости по фактическим расходам обсуждаются напрямую с мастером.'}
        </p>
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !preview?.available}
          className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
        >
          {paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : 'Найти мастера бесплатно'}
        </button>
      </>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-w-6xl flex-col gap-4 px-8 py-6">
      {header}
      {progress}
      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="flex w-[560px] shrink-0 flex-col gap-3 overflow-y-auto pb-2">{stepContent}</div>
        <div className="flex-1 overflow-hidden rounded-lg">
          <MapView
            mode="pin"
            center={geo}
            onCenterChange={step === 3 ? setGeo : undefined}
            height={undefined}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/order/new` присутствует.

- [ ] **Step 3: Commit**

```bash
git add "apps/client/app/(app)/order"
git commit -m "feat(client): визард срочной заявки /order/new"
```

---

### Task 4: `OrderPage`-шелл + 5 «простых» status-видов

**Files:**
- Create: `apps/client/lib/orderTypes.ts`
- Create: `apps/client/app/(app)/order/[id]/page.tsx`
- Create: `apps/client/components/order-views/NoMastersView.tsx`
- Create: `apps/client/components/order-views/PriceView.tsx`
- Create: `apps/client/components/order-views/ProgressView.tsx`
- Create: `apps/client/components/order-views/DoneView.tsx`
- Create: `apps/client/components/order-views/ClosedView.tsx`

**Interfaces:**
- Produces: `OrderDetail`, `OrderMaster` (типы, `@/lib/orderTypes`) —
  используются этой и следующей задачей; маршрут `/order/:id` (шелл
  выбирает вид по `order.status`; статусы `SEARCHING`/трек-статусы —
  Task 5, ещё не подключены — оставить `if`-ветки как есть, они уже
  ссылаются на `SearchView`/`TrackView`, которые появятся в Task 5).
- Consumes: `api` (`@/lib/api`), `getSocket` (`@/lib/socket`), `useParams`
  (`next/navigation`).

**Важно**: этот таск ссылается на `SearchView`/`TrackView` из
`@/components/order-views/SearchView` и `.../TrackView`, которых ещё нет
на диске после этого таска — сборка (`pnpm --filter client build`) в этом
таске **завершится ошибкой компиляции** (module not found) до Task 5. Это
ожидаемо: `page.tsx` шелла и оба набора видов логически образуют одно
целое (шелл диспетчеризует статус → вид), но раздельны по риску
реализации (простые вида vs. карта+раскладка). Финальная проверка сборки
для этого маршрута — в конце Task 5, не здесь. В этом таске верификация —
`pnpm --filter client build` **должен упасть на этих двух конкретных
импортах** (и ни на чём другом) — это подтверждает, что все остальные 5
видов + типы + шелл написаны корректно.

- [ ] **Step 1: Создать `apps/client/lib/orderTypes.ts`**

```ts
export interface OrderMaster {
  id: string;
  name: string | null;
  phone: string;
  rating: number | null;
  reviewCount: number;
}

export interface OrderDetail {
  id: string;
  status: string;
  commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';
  freePilot?: boolean;
  wave: number;
  category: { name: string } | null;
  master: OrderMaster | null;
  address: string;
  description: string;
  calloutPrice: number;
  serviceFee: number;
  workPrice: number | null;
  workComment: string | null;
  cancelReason: string | null;
  createdAt: string;
  priceProposedAt: string | null;
  priceDeadline: string | null;
  review: { rating: number; comment: string | null } | null;
}
```

- [ ] **Step 2: Создать `apps/client/app/(app)/order/[id]/page.tsx`**

Порт `apps/web/src/features/client-v2/pages/OrderPage.tsx`: `useParams`
из `react-router-dom` → `useParams` из `next/navigation` (та же сигнатура
использования — `useParams<{ id: string }>()`, работает в клиентских
компонентах синхронно, без `Promise`); тип `OrderDetail`/`OrderMaster`
теперь импортируется из `@/lib/orderTypes`, а не объявляется в этом файле:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { OrderDetail } from '@/lib/orderTypes';
import SearchView from '@/components/order-views/SearchView';
import NoMastersView from '@/components/order-views/NoMastersView';
import PriceView from '@/components/order-views/PriceView';
import ProgressView from '@/components/order-views/ProgressView';
import DoneView from '@/components/order-views/DoneView';
import ClosedView from '@/components/order-views/ClosedView';
import TrackView from '@/components/order-views/TrackView';

const TRACK_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION'];

export default function OrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    return api(`/orders/${id}`)
      .then(setOrder)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = (p: { orderId: string }) => {
      if (p.orderId === id) load();
    };
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  if (error || !order || !id) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm font-semibold text-danger">{error || t('orderDetail.notFound')}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-pill border-[1.5px] border-primary p-3 text-sm font-extrabold text-primary"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const freePilot = order.commercialMode === 'FREE_PILOT' || order.freePilot === true;

  if (order.status === 'SEARCHING') return <SearchView order={order} onChanged={load} />;
  if (order.status === 'NO_MASTERS') return <NoMastersView orderId={id} freePilot={freePilot} onChanged={load} />;
  if (TRACK_STATUSES.includes(order.status)) return <TrackView order={order} orderId={id} />;
  if (order.status === 'AWAITING_PRICE_CONFIRM') return <PriceView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'IN_PROGRESS') return <ProgressView order={order} />;
  if (order.status === 'DONE') return <DoneView order={order} orderId={id} onChanged={load} />;
  return <ClosedView order={order} onChanged={load} />;
}
```

- [ ] **Step 3: Создать `apps/client/components/order-views/NoMastersView.tsx`**

Порт `NoMastersView.tsx`: `useNavigate` → `useRouter`, `navigate(...)` →
`router.push(...)`, добавлена узкая центрированная колонка (`mx-auto
w-full max-w-[560px]`):

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

export default function NoMastersView({
  orderId,
  freePilot,
  onChanged,
}: {
  orderId: string;
  freePilot: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState('');

  async function retry() {
    setError('');
    try {
      await api(`/orders/${orderId}/retry-search`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[560px] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div className="text-4xl">😔</div>
      <div className="text-xl font-extrabold text-ink">{t('orderDetail.noMastersTitle')}</div>
      <div className="max-w-[290px] text-sm leading-relaxed text-ink-soft">
        {freePilot
          ? 'Сейчас рядом нет свободных мастеров. Списаний не было. Попробуйте поиск ещё раз или создайте плановую заявку — мастера сами предложат цену.'
          : t('orderDetail.noMastersText')}
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <button
        type="button"
        onClick={retry}
        className="mt-2 w-full rounded-pill bg-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.retrySearch')}
      </button>
      <button
        type="button"
        onClick={() => router.push('/planned/new')}
        className="w-full rounded-pill border-[1.5px] border-primary p-3.5 text-sm font-extrabold text-primary"
      >
        {t('orderDetail.startPlanned')}
      </button>
      <button type="button" onClick={() => router.push('/')} className="text-sm font-bold text-ink-soft">
        {t('orderDetail.toHome')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Создать `apps/client/components/order-views/PriceView.tsx`**

Порт `PriceView.tsx`: тип импортируется из `@/lib/orderTypes`, узкая
колонка добавлена:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/orderTypes';

export default function PriceView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order.priceDeadline) return;
    const deadline = new Date(order.priceDeadline).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.priceDeadline]);

  async function confirm() {
    setError('');
    try {
      await api(`/orders/${orderId}/confirm-price`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reject() {
    setError('');
    try {
      await api(`/orders/${orderId}/reject-price`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-ink">{t('orderDetail.priceTitle')}</span>
        <span className="rounded-pill bg-primary px-3 py-1.5 text-[13px] font-extrabold text-white">
          ⏱ {mm}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="text-sm font-semibold text-ink">{t('orderDetail.priceOffered', { name: order.master?.name })}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        {paymentsEnabled && (
          <div className="flex justify-between text-[13.5px] font-semibold text-ink-soft">
            <span>{t('orderDetail.priceCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1.5' : ''} flex justify-between text-sm font-extrabold text-ink`}>
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-lg font-extrabold">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-primary">{total} ₸</span>
        </div>
      </div>
      {order.workComment && (
        <div className="rounded-md bg-fill p-3 text-[13px] leading-relaxed text-ink">«{order.workComment}»</div>
      )}
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.priceRejectNote')
          : 'В бесплатном пилоте платформа не списывает деньги. После подтверждения вы рассчитываетесь с мастером напрямую; при отклонении заявка отменится.'}
      </p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirm}
        className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </button>
      <button
        type="button"
        onClick={reject}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('orderDetail.priceReject')}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Создать `apps/client/components/order-views/ProgressView.tsx`**

Порт `ProgressView.tsx`: `Link` из `react-router-dom` → `next/link`
(`to`→`href`), тип из `@/lib/orderTypes`, `STEPPER_STEPS` из
`@/lib/orderStatus`, узкая колонка добавлена:

```tsx
'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { STEPPER_STEPS } from '@/lib/orderStatus';
import type { OrderDetail } from '@/lib/orderTypes';

export default function ProgressView({ order }: { order: OrderDetail }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('orderDetail.orderNumber', { id: order.id.slice(0, 8) })}</div>
      <div className="flex flex-col">
        {STEPPER_STEPS.map((s, i) => {
          const done = i < currentIdx || (i === currentIdx && order.status !== s.status);
          const active = s.status === order.status;
          return (
            <div key={s.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 text-[11px] text-white ${
                    done || active ? 'border-primary bg-primary' : 'border-border bg-surface'
                  }`}
                >
                  {done ? '✓' : ''}
                </div>
                {i < STEPPER_STEPS.length - 1 && <div className="min-h-4.5 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="pb-3.5">
                <div className={`text-[13.5px] ${active ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft'}`}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-md bg-fill p-3.5 text-xs font-semibold leading-relaxed text-ink">
        {paymentsEnabled
          ? t('orderDetail.progressNote', { price: order.calloutPrice + (order.workPrice ?? 0) })
          : `Согласованная стоимость работ: ${order.workPrice ?? 0} ₸. Расчёт происходит напрямую с мастером.`}
      </div>
      <div className="mt-auto" />
      <Link
        href="/support"
        className="rounded-pill border-[1.5px] border-border p-3.5 text-center text-sm font-extrabold text-ink"
      >
        {t('orderDetail.support')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Создать `apps/client/components/order-views/DoneView.tsx`**

Порт `DoneView.tsx`: `useNavigate` → `useRouter`, тип из
`@/lib/orderTypes`, узкая колонка добавлена:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/orderTypes';

export default function DoneView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const router = useRouter();
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('orderDetail.doneTitle')}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-2.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        {paymentsEnabled && (
          <div className="flex justify-between text-[13.5px] font-semibold text-ink-soft">
            <span>{t('orderDetail.doneCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1' : ''} flex justify-between text-[13.5px] font-semibold text-ink-soft`}>
          <span>{t('orderDetail.doneWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span>{t('orderDetail.doneTotalLabel')}</span>
          <span>{total} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.doneNote')
          : 'Проверьте результат и подтвердите выполнение. Оплата работ производится мастеру напрямую. При проблеме откройте спор.'}
      </p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-pill bg-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => router.push(`/order/${orderId}/dispute`)}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('orderDetail.openDispute')}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Создать `apps/client/components/order-views/ClosedView.tsx`**

Порт `ClosedView.tsx`: `useNavigate` → `useRouter`, тип и `STATUS_LABELS`
из соответствующих `@/lib/...`, узкая колонка добавлена:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/orderStatus';
import type { OrderDetail } from '@/lib/orderTypes';

export default function ClosedView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isCancelled = order.status !== 'CLOSED';

  async function submitRating(stars: number) {
    setRating(stars);
    setSubmitting(true);
    setError('');
    try {
      await api(`/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ rating: stars }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-[560px] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isCancelled ? 'bg-ink-soft' : 'bg-success'
        }`}
      >
        {isCancelled ? '×' : '✓'}
      </div>
      <div className="text-xl font-extrabold text-ink">
        {isCancelled ? t('orderDetail.closedCancelledTitle') : t('orderDetail.closedTitle')}
      </div>
      {isCancelled && order.cancelReason && <div className="text-sm text-ink-soft">{order.cancelReason}</div>}
      {!isCancelled && (
        <div className="w-full rounded-md border border-border bg-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-ink">{t('orderDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-ink">{t('orderDetail.rateTitle')}</div>
              <div className="flex justify-center gap-1 text-[28px]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    className={s <= rating ? 'text-primary' : 'text-border'}
                  >
                    ★
                  </button>
                ))}
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => router.push('/')}
        className="w-full rounded-pill bg-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.toHome')}
      </button>
      {!isCancelled && (
        <button type="button" onClick={() => router.push(`/order/${order.id}/dispute`)} className="text-xs font-bold text-ink-soft">
          {STATUS_LABELS[order.status]}? {t('orderDetail.openDispute')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Проверить сборку (ожидается ошибка на 2 конкретных импортах)**

Run: `pnpm --filter client build`
Expected: FAIL — ошибка модуля не найден **только** для
`@/components/order-views/SearchView` и `@/components/order-views/TrackView`
(импортируются в `page.tsx` шелла, будут созданы в Task 5). Ошибок по
любым другим файлам/импортам быть не должно — если есть, это реальный баг
этого таска, а не ожидаемое падение.

- [ ] **Step 9: Commit**

```bash
git add apps/client/lib/orderTypes.ts "apps/client/app/(app)/order/[id]/page.tsx" apps/client/components/order-views/NoMastersView.tsx apps/client/components/order-views/PriceView.tsx apps/client/components/order-views/ProgressView.tsx apps/client/components/order-views/DoneView.tsx apps/client/components/order-views/ClosedView.tsx
git commit -m "feat(client): OrderPage-шелл + 5 простых status-видов"
```

Коммит осознанно создаётся при незелёной сборке всего пакета (недостающие
`SearchView`/`TrackView` — предмет Task 5) — это нормально для
промежуточного шага декомпозиции; итоговая зелёная сборка проверяется в
конце Task 5.

---

### Task 5: `SearchView` + `TrackView` (карта + 2-колоночная раскладка)

**Files:**
- Create: `apps/client/components/order-views/SearchView.tsx`
- Create: `apps/client/components/order-views/TrackView.tsx`

**Interfaces:**
- Consumes: `OrderDetail` (`@/lib/orderTypes`, Task 4), `MapView`,
  `LatLng` (`@/components/MapView`, Task 2), `WAVE_TEXTS`/`STATUS_LABELS`
  (`@/lib/orderStatus`), `api` (`@/lib/api`), `getSocket` (`@/lib/socket`).
- Produces: завершает набор видов, который `page.tsx` шелла (Task 4) уже
  импортирует — после этого таска `pnpm --filter client build` для всего
  `/order/:id` маршрута должен быть полностью зелёным.

**Отступление от оригинала (обосновано дизайном):** мобильный «sheet»-стиль
(`rounded-t-sheet`, `shadow-sheet`, drag-handle `<div className="mx-auto
mb-3 h-1 w-9.5 rounded-full bg-border" />`) специфичен для шторки снизу
поверх карты на весь экран — в 2-колоночной раскладке (карта слева,
обычная карточка-панель справа) эти классы и drag-handle убираются, панель
становится плоской карточкой (`border-l border-border bg-surface`).
Остальное содержимое (таймер/кнопка отмены в `SearchView`; аватар/
рейтинг/ETA/звонок/отмена в `TrackView`) переносится без изменений.

- [ ] **Step 1: Создать `apps/client/components/order-views/SearchView.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { WAVE_TEXTS } from '@/lib/orderStatus';
import MapView from '@/components/MapView';
import type { OrderDetail } from '@/lib/orderTypes';

export default function SearchView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  async function cancel() {
    setError('');
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="flex h-screen">
      <MapView mode="pulse" center={{ lat: 0, lng: 0 }} height={undefined} className="flex-1 rounded-none" />
      <div className="w-[380px] shrink-0 overflow-y-auto border-l border-border bg-surface px-5 py-5">
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-extrabold text-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</div>
          <div className="text-sm font-extrabold text-primary">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
        <button
          type="button"
          onClick={cancel}
          className="mt-3 w-full rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
        >
          {t('orderDetail.cancelFree')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Создать `apps/client/components/order-views/TrackView.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { STATUS_LABELS } from '@/lib/orderStatus';
import MapView, { type LatLng } from '@/components/MapView';
import type { OrderDetail } from '@/lib/orderTypes';

export default function TrackView({ order, orderId }: { order: OrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const [masterPos, setMasterPos] = useState<LatLng | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onLocation = (p: { orderId: string; lat: number; lng: number; etaMinutes: number }) => {
      if (p.orderId !== orderId) return;
      setMasterPos({ lat: p.lat, lng: p.lng });
      setEta(p.etaMinutes);
    };
    socket.on('master:location', onLocation);
    return () => {
      socket.off('master:location', onLocation);
    };
  }, [orderId]);

  async function cancel() {
    if (!confirm(t('orderDetail.cancel') + '?')) return;
    setError('');
    try {
      await api(`/orders/${orderId}/cancel`, { method: 'POST' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex h-screen">
      <MapView
        mode="tracking"
        center={masterPos ?? { lat: 51.1605, lng: 71.4704 }}
        masterPosition={masterPos}
        height={undefined}
        className="flex-1 rounded-none"
      />
      <div className="w-[380px] shrink-0 overflow-y-auto border-l border-border bg-surface px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-full bg-fill text-[15px] font-extrabold text-ink">
            {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-ink">
              {order.master?.name}{' '}
              <span className="rounded-pill bg-success-bg px-2 py-0.5 align-middle text-[10.5px] font-extrabold text-success-ink">
                {t('orderDetail.verified')}
              </span>
            </div>
            <div className="text-xs font-semibold text-ink-soft">
              ★ {order.master?.rating?.toFixed(1) ?? '—'} · {t('orderDetail.ordersCount', { n: order.master?.reviewCount ?? 0 })} ·{' '}
              {STATUS_LABELS[order.status]}
            </div>
          </div>
          {order.master?.phone && (
            <a
              href={`tel:${order.master.phone}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg text-white"
            >
              📞
            </a>
          )}
        </div>
        {eta != null && (
          <div className="mt-2.5 flex items-center justify-between rounded-md bg-fill px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-ink">{t('orderDetail.etaLabel')}</span>
            <span className="text-base font-extrabold text-primary">{t('orderDetail.etaMinutes', { n: eta })}</span>
          </div>
        )}
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-2.5 flex items-center gap-3.5 text-xs font-extrabold text-primary">
          <Link href="/support">{t('orderDetail.support')}</Link>
          <span className="text-border">·</span>
          <span className="text-ink-soft">{t('orderDetail.cancellationRules')}</span>
          <button type="button" onClick={cancel} className="ml-auto text-danger">
            {t('orderDetail.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку — теперь должна быть полностью зелёной**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршруты `/order/new` и
`/order/[id]` присутствуют в выводе.

- [ ] **Step 4: Commit**

```bash
git add apps/client/components/order-views/SearchView.tsx apps/client/components/order-views/TrackView.tsx
git commit -m "feat(client): SearchView+TrackView — карта в 2 колонки"
```

---

### Task 6: `DisputeView` + `/order/:id/dispute`

**Files:**
- Create: `apps/client/components/DisputeView.tsx`
- Create: `apps/client/app/(app)/order/[id]/dispute/page.tsx`

**Interfaces:**
- Produces: `DisputeView({ kind: 'orders' | 'planned-orders' })` — Фаза C
  добавит вторую тонкую страницу `app/(app)/planned/[id]/dispute/page.tsx`
  с `<DisputeView kind="planned-orders" />` без изменений в этом
  компоненте.
- Consumes: `api`, `apiUpload` (`@/lib/api`).

- [ ] **Step 1: Создать `apps/client/components/DisputeView.tsx`**

Порт `apps/web/src/features/client-v2/pages/DisputePage.tsx`:
переименован в `DisputeView`; `useNavigate`+`navigate(-1)` →
`useRouter()`+`router.back()`; `useParams` из `react-router-dom` →
`next/navigation` (та же сигнатура использования):

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '@/lib/api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  counterStatement: string | null;
}

const CATEGORY_KEYS = ['categoryQuality', 'categoryPrice', 'categoryBehavior', 'categoryOther'] as const;

export default function DisputeView({ kind }: { kind: 'orders' | 'planned-orders' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [freePilot, setFreePilot] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>('categoryQuality');
  const [text, setText] = useState('');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/${kind}/${id}`)
      .then((order) => {
        setDispute(order.dispute ?? null);
        setFreePilot(order.commercialMode === 'FREE_PILOT' || order.freePilot === true);
      })
      .catch((e) => setError((e as Error).message));
  }, [id, kind]);

  async function send() {
    setError('');
    setSubmitting(true);
    try {
      const reason = `${t(`dispute.${category}`)}. ${text}`.trim();
      const created = await api(`/${kind}/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) });
      setDispute(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadEvidence(file: File) {
    if (!dispute) return;
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${dispute.id}/evidence`, fd);
      setEvidenceCount((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.back()} className="text-xl text-primary">
          ←
        </button>
        <span className="flex-1 text-[17px] font-extrabold text-ink">{t('dispute.title', { id: id?.slice(0, 8) })}</span>
        {dispute && (
          <span className="rounded-pill bg-warning-bg px-2.5 py-1 text-[11px] font-extrabold text-warning-ink">
            {t('dispute.opened')}
          </span>
        )}
      </div>

      {!dispute && (
        <>
          <div className="text-sm font-extrabold text-ink">{t('dispute.reasonLabel')}</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-pill px-3.5 py-1.5 text-xs font-bold ${
                  category === key ? 'bg-primary text-white' : 'border-[1.5px] border-border text-ink-soft'
                }`}
              >
                {t(`dispute.${key}`)}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('dispute.placeholder')}
            className="min-h-24 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
          />
          <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
            {freePilot
              ? 'Мастер сможет дать пояснение, после чего оператор рассмотрит спор. Платформа не может вернуть оплату, переданную мастеру напрямую, но может зафиксировать нарушение, ограничить мастера и помочь сторонам урегулировать ситуацию.'
              : t('dispute.note')}
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={send}
            disabled={submitting || !text}
            className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {t('dispute.send')}
          </button>
        </>
      )}

      {dispute && (
        <>
          <div className="rounded-md border border-border bg-surface p-3.5">
            <div className="text-sm font-extrabold text-ink">{dispute.reason}</div>
            {evidenceCount > 0 && (
              <div className="mt-1 text-xs text-ink-soft">{t('common.photosCount', { n: evidenceCount })}</div>
            )}
          </div>
          <div className="text-sm font-extrabold text-ink">
            {t('dispute.evidenceLabel')} <span className="text-xs font-semibold text-ink-soft">{t('dispute.evidenceHint')}</span>
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-xl text-primary">
            ＋
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
            />
          </label>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="font-bold text-ink">{t('dispute.sentAt')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-bold text-ink">{t('dispute.waitingMaster')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-border" />
              <span className="font-semibold text-ink-soft">{t('dispute.waitingOperator')}</span>
            </div>
          </div>
          <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">{t('dispute.pausedNote')}</div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Создать `apps/client/app/(app)/order/[id]/dispute/page.tsx`**

```tsx
'use client';
import DisputeView from '@/components/DisputeView';

export default function OrderDisputePage() {
  return <DisputeView kind="orders" />;
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter client build`
Expected: сборка проходит без ошибок, маршрут `/order/[id]/dispute`
присутствует.

- [ ] **Step 4: Commit**

```bash
git add apps/client/components/DisputeView.tsx "apps/client/app/(app)/order/[id]/dispute"
git commit -m "feat(client): DisputeView + /order/:id/dispute"
```

---

### Task 7: Сквозная проверка Фазы B

**Files:** нет изменений кода — только живая браузерная проверка.

**Interfaces:** нет (финальная верификация всего, что сделано в
Tasks 1-6).

- [ ] **Step 1: Запустить dev-серверы**

Использовать уже настроенные записи `.claude/launch.json`
(`relaxed-api`, `relaxed-client`) из Фазы A — при необходимости повторить
обходы, найденные в Фазе A (см. отчёт Task 6 предыдущего плана: возможная
несовместимость `nest start --watch` в этой песочнице, обход — `nest
build && node dist/main`; `CORS_ORIGINS` в `apps/api/.env` должен включать
`http://localhost:4200`).

- [ ] **Step 2: Пройти визард полностью, включая фото**

Через UI на `http://localhost:4200/order/new`: выбрать категорию → ввести
описание, загрузить 1 фото (дождаться завершения антивирусной проверки —
кнопка/состояние `uploading` должно снять блокировку) → выбрать/ввести
адрес (карта в правой колонке должна быть интерактивна на шаге 3,
`onCenterChange` двигает `geo` при перетаскивании карты) → на шаге 4
дождаться `preview.available === true` и реальной цены с `POST
/orders/preview` → отправить. Ожидается редирект на `/order/:id`.

- [ ] **Step 3: Довести срочную заявку через все статусы**

Заявка после отправки — статус `SEARCHING`, экран `SearchView` (карта
слева, пульсирующая точка + таймер справа). Через прямые вызовы API от
имени мастера (создать/использовать мастера с активным `MasterProfile` в
нужной категории и `MasterPresence.isOnline=true`, см.
`apps/api/test/helpers.ts` — тот же рецепт, что в Фазе B прошлого цикла
«клиент v2»):

1. `POST /orders/:id/accept` от мастера → статус `ACCEPTED`, `TrackView`
   должен показать карту + аватар/рейтинг мастера.
2. Эмитировать сокет-событие `geo:update` (`{lat, lng}`) от имени
   мастера — на клиенте должен прийти `master:location`, маркер
   мастера на карте должен сдвинуться, ETA — обновиться в панели справа.
3. `POST /orders/:id/on-way`, затем `POST /orders/:id/on-site` — статус
   проходит `MASTER_ON_WAY` → `INSPECTION`, экран остаётся `TrackView`
   (оба входят в `TRACK_STATUSES`).
4. `POST /orders/:id/propose-price` (тело с `workPrice`/`workComment` по
   существующему DTO) → статус `AWAITING_PRICE_CONFIRM`, клиент видит
   `PriceView` с реальной ценой и обратным отсчётом.
5. На клиенте нажать «Подтвердить» (`POST /orders/:id/confirm-price`) →
   статус `IN_PROGRESS`, `ProgressView` со степпером.
6. `POST /orders/:id/complete` от мастера → статус `DONE`, клиент видит
   `DoneView`.
7. На клиенте нажать «Подтвердить выполнение» (`POST
   /orders/:id/confirm-completion`) → статус `CLOSED`, `ClosedView`,
   поставить оценку звёздами (`POST /orders/:id/review`) — подтвердить
   `rating`/`reviewCount` появились у мастера в БД (сверить с Postgres).

- [ ] **Step 4: Открыть спор**

На новой (другой) срочной заявке — довести до статуса `DONE` тем же путём
и вместо подтверждения выполнения открыть спор
(`/order/:id/dispute`) — выбрать категорию причины, ввести текст,
отправить, убедиться, что форма переключается в режим «спор открыт» с
таймлайном и полем загрузки доказательства; загрузить 1 файл в качестве
доказательства, подтвердить `evidenceCount` увеличился.

- [ ] **Step 5: Проверить «нет мастеров»**

Создать заявку без онлайн-мастера рядом — статус `NO_MASTERS`,
`NoMastersView` — проверить кнопки «Повторить поиск»
(`POST /orders/:id/retry-search`) и «Запланировать» (переход на
`/planned/new` — 404 до Фазы C, это ожидаемо, просто подтвердить сам факт
перехода по ссылке).

- [ ] **Step 6: Commit (если потребовались изменения окружения)**

Если для проверки пришлось менять `.claude/launch.json`/`apps/api/.env` —
эти файлы гитигнорируются (см. Фазу A) и не коммитятся. Если изменений в
отслеживаемых файлах не возникло — коммит не создаётся (как и в Task 6
Фазы A).
