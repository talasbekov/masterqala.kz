# Техническая документация MasterQala.kz

Этот раздел описывает фактическую реализацию репозитория, внедрённый бесплатный режим и обязательные изменения до публичного production-запуска.

## Статусы утверждений

В документах используются три типа утверждений:

- **реализовано** — подтверждено кодом, Prisma-схемой, миграцией или тестом;
- **проверено CI** — команда фактически завершилась успешно в GitHub Actions;
- **целевой gate** — обязательное изменение или проверка до production.

Наличие реализации без успешного CI/smoke не считается доказательством production-готовности.

## Источники истины

При расхождении документов приоритет имеют:

1. `apps/api/prisma/schema.prisma` и migrations;
2. контроллеры и сервисы `apps/api/src/**`;
3. `order.constants.ts` и `planned-order.constants.ts`;
4. realtime gateway/matching;
5. `apps/web/src/**`;
6. CI workflow и фактические результаты run;
7. `docs/project-spec.md` как продуктовая целевая модель.

## Текущая система

- [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md) — компоненты, зависимости и фактическая архитектура.
- [`STATE_MACHINES.md`](./STATE_MACHINES.md) — статусы и переходы срочных и плановых заявок.
- [`REST_API.md`](./REST_API.md) — HTTP-маршруты, DTO, роли, ошибки и коммерческое поведение.
- [`WEBSOCKET_EVENTS.md`](./WEBSOCKET_EVENTS.md) — handshake, realtime payload и правила режима заявки.
- [`DATA_MODEL.md`](./DATA_MODEL.md) — Prisma/PostGIS, `CommercialMode`, финансовые инварианты и пробелы constraints.

## Безопасность и эксплуатация

- [`SECURITY.md`](./SECURITY.md) — реализованные меры, P0/P1 риски, privacy и launch gate.
- [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — CI, migration rollout, single-node deployment, backup, monitoring и rollback.
- [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) — фактические тесты PR #4 и недостающее integration/browser покрытие.

## Бесплатный пилот

- [`../pilot/FREE_PILOT_TECHNICAL_SPEC.md`](../pilot/FREE_PILOT_TECHNICAL_SPEC.md) — требования первой бесплатной версии.
- [`../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md`](../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md) — file-level план backend/frontend/data/testing/rollout.

Фактическая реализация находится в PR #4 `feat/free-pilot-mode`.

## Ключевой принцип

`MockPaymentProvider` и бесплатный пилот — разные режимы:

- `PAID_MOCK` имитирует платную систему и создаёт финансовые записи;
- `FREE_PILOT` не создаёт платежи, начисления, покупки кредитов и выводы;
- номинальные суммы могут храниться для аналитики, но не являются выручкой;
- коммерческое поведение определяется неизменяемым режимом конкретной заявки.

## Текущий статус готовности

Реализовано в PR #4:

- `CommercialMode` и миграция;
- backend financial no-op/blocking;
- HTTP/Socket.IO masking;
- бесплатные плановые отклики;
- frontend capability-логика;
- unit/e2e-тесты;
- GitHub Actions workflow.

До public production остаются:

- подтверждённый зелёный CI;
- ручной smoke;
- обязательные P0 из `SECURITY.md`;
- production process/reverse proxy/storage/backup/monitoring.

## Правило актуализации

Изменение Prisma-схемы, endpoint, Socket.IO payload, статуса, таймаута, коммерческого поведения, privacy rule или production-конфигурации считается незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий документ.
