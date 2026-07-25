# Документация MasterQala.kz

В каталоге два набора технической документации. Они **описывают разные состояния
кода** — это не дублирование по недосмотру, и сливать их до мержа PR #4 нельзя.

| Набор | Что описывает | Когда станет неактуальным |
|---|---|---|
| [engineering/](engineering/architecture.md) + [STATUS.md](STATUS.md) | Ветку `main` — то, что работает прямо сейчас | При изменении кода `main` |
| [technical/](technical/README.md) + [pilot/](pilot/) | Ветку `feat/free-pilot-mode` (PR #4) — режим бесплатного пилота | Станет описанием `main` после мержа PR #4 |

Набор `technical/` предупреждает об этом сам: «до объединения PR #4 ветка `main`
может не содержать часть описанных capability-флагов и поведения `FREE_PILOT`».
Конкретно: `CommercialMode`, `Order.commercialMode`, `GET /config/public`, поля
`freePilot`/`commercialMode` в WebSocket-payload и CI в `.github/workflows/`
**в `main` отсутствуют**.

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

## Продукт

| Документ | О чём |
|---|---|
| [product/spec.md](product/spec.md) | Что система должна делать и почему так решили. Меняется только при изменении бизнес-решения |

## Ветка `main` — актуальное состояние

| Документ | О чём |
|---|---|
| [STATUS.md](STATUS.md) | Что реализовано, расхождения код↔спека, прод-блокеры, пределы архитектуры |
| [engineering/architecture.md](engineering/architecture.md) | Стек, карта модулей, сквозной поток заявки, разрешение гонок, джобы, realtime |
| [engineering/data-model.md](engineering/data-model.md) | Сущности и инварианты, таблица статусов рус↔enum, риски схемы |
| [engineering/api.md](engineering/api.md) | Справочник эндпоинтов по ролям, семантика кодов ответа |
| [engineering/development.md](engineering/development.md) | Запуск, env-переменные, тесты, ручная проверка |

## Ветка PR #4 — бесплатный пилот

Указатель набора: [technical/README.md](technical/README.md).

| Раздел | Документы |
|---|---|
| Система | `CURRENT_ARCHITECTURE`, `DATA_MODEL`, `REST_API`, `STATE_MACHINES`, `WEBSOCKET_EVENTS` |
| Безопасность | `SECURITY`, `FILE_UPLOAD_SECURITY`, `RATE_LIMITING_AND_HEADERS`, `SECURE_ENVIRONMENT`, `SECURITY_AUDIT_AND_RETENTION`, `SECURITY_OBSERVABILITY` |
| Эксплуатация | `DEPLOYMENT_RUNBOOK`, `TESTING_STRATEGY`, `VERIFICATION_STATUS` |
| Пилот | [pilot/](pilot/) — техспека, план реализации, выкатка |

Все — в [technical/](technical/) и [pilot/](pilot/). Документы безопасности
соответствуют открытым PR #6–#13, каждый из которых приносит свой файл.

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
| [research/2026-07-19-market-crash-test.md](research/2026-07-19-market-crash-test.md) | Проверка модели на прочность против Naimi, Kaspi и досок объявлений, 698 источников |

Последние два извлечены из JSON-дампов сессий исследования, которые лежали в `docs/`
нечитаемыми машинными артефактами на 1,9 МБ.

---

## Что делать после мержа PR #4

Наборы перестанут описывать разные состояния, и пять пар нужно будет свести в один
документ каждую:

| | |
|---|---|
| `technical/CURRENT_ARCHITECTURE.md` | `engineering/architecture.md` |
| `technical/DATA_MODEL.md` + `STATE_MACHINES.md` | `engineering/data-model.md` |
| `technical/REST_API.md` | `engineering/api.md` |
| `technical/WEBSOCKET_EVENTS.md` | раздел «Realtime» в `engineering/architecture.md` |
| `technical/VERIFICATION_STATUS.md` | `STATUS.md` |

Что при этом стоит сохранить из каждого набора:

- из `engineering/` — разбор гонок и идемпотентности, таблица статусов рус↔enum,
  ссылки на строки кода, список расхождений код↔спека, хранение файлов, локальный запуск;
- из `technical/` — payload-структуры WebSocket-событий, детали DTO, безопасность,
  деплой и тестовая стратегия, финансовые инварианты режимов.

## Правило актуализации

Изменение Prisma-схемы, эндпоинта, Socket.IO payload, статуса, таймаута,
коммерческого поведения, privacy-правила или production-конфигурации считается
незавершённым, пока в том же workstream не обновлены код, тесты и соответствующий
документ.
