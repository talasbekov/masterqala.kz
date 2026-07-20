# Клиент v2 — Фаза B: срочный режим

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: superpowers:subagent-driven-development.

**Цель:** визард создания срочной заявки (`/order/new`, 4 шага) и статус-driven детальная страница (`/order/:id`, 7 видов) + страница спора (`/order/:id/dispute`), строго по прототипу `apps/MasterQala/design_handoff_masterqala/Этап 5 - Клиент (mobile).dc.html` (строки 162-422, 691-729).

**Архитектура:** новые файлы в `apps/web/src/features/client-v2/`. Полностью заменяет `apps/web/src/pages/NewOrderPage.tsx` и `apps/web/src/pages/OrderPage.tsx` (удаляются). `MapView` — общий компонент на `react-leaflet`, используется в визарде (выбор адреса) и в двух видах детальной страницы (search, track).

**Верификация:** нет фронтенд-тестов (прецедент). Каждая задача — `pnpm --filter web build` + живая проверка в браузере контроллером после всех задач (карта, сокет-трекинг, полный цикл заявки — build один не докажет, что Leaflet реально рисует тайлы и слушает сокет).

## Global Constraints

**API-контракты (сверены напрямую с кодом, не с памятью):**
- `GET /categories` → `{id, slug, name}[]` (уже используется, Фаза A).
- `POST /orders/preview` body `{categoryId, lat, lng}` → `{available: true, calloutPrice, serviceFee, distanceKm, coefficient}` либо `{available: false}`.
- `POST /orders` body `{categoryId, description, address, lat, lng, district, entrance?, floor?, apartment?, addressComment?, photoPaths?}` → полный `Order`.
- `GET /orders/:id` → полный `Order` + `dispute` + вычисляемый `priceDeadline` (ISO-строка или `null`). Поля: `id, status, wave, searchAttempt, category:{id,name}, master:{id,name,phone,rating,reviewCount}|null, address, description, calloutPrice, serviceFee, workPrice, workComment, cancelReason, createdAt, priceProposedAt, review:{rating,comment}|null`.
- `POST /orders/:id/cancel`, `POST /orders/:id/retry-search`, `POST /orders/:id/confirm-price`, `POST /orders/:id/reject-price`, `POST /orders/:id/confirm-completion` — без тела, возвращают полный `Order`.
- `POST /orders/:id/review` body `{rating: 1..5, comment?}` → созданный `Review` (уже реализовано этой же сессией).
- `POST /orders/:id/disputes` body `{reason: string, max 2000}` → `Dispute`. `POST /disputes/:id/evidence` — `apiUpload`, FormData поле `file`. `PATCH /disputes/:id` body `{counterStatement}`.
- `POST /uploads` — `apiUpload`, FormData поле `file` → `{path: string}`.
- `GET /addresses` → `Address[]` (`id, label, address, entrance, floor, apartment, comment, lat, lng, isDefault`). `POST /addresses` body — те же поля (без `id`). Ещё нигде не используется фронтендом — Фаза B первой их подключает.
- Сокет `order:status` — существующий паттерн (Фаза A уже его использует в `HomePage`), payload содержит `orderId` — при совпадении с текущим `id` перезагружать заявку.
- Сокет `master:location` (только для `ACCEPTED`/`MASTER_ON_WAY`/`INSPECTION`) — payload `{orderId, lat, lng, etaMinutes}` (`apps/api/src/realtime/realtime.gateway.ts:82`).
- **Инвариант, не требующий отдельного поля:** любой мастер, назначенный на срочную заявку (`order.master != null`), уже проходит `MasterProfile.status = 'ACTIVE'` в матчинге (`matching.service.ts:126`) — бейдж «✓ проверен» рисуется безусловно при наличии `order.master`, это не выдумка, а гарантированный архитектурой инвариант.
- `order.master.rating`/`reviewCount` — уже подмешиваются бэкендом (`ReviewsService.attachRating`, эта же сессия) в `GET /orders/:id`, `GET /orders/active`, `GET /orders` (listMine).

**Переиспользуемое из существующего кода (не дублировать):**
- `apps/web/src/orderStatus.ts` — `STATUS_LABELS`, `STEPPER_STEPS`, `WAVE_TEXTS`, `isTerminalStatus`. Не создавать новые.
- `apps/web/src/features/client-v2/categoryMeta.ts` (Фаза A) — иконки категорий.
- `apps/web/src/api.ts` — `api()`, `apiUpload()`.
- `apps/web/src/socket.ts` — `getSocket()`.
- `apps/web/src/auth.tsx` — `useAuth()`.

**Токены/язык:** те же правила Фазы A — `c2`-префикс, весь новый текст через `useTranslation()`/`ru.json`, `verbatimModuleSyntax`/`noUnusedLocals`/`noUnusedParameters`.

