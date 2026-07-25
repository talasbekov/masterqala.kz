# Стратегия тестирования MasterQala.kz

Документ определяет тестовую модель первой публичной версии `FREE_PILOT`, фактически добавленное покрытие PR #4 и проверки, которые ещё нужны до запуска.

## 1. Инструменты

Backend:

- Jest;
- NestJS TestingModule;
- Supertest;
- Prisma;
- PostgreSQL 16 + PostGIS 3.4;
- отдельный test `DATABASE_URL`;
- `PGBOSS_DISABLED=1` для тестов без реального worker.

Frontend:

- production build через Vite;
- полноценные Vitest/React Testing Library/MSW scripts пока не зафиксированы;
- Playwright пока не добавлен.

Команды API:

```bash
pnpm --filter api build
pnpm --filter api test -- --runInBand
pnpm --filter api test:e2e
pnpm --filter api test:cov
```

Команда frontend:

```bash
pnpm --filter web build
```

Перед `build`, `test` и `test:e2e` PR #4 автоматически выполняет `prisma generate` lifecycle-скриптами.

## 2. CI PR #4

`.github/workflows/ci.yml` выполняет:

1. checkout;
2. Node.js `22.12.0`;
3. pnpm `9.15.0`;
4. PostGIS service `16-3.4`;
5. `pnpm install --frozen-lockfile`;
6. `prisma migrate deploy`;
7. API build;
8. API unit tests;
9. API e2e tests;
10. web build.

Workflow запускается на push ветки и pull request в `main`.

На момент обновления документа успешный run доступным connector не подтверждён. Поэтому наличие тестов и CI-конфигурации не означает, что release gate пройден.

Lint/typecheck отдельным шагом сейчас отсутствует. TypeScript проверяется как часть build, но это не заменяет ESLint.

## 3. Что тестирование должно доказать

1. Состояния заявок меняются только разрешёнными переходами.
2. Конкурирующие действия не создают двойное назначение.
3. Повторная job/операция идемпотентна.
4. Пользователь получает только разрешённые данные.
5. REST и Socket.IO сохраняют одинаковую коммерческую семантику.
6. `FREE_PILOT` не создаёт финансовых записей.
7. `PAID_MOCK` сохраняет прежнее поведение.
8. Режим существующей заявки не меняется после переключения env.
9. Миграция безопасно относит исторические записи к `PAID_MOCK`.
10. Система восстанавливает состояние после reconnect/restart/redelivery.

## 4. Уровни тестирования

### 4.1 Unit

Проверяют небольшой сервис или преобразование с контролируемыми зависимостями.

Подходящие объекты:

- коммерческий режим;
- payment strategy;
- компенсация;
- Prisma stamping;
- HTTP presentation;
- realtime normalization;
- plan bid commercial rules;
- penalties;
- pricing/ETA;
- privacy redaction.

Unit-тест не заменяет проверку реальной транзакции, индекса или PostGIS-запроса.

### 4.2 Integration PostgreSQL/PostGIS

Обязательна реальная PostgreSQL/PostGIS, не SQLite.

Проверки:

- migrations;
- Prisma transactions;
- raw SQL PostGIS;
- георадиус кандидатов;
- unique/index constraints;
- конкурентное принятие;
- повторная delivery queue jobs;
- блокировки и атомарные balances;
- backfill `commercialMode`.

### 4.3 API e2e

Запускается NestJS-приложение и запрос выполняется через Supertest.

Проверки:

- auth;
- DTO validation;
- guards/roles;
- ownership;
- state transitions;
- файлы;
- `FREE_PILOT`/`PAID_MOCK`;
- database side effects.

### 4.4 Socket.IO integration

Через `socket.io-client`:

- handshake;
- rooms;
- presence;
- offers;
- statuses;
- geo relay;
- planned events;
- reconnect.

Текущий `RealtimeGateway` покрыт unit-тестами, но полноценный network-level Socket.IO integration suite ещё требуется.

### 4.5 Frontend component

Целевой стек:

- Vitest;
- React Testing Library;
- MSW.

Проверять:

