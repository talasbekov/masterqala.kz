# Owned Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task by task, with TDD and independent review of the frozen combined batch.

**Goal:** Make the two owned-orders routes show truthful actual prices, owner-safe active/history lists and accessible localized presentation.

**Architecture:** A pure presenter and injected read hook live in the existing shared UI package. One shared view composes canonical locale/Button and a router Link adapter; Next/Vite route wrappers provide current owner and API only. Existing direct-order/detail/planned APIs and shell behavior remain authoritative.

**Tech Stack:** React19/TypeScript, shared Tailwind4 tokens, Next15/React Router, Node22.12.0/pnpm9.15.0 and existing mounted tests, no new package dependencies.

**Spec:** docs/audits/2026-10-13-owned-orders-screen-mapping.md.

## Global Constraints

- Only Next and Vite /orders; no API/schema/policy/legacy/planned-v2 state edits.
- Source actual quoteTotal for versioned direct; unknown prequote, real0 preserved; actual cancellation amount separate; legacy workPrice??calloutPrice and planned workPrice??budget unchanged.
- Existing active/history terminal predicates and real detail/new-order destinations preserved.
- No writes on render/tab/navigation/retry; current owner/generation guards before every result/error/finally update.
- Canonical RU/KK/EN UI copy; no translated customer data/sample identity/date/ETA.44px filter targets,56px mobile CTA,24px inset and responsive bounded desktop list.
- Icons/native geometry/desktop extra filters/Vite shell are residual source gaps, not a full-parity claim.

## Review Focus

- Quote14000 versus work8000, null/0/prequote placeholder, changed quotes and cancellation fee must never imply free/paid or stale total.
- OwnerA pending reads followed by logout/ownerB, retry races and failures must not restoreA content or clearB loading.
- Empty history must not remove active orders; DONE/NO_MASTERS remain active, CLOSED/cancellations terminal, planned legacy rules unchanged.
- Keyboard/focusable router links carry real encoded owned IDs, no fake card clicks or external destinations.
- Long/missing fields, loading/error/retry and all3languages must retain usable width without inventing content.

### Task1: Pure presentation and owner-safe reads

Files: create packages/ui/src/owned-orders.ts and hooks/useOwnedOrders.ts; export from src/index.ts; create test/owned-orders.test.mjs and test/owned-orders-owner.test.mjs.

Interfaces: OwnedOrderItem is a discriminated urgent/planned union of actual id/status/description/address/category/master/createdAt and existing lifecycleVersion/commercialMode/quoteVersion/quoteTotal/workPrice/calloutPrice/cancellationAmount/departedAt/budget fields. presentOwnedOrderAmount(item) returns {label:CopyKey,amount:number|null}|null, never a formatted invented value. isOwnedOrderActive(item) preserves current predicates. useOwnedOrders({ownerId:string|null,api:(path:string)=>Promise<unknown>}) returns {items,loading,error,incomplete,retry}; no caller-provided owner is sent to the server.

- [x] Write pure failing cases: direct work8000+materials3500+callout2500/total14000, quoteVersion0/callout0 unknown, null versus0 total, quoted revision, cancellationAmount finite>=0 with departedAt present or amount>0 (otherwise no direct cancelled price row), legacy and planned formula controls, current terminal predicates.
- [x] Observe RED, implement minimal presenter without tariff calculation or migration, then verify GREEN.
- [x] Write mounted read-race failures: absent owner/noGET, ownerA unresolved→B/lateA resolve/reject, logout, retry generations, one endpoint error then honest retry, no POST.
- [x] Observe RED, implement bounded owner/request generation and lifetime checks, both owned GETs only. Independent endpoint outcomes preserve successful current-owner urgent data when planned fails; partial/stale errors are explicit, retry preserves owner isolation, and failed sources cannot yield a false global empty state. No persisted cache or token storage.
- [x] Run full shared tests/types and freeze independently.

### Task2: Shared responsive list and both router integrations

Files: create packages/ui/src/OwnedOrdersView.tsx; modify shared locale-data/index; replace only Next apps/client/app/(app)/orders/page.tsx and Vite features/client-v2/pages/MyOrdersPage.tsx with thin owner/API/router adapters. Add Vite tabs4/home.urgentButton KK/EN resources only. Extend client/Vite test bundle entries for actual mounted route pages; add route tests and shared presentation tests. Copy the reviewed55-route inventory and source mapping/plan into docs at this checkpoint.

Interfaces: OwnedOrdersView({items,loading,error,onRetry,renderLink}) uses canonical provider and local active/history selection. renderLink({href,children,className,ariaLabel}) returns the actual Next/ReactRouter Link; IDs are encoded into existing /order/:id or /planned/:id destinations. Real /order/new CTA only. No API action prop.

- [x] Write failing state×locale tests: active/history/empty/loading/error/retry, actual long/missing task/name/date, direct versus legacy/planned prices, localized statuses, actual0/dash, retained active orders after visiting empty history and DONE still active.
- [x] Write mounted Next/Vite owner adapter/navigation tests, actual MemoryRouter Link destinations, authenticated account switch/logout, old response not visible, read-only retry/tab/navigation and accessible link/filter names.
- [x] Observe RED and implement mobile soft cards/44px tabs/56px CTA and desktop bounded table/list using existing tokens/components. Retain existing route shells and expose asset/shell/extra desktop-filter residuals.
- [x] Run full shared/Next/Vite tests; UI/client/master types and client/Vite/master builds. Record precise DOM versus native evidence and dictionary coverage.
- [ ] Freeze for independent review before any publication; append only accepted exact tree to unchanged PR38 head. Monitor final exact-head CI including4 real queue cases/all builds through terminal result.

## Frozen local verification

Pinned Node 22.12.0 / pnpm 9.15.0: 81 shared, 69 Next-client and 22 Vite tests pass. UI/client/master TypeScript and client/Vite/master production builds pass. The existing Vite >500 kB chunk warning remains. Both actual old route components reproduced the wrong 8000 amount versus expected authoritative 14000 and failed owner-switch reads before the adapters were replaced. Shared tests cover malformed quote versions, partial source failure, retained handlers across owner A→B→A, status × locale, null/zero, loading/empty, encoded links and GET-only retries. Native geometry/live APIs/actual Next App Router remain pending. Publication is gated on independent review and unchanged remote-head verification.