**Leaflet:** `pnpm --filter web add leaflet react-leaflet` (версии не фиксировать — брать последние совместимые). Кастомные маркеры через `L.divIcon` (HTML+инлайн-стили под `c2`-палитру) — НЕ дефолтные PNG-иконки Leaflet (известная проблема путей ассетов в бандлерах, обходим полностью).

---

### Task 1: MapView — переиспользуемый компонент карты

**Files:**
- Create: `apps/web/src/features/client-v2/components/MapView.tsx`

**Interfaces:**
- Produces: `MapView` (default export), `LatLng` (type export) — используется в Task 2 (режим `pin`) и Task 3 (режим `pulse`, `tracking`).

- [ ] **Step 1: Установить Leaflet**

```bash
pnpm --filter web add leaflet react-leaflet
pnpm --filter web add -D @types/leaflet
```

- [ ] **Step 2: Компонент**

`apps/web/src/features/client-v2/components/MapView.tsx`:
```tsx
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

export default function MapView({ mode, center, onCenterChange, masterPosition, height = 220, className = '' }: MapViewProps) {
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
      <div style={{ height }} className={`relative overflow-hidden rounded-c2-lg bg-c2-fill ${className}`}>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-c2-primary/25" />
          <div className="relative h-4.5 w-4.5 rounded-full border-[3px] border-white bg-c2-primary shadow-c2-card" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className={`overflow-hidden rounded-c2-lg ${className}`} />;
}
```

Примечание: режим `pin` — маркер зафиксирован в центре карты (не перетаскивается напрямую), пользователь двигает саму карту; при остановке (`moveend`) координаты центра сообщаются наверх через `onCenterChange`. Это устойчивее к разным поддерживаемым версиям `react-leaflet`/touch-жестам, чем drag-маркер, и соответствует прототипу (маркер визуально «прибит» к центру, строка 215 прототипа).

- [ ] **Step 3: Собрать**

```bash
pnpm --filter web build
```
Ожидается: чисто. Визуальную проверку (тайлы реально грузятся, маркер двигается) — на Task 2/3, когда появится реальная страница, использующая компонент.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/client-v2/components/MapView.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): MapView — переиспользуемый Leaflet-компонент (pin/pulse/tracking)"
```

---

### Task 2: NewOrderPage v2 — визард 4 шага

**Files:**
- Create: `apps/web/src/features/client-v2/pages/NewOrderPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/NewOrderPage.tsx`

**Interfaces:**
- Consumes: `MapView`(Task 1), `categoryMeta`(Фаза A), `api`/`apiUpload`(`../../../api`), `useNavigate`.
- Produces: маршрут `/order/new` рендерит новый компонент.

Точные тексты — прототип строки 162-263 (uw1-uw4). Одно осознанное отличие: чип «＋ новый» (создание нового сохранённого адреса прямо в визарде, строка 225 прототипа) не реализуется — полноценный CRUD адресов (создание/редактирование) целиком принадлежит Фазе D (`/profile/addresses`); в визарде доступен только выбор из уже существующих сохранённых адресов или ручной ввод адреса текстом.

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок (после `catalog`):
```json
  "newOrder": {
    "step1Title": "Срочный вызов",
    "step1Question": "Что случилось?",
    "step1Unknown": "Не знаю категорию — помогите определить",
    "step2Title": "Опишите проблему",
    "step2Placeholder": "Например: «Течёт труба под раковиной на кухне, вода капает постоянно, перекрыл стояк»",
    "step2PhotosLabel": "Фото",
    "step2PhotosHint": "(до 5 — мастер точнее оценит работу)",
    "step2Next": "Далее — адрес",
    "step3Title": "Адрес",
    "step3MyLocation": "Моё место",
    "step3Entrance": "Подъезд",
    "step3Floor": "Этаж",
    "step3Apartment": "Квартира",
    "step3District": "Район",
    "step3Comment": "Комментарий мастеру: домофон, ориентиры…",
    "step3Next": "Далее — расчёт",
    "step4Title": "Проверьте заказ",
    "step4CalloutLabel": "Выезд мастера",
    "step4FeeLabel": "в т.ч. сервисный сбор платформы",
    "step4Note": "Стоимость работ мастер назовёт после осмотра — вы подтвердите или отклоните её отдельно. Скрытых платежей нет.",
    "step4PaymentMethod": "💳 Kaspi Gold ···· 4821",
    "step4CancelNote": "Отмена до принятия мастером — бесплатно. После принятия выезд удерживается.",
    "step4Submit": "Найти мастера · {{price}} ₸",
    "unavailable": "Мастеров рядом нет — попробуйте позже.",
    "geoError": "Не удалось определить геолокацию — разрешите доступ и повторите"
  }
