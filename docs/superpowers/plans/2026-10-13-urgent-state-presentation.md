# Urgent State Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the finite nine-row urgent-state presentation batch using inspected Figma card hierarchy and existing real lifecycle actions.

**Architecture:** Extend the current shared direct-order views with focused client status/request cards and master state notices, composing existing Button, QuoteCard and canonical locale provider. Router/API owners and their mutation/read-generation gates remain unchanged. Keep state selection explicit so reviewed quote/approved/DONE/CLOSED and quote editor behavior do not regress.

**Tech Stack:** React19, TypeScript, shared Tailwind4/tokens, Node22.12.0/pnpm9.15.0, mounted jsdom tests; Next and Vite consume the same shared views.

**Spec:** docs/audits/2026-10-13-urgent-state-screen-matrix.md

## Global Constraints

- No new server status, financial policy, invented ETA/radius/identity, messaging/profile buttons or unsupported planned/edit transitions.
- Preserve original quote draft/version, explicit acceptance, cancellation preview/confirmation, owner/order/read-generation guards and API payloads.
- Mobile24px/28px title34px line/14px body21px line/56px actions; desktop400px left and330px right cards,24px padding/20px heading/16px body24px line/52px actions, stack until cards fit.
- Unknown money remains a dash; actual zero remains0. Actual original request/address and distinct agreed scope remain visible.
- Original unsupported assets stay documented, never redrawn or replaced by screenshots. Native geometry/tiles/focus/live journey remains unverified.

## Review Focus

- Missing/long master/customer names, phone whitespace and absent quote data must not leak sample values or undefined/null.
- Same view rerender through unrelated statuses must remove state-only cards without changing quote draft/order identity or issuing requests.
- Stale/offline/busy renders disable mutations; read-only refresh retains existing stale retry and generation protection.
- Cancel-search must first fetch the real preview, preserving expectedUpdatedAt/amount and explicit confirmation.
- Desktop-only card splitting must preserve mobile action/contact/help access and real request versus agreed-scope distinction.

### Task1: Client discovery/arrival/no-master presentation

**Files:** Create packages/ui/src/ClientUrgentStateCards.tsx; modify DirectClientOrderView.tsx, locale-data.ts; create test/urgent-state-presentation.test.mjs.

**Interfaces:** ClientUrgentStateCards consumes DirectOrder, canonical useLocale, existing primary/help/cancel ReactNode actions and online/fresh/error. Produces explicit state-card composition for CREATED/SEARCHING/ACCEPTED/MASTER_ON_WAY/INSPECTION/NO_MASTERS only; unsupported states render nothing.

- [ ] Write mounted failing tests for all six statuses ×three languages: correct state-only heading/guidance, actual request/address details, no sample identities/ETA, no render/Back POST.
- [ ] Add cancel-search callback-order test: clicking direct control invokes onCancelPreview, then explicit confirmation sends unchanged amount/expectedUpdatedAt; offline/stale/busy blocks it.
- [ ] Run pinned shared test build and confirm expected missing-card failures before implementation.
- [ ] Implement scoped mobile cards and desktop400/330 composition using existing shared tokens/components; real Call/Help and guarded retry retained. Reuse existing cancellation flow, not a new command.
- [ ] Run all shared/Next/Vite tests and types; inspect changed state/action source coverage and commit independently.

### Task2: Client working-state cards

**Files:** Modify ClientUrgentStateCards.tsx, DirectClientOrderView.tsx, locale-data.ts and test/urgent-state-presentation.test.mjs.

**Interfaces:** Extend explicit selection with IN_PROGRESS; actual prices use shared null-preserving formatting. Preserve reviewed approved desktop implementation and every other status.

- [ ] Write failing tests for distinct original description/agreed workComment, empty comment fallback, null total versus explicit zero, long text and absent master phone in all languages.
- [ ] Confirm RED, then implement actual agreed scope/breakdown/total and generic after-work guidance; desktop summary/request split and real contact/help.
- [ ] Run all shared state/quote/guard regressions plus Next/Vite tests, client/master types and builds; commit independently.

### Task3: Master waiting/work/acceptance presentation

**Files:** Modify DirectMasterOrderView.tsx, locale-data.ts; extend test/urgent-state-presentation.test.mjs and existing master-quote/refresh tests only where integration assertions require it.

**Interfaces:** Existing DirectMasterOrderView props and onRefresh/onAction remain unchanged. Add explicit AWAITING_PRICE_CONFIRM/IN_PROGRESS/DONE presentation selection; existing actual quote/identity and original-version editor retained.

- [ ] Write failing mounted tests for sent/result-sent/working badges, actual named/generic customer explanation, waiting/working/additional-consent guidance and56px mobile actions in three languages.
- [ ] Add status transition tests: retained inputs/original expectedQuoteVersion while editing; no Complete in awaiting, no Start in DONE, no unsupported propose during work; Refresh invokes existing read callback only.
- [ ] Confirm RED, then implement focused notices/card hierarchy; generic category-neutral work checks, existing complete/refresh/revise/Call/Help only.
- [ ] Run all shared mounted quote/refresh/state tests, Next/Vite regressions, shared/client/master types and client/master builds; freeze exact commit for independent review.

### Final gate

- [ ] Verify matrix has exactly nine runtime rows and document unsupported assets/timestamps/ETA/edit/planned/working-revision contracts.
- [ ] Review all changes independently before publication; exact frozen tree only, append onto unchanged PR38 head through authorized connector protocol.
- [ ] Monitor exact-head CI through terminal state, including4 isolated real queue cases/all builds. Correct failures within batch; do not equate DOM tests with native visual acceptance.
