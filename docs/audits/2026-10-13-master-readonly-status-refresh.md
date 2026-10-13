# Master read-only status refresh

Sources: original Figma mobile143:1829 (waiting for quote consent) and143:1988 (waiting for result acceptance), high-fidelity design context and screenshots. Both expose an explicit Refresh status action. The existing authenticated master container owns GET /orders/{current id} through useOrderState.load; no POST refresh endpoint is introduced.

Expose this callback only in the two waiting states, retaining real Call/Help/Revise access. The56px mobile/52px desktop secondary refresh action has localized loading text, synchronous repeated-click protection and busy/offline guards; stale state may be retried. Local read failure is visible and retryable. Request identity and cleanup prevent a late old-order read callback from clearing the new order's pending action or showing its error.

Mounted real-hook tests revealed pre-existing reconciliation races: fresh was invalidated only via React state, allowing a same-batch mutation after GET started; a new-order layout commit could inherit prior verification before passive cleanup; old-ID mutate callbacks checked the ID only after writing. A synchronous order-ID/read-generation-scoped verified ref now invalidates at GET start/cleanup and records the verified ID/generation only on the current generation/current-ID response. Mutation entry requires mounted/current-ID/verified-ID/current captured-generation plus existing fresh/online/lock guards. This changes no valid endpoint, price, payment or dispatch behavior.

Coverage: red→green view refresh/mutation-gating regressions; RU/KK/EN, stale retry, offline/busy/duplicate guard, rejected GET/error, order-ID callback ordering, real-hook current GET→approved quoteVersion→start command, failed reconciliation retry. Native Next/socket/browser focus/geometry and live backend journey remain unverified. Remaining source-only state coverage is documented in 2026-10-13-remaining-direct-screen-coverage.md; it is not a rendered parity claim.

Pinned local verification on this checkpoint: Node22.12.0/pnpm9.15.0, shared38/client66 tests, shared/client/master TypeScript and master production build passed. These tests include6 mounted real-hook cases. Exact published-head CI will be reported separately after independent review/publication.

Review correction: retained same-ID mutation handlers from the previous verified quote generation are rejected before POST even after a newer GET succeeds. The newly rendered handler for the verified generation remains usable; a mounted red→green regression checks both. Server version checks remain unchanged.