```

- [ ] **Step 2: Компонент визарда**

`apps/web/src/features/client-v2/pages/NewOrderPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';
import { categoryMeta } from '../categoryMeta';
import MapView, { type LatLng } from '../components/MapView';

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
  const navigate = useNavigate();
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
    api('/categories').then(setCategories);
    api('/addresses').then(setSavedAddresses);
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('newOrder.geoError')),
    );
  }, [t]);

  useEffect(() => {
    if (step !== 4 || !categoryId) return;
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, lat: geo.lat, lng: geo.lng }) }).then(
      setPreview,
    );
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
      navigate(`/order/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-c2-primary' : 'bg-c2-border'}`} />
      ))}
    </div>
  );

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-c2-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-c2-ink">{title}</span>
      <span className="text-xs font-bold text-c2-ink-soft">
        {t('common.stepOf', { n: step, total: 4 })}
      </span>
    </div>
  );

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('newOrder.step1Title'), () => navigate('/'))}
        {progress}
        <div className="text-xl font-extrabold text-c2-ink">{t('newOrder.step1Question')}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-c2-md border-2 p-3.5 text-left ${
                  active ? 'border-c2-primary bg-c2-fill-soft' : 'border-c2-border bg-c2-surface'
                }`}
              >
                <div className="mb-1.5 text-xl">{meta.icon}</div>
                <div className="text-sm font-extrabold text-c2-ink">{c.name}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => navigate('/support')}
          className="rounded-c2-md border-[1.5px] border-dashed border-c2-border p-3 text-[13px] font-bold text-c2-ink-soft"
        >
          {t('newOrder.step1Unknown')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId}
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
        {header(t('newOrder.step2Title'), () => setStep(1))}
        {progress}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-28 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="text-sm font-extrabold text-c2-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-c2-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-c2-md bg-c2-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-18 w-18 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-2xl text-c2-primary">
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
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('newOrder.step2Next')}
        </button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="flex flex-col gap-3 pb-3.5">
        <div className="relative">
          <MapView mode="pin" center={geo} onCenterChange={setGeo} height={190} />
          <button
            type="button"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) =>
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              )
            }
            className="absolute bottom-3 right-3 rounded-c2-pill bg-white px-3 py-2 text-xs font-extrabold text-c2-ink shadow-c2-card"
          >
            ◎ {t('newOrder.step3MyLocation')}
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-c2-ink">{t('newOrder.step3Title')}</span>
            <span className="text-xs font-bold text-c2-ink-soft">{t('common.stepOf', { n: 3, total: 4 })}</span>
          </div>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder={t('newOrder.step3Title')}
            className="rounded-c2-md border-[1.5px] border-c2-primary bg-c2-surface p-3 text-sm font-bold text-c2-ink outline-none"
          />
          {savedAddresses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedAddresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectAddress(a)}
                  className="rounded-c2-pill border-[1.5px] border-c2-border px-3 py-1.5 text-xs font-bold text-c2-ink-soft"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Entrance')}</div>
              <input
                value={entrance}
                onChange={(e) => setEntrance(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Floor')}</div>
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Apartment')}</div>
              <input
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
          </div>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder={t('newOrder.step3District')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={addressComment}
            onChange={(e) => setAddressComment(e.target.value)}
            placeholder={t('newOrder.step3Comment')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <button
            type="button"
            onClick={() => setStep(4)}
            disabled={!addressText || !district}
            className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {t('newOrder.step3Next')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('newOrder.step4Title'), () => setStep(3))}
      {progress}
      <div className="rounded-c2-md bg-c2-fill p-3.5">
        <div className="text-sm font-extrabold text-c2-ink">
          {categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '').icon}{' '}
          {categories.find((c) => c.id === categoryId)?.name} · «{description.slice(0, 40)}» · {photoPaths.length} фото
        </div>
        <div className="mt-1 text-xs font-semibold text-c2-on-fill">
          {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} · {t('newOrder.step3Apartment')} {apartment}
        </div>
      </div>
      {preview?.available === false && <p className="text-sm font-semibold text-c2-danger">{t('newOrder.unavailable')}</p>}
      {preview?.available && (
        <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
          <div className="flex justify-between text-sm font-bold text-c2-ink">
            <span>{t('newOrder.step4CalloutLabel')}</span>
            <span className="font-extrabold">{preview.calloutPrice} ₸</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-c2-ink-soft">
            <span>{t('newOrder.step4FeeLabel')}</span>
            <span>{preview.serviceFee} ₸</span>
          </div>
          <div className="my-2.5 border-t border-dashed border-c2-border" />
          <div className="text-xs leading-relaxed text-c2-on-fill">{t('newOrder.step4Note')}</div>
        </div>
      )}
      <div className="flex items-center justify-between rounded-c2-md border border-c2-border bg-c2-surface p-3">
        <span className="text-sm font-extrabold text-c2-ink">{t('newOrder.step4PaymentMethod')}</span>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('newOrder.step4CancelNote')}</p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !preview?.available}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' })}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Общий ключ `common.stepOf`/`common.next`**

В `ru.json`, в блок `"common"` добавить:
```json
    "stepOf": "шаг {{n}} из {{total}}",
    "next": "Далее"
