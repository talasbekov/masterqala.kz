# Desktop map-first: implementation and verification

Base: 07699385e66f18252cf412b083fa1097484c088c, isolated branch feat/desktop-map-first.

## Design
The client entry at port 4200 becomes a public map with a floating header and order cards, based on Figma 74:1333 and the CURRENT typography and locale controls. Real Leaflet coordinates and public categories replace design placeholders. No sample price, ETA, platform reserve or payment action is introduced. Existing owned drafts and server-keyed creation remain authoritative.

Guests can compose a draft before login. A separate tab-scoped guest record transfers only after an explicit continuation and successful authentication. It cannot overwrite any existing owned draft or pending request. Login does not create an order. The client must explicitly confirm after login. Private routes remain guarded. The former home dashboard stays available at /dashboard. Existing four-step /order/new and planned-order routes remain available while subsequent desktop stages are implemented.

Public site entry points target the desktop client locally; the mobile PWA remains a separate surface. Desktop composition supports RU, KK and EN, manual address with map pin, category, description and optional address details. Planned work links to the existing supported flow; this stage does not implement the new financial model.

## Sequence
- [x] Inspect instructions, Figma, API contracts and existing draft safeguards.
- [x] Create isolated worktree, restore existing dependencies offline; baseline 136 client tests pass.
- [x] Write failing tests for guest transfer, ownership conflicts, malformed input and storage failure.
- [x] Implement guest transfer and the map-first desktop entry with existing creation hooks.
- [x] Verify targeted tests, complete client/site suites, types and builds.
- [x] Verify real Chrome at desktop widths, guest login continuation, create/recovery, locale and navigation. Capture actual results and screenshots.
- [x] Review and export the stage, explicitly list remaining desktop work.

## Verification boundaries
Only local PostgreSQL, FREE_PILOT and console SMS. No production migrations, merge, push, deployment or external financial operations. Browser fault injection must be labeled separately from live API evidence. Preserve all other worktrees and test data. A passing HTTP response is not completion evidence.
