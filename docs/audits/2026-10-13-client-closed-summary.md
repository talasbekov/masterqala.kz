# Client completed order summary

Source: original mobile Figma142:1801, high-fidelity design context and screenshot. This CLOSED-only increment retains actual agreed scope/breakdown/total in the order, actual master identity and an honest direct-settlement card. If the total is unavailable it remains a dash. Conditional if-not-paid copy does not infer a paid flag from CLOSED; no sample repair-completed fact, identity, specialty or experience is inserted.

Mobile header uses the actual order reference. Home and My orders use existing client routes / and /orders through router-owned callbacks. When no Home callback is supplied the shared view does not invent navigation. Existing master contact remains available through an actual telephone link in scroll content, while header Help and optional review fields/status/guarded submission are retained. Other lifecycle actions remain unchanged.

Mounted red→green tests cover RU/KK/EN, actual quote/payment-if-unpaid wording, Home/Orders callbacks without mutations, real/missing telephone, unknown totals/scope fallback, already-reviewed state and busy/offline/reconciling review guards. Native route navigation, telephone launch, focus, sticky geometry, exact rendered parity and live backend journey remain unverified. Native KK review is still pending. No new assets, APIs or payment policy are introduced.

Pinned local verification: Node22.12.0/pnpm9.15.0, shared43/client66 tests, shared/client/master TypeScript and client production build passed. Final native acceptance and exact new-head CI remain separate checks after review/publication.