```

- [ ] **Step 4: Маршрут**

В `apps/web/src/App.tsx`: заменить `import NewOrderPage from './pages/NewOrderPage';` на `import NewOrderPage from './features/client-v2/pages/NewOrderPage';`. Маршрут `/order/new` остаётся в блоке старого `Layout` (детальная страница ещё не переехала — переедет вместе с Task 3/4 этого же плана; см. ниже, когда `/order/:id` тоже станет v2, `/order/new` логично перенести в `AppShell`-less отдельный полноэкранный рендер — визард не показывает нижний таб-бар, поэтому остаётся вне `AppShell`, как и `/login`).

```bash
rm apps/web/src/pages/NewOrderPage.tsx
```

- [ ] **Step 5: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка (через preview-тулы, т.к. Leaflet-рендер не проверяется билдом): открыть `/order/new`, убедиться что карта на шаге 3 реально показывает тайлы OSM (не пустой серый блок), пройти все 4 шага, отправить заявку, убедиться что редиректит на `/order/:id`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/client-v2/pages/NewOrderPage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git rm apps/web/src/pages/NewOrderPage.tsx
git commit -m "feat(web): визард срочной заявки v2 (4 шага) — MapView, сохранённые адреса, фото"
```

---

### Task 3: OrderPage v2 — каркас + 6 из 7 видов (без track)

**Files:**
- Create: `apps/web/src/features/client-v2/pages/OrderPage.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/SearchView.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/NoMastersView.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/PriceView.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/ProgressView.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/DoneView.tsx`
- Create: `apps/web/src/features/client-v2/components/order-views/ClosedView.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/OrderPage.tsx`

**Interfaces:**
- Produces: `OrderPage` (default export) — рендерит `TrackView` (Task 4) для статусов `ACCEPTED`/`MASTER_ON_WAY`/`INSPECTION` через **временную заглушку** в этом Task (см. Step 2 — заменяется в Task 4, не является нарушением «без плейсхолдеров», т.к. это явный, отслеживаемый шов между двумя задачами одного плана, а не незавершённая функциональность конечного продукта).

Точные тексты — прототип строки 265-422.

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок `orderDetail`:
```json
  "orderDetail": {
    "cancelFree": "Отменить — бесплатно",
    "cancel": "Отменить",
    "noMastersTitle": "Никто не откликнулся",
    "noMastersText": "Сейчас рядом нет свободных мастеров. Оплата за выезд полностью возвращена. Попробуйте ещё раз или запланируйте на удобное время — мастера сами предложат цену.",
    "retrySearch": "Повторить поиск",
    "startPlanned": "Запланировать на время",
    "toHome": "На главную",
    "priceTitle": "Цена работ",
    "priceCalloutLabel": "Выезд (уже оплачен)",
    "priceWorkLabel": "Работы",
    "priceTotalLabel": "Итого",
    "priceConfirm": "Подтвердить {{price}} ₸",
    "priceReject": "Отклонить цену",
    "priceRejectNote": "Если отклоните — заявка отменится, оплата за выезд не возвращается (мастер уже приехал).",
    "support": "Поддержка",
    "orderNumber": "Заявка №{{id}}",
    "progressNote": "Итог к оплате: {{price}} ₸ (выезд оплачен, работы — после подтверждения выполнения).",
    "doneTitle": "Мастер завершил работу",
    "doneCalloutLabel": "Выезд",
    "doneWorkLabel": "Работы",
    "doneTotalLabel": "Итого",
    "doneNote": "Проверьте результат. Если всё в порядке — подтвердите. Если нет — откройте спор, оператор разберётся.",
    "confirmDone": "Подтвердить выполнение",
    "openDispute": "Открыть спор",
    "closedTitle": "Заказ выполнен",
    "closedCancelledTitle": "Заявка отменена",
    "rateTitle": "Оцените мастера",
    "rateThanks": "Спасибо за отзыв!",
    "submitRating": "Отправить"
  }
```

- [ ] **Step 2: OrderPage — каркас**