- loading/error/empty states;
- кнопки по state machine;
- тексты `FREE_PILOT`;
- смешанную плановую ленту;
- скрытие коммерческих действий;
- обработку событий и refetch;
- защиту от двойного клика;
- accessibility критичных форм.

### 4.6 Browser e2e

Целевой инструмент — Playwright.

Роли:

- клиент;
- активный мастер;
- второй мастер;
- оператор.

Browser suite пока не реализован и остаётся release gap.

## 5. Фактически добавленное покрытие PR #4

### 5.1 `CommercialModeService`

Проверяется:

- `FREE_PILOT` capability flags;
- `PAID_MOCK` capability flags;
- неизвестное значение;
- fail-fast `PAID_LIVE`.

### 5.2 Prisma stamping

Проверяется:

- автоматическая установка режима при создании `Order`;
- автоматическая установка режима при создании `PlannedOrder`;
- явно переданный режим не перезаписывается;
- update-операции не меняют режим автоматически.

### 5.3 Payment provider

Проверяется:

- no-op для бесплатной заявки;
- отсутствие делегирования mock-провайдеру;
- делегирование для `PAID_MOCK`;
- режим берётся из записи заявки, а не текущего env.

### 5.4 Compensation

Проверяется:

- бесплатная заявка не создаёт `Accrual`;
- платная mock-заявка сохраняет начисление;
- повторный путь не создаёт неожиданную финансовую запись.

### 5.5 HTTP presentation

Проверяется:

- `calloutPrice=0` и `serviceFee=0` для `FREE_PILOT`;
- номинальные значения сохраняются отдельными полями;
- массивы, wrapper `{ order }` и одиночные объекты нормализуются;
- `PAID_MOCK` не маскируется.

### 5.6 Срочный matching/offer

Проверяется:

- бесплатная компенсация равна 0;
- платная mock-компенсация рассчитывается;
- режим берётся из `Order.commercialMode`;
- `offer:new` не раскрывает адрес, подъезд, этаж, квартиру и комментарий доступа.

### 5.7 `order:status`

Проверяется:

- нулевые суммы `FREE_PILOT`;
- фактические суммы `PAID_MOCK`;
- одинаковый payload клиенту и мастеру;
- режим существующей заявки не зависит от env;
- один запрос режима переиспользуется через `WeakMap`;
- нерелевантные события не вызывают дополнительный DB lookup.

### 5.8 Плановые коммерческие операции

Проверяется:

- бесплатный отклик при нулевом/отсутствующем балансе;
- отсутствие `SPEND`;
- отсутствие `REFUND` при отмене;
- историческая `PAID_MOCK` заявка продолжает списывать/возвращать кредит;
- лимиты и основная service-логика не обходятся.

### 5.9 Споры

Проверяется:

- `refundServiceFee=false` для `FREE_PILOT`;
- refund provider не вызывается;
- `PAID_MOCK` сохраняет прежнюю ветку;
- решение и санкция сохраняются.

### 5.10 Wallet и public config

Проверяется:

- wallet service работает с новой зависимостью режима;
- public config e2e возвращает capability flags `FREE_PILOT`.

## 6. Матрица коммерческих режимов

| Сценарий | `FREE_PILOT` | `PAID_MOCK` |
|---|---|---|
| создание срочной | нет HOLD | HOLD |
| принятие | нет CAPTURE | CAPTURE |
| `NO_MASTERS`/ранняя отмена | нет VOID | VOID |
| закрытие/поздняя отмена | нет Accrual | один Accrual |
| HTTP цена выезда/сбора | `0/0` | фактическая |
| `order:status` | `0/0`, `freePilot=true` | фактическая, `false` |
| оффер мастеру | `compensation=0` | `callout-serviceFee` |
| плановый отклик | бесплатно | минус 1 кредит |
| отмена после выбора | без REFUND | плюс 1 кредит |
| покупка кредитов | `403` | mock charge |
| wallet balance/history | `0`/`[]` | фактические mock данные |
| вывод | `403` | mock payout |
| решение спора с refund | принудительно `false` | mock refund |

`PAID_LIVE` не тестируется как доступный режим: startup обязан завершиться ошибкой до подключения адаптера.

## 7. Срочный режим — обязательная матрица

### Создание

