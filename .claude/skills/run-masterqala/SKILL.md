---
name: run-masterqala
description: Build, run, and drive MasterQala.kz (NestJS API + React PWA). Use when asked to start the app or dev servers, run its unit/e2e tests, log in as a client, create a test order, take a screenshot of the UI, or verify a change in the running app.
---

MasterQala.kz — монорепо: NestJS API (`apps/api`, :3000, префикс `/api/v1`) и
React 19 + Vite PWA (`apps/web`, :5180). Всё водится одним скриптом
`.claude/skills/run-masterqala/driver.mjs`: он поднимает оба сервера, логинит
клиента по OTP (код читается из лога API — SMS никуда не уходит) и снимает
скриншоты через headless Chrome по CDP. Зависимостей у драйвера нет, нужен
только Node ≥ 22 (глобальные `fetch` и `WebSocket`).

Все пути ниже — от корня репозитория (или ворктри: драйвер вычисляет корень от
своего расположения и работает в любом из них).

## Prerequisites

Ничего доустанавливать не пришлось: на машине уже есть `docker`, `pnpm@9.15`,
Node v24 и `/usr/bin/google-chrome` (драйвер сам находит `google-chrome`,
`chromium` или `chromium-browser`; путь можно задать через `MQ_CHROME`).

БД поднимается контейнерами из `docker-compose.yml` — PostGIS 16 на :5432
(dev) и :5433 (test).

## Setup

Одна команда: контейнеры БД, `apps/api/.env`, зависимости, Prisma-клиент,
сборка `packages/ui`, миграции и сиды.

```bash
node .claude/skills/run-masterqala/driver.mjs setup
```

`.env` драйвер создаёт сам из `apps/api/.env.example`, подставляя рабочий
`JWT_SECRET` (≥32 символов), `PORT` и `CORS_ORIGINS` под :5180. **Не копируйте
`.env` из другого чекаута** — старые копии не содержат переменных, которые
`config.getOrThrow` теперь требует, и API падает на старте.

## Run (agent path)

```bash
node .claude/skills/run-masterqala/driver.mjs up      # api :3000 + web :5180
node .claude/skills/run-masterqala/driver.mjs smoke   # сквозной сценарий по API
node .claude/skills/run-masterqala/driver.mjs shot /orders /tmp/shot.png
node .claude/skills/run-masterqala/driver.mjs down
```

`all` = `setup` + `up` + `smoke` + `shot` одной командой (проверено с нуля).

| команда | что делает |
|---|---|
| `setup` | docker БД (`-p masterqalakz`), `.env`, `pnpm install`, prisma generate/migrate deploy/seed, сборка ui |
| `up` | запускает api и web в фоне, ждёт `/api/v1/health` и корень web |
| `down` | гасит обе группы процессов по pid-файлам |
| `logs [api\|web] [N]` | хвост лога сервера |
| `login [phone]` | OTP-логин клиента, печатает `{accessToken,user}`, кэширует сессию |
| `smoke` | health → `/config/public` → `/categories` → логин → `POST /planned-orders` → проверка в `/planned-orders/mine` |
| `test` | unit-тесты API |
| `e2e` | e2e-тесты API (сам убирает `.env` на время прогона, см. Gotchas) |
| `shot [route] [out.png]` | headless Chrome 390×844: логин, скриншот и `document.body.innerText` |
| `all` | setup + up + smoke + shot |

Артефакты: логи и pid-файлы в `/tmp/masterqala-run/` (`api.log`, `web.log`,
`session.json`), скриншот по умолчанию — `/tmp/masterqala-run/masterqala.png`.

Переменные окружения драйвера: `MQ_PHONE` (номер клиента, дефолт
`+77010009911`), `MQ_API_PORT`, `MQ_WEB_PORT`, `MQ_RUN_DIR`, `MQ_CDP_PORT`,
`MQ_CHROME`, `MQ_COMPOSE_PROJECT`.

Вывод рабочего прогона:

```
✓ /health
✓ /config/public → {"commercialMode":"FREE_PILOT","paymentsEnabled":false,…}
✓ /categories → 6 шт.
✓ логин +77010009913 → role=CLIENT
✓ плановая заявка c5175cdd-… (PUBLISHED)
✓ заявка видна в /planned-orders/mine
✓ smoke пройден
```

### Свои сценарии поверх драйвера

Токен для ручных запросов:

```bash
TOKEN=$(node .claude/skills/run-masterqala/driver.mjs login | sed -n 's/.*"accessToken": "\(.*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3000/api/v1/planned-orders/mine
```

## Run (human path)

```bash
pnpm --filter api start:dev   # :3000, префикс /api/v1
pnpm --filter web dev         # :5173 — занят, если рядом крутится accr-frontend
```

Ctrl-C для остановки. Для агента бесполезно: логин требует OTP-кода из лога,
поэтому проще `driver.mjs up` + `driver.mjs login`.

