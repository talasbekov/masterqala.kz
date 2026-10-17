# Desktop stage 3: active pilot requests, comparison and account

Base: stage 2 tree `46dbf930b87e6454bc458c39b4ea9d69bd42a4be`, on local `feat/desktop-map-first` at main `07699385e66f18252cf412b083fa1097484c088c`.

## Design and contracts

Fresh Figma CURRENT section `558:5008`, quote frame `560:2781`, replacement frame `564:9386`, and existing planned choice frame `560:3338` establish the teal header, 32px heading, 24px padded cards, 456px summary and 52px actions. Future finance copy in these frames is not a supported pilot contract. Profile reference `93:1560` supplies the established 384px account aside; no duplicate CURRENT account or comparison frames were found or created.

Use existing authenticated API and owner lifecycle guards. FREE_PILOT remains active, PAID_LIVE and PLATFORM_V1_RESERVED remain disabled. No production operations or publication.

## Work and verification

1. Present real urgent pilot states, actual professional identity/location and price, with only server-supported transitions. Inspection cannot cancel; quote rejection explicitly cancels; completion and review use existing endpoints.
2. Compare actual planned offers in aligned columns, invalidate stale selections on refresh/socket/owner changes, protect repeated selection and late completion.
3. Add desktop profile and address layouts. Preserve owner-bound tab drafts, clear on logout, never submit on reload. Unknown address-create results require server reconciliation before a new explicit action.
4. Run focused race tests, client/shared UI suites, typecheck/build, independent review, and Chrome against local API/PostgreSQL. Cover RU/KZ/EN, 1440/1366/mobile, reload, browser history, repeat actions and transport failures.
5. Record honest live evidence and limitations, preserve earlier artifacts and user main, export and independently apply-verify a cumulative patch, and upload report/screenshots to Library.