- неизвестная категория → `400`;
- активная заявка клиента → `409`;
- preview без мастеров → `available=false`;
- create без мастеров → `422`;
- координаты записаны в PostGIS;
- максимум 5 фото;
- статус переходит в `SEARCHING`;
- wave 1 job создана;
- `commercialMode` сохранён;
- бесплатная заявка не создаёт HOLD.

### Волны

- радиусы 3/6/10 км;
- таймауты 60/60/90 секунд;
- только `ACTIVE`, online, подходящая категория;
- blocked/занятые исключаются;
- клиент исключён как кандидат своей заявки;
- повторная job не дублирует офферы;
- wave не движется назад;
- после последней волны — `NO_MASTERS`;
- оффер не содержит точный адрес.

### Принятие

- без актуального оффера → `403`;
- конкурентное принятие: один успех, остальные `409`;
- проигравшие офферы `LOST`;
- проигравшие получают `offer:closed`;
- правильный `masterId`;
- `FREE_PILOT` не создаёт CAPTURE.

### Выполнение

- только назначенный мастер меняет мастерские статусы;
- только клиент подтверждает цену/закрытие;
- неверный previous state → `409`;
- timeout цены идемпотентен;
- auto-close идемпотентен;
- открытый спор блокирует auto-close;
- `FREE_PILOT` не создаёт Accrual.

### Отмена/retry

- клиент до принятия;
- клиент после принятия;
- мастер только в разрешённом статусе;
- санкция мастера;
- новая `searchAttempt`;
- отменивший мастер не получает повторный оффер;
- retry только из `NO_MASTERS` владельцем;
- бесплатная заявка не вызывает HOLD/VOID/Accrual.

## 8. Плановый режим — обязательная матрица

### Создание/feed

- прошедшая дата → `400`;
- дальше 14 дней → `400`;
- `slotEnd <= slotStart` → `400`;
- создаётся `PUBLISHED`;
- expiry job создана;
- feed фильтруется категориями;
- feed использует `slotStart`;
- feed содержит `commercialMode`;
- точный адрес/фото/клиент/чужие bids скрыты.

### Отклики

- один bid мастера;
- максимум 5;
- blocked мастер отклоняется;
- закрытая заявка не принимает bid;
- `FREE_PILOT` работает без account;
- `PAID_MOCK` атомарно списывает 1;
- ошибка bid не теряет кредит;
- смешанная лента корректно показывает бесплатные и платные записи.

### Выбор/выполнение

- bid принадлежит заявке;
- выбранный мастер получает событие;
- остальные получают закрытие;
- confirm только выбранному;
- timeout 2 часа возвращает `PUBLISHED`;
- stale timeout игнорируется;
- телефон раскрывается с `CONFIRMED`;
- auto-close 24 часа;
- OPEN dispute блокирует auto-close;
- без bids при `slotStart` → `EXPIRED`.

## 9. Авторизация/privacy

Обязательные тесты:

- неверный телефон;
- SMS send rate limit;
- истёкший/неверный/повторный код;
- JWT отсутствует/невалиден;
- удалённый пользователь с валидным token получает `401`;
- текущая роль загружается из БД;
- CLIENT не вызывает operator endpoint;
- чужая заявка/адрес/файл недоступны;
- path traversal отклоняется;
- MIME/размер отклоняются;
- неизвестные DTO-поля не сохраняются;
- точный адрес не попадает в оффер/feed;
- номинальные суммы пилота не попадают в public realtime.

После реализации security P0 добавить:

- default JWT startup failure;
- CORS allowlist;
- global rate limits;
- magic bytes/EXIF/PDF tests;
- audit log assertions.

## 10. WebSocket

### Unit — реализовано частично

- normalization `order:status`;
- одинаковый payload двум получателям;
- safe failure;
- отсутствие лишнего query;
- free offer compensation.

### Integration — требуется

- invalid JWT → `connect_error`;
- room isolation;
- online/offline;
- geo update;
- master location только связанному клиенту;
- multi-socket поведение после исправления presence;
- reconnect + REST refetch;
- duplicate/out-of-order event tolerance;
- proxy/TLS WebSocket smoke.

## 11. Миграции

Для schema PR:

