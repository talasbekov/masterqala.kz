# Existing order-dispute implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, retaining frozen parent review gates. Steps use checkbox syntax.

**Goal:** Safely localize four existing dispute route bindings without changing business permissions or pretending to implement general support.
**Architecture:** Shared typed context/evidence validation, owner/target-scoped reads and guarded actions, three-language presenters and thin router adapters. Preserve planned-client code. Port existing master upload cancellation to optional Next/Vite signals.
**Tech Stack:** React19/TypeScript, existing UI/tokens, Next15/Vite8, mounted jsdom transport/router fixtures; Node22.12.0/pnpm9.15.0.
**Spec:** docs/superpowers/specs/2026-10-13-existing-order-disputes.md

## Global constraints
- Four routes only; no earlier Help→dispute, new intake/notification/server/payment/status/window/role rules.
- Existing IN_PROGRESS/DONE/CLOSED,48h CLOSED window, participant/opener, OPEN upload/reply and2000-character DTO rules remain authoritative.
- Selected files/private draft text current memory only; fixtures only, no live submission/upload/financial actions.
- Evidence JPEG/PNG10MiB; actual scan states, no PDF/preview/filename matching/idempotency claim.
- Planned-client implementation byte-preserved; existing master planned context reads do not change lifecycle.
- Native routing/geometry/live integrations, original assets and Kazakh review remain pending.

## Review focus
- Owner/target/API/draft/read A→B→A or retained callbacks must not initiate/complete a different session write/poll.
- Initial/malformed/partial GET and uncertain committed writes must not unlock another write without authoritative reconciliation.
- Older master dispute URL must not display/mutate a different latest dispute returned by order GET: require exact expected ID.
- Changed status/window/opener and read/draft revision reject retained actions; no silent rebase.
- Locale/long text/zero-null amounts/dates/navigation preserve actual content, payloads and memory drafts without fabricated history/payment.

### Task1: Shared session, presentation and upload cancellation
**Files:** create packages/ui/src/disputes.ts, dispute-copy.ts, hooks/useOrderDispute.ts, OrderDisputeView.tsx, OwnedDisputesView.tsx; export through index.ts. Modify apps/client/lib/api.ts, apps/web/src/api.ts. Tests: UI dispute-session/view and client/web upload-lifetime plus bundle entries.
**Interfaces:** DisputeTarget={kind:'orders'|'planned-orders';id:string}; useOrderDispute({ownerId,target,expectedDisputeId?,api,upload}) exposes context/evidence read state, current-memory draft/file and guarded submit/reply/upload/retry/cancel. Inject api(path,RequestInit?) and upload(path,FormData,{signal?}); no auth in package. Presenter consumes state, router link adapter and explicit reply-confirmation callback. List consumes validated summaries/read state/real destinations.
- [x] Write mounted RED tests for initial/malformed/partial/stale reads, owner/target/API ABA, duplicate/draft/read retained handlers, exact expected ID, all allowed/blocked status/opener/window, existing payloads and actual quoteTotal/unknown/zero.
- [x] Run full affected tests; verify expected failures rather than import/fixture errors.
- [x] Implement validation/read/action/presentation using existing owner read helper, shared fields/Button and canonical locale. Synchronous lock/opaque lifetime/read/draft revisions; no automatic writes. Unknown write requires fresh GET; failed GET stays locked; preserve valid context on evidence failure and disable upload until both reads verified. Actual resolution fields are recorded decisions.
- [x] Port reviewed optional signal pattern: cancellation before token read/request/poll/delay; clean timers/listeners. Transport tests abort before request, late upload response, delay/inflight poll and unchanged CLEAN/INFECTED/SCAN_FAILED/no new-owner request.
- [x] Run UI/client/web tests/types, inspect and commit Task1; hold publication for integration review.

### Task2: Urgent client adapters and exact planned isolation
**Files:** exact copies into apps/client/components/LegacyDisputeView.tsx and apps/web/src/features/client-v2/pages/LegacyDisputePage.tsx. Adapt existing DisputeView.tsx/DisputePage.tsx wrappers to planned legacy versus urgent owner-bound shared session. Client test/dispute-entry.tsx, both dispute-route.test.mjs and bundle entries.
**Consumes:** Task1 controller/presenter and optional upload signal.
- [x] Write RED actual Next/MemoryRouter tests: RU/KK/EN, pending/failed GET no enabled submit, owner/target handlers, duplicate current payload, stale/dirty/locale preservation, successful/unknown create, evidence states and real links without navigation/render mutation.
- [x] Byte-verify original legacy copies, then replace urgent adapters only. No earlier Help routing; attachments only after actual dispute exists.
- [x] Run complete UI/client/web tests/types; commit Task2 and scoped evidence/inventory.

### Task3: Master list/detail and aggregate checkpoint
**Files:** apps/master/app/(app)/disputes/page.tsx, components/DisputeDetailView.tsx, lib/disputes.ts (signal/typed adaptation only as needed); test/dispute-entry.tsx, dispute-owner.test.mjs, bundle entries.
**Consumes:** Task1 validated list/context controller with expectedDisputeId and existing master signal transport.
- [x] Write RED mounted list/detail cases: owner ABA, partial evidence failures, actual target resolution/exact-ID mismatch, OPEN/RESOLVED/opener/statement/decision labels, neutral confirmation accept/cancel, duplicate/retained reply, unknown upload→GET lock, memory cleanup and unchanged planned paths.
- [x] Implement validated owner-bound list and resolver with actual dates/status/links. Stale/absent/mismatching context cannot reply/upload. Same-target locale/refresh retains draft; owner/target clears it. No fake timeline/payment/fine completion/immutable promise.
- [x] Run full UI/Next/Vite/master tests, shared/all five frontend types, client/Vite/master builds. Record source/native/service gaps and fixed55-route scope.
- [ ] Freeze combined exact tree for independent review; accepted-only PR38 append after unchanged-head/tree/fetch checks, monitor full PostGIS/queue/build CI and metadata read-back to terminal.
