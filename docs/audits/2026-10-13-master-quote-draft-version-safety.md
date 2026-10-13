# Master quote draft version safety

## Reproduced problem

An actual mounted DirectMasterOrderView at quote version3 opened Revise with work8000 and the original scope. Rerendering a fresh server version4 with work9999 left those inputs unchanged, but Send used the latest expectedQuoteVersion4. This could silently overwrite the newer quote with an old local draft. The new regression was observed failing before implementation (stale Send remained enabled), then passing.

## Bounded correction

- Explicit Revise snapshots the current order ID, original quote version and quote fields together.
- Same-version refresh retains typed unsaved fields. A different order/version, missing version or incompatible stage blocks submission and explains the conflict in RU/KK/EN.
- Proposal submits the original draft expectedQuoteVersion; no automatic rebasing or version substitution.
- Explicit reload clearly discards local changes in favor of the current verified quote. Cancel exits the editor; reopening snapshots current props. Inputs remain intact after an unsuccessful proposal, including an existing server conflict error.
- Existing busy, offline, reconciliation, refresh and server consent/version policies remain authoritative. A GET retry is offered when the current version is unavailable or stale; it does not mutate the order.
- Draft values remain only in the mounted form. This slice makes no persistence, native browser, or reload guarantee.

## Verification

Pinned Node22.12.0 / pnpm9.15.0: shared UI48 tests and client66 tests pass; shared/client/master TypeScript passes; master production build passes. Five mounted regressions cover the original v3→v4 bug, actual input events and rejected response, same-version preservation, explicit cancel/reopen/current snapshot, missing version, owner-order identity mismatch, busy/offline/stale and all three languages. These tests exercise actual React state/DOM handlers, not a real network request or native browser.

Figma master quote form143:1777 inspected from the supplied original file. Conflict/recovery controls are functional safety UI; native geometry/focus/Next navigation, live two-role quote revision and KK native-language review remain unverified. No API, migration, pricing policy, payment/dispatch behavior or original Figma changes.

Review correction: stale same-version editor and stale approved non-editing view both retain guarded GET recovery access, including after a failed GET and explicit cancel. Recovery does not discard typed values or replace the draft version; a mounted failed-read/retry regression was observed red before the correction and green afterward.
