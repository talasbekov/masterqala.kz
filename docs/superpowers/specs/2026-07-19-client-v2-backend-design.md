# Client v2 — Backend Extensions (Cycle 1 of 2)

> Источник требований: `apps/MasterQala/design_handoff_masterqala/README.md` (дизайн-хендофф, палитра утверждена заказчиком 19.07.2026) + 3 hi-fi HTML-прототипа (клиент/мастер/оператор). Этот документ покрывает **только** секцию «Недостающие данные API», отфильтрованную до пунктов, нужных клиентскому флоу (см. «Вне скоупа»).
>
> Организация работы (решено с пользователем 2026-07-19): два последовательных цикла — **(1) бэкенд-расширения** (этот документ), **(2) клиент v2** (токены, ~30 экранов, карта, i18n-инфраструктура) — по прецеденту этапов 2-5 проекта. Остальные роли хендоффа (мастер mobile, оператор desktop) — отдельные будущие циклы, не в этом документе.
>
> Решения по открытым вопросам, где пользователь делегировал выбор («автоматически на все вопросы сам отвечай») — помечены **[РЕШЕНО]** с обоснованием.

## Цель

Замкнуть 8 пробелов данных, без которых клиентские экраны хендоффа (цикл 2) физически не смогут отрисовать реальные данные: фото к заявке, детали адреса, сохранённые адреса, характеристики мастера в ставке, бюджет/слот плановой заявки, живая геопозиция мастера с ETA, дедлайны таймеров в ответе API, и закрытие утечки точного адреса в офере.

## Вне скоупа

- Операторские `/admin/orders`, `/admin/users` (+block), `/admin/metrics`, `AuditLog`, ручной матчинг — пункт 9 хендоффа, роль «Оператор» — отдельный будущий цикл.
- Реальная интеграция Kaspi, SMS-шлюз, web-push — существующий бэклог, не связан с этим хендоффом.
- Экраны мастера (мастер-мобайл) — отдельный будущий цикл; в этом документе трогаем только то серверное поведение, которое видно клиенту (офер без адреса, релей геопозиции).

## 1. Фото заявок

**Схема:** новые модели `OrderPhoto` (`id, orderId, path, createdAt`, FK `onDelete: Cascade`) и `PlannedOrderPhoto` (аналогично, `plannedOrderId`).

**[РЕШЕНО] Момент загрузки:** в визарде фото выбираются на шаге 2, заявка создаётся только на шаге 4 — значит фото должны грузиться до существования заявки. Добавляю generic `POST /uploads` (JwtAuthGuard, тот же `FileStorage`/лимиты, что у документов мастера: JPEG/PNG, ≤10 МБ), возвращает `{ path }`. `CreateOrderDto`/`CreatePlannedOrderDto` принимают `photoPaths?: string[]` (`@ArrayMaxSize(5)`), при создании заявки транзакционно создаются строки `OrderPhoto`/`PlannedOrderPhoto` по переданным путям — путь не привязан к пользователю на этапе аплоада, поэтому валидировать нечего (тот же trust-model, что у существующего `LocalDiskStorage`, все файлы за authenticated-стеной).

**Чтение:** `ORDER_INCLUDE`/эквивалент для `PlannedOrder` расширяется `photos: true`. Стриминг файла — новый эндпоинт `GET /orders/:id/photos/:path` (и planned-эквивалент), guard идентичен `DisputesService.getEvidenceStream` (клиент/мастер этой заявки/OPERATOR).

## 2. Детали адреса

`Order` и `PlannedOrder` получают одинаковый набор nullable-колонок: `entrance String?`, `floor String?`, `apartment String?`, `addressComment String?`. `CreateOrderDto`/`CreatePlannedOrderDto` — те же поля опционально (`@IsOptional() @IsString() @MaxLength(...)`).

## 3. Сохранённые адреса

Новая модель `Address`:
```
id        String  @id @default(uuid())
userId    String
user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
label     String  // "Дом" / "Работа" / произвольное
address   String
entrance  String?
floor     String?
apartment String?
comment   String?
lat       Float?
lng       Float?
isDefault Boolean @default(false)
createdAt DateTime @default(now())
```
**[РЕШЕНО] lat/lng — `Float?`, не `geography`:** это витринные данные для автозаполнения формы, не участвуют в матчинге/PostGIS-запросах — geography(Point) был бы избыточен.

Эндпоинты (новый модуль `addresses`): `GET /addresses`, `POST /addresses`, `PATCH /addresses/:id`, `DELETE /addresses/:id` — guard по `userId === user.id`. `POST`/`PATCH` с `isDefault: true` атомарно снимает флаг с остальных адресов пользователя (аналог паттерна `updateMany` + гейт, уже используемого в `OrdersService`).

`User.defaultAddress` (существующая строка) — **не удаляется** в этом цикле (используется в `NewOrderPage` для префилла); станет производным от `Address{isDefault: true}` на стороне фронта в цикле 2, схему не трогаем.

## 4. Характеристики мастера в ставке

`MasterProfile.experienceYears` уже существует — пробрасывается в DTO ставки как есть. Новые вычисляемые поля в ответе бида (не колонки):
- `completedCount: number` — `count()` заказов (`Order` + `PlannedOrder`) со `status: 'CLOSED'` и `masterId` этого мастера.
- `verified: boolean` — `masterProfile.status === 'ACTIVE'` (у бидующего мастера иначе не может быть, но поле делает контракт явным для фронта, а не подразумеваемым).

**[РЕШЕНО] Без денормализации:** `completedCount` — живой `count()`-запрос при чтении ленты бидов, не кэш-колонка. Лента бидов — это N≤5 записей на заявку, объём заведомо мал; денормализация была бы преждевременной оптимизацией.

