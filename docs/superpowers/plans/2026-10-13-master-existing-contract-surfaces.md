# Master Existing-Contract Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with TDD; freeze each task for independent review, combine publication only after accepted aggregate checks.

**Goal:** Make existing master dashboard/presence/application UI owner-safe and truthful in RU/KK/EN without changing eligibility, KYC, payments or review sequencing.

**Architecture:** Existing API gains an Error subclass carrying HTTP status while preserving messages/payloads. Master owner-scoped reads reuse the shared reviewed resource controller; presence state lives in a keyed owner session with guarded async/timer/socket/action callbacks. Existing master routes consume those controllers and canonical shared locale presentation, with no new routes/endpoints/provider or persisted sensitive draft.

**Tech Stack:** Existing React19/Next15/TypeScript/shared controls, Node22.12.0/pnpm9.15.0, mounted actual route/transport fixtures.

**Spec:** docs/audits/2026-10-13-master-nonorder-mapping.md; parent approved its bounded three-task scope.

## Global Constraints

- No server/schema/KYC/permission/payment/eligibility/review-stage changes; existing master AuthProvider roles and destinations preserved.
- Application POST stays current exact DTO (including requiredIIN) and immediate PENDING_REVIEW semantics; upload allowed statuses/types/size/scanning/CDR remain server-authoritative.
- IIN/files stay current form memory only; owner/logout/unmount clears ownership. No real sensitive uploads in tests.
- Presence emits remain explicit existing intents. No automatic geolocation on render/reconnect/GET; late geo must not re-enable after Offline/account change.
- Online flag is requested local mode with separate connection uncertainty, not proof of eligibility/delivery.
- Actual names/categories/district/status/comments/stats only; no accepted-income substitution, sample distance/price, master history/inbox/contact or ACTIVE save button.
- Original planned tab/legacy lifecycle remain untouched; source assets/native geometry/full shell and missing contracts remain explicit.

## Review Focus

- A→B→A retained reads/actions, old responses and logout/unmount must never render previous-owner identity/IIN/client offers or navigate the new owner.
- Application404 means absence;500/network/malformed response must remain errors with retry and successful source data retained.
- Explicit Offline must invalidate pending initial/interval geo callbacks; repeat Online cannot leak duplicate intervals/listeners or requests.
- Upload/save duplicates and stale completions must not clear another owner/newer draft; uncertain failures preserve user input and require authoritative retry.
- Source labels cannot imply verified documents, paid income, support delivery or eligibility unsupported by actual returned status/contract.

### Task1: Owner, connection and async lifetime safety

Files: master lib/api.ts, masterApplication.ts, masterPresence.tsx, new lib/useMasterDashboardData.ts; minimal dashboard/application error/controller adapters; components/AuthGuard.tsx only if no-user rendering regression reproduces. New mounted test/presence-owner.test.mjs, dashboard-owner.test.mjs, auth-guard.test.mjs and existing test bundle entries.

Interfaces: ApiError extends Error with readonly status:number; existing api/options/message unchanged. fetchApplication returns null only for status404, otherwise rejects. useMasterDashboardData({ownerId}) exposes independently owned application/stats/active order data, loading/errors/freshness/retry without writes. Application and active response adapters validate required IDs/status/arrays instead of fabricating absence. MasterPresenceProvider outer Auth owner keys an internal session; context adds availabilityPending for explicit geo request, retains existing actions/offer fields. Existing socket reset/get path reconnects for current owner only; no new credential state.

- [x] Write RED actual transport tests:404 absence vs500/network/malformed; A→B→A GET/retained retry/socket callbacks; valid active/stats source survives other failure; logout/unmount/failed GET recovery.
- [x] Write RED actual mounted presence tests: no owner/no socket/GET/geo; owner switch/unmount cleanup; pending offer/accept/decline response cannot update/navigate another owner; new current action succeeds; duplicate accept/Online guards; initial and interval late geo after Offline/account switch cannot emit/update; one exact interval/listener, no GPS on render/reconnect/foreground; reconnect pending-offer GET still works without GPS.
- [x] Write protected-child logout test. If old checked flag exposes children, require current user before rendering while retaining existing /login redirect and role semantics.
- [x] Implement minimal guards and per-source error/status adapters. Preserve presence intents, POST bodies/endpoints,30-second location cadence and current pending-offer reconciliation. Add minimal read-error retry to affected existing routes so changed fetchApplication cannot leave an unhandled loading dead end; localization/presentation follows later tasks.
- [x] Run focused/full master/shared tests/types; freeze for parent review before Task2.

### Task2: Truthful source-backed urgent dashboard

Files: master app/(app)/page.tsx and small presentational helpers/shared locale copy; corresponding actual dashboard route tests and audit/inventory. Existing PlannedFeedView unchanged.

Interface: consume Task1 owner-scoped data plus current presence context; existing direct work links and real offer fields only. Display completedCount/rating with finite/null validation, omit accepted-income card until its contract exists. Current request mode and connection status remain distinct. Any actual offer action retains current owner/deadline/busy/offline guards from Task1.

- [x] Write RED state×locale/source tests: no application/pending/needs-info/rejected/ACTIVE, direct current work, online-request/offline/disconnected/geo denied, no actual offer, actual offer and missing/long fields. No fake income,2500travel,2.4km,verified eligibility/support or history target.
- [x] Implement scoped mobile24px soft cards/56px actions and desktop actual-data main/aside composition using existing tokens/components. Preserve real application/current-order links and existing planned tab behavior; no new directory/history/feed/intake contract.
- [x] Mount actual route with API/socket/geolocation fixtures: all locales, owner switch/errors/retry, correct encoded links, no location/API mutation from render/tab/navigation, existing planned tab source retained.
- [x] Full relevant suites/types/builds; freeze separate Task2 review checkpoint.

### Task3: Existing application/profile/document UI

Files: master app/(app)/become-master/page.tsx, existing masterApplication helper and small owner-safe controller/presenters as needed; shared copy only; actual mounted application tests and audit/inventory. No new application endpoints/routes.

Interface: current exact submitApplication values and uploadApplicationDocument type/File pass through unchanged. ACTIVE shows actual read-only fullName/experience/district/categories; submit/resubmit/upload availability follows current server statuses. Returned profile approval and per-document scan/CDR statuses are separate facts. Status refresh is GET-only, with current-owner/write generations and preserved same-owner dirty inputs.

- [x] Write RED mounted owner/write regressions: old-owner POST/upload completion, invalidated newer local editor, duplicate submit/upload, read error/input retention, cancel/back, locale-only edits, current404/new form vs500/error, status guards. All files/IIN fixtures only; no browser persistence.
- [x] Write RED truthful document tests: pending/scanning/clean/infected/scan-failed/missing and CDR-pending/failed, no operator-verification assertion from filename alone. ACTIVE cannot submit/resubmit; PENDING_REVIEW cannot edit; NEEDS_INFO/REJECTED retain existing allowed resubmission and upload differences.
- [x] Implement accessible shared labelled fields/action-specific busy/error states and source-backed status/profile cards, preserving immediate POST→PENDING_REVIEW then allowed uploads. No three-stage redesign, ACTIVE edit or city/about/multi-district control; no fake help/contact/history.
- [x] Full shared/Next/Vite/master tests, all frontend types and client/Vite/master builds. Document remaining source/native/service gaps; freeze combined accepted tree for review before exact-tree PR38 append and terminal full CI.
