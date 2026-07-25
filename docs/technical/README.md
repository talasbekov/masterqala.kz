# Техническая документация MasterQala.kz

Этот раздел описывает фактическую реализацию репозитория, внедрённый бесплатный режим и обязательные изменения до публичного production-запуска.

## Статусы утверждений

В документах используются три типа утверждений:

- **реализовано** — подтверждено кодом, Prisma-схемой, миграцией или тестом;
- **проверено CI** — команда фактически завершилась успешно в GitHub Actions;
- **целевой gate** — обязательное изменение или проверка до production.

Наличие реализации и зелёного CI без production-like smoke не считается доказательством полной production-готовности.

Что ещё не проверено руками: [`VERIFICATION_STATUS.md`](./VERIFICATION_STATUS.md).

## Источники истины

При расхождении документов приоритет имеют:

1. `apps/api/prisma/schema.prisma` и migrations;
2. контроллеры и сервисы `apps/api/src/**`;
3. `order.constants.ts` и `planned-order.constants.ts`;
4. realtime gateway/matching;
5. `apps/web/src/**`;
6. CI workflow и фактические результаты run;
7. `../product/spec.md` как продуктовая целевая модель.

## Текущая система

- [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md) — компоненты, зависимости и фактическая архитектура.
- [`STATE_MACHINES.md`](./STATE_MACHINES.md) — статусы и переходы срочных и плановых заявок.
- [`REST_API.md`](./REST_API.md) — HTTP-маршруты, DTO, роли, ошибки и коммерческое поведение.
- [`WEBSOCKET_EVENTS.md`](./WEBSOCKET_EVENTS.md) — handshake, realtime payload и правила режима заявки.
- [`DATA_MODEL.md`](./DATA_MODEL.md) — Prisma/PostGIS, `CommercialMode`, финансовые инварианты и пробелы constraints.
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — локальный запуск, env-переменные, тесты, ручная проверка.

## Безопасность и эксплуатация

- [`SECURITY.md`](./SECURITY.md) — реализованные меры, P0/P1 риски, privacy и launch gate.
- [`SECURE_ENVIRONMENT.md`](./SECURE_ENVIRONMENT.md), [`RATE_LIMITING_AND_HEADERS.md`](./RATE_LIMITING_AND_HEADERS.md), [`FILE_UPLOAD_SECURITY.md`](./FILE_UPLOAD_SECURITY.md), [`SECURITY_AUDIT_AND_RETENTION.md`](./SECURITY_AUDIT_AND_RETENTION.md), [`SECURITY_OBSERVABILITY.md`](./SECURITY_OBSERVABILITY.md) — секреты, лимиты, загрузки, аудит, наблюдаемость.
- [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — CI, migration rollout, single-node deployment, backup, monitoring и rollback.
- [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) — фактическое покрытие и недостающее integration/browser покрытие.
- [`VERIFICATION_STATUS.md`](./VERIFICATION_STATUS.md) — что ещё должно быть проверено руками.

## Бесплатный пилот

- [`../pilot/FREE_PILOT_TECHNICAL_SPEC.md`](../pilot/FREE_PILOT_TECHNICAL_SPEC.md) — требования первой бесплатной версии.
- [`../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md`](../pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md) — file-level план backend/frontend/data/testing/rollout.

Реализация смержена в `main` 26.07.2026; ветка `feat/free-pilot-mode` удалена.

## Ключевой принцип

`MockPaymentProvider` и бесплатный пилот — разные режимы:

- `PAID_MOCK` имитирует платную систему и создаёт финансовые записи;
- `FREE_PILOT` не создаёт платежи, начисления, покупки кредитов и выводы;
- номинальные суммы могут храниться для аналитики, но не являются выручкой;
- коммерческое поведение определяется неизменяемым режимом конкретной заявки.

## Текущий статус готовности

Реализовано и проверено CI:

- `CommercialMode` и migration deploy;
- backend financial no-op/blocking;
- HTTP/Socket.IO masking;
- бесплатные плановые отклики;
- frontend capability-логика;
- API build;
- API unit tests;
- API e2e tests;
- web build вместе с workspace-пакетом `@masterqala/ui`.

CI прогоняется на каждый push: сборка, unit и e2e. Актуальный счёт тестов —
в [`../STATUS.md`](../STATUS.md).

До public production остаются:

- **код-ревью стека безопасности** — он смержен в `main` без единого ревью;
- ручной business smoke;
- migration/rollback/backup smoke на production-like staging;
- обязательные P0 из [`SECURITY.md`](./SECURITY.md);
- production process/reverse proxy/storage/backup/monitoring.

Чек-лист ручных проверок — [`VERIFICATION_STATUS.md`](./VERIFICATION_STATUS.md).

## Правило актуализации

Изменение Prisma-схемы, endpoint, Socket.IO payload, статуса, таймаута, коммерческого поведения, privacy rule или production-конфигурации считается незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий документ.