## Test

```bash
node .claude/skills/run-masterqala/driver.mjs test   # 34 сьюта, 146 тестов — все зелёные, ~8 с
node .claude/skills/run-masterqala/driver.mjs e2e    # 52 сьюта, 208 тестов — все зелёные, ~150 с
```

e2e требуют поднятой `db_test` на :5433 (её поднимает `setup`).

## Gotchas

- **`pnpm --filter api test:e2e` напрямую валит 34 теста.** `ConfigModule`
  читает `apps/api/.env` даже при `NODE_ENV=test`, и dev-овский
  `COMMERCIAL_MODE=FREE_PILOT` отключает цены, оплаты и лид-кредиты — тесты
  ждут `PAID_MOCK` и получают нули (`Expected: 1200 / Received: 0`,
  `Expected: "SUCCEEDED" / Received: "FAILED"`). Экспорт
  `COMMERCIAL_MODE=PAID_MOCK` не спасает: тогда падает
  `commercial-mode.e2e-spec`, который сам выставляет `FREE_PILOT`. В CI файла
  `.env` просто нет — `driver.mjs e2e` воспроизводит это, временно убирая файл
  и возвращая его после прогона.
- **`docker compose up -d` из ворктри поднимает ВТОРУЮ пару контейнеров.**
  Имя compose-проекта берётся от имени каталога (`sad-haibt-0f77d1`), и старт
  падает с `Bind for 0.0.0.0:5432 failed: port is already allocated`. БД одна
  на все ворктри — только `docker compose -p masterqalakz up -d` (драйвер так
  и делает).
- **3 OTP-кода на номер за 10 минут** (`SEND_WINDOW_MS`/`MAX_SENDS_PER_WINDOW`
  в `apps/api/src/auth/auth.service.ts`), дальше 429. Драйвер кэширует сессию
  в `/tmp/masterqala-run/session.json` и переиспользует её; если всё же
  упёрлись — возьмите другой номер через `MQ_PHONE=+77010009912`.
- **Код из лога нельзя выдёргивать наивным `/(\d{6})/`.** Nest печатает в
  начале строки шестизначный pid, и регексп ловит его вместо кода → «Неверный
  код». Нужен якорь: `/подтверждения:\s*(\d{6})/`.
- **Срочные заявки (`POST /orders`) в чистой БД дают 422 «Мастеров рядом
  нет».** Нужен `MasterProfile` со статусом ACTIVE, категорией и
  `MasterPresence.isOnline` с гео-точкой в радиусе (пишется только сырым SQL —
  Prisma не умеет в PostGIS geography; рецепт — `apps/api/test/helpers.ts`,
  `createActiveMaster`/`setMasterOnline`). Плановые заявки такого гейта не
  имеют, поэтому smoke ходит через `POST /planned-orders`.
- **Роли `MASTER` не существует.** `UserRole` — только `CLIENT | OPERATOR`;
  мастером пользователя делает наличие `MasterProfile`.
- **`prisma migrate dev` в неинтерактивной оболочке отказывается работать**
  («Prisma Migrate has detected that the environment is non-interactive») —
  только `migrate deploy`.
- **Порт API один на все ворктри** (`PORT` из `.env`, дефолт 3000): второй
  инстанс не поднять. `driver.mjs up` замечает уже слушающий API и
  переиспользует его — но тогда `login` не найдёт лог (`/tmp/masterqala-run/api.log`
  пишет только сам драйвер), так что чужой API лучше сначала погасить.
- **:5173 на этой машине занят** контейнером `accr-frontend`, поэтому web
  ходит на :5180, и этот порт прописан в `CORS_ORIGINS`.
- **`preview_screenshot`/`preview_click` из preview-тула здесь ненадёжны** —
  скриншоты отваливаются по таймауту. `driver.mjs shot` берёт картинку
  напрямую по CDP и работает.

## Troubleshooting

- **`API не запущен: Config validation error` / падение сразу после старта**:
  в `.env` нет переменной, которую требует `config.getOrThrow`. Удалите
  `apps/api/.env` и выполните `driver.mjs setup` — он сгенерирует полный файл.
- **`verify-code → 400 {"message":"Неверный код"}`**: код взят не из той
  строки лога (см. gotcha про pid) или истёк — TTL 5 минут, 5 попыток.
- **`request-code → 429 Слишком много запросов кода`**: лимит на номер.
  `MQ_PHONE=+7701000991X` с другой цифрой.
- **`таймаут ожидания API /health`**: смотрите `driver.mjs logs api 60` —
  чаще всего не поднята БД (`docker compose -p masterqalakz up -d`) или порт
  3000 занят чужим процессом.
- **`Bind for 0.0.0.0:5432 failed: port is already allocated`**: запущен
  compose из другого каталога/ворктри. Погасите лишний проект
  (`docker compose down` в нём) и поднимайте с `-p masterqalakz`.
