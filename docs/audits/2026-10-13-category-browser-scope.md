# Existing category browser scope

## Source and contract

High-fidelity Figma context and screenshot inspected for `93:1671` in file `0yR2Q2iy5rT9qrW3M83L1N`: desktop Master directory, actual design samples include master profiles, rating/order count, travel estimates and service/district/rating filters. It is **not** a service-category list. The cleanup below does not implement directory parity or copy sample identities, verification or ETA. Original icons/assets, directory/profile/filter contracts and native geometry remain open.

Existing Next `/catalog` and Vite `/catalog` fetch public `GET /categories`, supplied by `MastersController.listCategories` with categories ordered by name. Their existing category links go to generic `/order/new` without writing/seeding a draft. Preserve that behavior, authentication boundaries, API and payloads. Public data needs request/lifetime isolation, not owner caches.

## Approved bounded design

Shared injected public read hook validates category arrays, nonblank ID/name/slug strings and unique IDs. Initial loading, malformed/network failure, true server-empty and explicit retry are distinct. A failed refresh preserves successful rows with a visible stale warning. Synchronous in-flight guards and opaque API/lifetime plus request revisions ignore disposed/older retained callbacks and responses.

Shared presentation uses canonical RU/KK/EN language, neutral Services heading, actual server names and labelled local name search. Search trims/case-folds names without translating server data. Local no-match differs from a truly empty list. Real Back and generic order links use router-specific adapters and accessible names; no inert filters, fabricated profiles, category subtitle promises or draft writes. Source typography32px desktop, card16px radius/24px padding and existing shared field/action primitives are reused; mobile wraps without persistent sidebar width. Directory layout/assets are explicitly unimplemented.

Tests use public category fixtures and mounted shared/Next/Vite routes. Cover three languages, long names, malformed/duplicate/empty responses, retry failure with retained data, duplicate/retained retry and unmount, actual search/navigation and unchanged owner-scoped submitted UUID/payload draft. No POST/socket/geolocation or external navigation. Pinned toolchain, aggregate tests/types/builds precede frozen independent review/publication.

## Current fixed project boundary

Published master batch `00793679ffe67adc7ed74b61c082d34a33d8063b` matches reviewed local `d35b2ccf`; exact-head CI38393347013 is green:115 UI/107 Next/61 Vite/66 master,201 API units/265 PostGIS E2E,17 queue/safety tests, migrations and all builds. Fixed55-route inventory:18 scoped implementations,17 other parity/localization gaps,4 service-contract gaps,16 dependency-gated routes. All native/live acceptance remains pending. Master application/dashboard now have scoped three-language existing-contract behavior, not full onboarding or upload idempotency. Ordinary callout pricing, planned-v2/ADMIN designs, real support/feed/push, public master directory and unsupported profile fields remain product/API requirements. Native renderer/live SMS/two-role/files/maps/PWA and unavailable original homepage images are access/asset dependencies.

## Local checkpoint evidence

Shared missing exports/read/search behavior reproduced RED; actual Next and Vite routes lacked a search input and crashed on malformed arrays, reproducing RED before integration. Combined local checks pass with pinned Node22.12.0/pnpm9.15.0:125 shared,111 Next,65 Vite and66 master tests; shared/all five frontend types; client/Vite/master production builds. Nine public-read/view cases plus one long-name/locale case cover API/lifetime replacement, disposed retry, duplicate requests, malformed keys/names, true empty, stale data, local search and no extra reads. Each actual router has four mounted cases, including untouched submitted UUID/payload draft and real Home/order navigation. Native Next/AppRouter/geometry and master-directory parity remain unverified. Existing Vite large-chunk and Node experimental-test warnings remain.