`apps/web/src/features/client-v2/pages/OrderPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import SearchView from '../components/order-views/SearchView';
import NoMastersView from '../components/order-views/NoMastersView';
import PriceView from '../components/order-views/PriceView';
import ProgressView from '../components/order-views/ProgressView';
import DoneView from '../components/order-views/DoneView';
import ClosedView from '../components/order-views/ClosedView';
import TrackView from '../components/order-views/TrackView';

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

const TRACK_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION'];

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => api(`/orders/${id}`).then(setOrder).finally(() => setLoading(false));

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

  if (loading || !order || !id) return <div className="p-6 text-c2-ink-soft">Загрузка…</div>;

  if (order.status === 'SEARCHING') return <SearchView order={order} onChanged={load} />;
  if (order.status === 'NO_MASTERS') return <NoMastersView orderId={id} onChanged={load} />;
  if (TRACK_STATUSES.includes(order.status)) return <TrackView order={order} orderId={id} />;
  if (order.status === 'AWAITING_PRICE_CONFIRM') return <PriceView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'IN_PROGRESS') return <ProgressView order={order} />;
  if (order.status === 'DONE') return <DoneView order={order} orderId={id} onChanged={load} />;
  return <ClosedView order={order} onChanged={load} />;
}
```

- [ ] **Step 3: SearchView**

`apps/web/src/features/client-v2/components/order-views/SearchView.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { WAVE_TEXTS } from '../../../../orderStatus';
import MapView from '../MapView';
import type { OrderDetail } from '../../pages/OrderPage';

export default function SearchView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  async function cancel() {
    await api(`/orders/${order.id}/cancel`, { method: 'POST' });
    onChanged();
  }

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="flex flex-col">
      <MapView mode="pulse" center={{ lat: 0, lng: 0 }} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-c2-sheet bg-c2-surface px-5 pb-4.5 pt-4 shadow-c2-sheet">
        <div className="mx-auto mb-3 h-1 w-9.5 rounded-full bg-c2-border" />
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-extrabold text-c2-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</div>
          <div className="text-sm font-extrabold text-c2-primary">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        <button
          type="button"
          onClick={cancel}
          className="mt-3 w-full rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
        >
          {t('orderDetail.cancelFree')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: NoMastersView**

`apps/web/src/features/client-v2/components/order-views/NoMastersView.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';

