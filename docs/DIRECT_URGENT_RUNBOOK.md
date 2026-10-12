# Reviewing direct urgent lifecycle v2

No production deployment or merge is performed by this branch. This increment covers urgent orders; the remaining plan is documented in `docs/superpowers/plans/2026-10-13-figma-mvp-alignment.md`.

## Local environment

Use Node 22.12+ and the repository-pinned pnpm 9.15.0. Follow existing README/docker instructions for PostgreSQL/PostGIS and supporting services. Copy `apps/api/.env.example` into your private environment configuration; never commit real credentials. Required DATABASE_URL points to PostgreSQL with PostGIS. Production integrations, SMS, scan storage and queue must be configured according to README; examples/mock SMS are not real integrations.

```sh
corepack pnpm@9.15.0 install --frozen-lockfile
corepack pnpm@9.15.0 --filter api exec prisma migrate deploy
corepack pnpm@9.15.0 --filter @masterqala/ui build
corepack pnpm@9.15.0 --filter api start:dev
```

In separate terminals use the existing app dev commands (`--filter client dev`, `--filter master dev`, `--filter web dev`, `--filter operator dev`). Default ports are client4200/master4300/web5173/operator4400/API3000. Point app API URLs at the running API and allow the local origins in API CORS.

For isolated review only, `COMMERCIAL_MODE=DIRECT_PAYMENT` creates urgent v2 orders with direct payment; the default stays FREE_PILOT pending ordinary callout tariff agreement. Do not expose planned orders as the new direct lifecycle. Changing the current environment mode does not rewrite stored modes/history.

Migrations are additive: version1 remains on old urgent orders; new direct urgent orders stamp lifecycle2/SEQUENTIAL. Quote consent is versioned. PRICE_APPROVED remains active until the assigned master explicitly starts. DONE remains occupied until the client accepts. Review pending cron/queue operation separately: tests use PGBOSS_DISABLED and do not establish production recovery latency. Recovery cron can introduce up to a minute of dispatch delay after outage.

## Verification

```sh
corepack pnpm@9.15.0 --filter api run test --runInBand
corepack pnpm@9.15.0 --filter api test:e2e
corepack pnpm@9.15.0 --filter api build
corepack pnpm@9.15.0 --filter web build
```

The e2e suite resets a **test** database. Do not point test DATABASE_URL at real data. CI runs PostGIS16, migrations, full API unit/e2e and all app builds.

For browser contract checks install Playwright in a separate QA environment (no runtime dependency) and make its module available as `PLAYWRIGHT_MODULE`; use its Chromium or `CHROMIUM_PATH`. With the appropriate real dev app running:

```sh
QA_BASE_URL=http://127.0.0.1:5173 node scripts/qa/direct-client-ui.cjs
QA_BASE_URL=http://127.0.0.1:4200 QA_WIDTHS=1280,1440,1920 node scripts/qa/direct-client-ui.cjs
QA_BASE_URL=http://127.0.0.1:4300 node scripts/qa/direct-master-ui.cjs
QA_BASE_URL=http://127.0.0.1:4300 node scripts/qa/offer-recovery-ui.cjs
```

`QA_SCREENSHOTS_DIR` optionally saves images. These scripts substitute explicit API fixtures. The offer script also starts a fixture Socket.IO server on port3000; run it without the real API on that port. They do not prove a two-role journey against a live database. Server e2e checks exercise real PostgreSQL and authorization separately.

Review queue/SMS/HTTPS/real-device behavior, backups, logs, monitoring and secrets before an operational launch. UI/build success alone does not establish production readiness. Roll back application version through the deployment system without deleting existing order/financial data; obtain a tested DB backup before any production migration. No destructive down migration is supplied.
