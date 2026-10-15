# Exact current-order submission recovery

## Scope

The new-order form now captures its latest owner-scoped session values before freezing a pending intent. Schema2 stores one UUID, SERVER_KEYED protocol and a whitelisted copy of the submitted API payload. Initial submission and explicit recovery send the identical snapshot/UUID only to POST /orders/idempotent. Neither old-server404 nor any other error triggers legacy POST /orders, a new UUID or heuristic success matching.

Schema1 markers remain LOCAL_ONLY. Recognizable same-owner missing/empty/overlong/non-string keys and malformed schema2 snapshots retain the conservative local lock instead of being upgraded into a new request. Their real owned-orders/support destinations remain available; they cannot be replayed. Explicit logout clears persisted and same-document fallback records. Storage-denied fallback survives soft route remount but not a full reload, with an explicit warning.

Recovery may complete the original creation if the first attempt never committed, using the same identity without a second order for that identity; all three languages state this explicitly. Recovery is user-triggered, with localized RU/KK/EN checking copy and busy/offline guards. Mount, restore and locale changes do not submit. A successful response or committed-processing202 with the exact order ID settles only its matching owner/request and follows the actual order. Disposed callbacks may settle a matching remount but do not navigate the disposed form. Captured actions cannot send after logout invalidates their marker. Invalid unsent fields remain editable and show a validation message; existing server DTO limits and photo-reference shape are used, with server validation/preview remaining authoritative.

## Verification boundaries

Pinned Node22.12.0/pnpm9.15.0 checks: client56 tests and shared20 tests passed; client/master/shared TypeScript and client production build passed. Mounted jsdom tests exercise current-session capture, response loss/remount, byte-identical same-key replay, duplicate/offline guards, explicit logout invalidation, late exact settlement and localized recovery button states. Store tests cover old markers, damaged snapshots, payload whitelisting and old-server404 without fallback. These are not native Next navigation, real browser reload, SMS or live two-role journey evidence.

Server contract head5896d123 exact CI passed run38332959402: additive migration, API198units/41suites and263PostGIS E2E tests/61suites, including all eight request-identity cases, and all app/site builds. https://github.com/talasbekov/masterqala.kz/actions/runs/38332959402

The client checkpoint has not yet been published or run in CI. Full browser reload recovery is implemented through persisted exact server identity when storage is available but remains unverified in a real browser. Legacy local-only outcomes cannot be safely recovered by this new protocol. Definitive rejection/editing recovery for all server errors is not provided. A committed-processing order may still need payment/dispatch recovery; this slice does not repeat or repair those side effects. Fees, business modes, migration of old orders and existing API payload fields are unchanged.
