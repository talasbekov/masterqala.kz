# Vite current-order recovery port

## Scope and evidence

The separate Vite mobile-client current-order route previously kept only component state and POSTed legacy `/orders`. It now reuses the reviewed shared owner/session store and injected creation hooks rather than introducing a second recovery protocol. Next and React Router render the same localized outcome view through explicit router-link adapters; internal navigation retains late-response handling. Shared safe-return validation is byte-identical to the previous Next utility, with thin Next reexports.

Restored drafts revalidate current category/location through the server preview before initial creation. Existing pilot/paid availability gates remain; DIRECT_PAYMENT follows its existing server contract allowing creation without an immediately nearby master. No financial amounts, tariff policy or backend contract changes. Submitted payload validation and snapshot/UUID identity remain the shared authoritative implementation. No automatic mount replay, new key for unknown outcomes or404 legacy fallback.

Explicit logout clears this tab's owner draft/pending and volatile fallback while retaining locale. Owner changes/unmount invalidate old initial geo, address requests and photo callbacks. Explicit geo uses the shared location-revision callback so a newer deliberate saved address wins. Only submitted photo references persist; no blobs/files/auth tokens/fees.

## Verification boundaries

Mounted tests use actual AuthProvider, CommercialModeProvider, NewOrderPage/LoginPage, shared store/hooks, MemoryRouter and installed Leaflet. Only HTTP transport responses and unavailable device geolocation are fixtures. Node's CSS loader intentionally does not measure CSS; it keeps actual Leaflet logic/events.

Observed RED evidence: initial same-owner restore stayed on step1; logout from support retained pending data; actual login ignored safe return and went Home; late old-owner photo upload appended its reference to the new account; unresolved old-owner creation kept new-owner submit busy. Each corresponding correction requires GREEN before checkpoint.

Regression cases cover exact-key initial creation, repeated click, support/remount late settlement, explicit same-key response-loss replay with identical snapshot,404 no fallback, damaged-key local-only lock, storage-blocked same-document fallback and logout, account isolation, explicit geo ordering, late upload isolation, actual protected redirect and SMS-form return/query/hash, external/login-loop rejection, offline gating and server preview revalidation/mode availability.

The supported native renderer remains unavailable. MemoryRouter/DOM tests do not prove native BrowserRouter/SMS, actual reload, map tiles, CSS geometry or full Figma parity. Vite map center-prop/latest-handler synchronization and whole-form KK/EN dictionary gaps remain separate known work. Storage-denied fallback cannot survive a full document reload. Legacy/local-only unknown outcomes and postcommit payment/dispatch recovery remain open.

CI adds `pnpm --filter web run test` to the pinned workflow; no dependencies or credentials are added.

## Frozen local verification

Pinned Node22.12.0/pnpm9.15.0:15 Vite mounted cases,55 shared tests and66 Next-client tests pass; shared/client/master TypeScript and Vite production build pass. Client production build passed after the shared status/safe-return extraction; subsequent production change is isolated to Vite's owner-keyed controller remount. Vite's nonblocking >500KB chunk warning persists. The safe-return implementation SHA256 is identical before/after extraction. `git diff --check` passes. New exact-head CI and independent review are still required before publication.

Owner-keyed controller lifetime ensures an unresolved POST from the previous account cannot keep the next account's wizard busy, while the old exact response cannot navigate or clear a newer owner/request. Its mounted regression was observed RED before the keyed boundary and GREEN afterward.
