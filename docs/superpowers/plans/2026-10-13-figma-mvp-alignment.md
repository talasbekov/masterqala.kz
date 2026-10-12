# MasterQala Figma MVP Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution in the current session; no subagent delegation requested.

**Goal:** Реальный полный цикл заказа по текущей Figma с прямым расчётом и ru/kk/en.

**Architecture:** Сохраняем приложения и backend. Рекомендуется additive migration и lifecycle v2 для новых заказов, legacy v1 не переоцениваем. Независимое исправление CI уже проверено; продуктовая реализация ожидает ревью spec и решения о цене выезда в смете.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 16/PostGIS, pg-boss 10, Socket.IO 4; Next.js 15/React 19; Vite 8; Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-13-figma-mvp-alignment-design.md`.

Статус: проект плана, не утверждённая архитектура. Не считать будущие задачи выполненными.

## Global Constraints

- Новый dispatch — один мастер, 30 секунд. Отмена — 0 ₸ до departedAt / 2500 ₸ после.
- Оплата напрямую мастеру. CLOSED не означает paid. Комиссию не внедрять.
- Не изменять оригиналы Figma, не сливать main и не публиковать production.
- Код языка kk; KZ — отображаемая подпись. Суммы KZT без конвертации.
- Существующие финансовые записи не удалять; mode/version фиксируются при создании заказа.
- Новые экраны реализовывать только после получения design context и screenshot конкретных ID.

## Review Focus

1. Два заказа для одного мастера: транзакционная защита занятости, не только gate одного заказа.
2. Таймаут/redelivery старого оффера и рестарт: ни двойного назначения, ни двух актуальных офферов.
3. Отмена одновременно с выездом: нельзя подтвердить 0 ₸ и получить 2500 ₸ незаметно.
4. Устаревшая смета и повтор согласия/приёмки: конфликт новой версии, идемпотентность той же версии.
5. Последний администратор и параллельное отключение: хотя бы один активный ADMIN остаётся.

---

### Task 0: Рабочие исходные проверки

**Files:** `.github/workflows/ci.yml`; `docs/audits/2026-10-13-figma-repository-baseline.md`.

**Interfaces:** Produces воспроизводимый baseline и исправленную команду unit CI.

- [x] Воспроизвести `pnpm --filter api test -- --runInBand`: Jest No tests found.
- [x] Заменить на `pnpm --filter api test --runInBand`.
- [x] Проверить исправленную команду: 36 suites / 165 tests PASS.
- [x] Проверить API/UI/mobile build и client/master/operator typecheck.
- [ ] Проверить e2e/очередь на доступной тестовой PostGIS.

### Task 1: Новый контракт заказа с совместимой миграцией

**Files:** `apps/api/prisma/schema.prisma`, новый migration.sql, `apps/api/src/commercial-mode/*`, `apps/api/src/orders/order.constants.ts`, `apps/api/src/orders/dto.ts`, `apps/api/test/direct-order-contract.e2e-spec.ts`.

**Interfaces:** Produces DIRECT_PAYMENT, lifecycleVersion, PRICE_APPROVED, departedAt, cancellationAmount, quoteVersion/consentedVersion и раздельные строки сметы.

- [ ] После ревью spec написать e2e: новый заказ DIRECT_PAYMENT/v2, старый заказ v1 неизменён; payment/accrual не создаются для v2.
- [ ] Выполнить тесты до реализации и подтвердить ошибки новых ожидаемых полей/контракта.
- [ ] Добавить enum/nullable поля и additive migration. Existing rows остаются v1. New v2 выставляется сервисом явно.
- [ ] Обновить active status predicates в SQL/Prisma/клиентах; PRICE_APPROVED и DONE мастера активны до приёмки.
- [ ] Проверить Prisma generate, миграции с реальными legacy fixtures и API build; legacy commercial-mode e2e PASS.
- [ ] Commit: `feat: add versioned direct-payment order contract`.

### Task 2: Последовательные офферы с серверным deadline

**Files:** `apps/api/src/orders/matching.service.ts`, `orders.service.ts`, `order.constants.ts`, `apps/api/src/queue/queue.constants.ts`, `apps/api/test/sequential-dispatch.e2e-spec.ts`.

**Interfaces:** Consumes Task 1. Produces последовательный dispatch по сохранённому mode, expiresAt и timeout job с orderId/attempt/offerId.

- [ ] Red tests: два подходящих мастера → оффер только ближайшему; 30 секунд → следующий; старый timeout/redelivery no-op; просроченный accept 409; два заказа один мастер → только одно назначение.
- [ ] Реализовать блокировки заказа и masterUserId; выдавать один оффер с persisted deadline; после commit отправлять socket/queue.
- [ ] При рестарте восстанавливать актуальный job; исключать cancelled/accepted мастера этой попытки.
- [ ] На исчерпании кандидатов NO_MASTERS; legacy WAVE ветку сохранить.
- [ ] Выполнить новые e2e плюс `matching-waves`, `orders-accept`, `blocked-user-realtime`, `realtime-orders`.
- [ ] Commit: `feat: dispatch urgent orders sequentially with durable deadlines`.

### Task 3: Смета, согласование, старт и приёмка

**Files:** `apps/api/src/orders/orders.service.ts`, `orders.controller.ts`, `dto.ts`, `apps/api/test/direct-order-lifecycle.e2e-spec.ts`.

**Interfaces:** POST propose-price принимает breakdown; confirm-price ожидаемую quoteVersion; start-work доступен назначенному мастеру; confirm-completion явный/idempotent.

- [ ] Red tests: approve → PRICE_APPROVED; complete до start 409; start чужим 403; устаревшая quoteVersion 409; изменение сметы сбрасывает consent; повтор согласия/приёмки той же версии возвращает текущий заказ.
- [ ] Добавить вычисление total на сервере, optimistic checks и отдельный start-work.
- [ ] Не запускать AUTO_CLOSE и auto-price transition для v2; старые queued jobs v2 no-op.
- [ ] Выполнить direct lifecycle, legacy orders-price-flow/orders-complete и reviews e2e.
- [ ] Commit: `feat: require current quote consent and explicit work acceptance`.

### Task 4: Фактический выезд и подтверждаемая отмена

**Files:** `apps/api/src/orders/orders.service.ts`, `orders.controller.ts`, `dto.ts`, `apps/api/test/direct-order-cancellation.e2e-spec.ts`, операторское представление заказа.

**Interfaces:** on-way фиксирует departedAt; cancellation preview возвращает текущую сумму и token/version; cancel проверяет подтверждённые ожидания атомарно.

- [ ] Red tests: ACCEPTED без departedAt → 0; MASTER_ON_WAY/INSPECTION/PRICE_APPROVED с departedAt →2500; работа/материалы не начисляются; нет payment/accrual; повтор отмены идемпотентен.
- [ ] Red race test: preview=0, конкурентный on-way → cancel с устаревшим ожиданием 409, заказ не отменён.
- [ ] Реализовать транзакцию отмены до начала работ; закрыть pending offers; показать сумму/причину оператору без paid.
- [ ] Проверить direct/legacy cancellation и price rejection e2e.
- [ ] Commit: `feat: calculate direct cancellation from actual departure`.

### Task 5: UI-основа и словари

**Files:** `packages/ui/src/tokens.css`, UI components/fonts; locale resources и providers приложений.

**Interfaces:** Совместимые tokens/components и `ru/kk/en`, locale persistence/Intl formatting.

- [ ] Получить актуальные design context контролов 218:1351/218:1365 и mobile counterparts, переменные и screenshot.
- [ ] Добавить Inter локально и целевые токены; мигрировать приложения последовательными проверяемыми частями.
- [ ] Сделать общий словарь с templates/plurals, выбранный язык local/profile, lang до отображения; без перевода пользовательского контента.
- [ ] Проверить кнопки 44px+, focus/disabled/loading, суммы/date ru/kk/en и отсутствие сырых ключей.
- [ ] UI build и typecheck всех потребителей; визуальная проверка контролов/длинных текстов, без формальных snapshot-тестов CSS.
- [ ] Commit: `feat: align shared UI and localization with current Figma`.

### Task 6: Полный срочный frontend

**Files:** client/web order pages/views и формы; master ActiveOrderView/Mobile/lib; общие hooks/API wrappers.

**Interfaces:** Consumes Tasks 1–5. Produces реальный urgent flow клиента/мастера с version-aware действиями и cancellation confirmation.

- [ ] Получить high-fidelity design context каждого изменяемого состояния: 74:1333, 90:1297/1794/2291/2788/3291, 378:1515, 287:1507, 93:1320, 204:1480; mobile 118:1427/1494/1545, 142:1460/1509/1562/1611/1671/1801; master 95:1405/1459/1512/1570,103:1546 и mobile 143:1672/1732/1777/1829/1877/1925/1988.
- [ ] Red behavior checks: ошибка fetch не empty; Back не mutation; reload/reconnect получает серверную стадию; смена ID не получает предыдущий ответ; повторный submit блокирован.
- [ ] Реализовать реальные формы/раздельную смету/ожидание старта/приёмку/подтверждение отмены с API, 409 → refresh, 403 → own orders.
- [ ] Добавить отсутствие сети и запрет mutations до reconnect; draft после SMS сохраняется.
- [ ] E2E двух ролей без мок-успехов + скриншоты web1280/1440/1920 и mobile360/390/430, 3 языка. Проверить реальные static assets и rendered geometry.
- [ ] Commit: `feat: implement current urgent client and master flows`.

### Task 7: Публичный сайт

**Files:** `apps/site/app/page.tsx`, layout/globals; Header/Hero/Footer и секции; local public assets.

**Interfaces:** Реальные CTA `/order/new`, `/planned/new` и регистрация мастера через configured app URLs.

- [ ] Использовать design context 73:1331 и mobile guest 227:3826; скачать assets локально по инструкции контекста.
- [ ] Собрать split layout, planned/urgent/master sections, header/footer; сохранить действующие SEO routes.
- [ ] Не выдавать sample offer за реальный заказ; не обещать неподтверждённые цены/SLA.
- [ ] Проверить маршруты CTA/locale, site build с реальным API, визуальные скриншоты и responsive widths.
- [ ] Commit: `feat: align public site with current Figma`.

### Task 8: Плановые заявки

**Files:** `apps/api/src/planned-orders/*`; client/web planned views; master PlannedFeedView/lib/plannedFeed; planned e2e.

**Interfaces:** Новая версия planned workflow, раздельная смета, явные согласие/старт/приёмка, без lead charge v2.

- [ ] Сверить фактические design context planned states и подготовить отдельную точную матрицу переходов до миграции.
- [ ] Проверить/create выбор, конкурирующие ставки и повтор выбора, согласованную цену и чужой доступ failing e2e.
- [ ] Реализовать additive planned v2 с сохранением legacy и direct payment policy.
- [ ] Backend e2e + real client/master planned flow и ru/kk/en screenshots.
- [ ] Commit отдельным PR: `feat: align planned booking lifecycle with direct payment`.

### Task 9: Оператор и администратор

**Files:** UserRole schema/migration; auth/roles.guard; admin-users services/controllers; operator pages; staff e2e.

**Interfaces:** ADMIN отдельно от OPERATOR, управление сотрудниками с аудитом, защита последнего ADMIN.

- [ ] Получить contexts 224:1669/1757/1810 и операторских текущих страниц.
- [ ] Red tests: оператор не меняет роли, admin меняет с журналом, два admin параллельно отключаются → один отказ, последний остаётся.
- [ ] Реализовать explicit first-admin bootstrap и transactional gates; не повышать операторов автоматически.
- [ ] Подключить реальные интерфейсы документов/обращений/заказов, скрыть payouts для direct режима; сохранить legacy историю.
- [ ] Role matrix/admin e2e, screenshot и проверка файла PDF с реальными uploads.
- [ ] Commit отдельным PR: `feat: separate administrator and operator permissions`.

### Task 10: PWA, уведомления и передача

**Files:** PWA config/service worker, subscriptions API/schema, auth/notifications hooks, environment examples, runbook/CI.

**Interfaces:** Push-ID deeplink → актуальный заказ; отказ/неподдержка push → обычная работа приложения.

- [ ] Test subscription ownership, invalid endpoint cleanup, expired session deep link, offline cold start; permission только после явного действия.
- [ ] Реализовать push subscriptions/VAPID env, foreground refresh, notifications fallback и mobile safe area.
- [ ] Полный API unit/e2e/queue, все builds/typechecks, full urgent/planned роль-сценарии и проверка 3 языков.
- [ ] Собрать screenshot evidence, launch/migration/rollback инструкции, список внешних блокеров (SMS, HTTPS/devices, юридические тексты, партнёры).
- [ ] Создать draft PR с фактическими проверками. Не merge и не production deploy.

## Порядок и завершение

0 → 1 → 2/3/4 → 5 → 6 → 7 → 8 → 9 → 10. Задачи 7 и часть 5 независимы от backend после утверждения визуального scope. Для каждой новой архитектурной части уточнять только существенные новые решения, не повторять согласованные правила.

Готовность интерфейса, готовность end-to-end MVP и готовность эксплуатации — разные результаты; каждый заявлять только по фактическим проверкам. В настоящий момент реализовано только исправление CI; миграции и продуктовые изменения не начаты.
