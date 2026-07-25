# MasterQala.kz

Платформа вызова мастеров на дом (Казахстан, пилот — Астана). Два режима:
**«Сейчас»** — срочный вызов с волновым подбором ближайшего мастера, и
**«Запланировать»** — плановая заявка со ставками мастеров.

Мастер оставляет себе 100% стоимости работ: платформа зарабатывает на сервисном сборе
с выезда (срочные) и lead-кредитах за отклик (плановые), а не на комиссии с работ.

## Структура

```
apps/api      NestJS + Prisma + PostgreSQL/PostGIS + pg-boss + Socket.IO
apps/web      React 19 + Vite, PWA — клиент, мастер и оператор в одном приложении
packages/ui   дизайн-система: токены и компоненты
docs/         документация
```

## Быстрый старт

```bash
docker compose up -d                  # БД :5432 и тестовая БД :5433
pnpm install
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ../..

pnpm --filter api start:dev           # API на :3000, префикс /api/v1
pnpm --filter web dev                 # Web на :5173
```

SMS-коды в dev пишутся в лог API строкой `SMS → +7…`. Оператор из сидов —
телефон из `OPERATOR_PHONE`.

```bash
pnpm --filter api test                # unit
pnpm --filter api test:e2e            # e2e, нужна db_test на :5433
```

Подробнее — [docs/technical/DEVELOPMENT.md](docs/technical/DEVELOPMENT.md).

## Документация

| | |
|---|---|
| [docs/README.md](docs/README.md) | Карта документации — начните отсюда |
| [docs/product/spec.md](docs/product/spec.md) | Что система должна делать и почему так решили |
| [docs/STATUS.md](docs/STATUS.md) | Что уже работает, чего нет, где код расходится со спекой |
| [docs/technical/](docs/technical/CURRENT_ARCHITECTURE.md) | Архитектура, модель данных, API, локальная разработка |
