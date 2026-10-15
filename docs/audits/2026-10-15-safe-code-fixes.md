# Bounded audit corrections, 15 October 2026

Base: `d1c45b84292ce43a367eebb5161d72743f08e75a`, draft PR 38. These corrections do not activate the new platform-payment model or change historical tariffs, saved commercial modes, roles, provider configuration or existing planned-order rules.

## Package 1: ERROR withdrawal reconciliation

Resolution now performs a conditional `ERROR` transition in the same transaction as the balance release and audit. Only the winning transition may restore the reserved amount. A competing or repeated resolution receives 409 and cannot overwrite the winning outcome or create another balance increment/audit. A repeat after an uncertain response must read the actual withdrawal status; it is not a new payout.

Three deterministic unit regressions first reproduced two successful resolutions on the old implementation, then passed after the fix. Real-database tests force both requests to read ERROR and cover FAILED/FAILED, PAID/FAILED, FAILED/PAID, lost-response retries and audit-failure rollback. These tests are included in the existing E2E CI command. They are not proof of live provider reconciliation.

## Package 2: unavailable agreed amounts

An absent or malformed quote total is displayed as unavailable, never substituted with zero. A genuine zero remains a known displayed amount. RU/KK/EN client/mobile/desktop and master summaries preserve the distinction. Quote approval, work start and result acceptance are unavailable until the amount can be read. Existing help, contact and read recovery remain accessible.

The direct-order server validates all stored quote components and the integer total before a new approval, start or acceptance transition. It rejects null, missing, non-finite, negative or overflowing values. Already completed idempotent transitions retain their existing behavior. This is a completeness guard for the existing direct-settlement contract, not evidence of platform payment.

## Verification checkpoint

Pinned Node 22.12.0 / pnpm 9.15.0. A fresh clone was taken at the verified base; the earlier dirty checkout was untouched. The lockfile matched the available local dependency installation, which was copied into this isolated checkout because the offline package store was incomplete.

Passed locally:
- Shared UI build and 161 tests (including nine locale/amount regressions)
- API build, all 42 unit suites / 211 tests, and full API TypeScript (including E2E sources)
- Client 127, Vite web 81, master 80, operator 142 and site 29 fixture tests
- Shared UI, API and all five frontend TypeScript checks; Vite compilation is covered by its production build
- Client and Vite production builds
- `git diff --check`

Master and operator production builds subsequently passed. The existing Vite large-chunk warning remains.

Blocked locally: the PostgreSQL/PostGIS test server is absent (localhost:5433 refuses connections), with no local PostgreSQL/container executable available. The targeted database E2E command was attempted and failed at application initialization, before test behavior could execute. Database concurrency/rollback, migrations and real queue/restart validation are therefore NOT claimed passed. The API-backed site production build also requires that service. Exact-head CI with its isolated database services remains required before readiness claims.

No browser/live-provider/SMS/GPS/native-device acceptance was performed. KZ wording requires native-language review. No push, merge or deployment was performed in this checkpoint.

## Next bounded package

Add an explicit, default-legacy planned lifecycle discriminator. Reserve the new platform generation without activating its creation. Legacy mutation paths/workers must not handle the reserved generation. Its free preliminary bids, inspection/final quote, payment-bound separate start and explicit acceptance require a separate complete contract; existing DIRECT_PAYMENT rows must not silently be reinterpreted as the new model. New rates, timeouts, providers, GPS evidence and territory privileges remain unresolved product/integration gates.

## Review correction: authoritative quote serialization

Independent review found that the existing order serializer still summed missing components as zero before the UI received them. A new shared server helper now returns null unless all components and the positive quote version are valid. Detail, mutation returns, client lists, active-master reads and operator detail use that rule; the server transition guard reuses the same component validator. Zero remains valid, overflow does not. Desktop component rows also reject missing/malformed callout/material values rather than formatting null as zero or showing a partial subtotal.

New read regressions reproduced 6,000 from a null work amount and an overflowing total before the correction. They cover each component across four real service readers and operator detail. An E2E assertion verifies the actual HTTP null response when the isolated database is available.

Corrective checkpoint: 162 shared UI tests and 219 API units / 43 suites pass. API full TypeScript/build and all five application fixture suites pass again (127/81/80/142/29). Earlier frontend production builds preceded this final serialization/component-row correction; final exact-head CI must repeat them. Database E2E remain blocked as above.
