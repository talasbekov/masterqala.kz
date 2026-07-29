# Флоу мастера (десктоп) — Фаза 2: рабочая лента + деньги — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить временную заглушку `/` на рабочий дашборд мастера
(срочные заявки с картой и полной стейт-машиной, плановая лента+ставки),
реализовать реальный приём оффера (замена Фазы-1-заглушки в
`OfferOverlay`), и добавить `/lead-credits`/`/wallet`.

**Architecture:** Продолжение `apps/master` (Next.js 15) из Фазы 1.
Точечный backend-фикс (Task 1, явно одобрен пользователем через
`AskUserQuestion` — см. `docs/superpowers/specs/2026-07-29-master-flow-desktop-design.md`,
уточнение в разделе «Активная срочная заявка»): `Order` получает scalar
`lat`/`lng`, т.к. иначе карта активной заявки технически невозможна —
бэкенд нигде не отдаёт координаты адреса заявки. Остальное — фронтенд
`apps/master`, без новых бэкенд-эндпоинтов.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, Leaflet
(копия паттерна `apps/client`), Socket.IO, NestJS+Prisma (только Task 1).

## Global Constraints

- Кроме Task 1 (явно одобренное исключение) — ни одного нового
  бэкенд-эндпоинта, ни одного изменения `apps/api`/`apps/client` вне
  того, что описано в Task 1.
- Без i18n — все строки хардкод на русском (как в Фазе 1).
- Без фреймворка юнит/e2e-тестов на фронте — верификация:
  `pnpm --filter master build` + ручная проверка в браузере. Task 1 —
  исключение: `apps/api` тестируется через существующий e2e-фреймворк
  (Jest + supertest), TDD (RED→GREEN) обязателен.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css`
  (`bg-background`, `bg-surface`, `text-ink`, `text-ink-soft`,
  `text-muted`, `text-primary`, `text-danger`, `border-border`,
  `bg-fill-soft`, `rounded-md`, `rounded-lg`, `rounded-pill`) — тот же
  список, что в Фазе 1.
- Карта — `mode="tracking"` из уже скопированного (в этой фазе, Task 3)
  `MapView`: статичный пин в `center` + маркер `masterPosition`,
  обновляемый снаружи. Никаких новых режимов карты не требуется.
- **Приватность оффера не трогать**: `offer:new` НЕ получает
  координаты — только `district`/`distanceKm`, как сейчас (проверено
  e2e-тестом `realtime-orders.e2e-spec.ts:52`,
  `expect(offer.address).toBeUndefined()`). Координаты появляются
  только в `/master/active-order` — **после** принятия заявки, не до.
  Это сознательное решение контроллера при планировании (не часть
  одобрения пользователя выше, но прямое следствие уже существующей
  политики приватности из Цикла 1 — «район вместо полного адреса до
  принятия»), не смешивать с Task 1.

---

## Файловая структура Фазы 2

```
apps/api/
  prisma/schema.prisma                     # + Order.lat/lng
  prisma/migrations/<ts>_add_order_lat_lng/
  src/orders/orders.service.ts             # create() пишет lat/lng
  test/orders-create.e2e-spec.ts           # + 1 тест

apps/client/
  lib/orderTypes.ts                        # + lat/lng
  components/order-views/TrackView.tsx     # реальный адрес вместо Астаны

apps/master/
  lib/
    activeOrder.ts                         # новое
    plannedFeed.ts                         # новое
    masterPresence.tsx                     # + myPosition, acceptOffer
  components/
    MapViewInner.tsx                       # новое (копия apps/client)
    MapView.tsx                            # новое (копия apps/client)
    ActiveOrderView.tsx                    # новое
    PlannedFeedView.tsx                    # новое
    OfferOverlay.tsx                       # реальная кнопка «Принять»
  app/(app)/
    page.tsx                               # переписан целиком
    lead-credits/page.tsx                  # новое
    wallet/page.tsx                        # новое
```

---

### Task 1: Backend — `Order.lat`/`Order.lng` + фикс карты в `apps/client`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_order_lat_lng/migration.sql`
- Modify: `apps/api/src/orders/orders.service.ts`
- Test: `apps/api/test/orders-create.e2e-spec.ts`
- Modify: `apps/client/lib/orderTypes.ts`
- Modify: `apps/client/components/order-views/TrackView.tsx`

**Interfaces:**
- Produces: `Order.lat: number | null`, `Order.lng: number | null` —
  доступны без изменений в `ORDER_INCLUDE` (это scalar-поля, Prisma
  возвращает их автоматически) во всех местах, где заявка читается
  через `ORDER_INCLUDE` — в частности `GET /master/active-order`
  (используется Task 2 этой фазы) и `GET /orders/:id`.
- **НЕ трогать** `apps/api/src/orders/matching.service.ts` — `offer:new`
  координаты не получает (см. Global Constraints, приватность).

- [ ] **Step 1: RED — добавить тест на lat/lng в ответе создания заявки**

