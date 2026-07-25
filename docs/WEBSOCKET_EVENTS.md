# Socket.IO события MasterQala.kz

## 1. Подключение

Transport: Socket.IO.

JWT передаётся в handshake:

```ts
io(API_URL, {
  auth: { token: accessToken },
});
```

Сервер проверяет JWT до установления соединения. При успешной проверке сокет входит в персональную комнату:

```text
user:{userId}
```

Все серверные события отправляются через эту комнату. Невалидный или отсутствующий JWT приводит к `connect_error` с сообщением `Требуется вход`.

## 2. Коммерческий режим

Источник истины для событий конкретной заявки — сохранённое поле:

- `Order.commercialMode`;
- `PlannedOrder.commercialMode`.

Текущая переменная окружения не должна менять payload уже созданной заявки.

Для срочной заявки `order:status` нормализуется централизованно в `RealtimeGateway` перед отправкой клиенту и мастеру. Один и тот же объект payload кэшируется через `WeakMap`, поэтому две персональные отправки используют один запрос к БД.

## 3. Входящие события клиента

### `presence:online`

Мастер становится доступным для срочного матчинга.

Payload:

```ts
interface PresenceOnlinePayload {
  lat: number;
  lng: number;
}
```

Некорректные координаты игнорируются.

### `presence:offline`

Мастер вручную выходит из режима приёма заявок.

Payload отсутствует.

### `geo:update`

Обновляет текущую геопозицию мастера. Если мастер едет по активной срочной заявке, сервер рассчитывает ETA и отправляет клиенту `master:location`.

Payload:

```ts
interface GeoUpdatePayload {
  lat: number;
  lng: number;
}
```

## 4. Срочные заявки: серверные события

### `offer:new`

Персональное предложение мастеру принять срочную заявку.

```ts
interface UrgentOfferPayload {
  orderId: string;
  category: string;
  description: string;
  district: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string; // ISO 8601
  wave: number;
}
```

Правила:

- `FREE_PILOT`: `compensation = 0`, `freePilot = true`;
- `PAID_MOCK`: `compensation = calloutPrice - serviceFee`, `freePilot = false`;
- режим определяется по `Order.commercialMode`.

Адрес квартиры в публичный оффер не передаётся. Детали доступны назначенному мастеру после принятия заявки через защищённый HTTP endpoint.

### `offer:closed`

Закрывает ранее отправленный оффер.

```ts
interface OfferClosedPayload {
  orderId: string;
  reason: string;
}
```

Типовые причины:

- заявку принял другой мастер;
- время принятия истекло;
- клиент отменил заявку;
- поиск завершён.

### `order:status`

Событие изменения срочной заявки. Отправляется клиенту и назначенному мастеру.

```ts
interface OrderStatusPayload {
  orderId: string;
  status: string;
  wave: number;
  master: unknown | null;
  workPrice: number | null;
  workComment: string | null;
  cancelReason: string | null;
  calloutPrice: number;
  serviceFee: number;
  commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';
  freePilot: boolean;
  priceProposedAt: string | Date | null;
}
```

Нормализация:

| Режим заявки | `calloutPrice` | `serviceFee` | `freePilot` |
|---|---:|---:|---|
| `FREE_PILOT` | `0` | `0` | `true` |
| `PAID_MOCK` | фактическая сумма | фактическая сумма | `false` |

Номинальные суммы бесплатной заявки в Socket.IO payload не передаются. Они остаются в БД для внутренней аналитики.

Если сервер не смог определить режим заявки, исходный `order:status` не отправляется. Это безопаснее, чем передать ненормализованные финансовые поля.

### `master:location`

Передаёт клиенту движение назначенного мастера.

```ts
interface MasterLocationPayload {
  orderId: string;
  lat: number;
  lng: number;
  etaMinutes: number;
}
```

Событие формируется только для срочной заявки в статусе `ACCEPTED` или `MASTER_ON_WAY`.

## 5. Плановые заявки: серверные события

### `bid:new`

Клиент получил новый отклик.

```ts
interface BidNewPayload {
  plannedOrderId: string;
  bidsCount: number;
}
```

Событие не содержит финансовую операцию. Бесплатность отклика определяется по `PlannedOrder.commercialMode` на backend и по HTTP-данным заявки на frontend.

### `bid:selected`

Мастера выбрали исполнителем.

```ts
interface BidSelectedPayload {
  plannedOrderId: string;
}
```

### `bid:closed`

Отклик закрыт, обычно потому что выбран другой мастер.

```ts
interface BidClosedPayload {
  plannedOrderId: string;
  reason: string;
}
```

### `planned:status`

Изменение статуса плановой заявки. Отправляется клиенту и назначенному мастеру.

```ts
interface PlannedStatusPayload {
  plannedOrderId: string;
  status: string;
  workPrice: number | null;
  cancelReason: string | null;
  slotStart: string | Date;
  slotEnd: string | Date;
  master: unknown | null;
}
```

Событие используется как сигнал обновления. Полная карточка, включая `commercialMode`, перечитывается через защищённый HTTP endpoint.

## 6. Требования к frontend

- подписка создаётся один раз и снимается при unmount;
- после `order:status` и `planned:status` рекомендуется перечитать карточку через HTTP;
- `offer:new.freePilot`, а не текущая глобальная конфигурация, определяет текст оффера;
- плановый отклик определяется по `plannedOrder.commercialMode`;
- нельзя вычислять коммерческий режим по текущему env для уже созданной заявки;
- клиент не должен отображать номинальные поля бесплатного заказа как сумму к оплате.

## 7. Обратная совместимость

Добавленные поля `commercialMode`, `serviceFee` и `freePilot` являются расширением `order:status`. Клиенты должны игнорировать неизвестные поля.

При переходе с `FREE_PILOT` на `PAID_MOCK`:

- новые заявки получают новый режим;
- старые заявки продолжают отправлять payload своего сохранённого режима;
- переподключение Socket.IO не изменяет финансовую семантику активной заявки.

## 8. Проверки

Unit-тесты должны подтверждать:

- одинаковый нормализованный `order:status` для клиента и мастера;
- один запрос режима для двух отправок одного payload;
- нулевые суммы в `FREE_PILOT`;
- фактические суммы в `PAID_MOCK`;
- отсутствие DB-запроса для событий, не связанных с `order:status`;
- `offer:new.compensation = 0` для бесплатной заявки.
