# Planned generation boundary: inactive reservation

Base of this package: `5be6e7d1a9eb63dd43db12b48b64e03c8991de41`.

## What this package does

Adds a persisted `PlannedLifecycleModel` enum and `PlannedOrder.lifecycleModel` with the unambiguous default `LEGACY`. The only other enum value is `PLATFORM_V1_RESERVED`, explicitly unsupported by all current planned workflows. Existing rows keep their commercial mode, prices, status, selected bid, credit ledger and timestamps. There is no migration from historical orders into the new business model.

The current create service explicitly writes LEGACY. The request DTO exposes no lifecycle selector; untrusted extra request fields cannot activate the reserved model. No route, worker or feature flag creates the new generation. Direct database construction of reserved rows exists only in isolated test fixtures.

Old order mutations require an exact LEGACY match; the shared transition compare-and-swap also includes that predicate. Both free and paid legacy bid paths check the persisted model before creating bids or touching credits. Old auto-close, confirmation-timeout and expiry workers ignore reserved/unknown models. Existing legacy DIRECT_PAYMENT / FREE_PILOT / PAID_MOCK behavior remains unchanged, including historical lead-credit rules and auto-close.

Current client/feed/operator readers exclude reserved rows or reject their detail; legacy realtime status emission is suppressed. Legacy disputes (including evidence/counter-statements/resolution) and review submission reject reserved rows, so they cannot become an alternate route to old sanctions, auto-close or review-window rules. This does not grant any new access.

Missing or unknown lifecycle markers are not interpreted as LEGACY. Production rows are non-null and get the database default; test doubles must represent this persisted field explicitly.

## What this package does NOT implement

It is not the new planned feature and does not fix its requirements by changing historical DIRECT_PAYMENT behavior. Reserved rows cannot accept any bid, paid or free. In particular, this package does not claim that a free new planned bid can already be submitted, or that a new planned order can already complete.

Before activation, a separate implementation must provide:
- Free preliminary replies with explicit scope/conditions, no SPEND or REFUND credit operations
- Versioned assignment and stale-event protection for reselection; preserve task/date after master cancellation and retain client choice
- Inspection, final quote, explicit consent and verified platform payment as separate facts
- Separate start after the current final quote/payment gates; old on-site must not start the new workflow
- Explicit client acceptance; silence/old auto-close/dispute resolution must not invent acceptance
- Independent supplements, purchase receipts/store-money accounting and supported financial reconciliation
- Approved configurable rules, actual providers and operational/permission decisions where required

No new rates, thresholds, deadlines, GPS evidence rules, payment provider, ADMIN role or territory access are introduced. `PLATFORM_V1_RESERVED` must remain unused in operational data until all those gates and the full negative/concurrent/restart test matrix are met. All running API/worker versions must understand the discriminator before any later activation; applying this schema alone does not make an older executable safe for new-model rows.

## Migration and validation

Migration: `20261015000100_planned_lifecycle_boundary/migration.sql`.
It contains only CREATE TYPE and ADD COLUMN NOT NULL DEFAULT LEGACY. Prisma schema validation passes. Offline `prisma migrate diff --from-schema-datamodel <base-schema> --to-schema-datamodel prisma/schema.prisma --script` independently generated the same two statements.

No migration was applied to any live or local database in this task. The local PostgreSQL/PostGIS server is unavailable. A schema diff is not migration-runtime verification or evidence about lock duration on production-sized data. A seeded old-schema migration rehearsal and real isolated PostGIS tests are still required before deployment.

## Tests

Before implementation, the new boundary unit suite reproduced 17 failing cases; the preserved legacy behavior control passed. After implementation, the boundary has 21 passing tests: unknown/missing/reserved markers, a reserved model observed after an earlier LEGACY commercial read, all seven existing transitions, three old workers, transition predicates, current creation, preserved legacy arrival/auto-close, dispute and review bypass protection. The existing commercial suite separately verifies historical paid DIRECT_PAYMENT / PAID_MOCK delegation and FREE_PILOT no-credit behavior.

Real-database E2E source covers enum default/current creation, malicious selector input, credit balances/ledger, old on-site/start and workers, dispute resolution, and filtered client/feed reads. It is compiled but cannot execute locally without the isolated database. No runtime migration/concurrency/restart or live browser/provider readiness is claimed.

Final local package checkpoint: all 44 API unit suites / 241 tests pass; full API TypeScript (including E2E files) and API build pass. Read-only ESLint passes on the five newly added server helper/test files after formatting those files. Existing compact legacy files were not mass-reformatted. Schema validate, schema-only migration diff and git diff whitespace checks pass. Database execution remains blocked.

## Read/matching follow-up from independent review

The dashboard planned/dispute counts, master/bid completed counts, urgent acceptance's planned busy check, and sequential matching's planned busy SQL now explicitly filter LEGACY. They cannot absorb inactive reserved fixtures into existing metrics or dispatch decisions. Four assertions failed against the earlier implementation and pass after the predicates were added; all 45 API unit suites / 244 tests pass. This does not make a mixed operational rollout safe: future activation must implement cross-model occupancy/reconciliation rather than merely remove these filters. Reserved rows remain prohibited in operational data. Real PostGIS matching and migration behavior still await CI.