Открыть `apps/api/test/orders-create.e2e-spec.ts`, добавить новый `it`
сразу после теста `'создание: заявка в SEARCHING, есть HOLD на полную
стоимость выезда, гео записано'` (в той же `describe`-секции, использует
уже существующие `client`, `plumbingId` из `beforeEach`):

```ts
  it('создание: заявка возвращает lat/lng, совпадающие со входными координатами', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    expect(order.lat).toBeCloseTo(ALMATY.lat, 3);
    expect(order.lng).toBeCloseTo(ALMATY.lng, 3);
  });
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd apps/api && DATABASE_URL="postgresql://masterqala:masterqala@localhost:5432/masterqala" npx jest --config test/jest-e2e.json orders-create -t "lat/lng"`
Expected: FAIL — `order.lat`/`order.lng` равны `undefined`,
`toBeCloseTo` падает.

- [ ] **Step 3: Добавить `lat`/`lng` в модель `Order`**

В `apps/api/prisma/schema.prisma` найти модель `Order` (строка ~132) и
добавить `lat`/`lng` сразу после строки `location
Unsupported("geography(Point, 4326)")?` (по образцу `Address.lat`/
`Address.lng`, строки 311-312 той же схемы):

```prisma
  location        Unsupported("geography(Point, 4326)")?
  lat             Float?
  lng             Float?
  status          OrderStatus               @default(CREATED)
```

- [ ] **Step 4: Сгенерировать и проверить миграцию**

Run: `cd apps/api && DATABASE_URL="postgresql://masterqala:masterqala@localhost:5432/masterqala" npx prisma migrate dev --name add_order_lat_lng`

Открыть сгенерированный `apps/api/prisma/migrations/<новый
timestamp>_add_order_lat_lng/migration.sql` и проверить: должна быть
ровно одна содержательная строка вида
`ALTER TABLE "Order" ADD COLUMN "lat" DOUBLE PRECISION, ADD COLUMN "lng" DOUBLE PRECISION;`.

**Если** Prisma также сгенерировала `DROP INDEX "Order_location_idx"`
и/или `DROP INDEX "MasterPresence_location_idx"` (известная причуда —
Prisma не видит GIST-индексы на `Unsupported`-колонках и каждый раз
предлагает их удалить, см. миграции `20260719161504_client_v2_backend_extensions`
и `20260719203246_minimal_master_rating` с тем же паттерном) — удалить
эти две строки из файла миграции и добавить перед оставшимся содержимым
тот же предупреждающий комментарий, что и в упомянутых миграциях:

```sql
/*
  Warnings:
  Note: this migration intentionally does NOT drop "MasterPresence_location_idx" /
  "Order_location_idx" even though Prisma's diff engine proposed dropping them.
  Those GIST indexes were created via raw SQL in migration
  20260715072332_stage2_urgent_orders because Prisma cannot express indexes on
  Unsupported("geography(...)") columns in schema.prisma. Since they're invisible
  to the schema, every future `prisma migrate dev` will keep proposing to drop them;
  they are load-bearing for the ST_DWithin/ST_Distance queries in
  src/orders/matching.service.ts, so we preserve them here.
*/
```

- [ ] **Step 5: Записывать `lat`/`lng` при создании заявки**

В `apps/api/src/orders/orders.service.ts`, метод `create()` (строки
~61-118), найти `tx.order.create({ data: { ... } })` и добавить
`lat`/`lng` сразу после `district: dto.district,`:

```ts
      const created = await tx.order.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          district: dto.district,
          lat: dto.lat,
          lng: dto.lng,
          entrance: dto.entrance ?? null,
          floor: dto.floor ?? null,
          apartment: dto.apartment ?? null,
          addressComment: dto.addressComment ?? null,
          calloutPrice: quote.calloutPrice,
          serviceFee: quote.serviceFee,
        },
      });
```

Остальная часть метода (raw-SQL `UPDATE ... SET location = ...`,
`orderPhoto.createMany`, холд, гейт, постановка в очередь) не меняется
— `lat`/`lng` пишутся как обычные scalar-поля параллельно с уже
существующей записью `location` через PostGIS, а не вместо неё.

- [ ] **Step 6: Запустить тест снова, убедиться что проходит (GREEN)**

Run: `cd apps/api && DATABASE_URL="postgresql://masterqala:masterqala@localhost:5432/masterqala" npx jest --config test/jest-e2e.json orders-create -t "lat/lng"`
Expected: PASS

- [ ] **Step 7: Полный прогон e2e + build, убедиться в отсутствии регрессий**

Run: `rm -rf /tmp/jest_rs && cd apps/api && DATABASE_URL="postgresql://masterqala:masterqala@localhost:5432/masterqala" npx jest --config test/jest-e2e.json --runInBand`
Expected: все suites зелёные (единственный известный environmental fail
— `queue.e2e-spec.ts` из-за занятого порта 5433 чужим контейнером,
не регрессия этой задачи — см. память `masterqala-stage-plan`).

