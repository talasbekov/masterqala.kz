# Remaining operator contracts after dispute review

Read-only consolidation. Published dispute head is 2e84f1e21db58c80d034d0e4cd91c7df565160ed, preserving accepted local cc7261f. Exact-head CI38419869624 is green (105 operator fixtures, 201 API units, 265 PostGIS tests, 17 queue/guard tests, both migrations and all builds); local 105 operator fixtures and all aggregate frontend checks passed. This proposal does not change application behavior.

## Fixed coverage boundary

The 55-route checklist has 31 scoped implementations, 4 remaining public-site parity/localization surfaces, 4 unavailable service contracts and 16 dependency-gated routes. Scoped implementation means reviewed source/DOM/database evidence within documented limits, not completed native visual/live acceptance. All 55 still need permitted browser/live acceptance. Remaining original assets, site landing/directory, planned-v2, ADMIN/last-admin, functional support/feed, push/PWA, ordinary-callout decisions and general payment/outbox recovery remain open. Some older row labels in the inventory still describe intermediate local review states; the published checkpoints and exact CI links are authoritative.

Operator coverage: login, overview, masters, journal, orders, verification and disputes are now reviewed scoped work. The remaining existing routes are users, platform security observability, and archived withdrawals. User blocking is not ADMIN role management; observability is not account-security configuration.

## Source inspection

High-fidelity screenshot/context retrieved for Figma97:1903 (operator users) and97:2056 (operator security), file0yR2Q2iy5rT9qrW3M83L1N. Shared desktop navy224px sidebar/topbar,32px heading,16px body, white16-radius surfaces and labelled search remain reusable. Native mobile operator source and live geometry are unverified.

Users source displays name/phone search, masked contacts, roles, order counts and statuses. API GET /admin/users supports only name/phone substring search, returns every matching row without pagination, a localized role description, combined urgent client/master order count and isBlocked. It does not supply verification status, role filter or user detail. Do not fabricate those fields or label count as all planned-inclusive history.

Security source97:2056 displays account two-factor verification, critical-action confirmations, personal-data masking/export permissions and own access. Existing GET /admin/security/dashboard instead returns infrastructure readiness, queue/scanner dependencies, operational counters, 10 OPEN alerts and recent audit events. None of those prove the prototype 2FA/access/export settings. A truthful observability UI can reuse surface styles but cannot claim full source account-security parity.

## Proposed smallest batch: existing users, two tasks

1. Validated owner/search/read helper and local action controller. Keep 400ms search. No old-owner row flash, late responses, stale retained actions or overlapping reads. Preserve successful same-search rows with explicit stale indication; failed/malformed data must not be empty. Block requires existing nonempty trimmed reason; server rejects OPERATOR. Unblock also requires explicit confirmation of the exact selected user. Capture original verified row/read, action, draft revision and owner lifetime. Synchronous duplicate protection. No optimistic isBlocked change.
2. Actual route and three-language source-styled presentation. Accessible search/table/actions/confirmation, actual identity/count/raw unknown roles, masked phone display, real empty/error/retry. Preserve current-memory reason on Back. No role grant/edit, filter or verification badge. Use fixture-only mounted tests for both actions, owner ABA, old filtered handlers, unknown outcomes, failed reconciliation and languages; aggregate types/build and independent review before publication.

An uncertain block/unblock POST is locked by original owner and user identity across Back/selection changes. Reconcile via GET /admin/users without search, validate all rows and find that exact ID. Search does not match IDs, so never substitute an ID as search. An absent original user or failed/malformed GET stays unknown; it does not establish rollback/success. Fresh authoritative row may allow a deliberate next action according to actual isBlocked and unchanged server rules. No reload-safe identity or audit/outbox repair claim. No real block/unblock actions during implementation.

Backend evidence: admin-users.controller.ts uses JWT/RolesGuard OPERATOR only. AdminUsersService.block rejects existing role OPERATOR, sets isBlocked, disconnects sockets, then audits. Unblock clears block fields then audits. A post-update/audit failure can leave a committed account change; immediate blind repeat can duplicate audit/side effects. BlockUserDto requires string/nonempty, with no current maximum; do not invent a new business limit.

## Security must be a separate bounded review

Current dashboard poll is 15 seconds, visibility-gated but has no owner/read/action generations. Reuse the reviewed read helper, validate actual data, prevent overlaps/late owner results, use finite locale dates and actual raw rule/resource/error content. Preserve current OPERATOR role; no credentials, network settings, webhook configuration or permissions changes.

SecurityObservabilityService.transition supports OPEN→ACKNOWLEDGED and OPEN/ACKNOWLEDGED→RESOLVED; same requested status returns the existing row, RESOLVED rejects other transitions. Optional trimmed note maximum1000 remains. Assignment only permits an actual OPERATOR or null and rejects resolved alerts. Source does not authorize fabricated account controls.

Dashboard only includes 10 OPEN alerts. Losing an alert from that list cannot prove acknowledged/resolved or even existence. Existing GET /admin/security/alerts has all-status/cursor reads but no exact-ID endpoint; any recovery design must traverse/validate exact original ID and stay conservative if absent. Do not infer success from counters or similar rows. Its severity-first ordering and timestamp cursor need separate evidence before claiming complete pagination.

Manual delivery retry is non-idempotent: it creates a fresh UUID/dedupeKey MANUAL_RETRY row and queues delivery, requiring configured webhook. GET /alerts/:id/deliveries returns the latest100 actual rows but cannot identify a lost request as ours merely from a new row. A safety plan must show actual delivery state without claiming delivery, avoid automatic retries, and define honest unknown recovery. This is not repaired by existing urgent-order queue tests. Hold code until separate plan/review; never invoke actual external retry during implementation.

## Archived withdrawals remain held

Existing route resolves legacy PAID/FAILED outcomes and may alter funds/accounting. Product migration/archival decisions and financial boundaries are unresolved. Do not retrofit direct-payment settlement, transfer/retry or remove history. Existing page remains unverified, without real actions.
