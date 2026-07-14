# MasterQala.kz

Платформа вызова мастеров (Казахстан). Спека: `docs/project-spec.md`.

## Структура

- `apps/api` — NestJS + Prisma + PostgreSQL (API)
- `apps/web` — Vite + React PWA (клиенты, мастера, оператор)

## Запуск разработки

```bash
docker compose up -d                 # БД (5432) и тестовая БД (5433)
pnpm install
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ../..
pnpm --filter api start:dev          # API на :3000
pnpm --filter web dev                # Web на :5173
```

SMS-коды в dev пишутся в лог API (`SMS → +7…`). Оператор из сидов: `+77000000001`.

## Тесты

```bash
pnpm --filter api test               # unit
pnpm --filter api test:e2e           # e2e (нужна db_test на :5433)
```