Run: `pnpm --filter api build`
Expected: успешно.

- [ ] **Step 8: Обновить клиентский тип заявки**

В `apps/client/lib/orderTypes.ts` добавить `lat`/`lng` в интерфейс
`OrderDetail` сразу после `address: string;`:

```ts
export interface OrderDetail {
  id: string;
  status: string;
  commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';
  freePilot?: boolean;
  wave: number;
  category: { name: string } | null;
  master: OrderMaster | null;
  address: string;
  lat: number | null;
  lng: number | null;
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

- [ ] **Step 9: Починить захардкоженный центр карты в `TrackView`**

В `apps/client/components/order-views/TrackView.tsx` заменить строку

```tsx
        center={masterPos ?? { lat: 51.1605, lng: 71.4704 }}
```

на

```tsx
        center={
          masterPos ?? (order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : { lat: 51.1605, lng: 71.4704 })
        }
```

Остальной файл не меняется — резервный центр Астаны остаётся как
fallback на случай старых заявок без координат (созданных до этой
миграции).

- [ ] **Step 10: Проверить сборку `apps/client`**

Run: `pnpm --filter client build`
Expected: успешно.

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations \
  apps/api/src/orders/orders.service.ts apps/api/test/orders-create.e2e-spec.ts \
  apps/client/lib/orderTypes.ts apps/client/components/order-views/TrackView.tsx
git commit -m "fix(api,client): Order.lat/lng — карта мастера и реальный адрес в TrackView"
```

---

### Task 2: `lib/activeOrder.ts` — типы и API-вызовы активной срочной заявки

**Files:**
- Create: `apps/master/lib/activeOrder.ts`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза 1, Task 1).
- Produces: `interface ActiveOrder` (`id`, `status`, `address`,
  `description`, `lat`, `lng`, `category`, `client`),
  `fetchActiveOrder(): Promise<ActiveOrder | null>`,
  `setOnWay(orderId: string): Promise<void>`,
  `setOnSite(orderId: string): Promise<void>`,
  `proposePrice(orderId: string, amount: number, comment?: string): Promise<void>`,
  `completeOrder(orderId: string): Promise<void>`,
  `cancelOrder(orderId: string): Promise<void>` — используются Task 5
  (`ActiveOrderView`) и Task 8 (страница `/`) этой фазы.

- [ ] **Step 1: Создать `lib/activeOrder.ts`**

```ts
import { api } from './api';

export interface ActiveOrderClient {
  phone: string;
}

export interface ActiveOrderCategory {
  name: string;
}

export interface ActiveOrder {
  id: string;
  status: string;
  address: string;
  description: string;
  lat: number | null;
  lng: number | null;
  category: ActiveOrderCategory | null;
  client: ActiveOrderClient | null;
}

export async function fetchActiveOrder(): Promise<ActiveOrder | null> {
  const res = await api('/master/active-order');
  return (res.order ?? null) as ActiveOrder | null;
}

export async function setOnWay(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/on-way`, { method: 'POST' });
}

export async function setOnSite(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/on-site`, { method: 'POST' });
}

export async function proposePrice(orderId: string, amount: number, comment?: string): Promise<void> {
  await api(`/orders/${orderId}/propose-price`, {
    method: 'POST',
    body: JSON.stringify({ amount, comment: comment || undefined }),
  });
}

export async function completeOrder(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/complete`, { method: 'POST' });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/cancel`, { method: 'POST' });
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Commit**

```bash
git add apps/master/lib/activeOrder.ts
git commit -m "feat(master): типы и API-вызовы активной срочной заявки"
```

---

### Task 3: Копия `MapView`/`MapViewInner` из `apps/client`

**Files:**
- Create: `apps/master/components/MapViewInner.tsx`
- Create: `apps/master/components/MapView.tsx`

**Interfaces:**
- Produces: `MapView` (default export) — проп `mode: 'pin' | 'pulse' | 'tracking'`,
  `center: LatLng`, `onCenterChange?`, `masterPosition?: LatLng | null`,
  `height?`, `className?`; `export type { LatLng }`. Используется Task 5
  (`ActiveOrderView`) с `mode="tracking"`.

- [ ] **Step 1: Создать `components/MapViewInner.tsx`** (байт-в-байт
  копия `apps/client/components/MapViewInner.tsx` — тот же паттерн,
  что уже использовался при переносе клиентского флоу на десктоп)

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
  const onCenterChangeRef = useRef(onCenterChange);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

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
        onCenterChangeRef.current?.({ lat: c.lat, lng: c.lng });
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

- [ ] **Step 2: Создать `components/MapView.tsx`** (копия `apps/client/components/MapView.tsx`)

```tsx
'use client';
import dynamic from 'next/dynamic';

export type { LatLng } from './MapViewInner';

const MapView = dynamic(() => import('./MapViewInner'), { ssr: false });

export default MapView;
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно (компонент пока никем не импортируется, но должен
типо-checking-проходить).

