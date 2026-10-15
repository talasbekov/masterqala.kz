# Reviewing direct urgent lifecycle v2

No production deployment or merge is performed by this branch. This increment covers urgent orders; the remaining plan is documented in `docs/superpowers/plans/2026-10-13-figma-mvp-alignment.md`.

## Local environment

Use the CI-verified Node 22.12.0 and repository-pinned pnpm 9.15.0. Follow existing README/docker instructions for PostgreSQL/PostGIS and supporting services. Copy `apps/api/.env.example` into your private environment configuration; never commit real credentials. Required DATABASE_URL points to PostgreSQL with PostGIS. Production integrations, SMS, scan storage and queue must be configured according to README; examples/mock SMS are not real integrations.

```sh
corepack pnpm@9.15.0 install --frozen-lockfile
corepack pnpm@9.15.0 --filter api exec prisma migrate deploy
corepack pnpm@9.15.0 --filter @masterqala/ui build
corepack pnpm@9.15.0 --filter api start:dev
```

In separate terminals use the existing app dev commands (`--filter client dev`, `--filter master dev`, `--filter web dev`, `--filter operator dev`). Default ports are client4200/master4300/web5173/operator4400/API3000. Point app API URLs at the running API and allow the local origins in API CORS.

For isolated review only, `COMMERCIAL_MODE=DIRECT_PAYMENT` creates urgent v2 orders with direct payment; the default stays FREE_PILOT pending ordinary callout tariff agreement. Do not expose planned orders as the new direct lifecycle. Changing the current environment mode does not rewrite stored modes/history.

Migrations are additive: version1 remains on old urgent orders; new direct urgent orders stamp lifecycle2/SEQUENTIAL. Quote consent is versioned. PRICE_APPROVED remains active until the assigned master explicitly starts. DONE remains occupied until the client accepts. The ordinary unit/HTTP E2E job uses PGBOSS_DISABLED=1. A separate isolated real-queue job enables full AppModule workers; its evidence and limits are listed below. Production recovery latency and general payment/outbox recovery remain unverified. Recovery cron can introduce up to a minute of dispatch delay after outage.

## Verification

```sh
corepack pnpm@9.15.0 --filter api run test --runInBand
corepack pnpm@9.15.0 --filter api run test:e2e
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


## Verified continuation checkpoint — 2026-10-13 16:25 UTC

Draft PR38 head `6399efdb4fafe17c11eea92edaf650da85db334d` has exact-tree equality with reviewed local `83cd55e2` and green [CI 38429305501](https://github.com/talasbekov/masterqala.kz/actions/runs/38429305501): 152 shared UI, 127 Next client, 81 Vite, 80 master, 142 operator and 29 site fixtures; 201 API units, 265 PostGIS E2E, 17 isolated queue/guard tests; both migrations and all five application builds. PR37 remains `4060ba9`. This is a dated code/CI checkpoint, not native/live/production readiness.

Four real queue cases exercise keyed HTTP dispatch to the nearest eligible master; actual 30-second expiry with distinct duplicate deliveries completing; a captured exact persisted timeout job surviving stop/restart; and the actual minute recovery cron repairing committed SEARCHING without a dispatched job while replay preserves identity. Thirteen additional guard/observer tests cover safety and observation. The expiry/restart cases deliberately omit only the recovery cron so timeout-handler causality is observable; the separate minute-cron case retains actual scheduling. No production scheduling/configuration is changed. See `docs/audits/2026-10-13-urgent-queue-integration-proof.md`.

These tests can reset data/jobs **only** in the dedicated disposable loopback `5434/masterqala_urgent_queue_ci` database. The test guard requires `NODE_ENV=test` and `ALLOW_ISOLATED_QUEUE_TESTS=1`, checks the database identity before cleanup, and enables workers before imports. Never substitute a shared/deployed database or bypass that guard. Follow the existing isolated CI service/migration/`pnpm --filter api run test:queue:e2e` workflow; do not run its destructive cleanup against real data. Queue identity and these four recovery cases do not prove SMS, production failure latency, payment/outbox recovery or full two-role browser acceptance.

## Public-site local review

The existing site runs on port4100. In a private development environment set `API_URL=http://localhost:3000/api/v1`, `APP_URL=http://localhost:4200` for Next client (or `http://localhost:5173` for Vite), and `MASTER_APP_URL=http://localhost:4300`. These are the repository's local dev ports, not guessed production hosts. Production client/master base URLs must be explicitly configured; invalid/missing destinations have an honest unavailable state. Optional configured CONTACT_PHONE/CONTACT_EMAIL are displayed without a service-hours/intake guarantee. Do not commit credentials or private environment files.

```sh
corepack pnpm@9.15.0 --filter site run dev
corepack pnpm@9.15.0 --filter site run test
corepack pnpm@9.15.0 --filter site run build
```

Site build requires the running API for category static-param collection. The frozen local production build compiled and type-checked but failed collection with ECONNREFUSED because that local API was absent; this historical failure is retained. The exact published checkpoint's CI then started the real API and passed the full site build. Canonical mq_locale cookie/mq.locale/query dialog, validated actual categories, true missing-slug404 versus outage/malformed retry, configured destinations and all visible existing public copy have fixture coverage. Backend category names remain actual content.

The fixed inventory is **37 scoped route implementations, 4 missing general support/notification contracts, 14 dependency-gated routes =55**. Original homepage photos/split layout, directory/API gaps and every route's native/live acceptance remain open. No new independent features are planned beyond this checkpoint; use `docs/audits/2026-10-13-independent-work-boundary.md` for decisions and permitted-access prerequisites.