## 5. Бюджет и слот в плановой заявке

**[РЕШЕНО, риск ниже первоначальной оценки]** — перепроверил код: `scheduledAt` используется только в `dto.ts`, `planned-orders.service.ts`, `test/helpers.ts::createPlannedOrderViaApi` и `test/planned-orders-create.e2e-spec.ts` — один явный e2e-файл плюс центральный хелпер, не восемь файлов, как я предположил вначале. Меняю схему чисто:

- `PlannedOrder.scheduledAt` → `slotStart DateTime`, `slotEnd DateTime`.
- Новое поле `budget Int?` (₸, опционально — клиент может не указывать).
- `CreatePlannedOrderDto`: `scheduledAt` → `slotStart`/`slotEnd` (`@IsISO8601()` оба, плюс валидация `slotEnd > slotStart` в сервисе), `budget?: number`.
- Обновить `test/helpers.ts::createPlannedOrderViaApi` и `planned-orders-create.e2e-spec.ts` под новую форму.

## 6. Живая геопозиция мастера + ETA

`RealtimeGateway.geo:update` уже принимает координаты и пишет в `PresenceService.updateGeo`, но никуда дальше не транслирует. Добавляю в хендлер: после записи в presence, ищем активную заявку этого мастера —
- срочная: `status IN (ACCEPTED, MASTER_ON_WAY)`,
- плановая: `status = CONFIRMED` (мастер подтверждён, едет на визит).

Если найдена — эмит `master:location` в комнату `user:{clientId}` с `{ orderId, lat, lng, etaMinutes }`.

**[РЕШЕНО] Формула ETA:** по прецеденту `PricingService`/`PostgisRoutingService` (честная линейная аппроксимация, не реальный routing) — `etaMinutes = round(distanceKm × ROAD_FACTOR(1.3) / ASSUMED_SPEED_KMH × 60)`, новая конфиг-константа `ASSUMED_SPEED_KMH = 30` (городская езда) в `routing`-модуле. Реальный routing API — уже отложен в бэклоге проекта, не пересматриваю здесь.

## 7. Дедлайны таймеров в ответе API

Чисто вычисляемые поля, схему не трогают:
- `Order`: `priceDeadline` = `priceProposedAt + PRICE_CONFIRM_TIMEOUT_S` (когда `priceProposedAt` задан, иначе `null`).
- `PlannedOrder`: `confirmDeadline` = `selectedAt + PLANNED_CONFIRM_TIMEOUT_S` (когда `selectedAt` задан и статус ещё не `CONFIRMED`, иначе `null`).

Добавляются в `emitOrderStatus`/response-мэппинг обоих сервисов — единый источник правды вместо того, что сейчас фронт сам держит `+15 минут` захардкоженным.

## 8. 🔒 Офер без точного адреса (реальная находка, не косметика)

`matching.service.ts:85` сейчас шлёт `address: order.address` (точный адрес) **всем** мастерам волны, до принятия — то есть каждый, кто получил офер и не принял, всё равно увидел точный адрес клиента. Это утечка ПДн шире необходимого, независимо от хендоффа.

**Фикс:**
- `Order` получает `district String` (по прецеденту `PlannedOrder.district` — свободный текст, не геокодируется), обязательное поле в `CreateOrderDto`, собирается в визарде на шаге адреса рядом с полным адресом.
- `matching.service.ts`: `offer:new`-payload меняет `address` на `district`.
- Полный `order.address` остаётся видим мастеру только через `GET /orders/:id` **после** `accept()` — уже гарантировано существующим guard'ом в `OrdersService.getById` (мастер без `masterId` совпадения получает 403).

## Тестирование

TDD по установленному в проекте паттерну (RED→GREEN на каждую задачу плана). Новые e2e-файлы: `uploads.e2e-spec.ts`, `addresses.e2e-spec.ts`, `order-photos.e2e-spec.ts`. Обновляемые: `orders-create.e2e-spec.ts` (district обязателен — точечная проверка), `planned-orders-create.e2e-spec.ts` (slotStart/slotEnd/budget), `matching-waves.e2e-spec.ts` (offer payload — district вместо address). **Единая точка изменения для district** — `test/helpers.ts::createOrderViaApi` (все ~20 e2e-файлов урочного режима создают заказ через этот один хелпер, не напрямую; добавить `district: 'Есильский район'` туда — остальные файлы продолжат работать без правок). Аналогично `createPlannedOrderViaApi` для slotStart/slotEnd/budget. Новый unit: ETA-формула (по прецеденту `pricing.service.spec.ts`).

## Риски и последовательность

Порядок задач в плане должен уважать зависимости: (1) схема — одна миграция на все 8 пунктов сразу безопаснее восьми последовательных (меньше шансов на дрифт-конфликт, прецедент — инцидент с GIST-индексами в этапе 3, вызванный именно множественными миграциями подряд); (2) `uploads`-модуль и `Address`-модуль независимы, идут параллельно; (3) правки `matching.service.ts` (пункт 8) и `RealtimeGateway` (пункт 6) трогают один и тот же файл транзитивно (`OrdersService`) — сериализовать; (4) миграция `scheduledAt`→`slotStart/slotEnd` — последней среди схемных изменений, т.к. единственная truly breaking (не просто добавление колонки).

## Definition of Done

Все 8 пунктов реализованы и покрыты e2e/unit; `pnpm --filter api build` и `pnpm --filter api test`/`test:e2e` зелёные; whole-branch review (по прецеденту этапов 2-5) без Critical/Important находок; спека `docs/project-spec.md` синхронизирована там, где меняется бизнес-контракт (§3.3 — офер по district, §3.4/§6 — бюджет/слот плановой).