- [ ] **Step 4: Commit**

```bash
git add apps/master/components/MapViewInner.tsx apps/master/components/MapView.tsx
git commit -m "feat(master): копия MapView/MapViewInner из apps/client"
```

---

### Task 4: `MasterPresenceProvider` — `myPosition` + реальный `acceptOffer`

**Files:**
- Modify: `apps/master/lib/masterPresence.tsx`
- Modify: `apps/master/components/OfferOverlay.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза 1), `useRouter` из
  `next/navigation`.
- Produces: расширенный `MasterPresenceCtx` — добавляются `myPosition:
  LatLng | null`, `acceptingOffer: boolean`, `acceptOffer: () =>
  Promise<void>`; существующие поля (`online`, `connected`,
  `geoDenied`, `offer`, `offerNote`, `goOnline`, `goOffline`,
  `dismissOfferNote`) не меняют имён/типов. `export interface LatLng`
  — используется Task 5 (`ActiveOrderView`, проп `masterPosition`
  компонента `MapView`).

- [ ] **Step 1: Заменить содержимое `lib/masterPresence.tsx`**

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
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

export interface LatLng {
  lat: number;
  lng: number;
}

interface MasterPresenceCtx {
  online: boolean;
  connected: boolean;
  geoDenied: boolean;
  offer: UrgentOffer | null;
  offerNote: string;
  myPosition: LatLng | null;
  acceptingOffer: boolean;
  goOnline: () => void;
  goOffline: () => void;
  dismissOfferNote: () => void;
  acceptOffer: () => Promise<void>;
}

const Ctx = createContext<MasterPresenceCtx>({
  online: false,
  connected: false,
  geoDenied: false,
  offer: null,
  offerNote: '',
  myPosition: null,
  acceptingOffer: false,
  goOnline: () => {},
  goOffline: () => {},
  dismissOfferNote: () => {},
  acceptOffer: async () => {},
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
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<UrgentOffer | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
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
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const socket = getSocket();
        socket.emit('presence:online', coords);
        setOnline(true);
        setMyPosition(coords);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((next) => {
            const nextCoords = { lat: next.coords.latitude, lng: next.coords.longitude };
            socket.emit('geo:update', nextCoords);
            setMyPosition(nextCoords);
          });
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

  const acceptOffer = useCallback(async () => {
    if (!offer) return;
    setAcceptingOffer(true);
    try {
      await api(`/orders/${offer.orderId}/accept`, { method: 'POST' });
      setOffer(null);
      router.push('/');
    } catch (e) {
      setOffer(null);
      setOfferNote((e as Error).message);
    } finally {
      setAcceptingOffer(false);
    }
  }, [offer, router]);

  return (
    <Ctx.Provider
      value={{
        online,
        connected,
        geoDenied,
        offer,
        offerNote,
        myPosition,
        acceptingOffer,
        goOnline,
        goOffline,
        dismissOfferNote,
        acceptOffer,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useMasterPresence = () => useContext(Ctx);
```

- [ ] **Step 2: Заменить содержимое `components/OfferOverlay.tsx`**
  (реальная кнопка «Принять» вместо заглушки Фазы 1; ветка `offerNote`
  из Фазы 1 не меняется)

```tsx
'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlay() {
  const { offer, offerNote, acceptingOffer, acceptOffer, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return null;
    return (
      <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-[360px] items-start gap-3 rounded-md border border-border bg-fill-soft p-3 text-sm text-ink-soft shadow-lg">
        <p className="flex-1">{offerNote}</p>
        <button
          type="button"
          onClick={dismissOfferNote}
          aria-label="Скрыть уведомление"
          className="text-ink-soft hover:text-ink"
        >
          ✕
        </button>
      </div>
    );
  }

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
        <button
          type="button"
          disabled={acceptingOffer}
          onClick={acceptOffer}
          className="w-full rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          {acceptingOffer ? 'Принимаем…' : `Принять (${secondsLeft} с)`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 4: Живая проверка приёма оффера**

По паттерну живой проверки Фазы 1 Task 6 (реальный онлайн-мастер +
реальная срочная заявка от клиента, матчинг адресует оффер): убедиться,
что кнопка «Принять» реально вызывает `POST /orders/:id/accept`,
оффер закрывается, происходит переход на `/` (пока там будет
placeholder — полноценный дашборд появится в Task 8 этой же фазы; для
этой задачи достаточно подтвердить сам факт успешного `accept` и
навигации). Отдельно проверить happy-path ошибки: если `accept`
возвращает ошибку (например, заявку уже принял другой мастер —
можно спровоцировать гонку двумя мастерами или временно отключить
кандидата), баннер `offerNote` показывает текст ошибки.

- [ ] **Step 5: Commit**

```bash
git add apps/master/lib/masterPresence.tsx apps/master/components/OfferOverlay.tsx
git commit -m "feat(master): реальный accept оффера + myPosition в MasterPresenceProvider"
```

---

### Task 5: `ActiveOrderView` — карта + карточка статуса активной заявки

**Files:**
- Create: `apps/master/components/ActiveOrderView.tsx`

**Interfaces:**
- Consumes: `MapView`/`LatLng` (Task 3), `useMasterPresence()` →
  `myPosition` (Task 4), `ActiveOrder`/`setOnWay`/`setOnSite`/
  `proposePrice`/`completeOrder`/`cancelOrder` из `lib/activeOrder.ts`
  (Task 2).
- Produces: `<ActiveOrderView order={ActiveOrder} onChanged={() =>
  void} />` — используется Task 8 (страница `/`); `onChanged`
  вызывается после каждого успешного действия, чтобы страница
  перезагрузила активную заявку.

- [ ] **Step 1: Создать `components/ActiveOrderView.tsx`**

```tsx
'use client';
import { useState } from 'react';
import MapView from './MapView';
import { useMasterPresence } from '@/lib/masterPresence';
import {
  cancelOrder,
  completeOrder,
  proposePrice,
  setOnSite,
  setOnWay,
  type ActiveOrder,
} from '@/lib/activeOrder';

