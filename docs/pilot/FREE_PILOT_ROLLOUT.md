# Запуск бесплатного пилота MasterQala.kz

Этот runbook относится к реализации из PR `feat/free-pilot-mode`. Архитектурное обоснование и техническая спецификация находятся в документационном PR #3.

## 1. Что гарантирует режим

При `COMMERCIAL_MODE=FREE_PILOT` новые срочные и плановые заявки сохраняются с режимом `FREE_PILOT`.

Для таких заявок платформа:

- не создаёт реальные `PaymentTransaction`;
- не создаёт `Accrual` и не пополняет кошелёк мастера;
- не списывает и не возвращает lead-кредиты;
- не принимает и не выплачивает деньги;
- показывает клиенту стоимость выезда и сервисный сбор как `0 ₸`;
- сохраняет номинальный расчёт стоимости выезда в БД для аналитики;
- оставляет расчёт за работы напрямую между клиентом и мастером.

Режим фиксируется в каждой заявке. Последующее изменение переменной окружения влияет только на новые заявки и не меняет финансовое поведение уже созданных.

## 2. Подготовка окружения

Создать локальный env-файл на основе примера:

```bash
cp apps/api/.env.example apps/api/.env
```

Проверить обязательное значение:

```env
COMMERCIAL_MODE=FREE_PILOT
```

Не использовать `PAID_LIVE`: API намеренно прекращает запуск, пока реальный платёжный адаптер не подключён.

## 3. Установка и генерация Prisma Client

```bash
pnpm install --frozen-lockfile
pnpm --filter api prisma:generate
```

`build`, `test` и `test:e2e` также автоматически запускают `prisma generate` через lifecycle-скрипты.

## 4. Применение миграции

Для существующего окружения:

```bash
pnpm --filter api exec prisma migrate deploy
```

Миграция:

- создаёт enum `CommercialMode`;
- добавляет `commercialMode` в `Order` и `PlannedOrder`;
- относит существующие записи к `PAID_MOCK`;
- создаёт индексы по режиму и дате создания.

Перед production-применением сделать резервную копию PostgreSQL.

## 5. Обязательные проверки перед запуском

```bash
pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web build
```

PR нельзя переводить из draft до успешного прохождения этих команд.

## 6. Smoke-сценарий срочной заявки

1. Проверить публичную конфигурацию:

```bash
curl http://localhost:3000/api/v1/config/public
```

Ожидается:

```json
{
  "commercialMode": "FREE_PILOT",
  "paymentsEnabled": false,
  "leadCreditsEnabled": false,
  "payoutsEnabled": false
}
```

2. Создать срочную заявку.
3. Убедиться, что preview и карточка показывают выезд `0 ₸`.
4. Принять заявку мастером.
5. Согласовать стоимость работ.
6. Закрыть заявку.
7. Проверить, что расчёт обозначен как прямой между сторонами.

Контроль БД для конкретной заявки:

```sql
SELECT id, "commercialMode", "calloutPrice", "serviceFee", "workPrice"
FROM "Order"
WHERE id = '<ORDER_ID>';

SELECT *
FROM "PaymentTransaction"
WHERE "orderId" = '<ORDER_ID>';

SELECT *
FROM "Accrual"
WHERE "orderId" = '<ORDER_ID>';
```

Ожидается:

- `Order.commercialMode = 'FREE_PILOT'`;
- номинальные `calloutPrice` и `serviceFee` могут быть больше нуля;
- `PaymentTransaction` — 0 строк;
- `Accrual` — 0 строк.

Дополнительно проверить события Socket.IO:

- `offer:new` содержит `freePilot: true` и `compensation: 0`;
- web-клиент после `order:status` перечитывает заявку через HTTP и продолжает показывать маскированную цену;
- до подключения сторонних WebSocket-клиентов payload `order:status` необходимо нормализовать отдельно, потому что он пока содержит номинальный `calloutPrice` из БД.

## 7. Smoke-сценарий плановой заявки

1. Создать плановую заявку.
2. Откликнуться мастером при нулевом балансе lead-кредитов.
3. Выбрать мастера и завершить заявку.
4. Отменить отдельную тестовую заявку после выбора мастера.

Контроль БД:

```sql
SELECT id, "commercialMode", status
FROM "PlannedOrder"
WHERE id = '<PLANNED_ORDER_ID>';

SELECT *
FROM "LeadCreditTransaction"
WHERE "bidId" IN (
  SELECT id FROM "PlannedOrderBid"
  WHERE "plannedOrderId" = '<PLANNED_ORDER_ID>'
);
```

Ожидается:

- `commercialMode = 'FREE_PILOT'`;
- отклик создаётся;
- финансовых lead-credit транзакций нет.

## 8. Проверка заблокированных операций

В бесплатном режиме должны возвращать `403`:

- покупка lead-кредитов;
- создание заявки на вывод средств.

Frontend не должен показывать активные кнопки покупки кредитов, вывода или привязки карты.

## 9. Споры

Для `FREE_PILOT`:

- оператор может применить санкцию к мастеру;
- оператор может сохранить решение и комментарий;
- возврат сервисного сбора принудительно сохраняется как `false`;
- платёжный провайдер возврата не вызывается.

Платформа не обещает возврат денег, переданных мастеру напрямую.

## 10. Переключение режима

Изменение:

```env
COMMERCIAL_MODE=PAID_MOCK
```

влияет только на новые заявки.

Уже созданные `FREE_PILOT` заявки продолжают:

- не создавать платёжные транзакции;
- не начислять компенсации;
- показывать бесплатный выезд;
- использовать бесплатные плановые отклики.

Перед переключением проверить распределение активных заявок:

```sql
SELECT "commercialMode", status, COUNT(*)
FROM "Order"
WHERE status NOT IN ('CLOSED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER')
GROUP BY "commercialMode", status
ORDER BY "commercialMode", status;

SELECT "commercialMode", status, COUNT(*)
FROM "PlannedOrder"
WHERE status NOT IN ('CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER')
GROUP BY "commercialMode", status
ORDER BY "commercialMode", status;
```

## 11. Откат

Безопасный прикладной откат:

1. остановить создание новых заявок;
2. вернуть предыдущую версию приложения;
3. оставить новые столбцы и enum в БД;
4. не откатывать миграцию, пока существуют записи с `commercialMode`.

Удаление столбцов не требуется для отката приложения и создаёт лишний риск потери аналитических данных.

## 12. Статус готовности

Реализация остаётся в draft до выполнения build, unit, e2e и web build. Текущий web-клиент не использует цену из `order:status`, поэтому пользовательский интерфейс получает маскированные суммы через HTTP. Нормализация самого WebSocket payload требуется до публикации этого события для сторонних клиентов или внешних интеграций.
