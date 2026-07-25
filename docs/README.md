# Документация MasterQala.kz

> **Внимание: в каталоге сейчас два набора документации**, созданных параллельно
> и частично покрывающих одни темы. Они сведены в этом указателе, но **не сверены
> между собой** — см. «Требует сверки» в конце. До сверки при расхождении
> опирайтесь на код; порядок приоритета — ниже.

## Источники истины

При расхождении документов приоритет имеют:

1. `apps/api/prisma/schema.prisma` и migrations;
2. контроллеры и сервисы `apps/api/src/**`;
3. `order.constants.ts` и `planned-order.constants.ts`;
4. realtime gateway/matching;
5. `apps/web/src/**`;
6. CI workflow и фактические результаты run;
7. `product/spec.md` как продуктовая целевая модель.

## Статусы утверждений

- **реализовано** — подтверждено кодом, Prisma-схемой, миграцией или тестом;
- **проверено CI** — команда фактически завершилась успешно в GitHub Actions;
- **целевой gate** — обязательное изменение или проверка до production.

Реализация плюс зелёный CI без production-like smoke не считаются доказательством
production-готовности.

---

## Продукт

| Документ | О чём |
|---|---|
| [product/spec.md](product/spec.md) | Что система должна делать и почему так решили. Меняется только при изменении бизнес-решения |

## Техническое описание системы

| Документ | О чём |
|---|---|
| [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md) | Компоненты, зависимости, фактическая архитектура |
| [DATA_MODEL.md](DATA_MODEL.md) | Prisma/PostGIS, `CommercialMode`, финансовые инварианты, пробелы constraints |
| [REST_API.md](REST_API.md) | HTTP-маршруты, DTO, роли, ошибки, коммерческое поведение |
| [STATE_MACHINES.md](STATE_MACHINES.md) | Статусы и переходы срочных и плановых заявок |
| [WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md) | Handshake, realtime payload, правила режима заявки |
| [engineering/architecture.md](engineering/architecture.md) | Стек, карта модулей, сквозной поток заявки, разрешение гонок, джобы |
| [engineering/data-model.md](engineering/data-model.md) | Сущности и инварианты, таблица статусов рус↔enum |
| [engineering/api.md](engineering/api.md) | Справочник эндпоинтов по ролям, семантика кодов ответа |
| [engineering/development.md](engineering/development.md) | Запуск, env-переменные, тесты, ручная проверка |

## Безопасность и эксплуатация

| Документ | О чём |
|---|---|
| [SECURITY.md](SECURITY.md) | Реализованные меры, риски P0/P1, privacy, launch gate |
| [FILE_UPLOAD_SECURITY.md](FILE_UPLOAD_SECURITY.md) | Безопасность загрузки файлов |
| [RATE_LIMITING_AND_HEADERS.md](RATE_LIMITING_AND_HEADERS.md) | Ограничение частоты и security-заголовки |
| [SECURE_ENVIRONMENT.md](SECURE_ENVIRONMENT.md) | Секреты и конфигурация окружения |
| [SECURITY_AUDIT_AND_RETENTION.md](SECURITY_AUDIT_AND_RETENTION.md) | Аудит и политика хранения |
| [SECURITY_OBSERVABILITY.md](SECURITY_OBSERVABILITY.md) | Наблюдаемость |
| [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) | CI, накатывание миграций, деплой, бэкапы, мониторинг, откат |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Фактические тесты и недостающее покрытие |

## Состояние готовности

| Документ | О чём |
|---|---|
| [VERIFICATION_STATUS.md](VERIFICATION_STATUS.md) | Последний подтверждённый CI run и остающиеся ручные gates |
| [STATUS.md](STATUS.md) | Что реализовано, расхождения код↔спека, прод-блокеры, пределы архитектуры |

## Бесплатный пилот

| Документ | О чём |
|---|---|
| [FREE_PILOT_TECHNICAL_SPEC.md](FREE_PILOT_TECHNICAL_SPEC.md) | Требования первой бесплатной версии |
| [FREE_PILOT_IMPLEMENTATION_PLAN.md](FREE_PILOT_IMPLEMENTATION_PLAN.md) | План backend/frontend/data/testing/rollout |
| [FREE_PILOT_ROLLOUT.md](FREE_PILOT_ROLLOUT.md) | Выкатка |

Реализация — в PR #4 `feat/free-pilot-mode`.

**Ключевой принцип.** `MockPaymentProvider` и бесплатный пилот — разные режимы:
`PAID_MOCK` имитирует платную систему и создаёт финансовые записи; `FREE_PILOT`
не создаёт платежи, начисления, покупки кредитов и выводы. Номинальные суммы могут
храниться для аналитики, но выручкой не являются. Коммерческое поведение определяется
неизменяемым режимом конкретной заявки.

## Архив

| Каталог | О чём |
|---|---|
| [research/](research/) | Стратегический анализ на конкретную дату. Не редактируется: устаревшее заменяется новым датированным файлом |
| [superpowers/](superpowers/) | Дизайн-доки и планы этапов, пополняются SDD-циклом |
| Аналитические отчёты | «Аналитический отчёт по проекту MasterQala.kz», «Краш-тест MasterQala.kz для рынка Казахстана» |

---

## Требует сверки

Два набора документов писались независимо и описывают одно и то же по-разному.
Пары, которые нужно свести в один документ или явно разделить по назначению:

| | |
|---|---|
| `CURRENT_ARCHITECTURE.md` | `engineering/architecture.md` |
| `DATA_MODEL.md` + `STATE_MACHINES.md` | `engineering/data-model.md` |
| `REST_API.md` | `engineering/api.md` |
| `WEBSOCKET_EVENTS.md` | раздел «Realtime» в `engineering/architecture.md` |
| `VERIFICATION_STATUS.md` | `STATUS.md` |

Известное противоречие: `STATUS.md` фиксирует отсутствие CI и открытые проблемы
безопасности (`JWT_SECRET` с dev-фолбэком, `CORS origin: true`, rate-limit только на
SMS) — это верно **для `main`**, но соответствующая работа ведётся в открытых PR
(#4 — CI и режим пилота, #6–#13 — security). При сверке это надо учесть, иначе
документы будут противоречить друг другу, оставаясь каждый по-своему правдивым.

## Правило актуализации

Изменение Prisma-схемы, эндпоинта, Socket.IO payload, статуса, таймаута,
коммерческого поведения, privacy-правила или production-конфигурации считается
незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий
документ.