const FALLBACK_CENTER = { lat: 43.2389, lng: 76.8897 };

export function ActiveOrderView({ order, onChanged }: { order: ActiveOrder; onChanged: () => void }) {
  const { myPosition } = useMasterPresence();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const center = order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : FALLBACK_CENTER;

  async function run(action: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    setSubmitting(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full">
      <MapView mode="tracking" center={center} masterPosition={myPosition} height={undefined} className="flex-1 rounded-none" />
      <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto border-l border-border bg-surface p-6">
        <h2 className="text-lg font-extrabold text-ink">{order.category?.name}</h2>
        <div className="space-y-1 rounded-lg border border-border p-4">
          <div className="text-sm text-ink">{order.address}</div>
          <div className="text-sm text-ink-soft">{order.description}</div>
          {order.client?.phone && (
            <a href={`tel:${order.client.phone}`} className="text-sm font-bold text-primary underline">
              {order.client.phone}
            </a>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}

        {order.status === 'ACCEPTED' && (
          <button
            disabled={submitting}
            className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
            onClick={() => run(() => setOnWay(order.id))}
          >
            Еду
          </button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <button
            disabled={submitting}
            className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
            onClick={() => run(() => setOnSite(order.id))}
          >
            На месте
          </button>
        )}
        {order.status === 'INSPECTION' && (
          <div className="space-y-2">
            <input
              type="number"
              min="1"
              placeholder="Стоимость работ, ₸"
              className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <input
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              disabled={submitting || !Number(price)}
              className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => run(() => proposePrice(order.id, Number(price), comment))}
            >
              Отправить цену
            </button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <p className="text-center text-sm text-ink-soft">Ожидание подтверждения цены клиентом…</p>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button
            disabled={submitting}
            className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
            onClick={() => run(() => completeOrder(order.id))}
          >
            Выполнено
          </button>
        )}
        {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
          <button
            disabled={submitting}
            className="w-full rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger disabled:opacity-40"
            onClick={() => run(() => cancelOrder(order.id), 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Commit**

```bash
git add apps/master/components/ActiveOrderView.tsx
git commit -m "feat(master): ActiveOrderView — карта и стейт-машина активной заявки"
```

(Живая проверка `ActiveOrderView` целиком — часть Task 8, где компонент
впервые смонтирован на реальной странице `/`.)

---

### Task 6: `lib/plannedFeed.ts` — типы и API-вызовы плановой ленты

**Files:**
- Create: `apps/master/lib/plannedFeed.ts`

**Interfaces:**
- Consumes: `api` из `lib/api.ts`.
- Produces: `interface PlannedFeedItem`, `interface PlannedOrderDetail`,
  `interface BidValues`, `fetchPlannedFeed(): Promise<PlannedFeedItem[]>`,
  `fetchPlannedOrder(id: string): Promise<PlannedOrderDetail>`,
  `submitBid(plannedOrderId: string, values: BidValues): Promise<void>`
  — используются Task 7 (`PlannedFeedView`).

- [ ] **Step 1: Создать `lib/plannedFeed.ts`**

```ts
import { api } from './api';

export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';

export interface PlannedFeedItem {
  id: string;
  commercialMode: CommercialMode;
  category: { name: string } | null;
  district: string;
  description: string;
  slotStart: string;
  slotEnd: string;
  _count: { bids: number };
}

export interface PlannedOrderDetail extends PlannedFeedItem {
  budget: number | null;
}

export async function fetchPlannedFeed(): Promise<PlannedFeedItem[]> {
  return api('/planned-orders/feed');
}

export async function fetchPlannedOrder(id: string): Promise<PlannedOrderDetail> {
  return api(`/planned-orders/${id}`);
}

export interface BidValues {
  price: number;
  term: string;
  comment?: string;
}

export async function submitBid(plannedOrderId: string, values: BidValues): Promise<void> {
  await api(`/planned-orders/${plannedOrderId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ price: values.price, term: values.term, comment: values.comment || undefined }),
  });
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Commit**

```bash
git add apps/master/lib/plannedFeed.ts
git commit -m "feat(master): типы и API-вызовы плановой ленты"
```

---

### Task 7: `PlannedFeedView` — лента + детали + форма ставки

**Files:**
- Create: `apps/master/components/PlannedFeedView.tsx`

**Interfaces:**
- Consumes: `useCommercialMode()` из `lib/commercial-mode.tsx` (Фаза 1),
  `getSocket` из `lib/socket.ts` (Фаза 1), всё из `lib/plannedFeed.ts`
  (Task 6).
- Produces: `<PlannedFeedView />` (без пропов) — используется Task 8
  (страница `/`, вкладка «Плановые»).

- [ ] **Step 1: Создать `components/PlannedFeedView.tsx`**

Без карты (плановый режим не имеет геоданных в контракте — то же
решение, что в клиентском плановом режиме подпроекта 2, фаза C), узкая
центрированная колонка.

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { useCommercialMode } from '@/lib/commercial-mode';
import {
  fetchPlannedFeed,
  fetchPlannedOrder,
  submitBid,
  type PlannedFeedItem,
  type PlannedOrderDetail,
} from '@/lib/plannedFeed';

export function PlannedFeedView() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [feed, setFeed] = useState<PlannedFeedItem[]>([]);
  const [selected, setSelected] = useState<PlannedOrderDetail | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [error, setError] = useState('');

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

  async function open(id: string) {
    setError('');
    try {
      setSelected(await fetchPlannedOrder(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!selected || !Number(bidPrice) || !bidTerm) return;
    setError('');
    try {
      await submitBid(selected.id, { price: Number(bidPrice), term: bidTerm, comment: bidComment });
      setSelected(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const hasFreeOrders = feed.some((item) => item.commercialMode === 'FREE_PILOT');
  const hasPaidOrders = feed.some((item) => item.commercialMode !== 'FREE_PILOT');
  const selectedFree = selected ? selected.commercialMode === 'FREE_PILOT' : false;

  if (selected) {
    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-8">
        <button className="text-sm text-ink-soft" onClick={() => setSelected(null)}>
          ← Назад к ленте
        </button>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{selected.category?.name}</h2>
          <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-xs font-extrabold text-primary">
            {selectedFree ? 'Бесплатный отклик' : 'Отклик: 1 кредит'}
          </span>
        </div>
        <div className="text-sm text-ink-soft">{selected.district}</div>
        <div className="text-sm text-ink-soft">{new Date(selected.slotStart).toLocaleString('ru-RU')}</div>
        <div className="text-sm text-ink">{selected.description}</div>
        <input
          type="number"
          min="1"
          placeholder="Ваша цена, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidPrice}
          onChange={(e) => setBidPrice(e.target.value)}
        />
        <input
          placeholder="Срок (например: сегодня до 18:00)"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidTerm}
          onChange={(e) => setBidTerm(e.target.value)}
        />
        <input
          placeholder="Комментарий (необязательно)"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidComment}
          onChange={(e) => setBidComment(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(bidPrice) || !bidTerm}
          onClick={submit}
        >
          {selectedFree ? 'Откликнуться бесплатно' : 'Откликнуться (1 кредит)'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-3 p-8">
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
        return (
          <button
            key={item.id}
            onClick={() => open(item.id)}
            className="block w-full rounded-lg border border-border bg-surface p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-ink">{item.category?.name}</span>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-ink-soft">{item._count.bids}/5 ставок</span>
                <span className="rounded-pill bg-fill-soft px-2 py-0.5 text-xs font-extrabold text-primary">
                  {free ? 'Бесплатно' : '1 кредит'}
                </span>
              </div>
            </div>
            <div className="text-sm text-ink-soft">{item.district}</div>
            <div className="text-sm text-ink-soft">{new Date(item.slotStart).toLocaleString('ru-RU')}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Commit**

```bash
git add apps/master/components/PlannedFeedView.tsx
git commit -m "feat(master): PlannedFeedView — лента, детали, форма ставки"
```

(Живая проверка целиком — часть Task 8.)

---

### Task 8: Переписать `/` — рабочий дашборд (вкладки + активная заявка + плановая лента)

**Files:**
- Modify: `apps/master/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Фаза 1), `useMasterPresence()` → `online`,
  `geoDenied` (Фаза 1/Task 4), `getSocket` (Фаза 1),
  `fetchApplication`/`APPLICATION_STATUS_RU`/`Application` из
  `lib/masterApplication.ts` (Фаза 1) — гейт по анкете не меняется,
  `fetchActiveOrder`/`ActiveOrder` из `lib/activeOrder.ts` (Task 2),
  `ActiveOrderView` (Task 5), `PlannedFeedView` (Task 7).

- [ ] **Step 1: Заменить содержимое `app/(app)/page.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useMasterPresence } from '@/lib/masterPresence';
import { getSocket } from '@/lib/socket';
import { APPLICATION_STATUS_RU, fetchApplication, type Application } from '@/lib/masterApplication';
import { fetchActiveOrder, type ActiveOrder } from '@/lib/activeOrder';
import { ActiveOrderView } from '@/components/ActiveOrderView';
import { PlannedFeedView } from '@/components/PlannedFeedView';

type Tab = 'urgent' | 'planned';

export default function WorkDashboardPage() {
  const { user } = useAuth();
  const { online, geoDenied } = useMasterPresence();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('urgent');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    fetchApplication().then((app) => {
      setApplication(app);
      setLoaded(true);
    });
  }, []);

  const loadActive = useCallback(() => {
    fetchActiveOrder().then(setActiveOrder);
  }, []);

  useEffect(() => {
    if (!application || application.status !== 'ACTIVE') return;
    loadActive();
    const socket = getSocket();
    const onStatus = () => loadActive();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, [application, loadActive]);

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

  if (activeOrder) {
    return (
      <div className="h-full">
        <ActiveOrderView order={activeOrder} onChanged={loadActive} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto mt-8 flex w-full max-w-[480px] rounded-pill border border-border p-1">
        <button
          className={`flex-1 rounded-pill py-2 text-sm font-extrabold ${tab === 'urgent' ? 'bg-primary text-white' : 'text-ink-soft'}`}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </button>
        <button
          className={`flex-1 rounded-pill py-2 text-sm font-extrabold ${tab === 'planned' ? 'bg-primary text-white' : 'text-ink-soft'}`}
          onClick={() => setTab('planned')}
        >
          Плановые
        </button>
      </div>

      {tab === 'urgent' && (
        <div className="mx-auto max-w-[480px] p-8 text-center">
          <div className="text-lg font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
          <p className="mt-3 text-sm text-ink-soft">
            {online
              ? 'Ждём заявки рядом с вами…'
              : 'Нажмите «Стать онлайн» в боковой панели, чтобы получать срочные заявки.'}
          </p>
          {geoDenied && (
            <p className="mt-3 rounded-md bg-fill-soft p-3 text-sm text-ink-soft">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера и попробуйте снова.
            </p>
          )}
        </div>
      )}
      {tab === 'planned' && <PlannedFeedView />}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Живая проверка — срочный режим целиком**

Онлайн-мастер (см. паттерн Фазы 1 Task 6) без активной заявки открывает
`/`, видит вкладку «Срочные» с сообщением «Ждём заявки…». Клиент
создаёт срочную заявку рядом (реальный `POST /orders`) → мастер видит
`OfferOverlay` → «Принять» → навигация на `/`, где теперь сразу (без
вкладок) видна `ActiveOrderView`: карта с пином адреса клиента и своей
позицией. Пройти всю стейт-машину: «Еду» → `MASTER_ON_WAY` → «На месте»
→ `INSPECTION` → ввести цену → «Отправить цену» →
`AWAITING_PRICE_CONFIRM` (сообщение об ожидании) → клиент подтверждает
цену (через реальный `apps/client` на порту 4200, уже работающий и
покрывающий этот шаг с подпроекта 2 фазы B, либо прямым `POST
/orders/:id/confirm-price` — на усмотрение исполнителя) → `IN_PROGRESS`
→ «Выполнено» → заявка завершена, `/` возвращается к вкладкам (нет
активной заявки). Отдельно проверить отмену на статусе `ACCEPTED` или
`MASTER_ON_WAY` — заявка возвращается в поиск.

- [ ] **Step 4: Живая проверка — плановый режим**

На вкладке «Плановые» — лента реальных плановых заявок в категории
мастера (создать через `apps/client`, порт 4200, реальный визард
`/planned/new`, либо напрямую через API), открыть заявку, отправить
ставку — подтвердить появление ставки со стороны клиента
(`/planned/:id/compare` на 4200).

- [ ] **Step 5: Commit**

```bash
git add apps/master/app/\(app\)/page.tsx
git commit -m "feat(master): рабочий дашборд — вкладки, активная заявка с картой, плановая лента"
```

---

### Task 9: Страница `/lead-credits`

**Files:**
- Create: `apps/master/app/(app)/lead-credits/page.tsx`

**Interfaces:**
- Consumes: `api` (Фаза 1), `useCommercialMode()` (Фаза 1).

- [ ] **Step 1: Создать `app/(app)/lead-credits/page.tsx`** (порт
  `apps/web/src/pages/LeadCreditsPage.tsx`)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

interface Package {
  id: string;
  credits: number;
  priceTenge: number;
}

export default function LeadCreditsPage() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState('');

  function load() {
    api('/lead-credits/balance').then((r) => setBalance(r.balance));
    api('/lead-credits/packages').then(setPackages);
  }

  useEffect(() => {
    if (leadCreditsEnabled) load();
  }, [leadCreditsEnabled]);

  async function purchase(id: string) {
    setPurchasing(id);
    setError('');
    try {
      const r = await api('/lead-credits/purchase', { method: 'POST', body: JSON.stringify({ package: id }) });
      setBalance(r.balance);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing('');
    }
  }

  if (!leadCreditsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-8">
        <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>
        <div className="rounded-lg border border-border bg-fill-soft p-5 text-center">
          <div className="text-lg font-extrabold text-primary">Отклики бесплатны</div>
          <p className="mt-2 text-sm text-ink-soft">
            В период бесплатного пилота мастеру не нужны кредиты для отклика на плановые заявки.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 p-8">
      <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance}</div>
        <div className="text-sm text-ink-soft">кредитов на балансе</div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {packages.map((p) => (
          <button
            key={p.id}
            disabled={!!purchasing}
            onClick={() => purchase(p.id)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-4 disabled:opacity-40"
          >
            <span className="text-sm text-ink">
              {p.credits} кредит{p.credits > 1 ? 'ов' : ''}
            </span>
            <span className="text-sm font-extrabold text-primary">{purchasing === p.id ? 'Оплата…' : `${p.priceTenge} ₸`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Живая проверка**

Мастер с `leadCreditsEnabled` (проверить/переключить `commercialMode`
в конфиге, если пилот сейчас `FREE_PILOT` — см. `apps/api`
`.env`/сидинг конфига) открывает `/lead-credits`, видит баланс и
пакеты, покупает один — баланс обновляется. Если сейчас в проекте
активен `FREE_PILOT` (кредиты выключены) — проверить вместо этого,
что показывается честная заглушка «Отклики бесплатны».

- [ ] **Step 4: Commit**

```bash
git add apps/master/app/\(app\)/lead-credits
git commit -m "feat(master): страница /lead-credits"
```

---

### Task 10: Страница `/wallet`

**Files:**
- Create: `apps/master/app/(app)/wallet/page.tsx`

**Interfaces:**
- Consumes: `api` (Фаза 1), `useCommercialMode()` (Фаза 1).

- [ ] **Step 1: Создать `app/(app)/wallet/page.tsx`** (порт
  `apps/web/src/pages/WalletPage.tsx`)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
}

export default function WalletPage() {
  const { payoutsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api('/wallet/balance').then((r) => setBalance(r.balance));
    api('/wallet/withdrawals').then(setHistory);
  }

  useEffect(() => {
    if (payoutsEnabled) load();
  }, [payoutsEnabled]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setAmount('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!payoutsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-8">
        <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
        <div className="rounded-lg border border-border bg-fill-soft p-5 text-center">
          <div className="text-lg font-extrabold text-primary">Расчёт напрямую с клиентом</div>
          <p className="mt-2 text-sm text-ink-soft">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 p-8">
      <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance} ₸</div>
        <div className="text-sm text-ink-soft">доступно к выводу</div>
      </div>
      <div className="space-y-2">
        <input
          type="number"
          min="5000"
          placeholder="Сумма вывода, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : 'Вывести'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-extrabold text-ink">История</h2>
        {history.length === 0 && <p className="text-sm text-ink-soft">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex justify-between rounded-lg border border-border p-3 text-sm">
            <span className="text-ink">{w.amount} ₸</span>
            <span className="text-ink-soft">{STATUS_LABELS[w.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter master build`
Expected: успешно.

- [ ] **Step 3: Живая проверка**

Мастер с ненулевым балансом кошелька (см. подпроект 2/этап 4 — баланс
начисляется через `CompensationService.accrueCallout` после `complete`
завершённой срочной заявки, что уже пройдено в Task 8 этой фазы)
открывает `/wallet`, видит баланс, запрашивает вывод ≥5000₸ — заявка
появляется в истории со статусом «В обработке»/«Выплачено» (мок-провайдер
синхронно успешен). Если `payoutsEnabled` выключен — проверить честную
заглушку.

- [ ] **Step 4: Commit**

```bash
git add apps/master/app/\(app\)/wallet
git commit -m "feat(master): страница /wallet"
```

---

## Self-Review Checklist (для финального ревью Фазы 2)

- `offer:new` по-прежнему не содержит координат (privacy) — сверить
  `matching.service.ts` не тронут этой фазой.
- `Order.lat`/`lng` появляются в ответе `/master/active-order` и `GET
  /orders/:id` без ручного изменения `ORDER_INCLUDE` — это scalar-поля.
- `TrackView.tsx` подпроекта 2 использует реальный адрес, а не
  захардкоженную Астану, когда координаты есть.
- Все новые lib-файлы (`activeOrder.ts`, `plannedFeed.ts`) используют
  ровно те имена/типы, что объявлены в их «Produces», без расхождений
  между задачами.
- `pnpm --filter master build`, `pnpm --filter client build`,
  `pnpm --filter api build` — все три зелёные на последнем коммите
  фазы.
- Полный e2e-прогон `apps/api` (`--runInBand`) зелёный (кроме известного
  environmental `queue.e2e-spec.ts`).
