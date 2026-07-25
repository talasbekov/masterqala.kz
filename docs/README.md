# Документация MasterQala.kz

Один набор технической документации. Раньше их было два — `engineering/` свёрнут
в `technical/` 26.07.2026, дубли сведены.

## Источники истины

При расхождении документов приоритет имеют:

1. `apps/api/prisma/schema.prisma` и migrations;
2. контроллеры и сервисы `apps/api/src/**`;
3. `order.constants.ts` и `planned-order.constants.ts`;
4. realtime gateway/matching;
5. `apps/web/src/**`;
6. CI workflow и фактические результаты run;
7. [product/spec.md](product/spec.md) как продуктовая целевая модель.

## Статусы утверждений

- **реализовано** — подтверждено кодом, Prisma-схемой, миграцией или тестом;
- **проверено CI** — команда фактически завершилась успешно в GitHub Actions;
- **целевой gate** — обязательное изменение или проверка до production.

Реализация плюс зелёный CI без production-like smoke не считаются доказательством
production-готовности.

---

## С чего начать

1. [product/spec.md](product/spec.md) §1–§3 — что за продукт и как работают оба режима.
2. [STATUS.md](STATUS.md) — что из этого уже работает и где код расходится со спекой.
3. [technical/CURRENT_ARCHITECTURE.md](technical/CURRENT_ARCHITECTURE.md) — как устроено.
4. [technical/DEVELOPMENT.md](technical/DEVELOPMENT.md) — поднять у себя и потрогать.

## Продукт

| Документ | О чём |
|---|---|
| [product/spec.md](product/spec.md) | Что система должна делать и почему так решили. Меняется только при изменении бизнес-решения |
| [STATUS.md](STATUS.md) | Что реализовано, расхождения код↔спека, прод-блокеры, пределы архитектуры |

## Система

Указатель набора: [technical/README.md](technical/README.md).

| Документ | О чём |
|---|---|
| [technical/CURRENT_ARCHITECTURE.md](technical/CURRENT_ARCHITECTURE.md) | Компоненты, модули, оба режима, разрешение гонок, джобы, хранение файлов |
| [technical/DATA_MODEL.md](technical/DATA_MODEL.md) | Сущности, инварианты, коммерческий режим, пробелы схемы |
| [technical/STATE_MACHINES.md](technical/STATE_MACHINES.md) | Переходы статусов, финансовые эффекты, соответствие названий спеке |
| [technical/REST_API.md](technical/REST_API.md) | HTTP-контракт: маршруты, DTO, роли, ошибки |
| [technical/WEBSOCKET_EVENTS.md](technical/WEBSOCKET_EVENTS.md) | Handshake, payload событий, требования к клиенту |
| [technical/DEVELOPMENT.md](technical/DEVELOPMENT.md) | Запуск, env-переменные, тесты, ручная проверка |

## Безопасность и эксплуатация

| Документ | О чём |
|---|---|
| [technical/SECURITY.md](technical/SECURITY.md) | Реализованные меры, риски, privacy, launch gate |
| [technical/SECURE_ENVIRONMENT.md](technical/SECURE_ENVIRONMENT.md) | Секреты и конфигурация окружения |
| [technical/RATE_LIMITING_AND_HEADERS.md](technical/RATE_LIMITING_AND_HEADERS.md) | Ограничение частоты и security-заголовки |
| [technical/FILE_UPLOAD_SECURITY.md](technical/FILE_UPLOAD_SECURITY.md) | Проверка сигнатур, карантин, ClamAV, TTL |
| [technical/SECURITY_AUDIT_AND_RETENTION.md](technical/SECURITY_AUDIT_AND_RETENTION.md) | Аудит и политика хранения |
| [technical/SECURITY_OBSERVABILITY.md](technical/SECURITY_OBSERVABILITY.md) | Алерты, SLA, дашборд оператора |
| [technical/DEPLOYMENT_RUNBOOK.md](technical/DEPLOYMENT_RUNBOOK.md) | CI, миграции, деплой, бэкапы, откат |
| [technical/TESTING_STRATEGY.md](technical/TESTING_STRATEGY.md) | Покрытие и чего в нём нет |
| [technical/VERIFICATION_STATUS.md](technical/VERIFICATION_STATUS.md) | Что ещё должно быть проверено руками |

## Бесплатный пилот

| Документ | О чём |
|---|---|
| [pilot/FREE_PILOT_TECHNICAL_SPEC.md](pilot/FREE_PILOT_TECHNICAL_SPEC.md) | Требования первой бесплатной версии |
| [pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md](pilot/FREE_PILOT_IMPLEMENTATION_PLAN.md) | План backend/frontend/data/testing/rollout |
| [pilot/FREE_PILOT_ROLLOUT.md](pilot/FREE_PILOT_ROLLOUT.md) | Выкатка |

**Ключевой принцип.** `MockPaymentProvider` и бесплатный пилот — разные вещи:
`PAID_MOCK` имитирует платную систему и создаёт финансовые записи, `FREE_PILOT`
не создаёт платежей, начислений, покупок кредитов и выводов. Номинальные суммы
могут храниться для аналитики, но выручкой не являются. Поведение определяется
режимом, сохранённым в самой заявке, а не текущим значением env.

## Архив

| Каталог | О чём |
|---|---|
| [research/](research/) | Стратегический анализ на конкретную дату. Не редактируется: устаревшее заменяется новым датированным файлом |
| [superpowers/](superpowers/) | Дизайн-доки и планы этапов, пополняются SDD-циклом |

Три замороженных снимка на 19.07.2026, все — до Этапа 6 и клиента v2:

| Документ | О чём |
|---|---|
| [research/2026-07-19-strategy.md](research/2026-07-19-strategy.md) | Аудит кода, экономика, GTM, юридический контур. В шапке — список утверждений, которые уже неверны |
| [research/2026-07-19-project-analysis.md](research/2026-07-19-project-analysis.md) | Разбор репозитория и продукта, 281 источник |
| [research/2026-07-19-market-crash-test.md](research/2026-07-19-market-crash-test.md) | Проверка модели против Naimi, Kaspi и досок объявлений, 698 источников |

## Правило актуализации

Изменение Prisma-схемы, эндпоинта, Socket.IO payload, статуса, таймаута,
коммерческого поведения, privacy-правила или production-конфигурации считается
незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий
документ.
