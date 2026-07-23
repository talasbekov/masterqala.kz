# Техническая документация MasterQala.kz

Этот раздел описывает не только целевую архитектуру, но и фактическую реализацию в репозитории.

## Статусы документов

В документах используются два типа утверждений:

- **текущее поведение** — подтверждено кодом, Prisma-схемой или конфигурацией репозитория;
- **целевая модель** — обязательное изменение до бесплатного пилота или production.

Если поведение ещё не реализовано, это должно быть явно указано в документе.

## Источники истины

При расхождении документов приоритет имеют:

1. `apps/api/prisma/schema.prisma` — модель данных и перечисления статусов;
2. контроллеры и сервисы `apps/api/src/**` — фактические HTTP-переходы и бизнес-ограничения;
3. `apps/api/src/orders/order.constants.ts` и `apps/api/src/planned-orders/planned-order.constants.ts` — таймауты и лимиты;
4. `apps/web/src/**` — реально доступные пользовательские сценарии;
5. `docs/project-spec.md` — продуктовые требования и целевое поведение.

## Текущая система

- [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md) — компоненты, зависимости и фактическая архитектура.
- [`STATE_MACHINES.md`](./STATE_MACHINES.md) — статусы и переходы срочных и плановых заявок.
- [`REST_API.md`](./REST_API.md) — публичные HTTP-маршруты, роли, ограничения и поведение в пилоте.
- [`WEBSOCKET_EVENTS.md`](./WEBSOCKET_EVENTS.md) — handshake, realtime-события, payload и reconnect.
- [`DATA_MODEL.md`](./DATA_MODEL.md) — Prisma-сущности, связи, ограничения и финансовые таблицы.

## Безопасность и эксплуатация

- [`SECURITY.md`](./SECURITY.md) — текущие меры, P0/P1 риски, персональные данные и checklist.
- [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — production-схема пилота, migrations, backup, monitoring и rollback.
- [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) — unit/integration/e2e/WebSocket/browser матрица.

## Бесплатный пилот

- [`../pilot/FREE_PILOT_TECHNICAL_SPEC.md`](../pilot/FREE_PILOT_TECHNICAL_SPEC.md) — целевое техническое поведение первой бесплатной версии.
- [`../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md`](../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md) — последовательность изменений backend, frontend, данных, тестов и rollout.

## Ключевой принцип бесплатной версии

`MockPaymentProvider` и бесплатный пилот — разные режимы:

- mock имитирует успешную платную систему и создаёт финансовые записи;
- `FREE_PILOT` не создаёт платформенные платежи, начисления, покупки кредитов и выводы.

До реализации `COMMERCIAL_MODE=FREE_PILOT` текущий код нельзя считать готовой бесплатной production-версией.

## Правило актуализации

Изменение Prisma-схемы, публичного endpoint, WebSocket-события, статуса, таймаута, платежного поведения, роли или production-конфигурации считается незавершённым, пока соответствующий технический документ не обновлён в том же pull request.
