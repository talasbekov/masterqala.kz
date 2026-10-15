# Client Home Safe Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with TDD; independently review the frozen batch before publication.

**Goal:** Make both existing client home routes show current-owner data and truthful RU/KK/EN guidance without commercial or availability promises.

**Architecture:** One injected shared read hook independently reads active order and categories; a shared presentational view receives actual results and router Link adapter. Next and Vite retain their existing auth/API/socket providers and route shells. No cache, mutations or new endpoint.

**Tech Stack:** React19/TypeScript, existing shared UI/Tailwind4, Next15/React Router, Node22.12.0/pnpm9.15.0, existing mounted test harnesses.

**Spec:** docs/audits/2026-10-13-client-home-bounded-scope.md.

## Global Constraints

- Only Next/Vite home routes and shared helpers/copy/tests; no API/auth/schema/config/policy changes.
- Actual category names/order IDs/statuses only. Unknown status gets a neutral localized fallback.
- Remove approximate15-minute, free-callout, protected-payment, document-verification and24/7 support promises in every commercial mode. Use neutral task/address/order guidance.
- Keep existing /order/new, /planned/new, /catalog, /support and current-order destinations. No inferred category preselection, search, directory or draft writes.
- Assets/native geometry/full desktop parity remain explicit gaps; use existing tokens and accessible links, no fabricated replacement illustration.

## Review Focus

- OwnerA→B→A, logout, old socket callbacks and late GETs must never restore previous-owner orders or errors.
- Category failure must not erase a valid active order; active failure must not invent an empty order result.
- Older retry completion must not override a newer request or clear its loading state.
- Unknown/missing/long category/status/name data must stay usable and never imply a known price, ETA or availability.
- All commercial modes and locales must avoid unsupported promises while current-order draft and navigation remain unchanged.

### Task1: Shared independent owner-safe reads

Files: create packages/ui/src/hooks/useClientHome.ts; export src/index.ts; create test/client-home-owner.test.mjs.

Interfaces: useClientHome({ownerId:string|null,api:(path:string)=>Promise<unknown>,subscribeStatus:(callback:()=>void)=>()=>void}) returns {order:ClientHomeOrder|null,categories:ClientHomeCategory[],orderLoading:boolean,categoriesLoading:boolean,orderError:string,categoriesError:string,retry:()=>Promise<void>}. ClientHomeOrder contains actual id/status/category.name only; category contains actual id/slug/name. No owner ID is sent in the GET payload. Subscribe cleanup belongs to the current owner lifetime; socket events invoke an owner/generation-guarded read.

- [x] Write mounted failing tests: no owner/no requests/subscription; A→B→A retained retry/socket callback; logout/unmount late success/error; same-owner newer retry wins; valid order plus categories rejection; valid categories plus order rejection; malformed response treated as failure instead of fabricated empty success.
- [x] Observe RED against current duplicated behavior, then implement opaque owner lifetime and read generations with independently settled source states. Preserve successful same-owner results on failed refresh, showing explicit stale/error state; clear both sources on owner change.
- [x] Run focused and full shared tests/typecheck; freeze a small read-helper commit.

### Task2: Shared truthful view and both actual router adapters

Files: create packages/ui/src/ClientHomeView.tsx; extend locale-data.ts/index.ts; replace only apps/client/app/(app)/page.tsx and apps/web/src/features/client-v2/pages/HomePage.tsx with thin adapters. Extend existing actual-route test bundle entries and create both test/home-route.test.mjs plus shared test/client-home-view.test.mjs. Update55-route inventory/audit.

Interfaces: ClientHomeView consumes Task1 result, actual displayName and renderLink({href,children,className,ariaLabel}). Adapters bind existing useAuth, api, getSocket on/off order:status and actual router links; no commercial mode is needed for neutral factual guidance.

- [x] Write RED state×locale tests for greeting/active status/current-order link/unknown fallback, independent loading/errors/retry, long/missing data, actual category names and neutral creation guidance. Assert no15-minute/free/protected/24h/verified claim, including FREE_PILOT/DIRECT_PAYMENT/PAID_MOCK/PAID_LIVE wrappers.
- [x] Mount actual Next context-adapter and Vite MemoryRouter routes: owner switch/late GET and socket cleanup, real encoded detail/new/planned/catalog/help links, no POST or draft mutation from render/retry/navigation. Preserve an existing submitted pending UUID/snapshot on home navigation.
- [x] Implement existing-token responsive bounded layout, localized accessible actions and correct contrast. Do not add inert search or category-selection promises; preserve actual /order/new behavior explicitly.
- [x] Run full shared/Next/Vite tests, shared/client/master/Vite TypeScript and client/Vite/master builds; record DOM/fixture versus native limitations.
- [ ] Freeze combined checkpoint for independent review. Only after acceptance append exact reviewed tree to unchanged PR38 head and monitor full exact-head CI, including real PostGIS/queue cases.