1. чистая база принимает все migrations;
2. база предыдущей версии upgrade-ится;
3. Prisma Client генерируется;
4. новое приложение запускается;
5. индексы существуют;
6. PostGIS queries работают;
7. исторические `Order`/`PlannedOrder` получают `PAID_MOCK`;
8. новые записи получают текущий mode;
9. rollback приложения проверяется отдельно.

Запрещено использовать только `prisma db push` как доказательство готовности migration.

## 12. Файлы

Использовать отдельный временный каталог на run.

Проверки:

- случайное UUID-имя;
- допустимое расширение;
- файл существует;
- DB path относительный;
- path traversal;
- access control;
- orphan cleanup при ошибке;
- backup/restore сохраняет связи.

После security pipeline:

- magic bytes;
- image decode/re-encode;
- EXIF removal;
- PDF antivirus/sanitization;
- checksum.

## 13. Нагрузочные проверки пилота

Минимум:

- auth без реальной SMS отправки;
- 100–500 Socket.IO connections;
- частые geo updates;
- concurrent create/accept;
- PostGIS wave matching;
- planned feed/bids;
- uploads;
- queue timeout burst.

Наблюдать:

- API latency;
- DB CPU/connections/locks;
- queue lag;
- event latency;
- memory;
- `pgboss` table growth;
- disk usage.

Численные SLO утверждаются после выбора production infrastructure.

## 14. Browser e2e release paths

### Срочный

1. мастер online;
2. клиент создаёт;
3. мастер получает оффер без адреса, с `compensation=0`;
4. мастер принимает;
5. адрес раскрывается только назначенному мастеру;
6. статусы до осмотра;
7. предложение цены;
8. подтверждение;
9. выполнение;
10. закрытие/отзыв;
11. нет платформенной оплаты;
12. в БД нет financial rows.

### Плановый

1. клиент публикует;
2. мастер с нулём кредитов видит бесплатную заявку;
3. оставляет bid;
4. клиент выбирает;
5. мастер подтверждает;
6. данные раскрываются в нужном статусе;
7. выполнение/отзыв;
8. `SPEND/REFUND` отсутствуют.

### Смешанный режим

1. создать историческую/fixture `PAID_MOCK` заявку;
2. переключить глобальный mode на `FREE_PILOT`;
3. создать бесплатную заявку;
4. обе видны в ленте с правильной маркировкой;
5. paid требует кредит;
6. free не требует;
7. env не меняет поведение существующих записей.

### Оператор

1. анкета;
2. документ;
3. решение;
4. спор;
5. решение без refund для бесплатной заявки;
6. после реализации — audit log.

## 15. Test data

- только вымышленные телефоны/ИИН/адреса/документы;
- production dump запрещён;
- deterministic factories/seeds;
- уникальный namespace данных run;
- cleanup после run;
- timeout через fake timers или прямой handler invocation;
- SMS/payment через deterministic fake;
- CI secrets не используются как production secrets.

## 16. Merge gates

Фактический CI PR #4:

```text
install
migrate deploy
api build
api unit
api e2e
web build
```

Дополнительно необходимо добавить:

```text
lint
frontend component tests
Socket.IO integration
browser e2e
migration upgrade fixture
```

Merge блокируется при:

- failing build/test;
- отсутствующей migration;
- изменении endpoint/event/status без документации;
- financial side effect для `FREE_PILOT`;
- privacy leak;
- незафиксированном критичном ограничении.

## 17. Release gate `FREE_PILOT`

### Автоматические

- [ ] CI run зелёный;
- [ ] clean migration зелёная;
- [ ] unit/e2e зелёные;
- [ ] API/web builds зелёные;
- [ ] финансовая матрица зелёная;
- [ ] privacy tests зелёные.

### Требуется добавить/выполнить

- [ ] network Socket.IO integration;
- [ ] browser urgent path;
- [ ] browser planned path;
- [ ] смешанный режим;
- [ ] migration upgrade from pre-CommercialMode database;
- [ ] load smoke;
- [ ] backup/restore smoke;
- [ ] security P0 tests;
- [ ] production-like staging smoke.

Release готов только после автоматического gate, ручного эксплуатационного smoke и security gate.
