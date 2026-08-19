# Экран спора со стороны мастера — дизайн

## Контекст

`apps/master` (Next.js, флоу мастера MasterQala.kz) не имеет никакой обработки споров — ни экрана, ни точки входа. Бэкенд (`apps/api/src/disputes`) уже поддерживает споры и используется в `apps/client` через `DisputeView.tsx` (проп `kind: 'orders' | 'planned-orders'`). Референс UI: `apps/MasterQala/design_handoff_masterqala/Этап 5 - Мастер (mobile).dc.html`, пункт 12 README ("Спор (сторона мастера)"): заявление клиента, одно поле пояснения + фото, возможные исходы.

## Область работы

**В скоуп:**
- Мастер видит список своих споров и заходит в конкретный спор.
- Мастер читает заявление клиента и его фото.
- Мастер один раз пишет пояснение (текст + фото) в ответ на спор, который открыл клиент.
- Мастер видит исход после разрешения оператором.

**Вне скоупа (сознательно):**
- Мастер сам открывает спор на клиента (бэкенд это позволяет — `POST /orders/:id/disputes` доступен обеим сторонам, — но это отдельная задача).
- Полноценная история заказов в apps/master.
- Realtime-уведомление о новом споре (нет ни одного dispute-события в проекте сейчас; см. "Точка входа" ниже).

## Установленные факты (из кода)

- `apps/master` не имеет экрана истории заказов вообще: как только заявка выходит из `ACTIVE_MASTER_STATUSES` (`ACCEPTED`, `MASTER_ON_WAY`, `INSPECTION`, `AWAITING_PRICE_CONFIRM`, `IN_PROGRESS`), она пропадает с дашборда мастера (`apps/master/app/(app)/page.tsx`, `fetchActiveOrder` → `GET /master/active-order` возвращает только активные). Спор же можно открыть в течение 48 часов **после** закрытия заказа — то есть сейчас у мастера физически нет пути попасть на такой заказ.
- `GET /orders/:id` и `GET /planned-orders/:id` уже возвращают `dispute` (см. `orders.service.ts:163`, `planned-orders.service.ts:124`) — переиспользуем как есть.
- `PATCH /disputes/:id` (`addCounterStatement`) уже существует и корректно гарантирует "только не открывавшая спор сторона, один раз, пока `status === 'OPEN'`" (`disputes.service.ts:186-192`), но сейчас не используется НИ ОДНИМ фронтендом в проекте, включая `apps/client`.
- `POST /disputes/:id/evidence` уже принимает файлы от любого участника спора, ограничение JPEG/PNG ≤10MB.
- Фото хранятся в таблице `DisputeEvidence` с `uploadedByUserId`, но нигде наружу не отдаются со связкой автора — `Dispute.evidenceDocIds` это плоский массив путей без авторства.
- Realtime-инфраструктуры для споров нет: ни одного `dispute:*` socket-события в кодовой базе.
- Нет ни одного эндпоинта "мои споры" — есть только admin-only `listAll` для оператора.

## Backend-изменения

Два новых read-эндпоинта в `apps/api/src/disputes`, по образцу существующих guard'ов (`guardParticipant`):

1. **`GET /disputes/mine`** — список споров текущего пользователя (мастер или клиент — эндпоинт симметричный, чтобы им впоследствии мог воспользоваться и apps/client). Запрос: `Dispute`, где `order.masterId = userId OR order.clientId = userId OR plannedOrder.masterId = userId OR plannedOrder.clientId = userId`. Ответ — массив: `{ id, orderId, plannedOrderId, status, reason, createdAt, resolvedAt }`, сортировка по `createdAt desc`.
2. **`GET /disputes/:id/evidence`** — список evidence с авторством. Guard как у существующих evidence-эндпоинтов (`guardParticipant`). Ответ: `{ id, uploadedByUserId, isMine, mimeType, scanStatus, createdAt }[]`, где `isMine = uploadedByUserId === currentUserId`. Скачивание конкретного файла — через уже существующий `GET /disputes/:id/evidence/:docPath`.

Никаких изменений в `PATCH /disputes/:id`, `POST /disputes/:id/evidence`, схеме Prisma, socket-слое — не требуется.

## Frontend — apps/master

### Точка входа

Пункт "Мои споры" в навигации (там же, где сейчас `lead-credits`/`wallet`/`become-master`), со счётчиком открытых споров. Счётчик = число элементов `GET /disputes/mine` со `status: 'OPEN'`, подгружается при монтировании layout — по тому же паттерну, что `masterApplication`/`masterPresence` (`apps/master/lib/*`). Без push/socket — мастер узнаёт о новом споре, когда в следующий раз открывает приложение или заходит в раздел.

### Список: `apps/master/app/(app)/disputes/page.tsx`

Плоский список, новые сверху: категория/тип заказа, обрезанный текст `reason`, статус-пилюля ("Открыт"/"Решён"), относительная дата создания. Клик по строке → деталь. Без фильтров/вкладок — при ожидаемом объёме не нужны. Пустое состояние — простой текст, без иконки (как в `wallet`).

### Деталь: `apps/master/app/(app)/disputes/[id]/page.tsx` + `apps/master/components/DisputeDetailView.tsx`

По структуре повторяет `apps/client/components/DisputeView.tsx`, но без сценария "открыть спор" — только ответ.

1. **Загрузка**: элемент из `/disputes/mine` даёт `orderId`/`plannedOrderId` → выбираем `kind`, дальше `GET /{orders|planned-orders}/:id` для контекста заказа (адрес, категория) + `dispute`. Параллельно `GET /disputes/:id/evidence` для списка фото.
2. **Карточка заявления клиента**: текст `dispute.reason` + миниатюры фото клиента (`isMine === false`), тап — просмотр через `/disputes/:id/evidence/:docPath`.
3. **Блок "Моё пояснение"**:
   - Если `dispute.counterStatement` уже есть — показываем как read-only текст, без формы редактирования.
   - Если нет — textarea (локальный черновик) + кнопка загрузки фото (аналогично клиентскому `DisputeView`: "+" в пунктирной рамке, `accept="image/jpeg,image/png"`) + кнопка "Отправить" → confirm-диалог ("Пояснение нельзя будет изменить после отправки", по образцу confirm при отмене заказа в `ActiveOrderView`) → `PATCH /disputes/:id`.
   - Загрузка фото (`isMine === true`) разрешена в любой момент, пока `dispute.status === 'OPEN'` — независимо от того, отправлено ли уже пояснение (бэкенд это не ограничивает).
4. **Блок исхода** (когда `dispute.status === 'RESOLVED'`): пилюля "Решён", `resolutionNote`. Поля `refundServiceFee`/`penalizeMaster` — показываем строкой только если значение не `null` (не домысливаем смысл `null`).

### Копирайт и стиль

`apps/master` не использует `react-i18next` (в отличие от `apps/client`) — все существующие строки захардкожены на русском (см. `ActiveOrderView.tsx`: "Еду", "На месте", "Отменить" и т.д.). Новый экран следует этому же паттерну — простые русские строки, без i18n-ключей.

Ошибки загрузки/скана фото — тем же паттерном, что везде в проекте: `text-sm text-danger`, без toast-системы (её нет).

## Тестирование

Готового e2e/Playwright-стенда под `apps/master` не найдено. Проверка — ручной прогон через дев-сервер (см. память `masterqala-local-dev-testing`: OTP в логах API) плюс проход preview-тулом после реализации.