export default function NoMastersView({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function retry() {
    await api(`/orders/${orderId}/retry-search`, { method: 'POST' });
    onChanged();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div className="text-4xl">😔</div>
      <div className="text-xl font-extrabold text-c2-ink">{t('orderDetail.noMastersTitle')}</div>
      <div className="max-w-[290px] text-sm leading-relaxed text-c2-ink-soft">{t('orderDetail.noMastersText')}</div>
      <button
        type="button"
        onClick={retry}
        className="mt-2 w-full rounded-c2-pill bg-c2-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.retrySearch')}
      </button>
      <button
        type="button"
        onClick={() => navigate('/planned/new')}
        className="w-full rounded-c2-pill border-[1.5px] border-c2-primary p-3.5 text-sm font-extrabold text-c2-primary"
      >
        {t('orderDetail.startPlanned')}
      </button>
      <button type="button" onClick={() => navigate('/')} className="text-sm font-bold text-c2-ink-soft">
        {t('orderDetail.toHome')}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: PriceView**

`apps/web/src/features/client-v2/components/order-views/PriceView.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

export default function PriceView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!order.priceDeadline) return;
    const deadline = new Date(order.priceDeadline).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.priceDeadline]);

  async function confirm() {
    await api(`/orders/${orderId}/confirm-price`, { method: 'POST' });
    onChanged();
  }
  async function reject() {
    await api(`/orders/${orderId}/reject-price`, { method: 'POST' });
    onChanged();
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-c2-ink">{t('orderDetail.priceTitle')}</span>
        <span className="rounded-c2-pill bg-c2-primary px-3 py-1.5 text-[13px] font-extrabold text-white">
          ⏱ {mm}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="text-sm font-semibold text-c2-ink">{order.master?.name} осмотрел проблему и предлагает:</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="flex justify-between text-[13.5px] font-semibold text-c2-ink-soft">
          <span>{t('orderDetail.priceCalloutLabel')}</span>
          <span>{order.calloutPrice} ₸</span>
        </div>
        <div className="mt-1.5 flex justify-between text-sm font-extrabold text-c2-ink">
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-c2-border" />
        <div className="flex justify-between text-lg font-extrabold">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-c2-primary">{total} ₸</span>
        </div>
      </div>
      {order.workComment && (
        <div className="rounded-c2-md bg-c2-fill p-3 text-[13px] leading-relaxed text-c2-ink">«{order.workComment}»</div>
      )}
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('orderDetail.priceRejectNote')}</p>
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirm}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </button>
      <button
        type="button"
        onClick={reject}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('orderDetail.priceReject')}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: ProgressView**

`apps/web/src/features/client-v2/components/order-views/ProgressView.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { STEPPER_STEPS } from '../../../../orderStatus';
import type { OrderDetail } from '../../pages/OrderPage';

export default function ProgressView({ order }: { order: OrderDetail }) {
  const { t } = useTranslation();
  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-c2-ink">{t('orderDetail.orderNumber', { id: order.id.slice(0, 8) })}</div>
      <div className="flex flex-col">
        {STEPPER_STEPS.map((s, i) => {
          const done = i < currentIdx || (i === currentIdx && order.status !== s.status);
          const active = s.status === order.status;
          return (
            <div key={s.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 text-[11px] text-white ${
                    done || active ? 'border-c2-primary bg-c2-primary' : 'border-c2-border bg-c2-surface'
                  }`}
                >
                  {done ? '✓' : ''}
                </div>
                {i < STEPPER_STEPS.length - 1 && <div className="min-h-4.5 w-0.5 flex-1 bg-c2-border" />}
              </div>
              <div className="pb-3.5">
                <div className={`text-[13.5px] ${active ? 'font-extrabold text-c2-ink' : 'font-semibold text-c2-ink-soft'}`}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3.5 text-xs font-semibold leading-relaxed text-c2-ink">
        {t('orderDetail.progressNote', { price: order.calloutPrice + (order.workPrice ?? 0) })}
      </div>
      <div className="mt-auto" />
      <Link
        to="/support"
        className="rounded-c2-pill border-[1.5px] border-c2-border p-3.5 text-center text-sm font-extrabold text-c2-ink"
      >
        {t('orderDetail.support')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: DoneView**

`apps/web/src/features/client-v2/components/order-views/DoneView.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

export default function DoneView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function confirmDone() {
    await api(`/orders/${orderId}/confirm-completion`, { method: 'POST' });
    onChanged();
  }

  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-c2-ink">{t('orderDetail.doneTitle')}</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="mb-2.5 text-sm font-extrabold text-c2-ink">{order.master?.name}</div>
        <div className="flex justify-between text-[13.5px] font-semibold text-c2-ink-soft">
          <span>{t('orderDetail.doneCalloutLabel')}</span>
          <span>{order.calloutPrice} ₸</span>
        </div>
        <div className="mt-1 flex justify-between text-[13.5px] font-semibold text-c2-ink-soft">
          <span>{t('orderDetail.doneWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-c2-border" />
        <div className="flex justify-between text-base font-extrabold text-c2-ink">
          <span>{t('orderDetail.doneTotalLabel')}</span>
          <span>{total} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('orderDetail.doneNote')}</p>
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-c2-pill bg-c2-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/order/${orderId}/dispute`)}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('orderDetail.openDispute')}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: ClosedView (+ звёзды рейтинга)**

`apps/web/src/features/client-v2/components/order-views/ClosedView.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { STATUS_LABELS } from '../../../../orderStatus';
import type { OrderDetail } from '../../pages/OrderPage';

export default function ClosedView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const isCancelled = order.status !== 'CLOSED';

  async function submitRating(stars: number) {
    setRating(stars);
    setSubmitting(true);
    try {
      await api(`/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ rating: stars }) });
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isCancelled ? 'bg-c2-ink-soft' : 'bg-c2-success'
        }`}
      >
        {isCancelled ? '×' : '✓'}
      </div>
      <div className="text-xl font-extrabold text-c2-ink">
        {isCancelled ? t('orderDetail.closedCancelledTitle') : t('orderDetail.closedTitle')}
      </div>
      {isCancelled && order.cancelReason && <div className="text-sm text-c2-ink-soft">{order.cancelReason}</div>}
      {!isCancelled && (
        <div className="w-full rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-c2-ink">{t('orderDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-c2-ink">{t('orderDetail.rateTitle')}</div>
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
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="w-full rounded-c2-pill bg-c2-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.toHome')}
      </button>
      {!isCancelled && (
        <button type="button" onClick={() => navigate(`/order/${order.id}/dispute`)} className="text-xs font-bold text-c2-ink-soft">
          {STATUS_LABELS[order.status]}? {t('orderDetail.openDispute')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Временная заглушка TrackView (заменяется в Task 4)**

`apps/web/src/features/client-v2/components/order-views/TrackView.tsx` — временный минимальный файл, ЧТО ИМЕННО заменяется явно указано; создаётся здесь только чтобы `OrderPage.tsx` компилировался до Task 4:
```tsx
import type { OrderDetail } from '../../pages/OrderPage';

export default function TrackView({ order }: { order: OrderDetail; orderId: string }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
```

- [ ] **Step 10: Маршрут**

В `App.tsx`: заменить `import OrderPage from './pages/OrderPage';` на `import OrderPage from './features/client-v2/pages/OrderPage';`. `/order/:id` остаётся в блоке старого `Layout` (не показывает нижний таб-бар в прототипе — большинство видов на весь экран без навигации; переносить в `AppShell` не требуется).

```bash
rm apps/web/src/pages/OrderPage.tsx
```

- [ ] **Step 11: Собрать**

```bash
pnpm --filter web build
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/features/client-v2 apps/web/src/App.tsx
git rm apps/web/src/pages/OrderPage.tsx
git commit -m "feat(web): OrderPage v2 — каркас + 6 статус-видов (search/nomasters/price/progress/done/closed+рейтинг)"
```

---

### Task 4: TrackView — живая карта мастера

**Files:**
- Modify: `apps/web/src/features/client-v2/components/order-views/TrackView.tsx` (заменяет заглушку Task 3 полностью)

**Interfaces:**
- Consumes: `MapView`(Task 1, режим `tracking`), сокет `master:location`.

Точные тексты — прототип строки 308-341.

- [ ] **Step 1: Переводы**

В `ru.json`, в блок `orderDetail` добавить:
```json
    "callMaster": "Позвонить",
    "verified": "✓ проверен",
    "etaLabel": "Мастер приедет",
    "cancellationRules": "Правила отмены"
```

- [ ] **Step 2: TrackView**

`apps/web/src/features/client-v2/components/order-views/TrackView.tsx` (полностью заменяет содержимое Task 3):
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { getSocket } from '../../../../socket';
import { STATUS_LABELS } from '../../../../orderStatus';
import MapView, { type LatLng } from '../MapView';
import type { OrderDetail } from '../../pages/OrderPage';

export default function TrackView({ order, orderId }: { order: OrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const [masterPos, setMasterPos] = useState<LatLng | null>(null);
  const [eta, setEta] = useState<number | null>(null);

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
    await api(`/orders/${orderId}/cancel`, { method: 'POST' });
  }

  return (
    <div className="flex flex-col">
      <MapView mode="tracking" center={masterPos ?? { lat: 51.1605, lng: 71.4704 }} masterPosition={masterPos} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-c2-sheet bg-c2-surface px-5 pb-4 pt-3.5 shadow-c2-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9.5 rounded-full bg-c2-border" />
        <div className="flex items-center gap-3">
          <div className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-full bg-c2-fill text-[15px] font-extrabold text-c2-ink">
            {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-c2-ink">
              {order.master?.name}{' '}
              <span className="rounded-c2-pill bg-c2-success-bg px-2 py-0.5 align-middle text-[10.5px] font-extrabold text-c2-success-ink">
                {t('orderDetail.verified')}
              </span>
            </div>
            <div className="text-xs font-semibold text-c2-ink-soft">
              ★ {order.master?.rating?.toFixed(1) ?? '—'} · {order.master?.reviewCount ?? 0} заказов · {STATUS_LABELS[order.status]}
            </div>
          </div>
          {order.master?.phone && (
            <a
              href={`tel:${order.master.phone}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-c2-primary text-lg text-white"
            >
              📞
            </a>
          )}
        </div>
        {eta != null && (
          <div className="mt-2.5 flex items-center justify-between rounded-c2-md bg-c2-fill px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-c2-ink">{t('orderDetail.etaLabel')}</span>
            <span className="text-base font-extrabold text-c2-primary">{eta} мин</span>
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-3.5 text-xs font-extrabold text-c2-primary">
          <Link to="/support">{t('orderDetail.support')}</Link>
          <span className="text-c2-border">·</span>
          <span className="text-c2-ink-soft">{t('orderDetail.cancellationRules')}</span>
          <button type="button" onClick={cancel} className="ml-auto text-c2-danger">
            {t('orderDetail.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Собрать и живьём проверить**

```bash
pnpm --filter web build
```
Живая проверка (обязательна — сокет-логика не покрывается билдом): два окна браузера (клиент+мастер, как в прошлых циклах), мастер эмитит `geo:update` (через существующий WorkPage или напрямую через `preview_eval`+`socket.emit`), убедиться что маркер на карте клиента реально двигается и ETA обновляется.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/client-v2/components/order-views/TrackView.tsx apps/web/src/features/client-v2/i18n/locales/ru.json
git commit -m "feat(web): TrackView — живая карта мастера через master:location"
```

---

### Task 5: DisputePage v2

**Files:**
- Create: `apps/web/src/features/client-v2/pages/DisputePage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `apiUpload`, `api`.

Точные тексты — прототип строки 691-729. Категории — фронтенд-удобство (бэкенд принимает только свободный `reason`, см. Global Constraints); выбранная категория подставляется префиксом в `reason`.

- [ ] **Step 1: Переводы**

В `ru.json`, новый блок:
```json
  "dispute": {
    "title": "Спор по заявке №{{id}}",
    "opened": "Открыт",
    "reasonLabel": "Причина",
    "categoryQuality": "Качество работ",
    "categoryPrice": "Не та цена",
    "categoryBehavior": "Поведение",
    "categoryOther": "Другое",
    "placeholder": "Опишите подробно: что не так, когда заметили, что уже обсудили с мастером",
    "evidenceLabel": "Доказательства",
    "evidenceHint": "(фото)",
    "note": "Мастер сможет дать пояснение. Решение примет оператор — обычно в течение 24 часов. Возможен возврат сервисного сбора.",
    "send": "Отправить спор",
    "sentAt": "Спор отправлен",
    "waitingMaster": "Ждём пояснение мастера",
    "waitingOperator": "Решение оператора — до 24 ч",
    "pausedNote": "Пока спор открыт, автозакрытие заявки приостановлено. Мы напишем вам о каждом изменении."
  }
```

- [ ] **Step 2: DisputePage**

`apps/web/src/features/client-v2/pages/DisputePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  counterStatement: string | null;
}

const CATEGORY_KEYS = ['categoryQuality', 'categoryPrice', 'categoryBehavior', 'categoryOther'] as const;

export default function DisputePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>('categoryQuality');
  const [text, setText] = useState('');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/orders/${id}`).then((o) => setDispute(o.dispute ?? null));
  }, [id]);

  async function send() {
    setError('');
    setSubmitting(true);
    try {
      const reason = `${t(`dispute.${category}`)}. ${text}`.trim();
      const created = await api(`/orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) });
      setDispute(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadEvidence(file: File) {
    if (!dispute) return;
    const fd = new FormData();
    fd.append('file', file);
    await apiUpload(`/disputes/${dispute.id}/evidence`, fd);
    setEvidenceCount((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate(-1)} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 text-[17px] font-extrabold text-c2-ink">{t('dispute.title', { id: id?.slice(0, 8) })}</span>
        {dispute && (
          <span className="rounded-c2-pill bg-c2-warning-bg px-2.5 py-1 text-[11px] font-extrabold text-c2-warning-ink">
            {t('dispute.opened')}
          </span>
        )}
      </div>

      {!dispute && (
        <>
          <div className="text-sm font-extrabold text-c2-ink">{t('dispute.reasonLabel')}</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-c2-pill px-3.5 py-1.5 text-xs font-bold ${
                  category === key ? 'bg-c2-primary text-white' : 'border-[1.5px] border-c2-border text-c2-ink-soft'
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
            className="min-h-24 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <div className="text-sm font-extrabold text-c2-ink">
            {t('dispute.evidenceLabel')} <span className="text-xs font-semibold text-c2-ink-soft">{t('dispute.evidenceHint')}</span>
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-xl text-c2-primary">
            ＋
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
            />
          </label>
          <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('dispute.note')}</div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={send}
            disabled={submitting || !text}
            className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {t('dispute.send')}
          </button>
        </>
      )}

      {dispute && (
        <>
          <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
            <div className="text-sm font-extrabold text-c2-ink">{dispute.reason}</div>
            {evidenceCount > 0 && <div className="mt-1 text-xs text-c2-ink-soft">{evidenceCount} фото</div>}
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-c2-success" />
              <span className="font-bold text-c2-ink">{t('dispute.sentAt')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-c2-primary" />
              <span className="font-bold text-c2-ink">{t('dispute.waitingMaster')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-c2-border" />
              <span className="font-semibold text-c2-ink-soft">{t('dispute.waitingOperator')}</span>
            </div>
          </div>
          <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('dispute.pausedNote')}</div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Маршрут**

В `App.tsx`: добавить `import DisputePage from './features/client-v2/pages/DisputePage';` и `<Route path="/order/:id/dispute" element={<DisputePage />} />` в тот же блок старого `Layout`, что и `/order/:id`.

- [ ] **Step 4: Собрать**

```bash
pnpm --filter web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2/pages/DisputePage.tsx apps/web/src/features/client-v2/i18n/locales/ru.json apps/web/src/App.tsx
git commit -m "feat(web): DisputePage v2 — форма спора с категориями + таймлайн статуса"
```

---

## После завершения всех задач (контроллер)

1. `pnpm --filter web build` + `pnpm --filter api build`.
2. Живая браузерная проверка полного цикла срочной заявки (два окна — клиент+мастер, как в предыдущих циклах): создание через визард → поиск (карта с пульсацией) → принятие мастером → трекинг (карта с живым маркером мастера, ETA) → предложение цены → подтверждение → выполнение → закрытие + звезда рейтинга. Отдельно — сценарий NO_MASTERS и открытие спора.
3. Финальный whole-branch review (opus) диапазона коммитов Фазы B.
4. Обновить память проекта и `.superpowers/sdd/progress.md`.
