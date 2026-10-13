# Vite pin synchronization and current-order dictionaries

## Bounded implementation

The already reviewed Next pin-center algorithm moves to the existing shared package with a thin Next reexport. Its body is byte-identical (SHA256bc829d4ea8a0191319f12231a03afbd624ad1f2e8e1b76d86f5eb2fe51227149); only Leaflet-imported types become a minimal structural map interface, so no shared Leaflet dependency is introduced.

Vite pin MapView now synchronizes saved-address center props in layout effect, reads the latest callback, suppresses programmatic/resize coordinate mutations, observes container resizing and disposes helper/observer/map resources. Pulse/tracking behavior remains unchanged. Restored pending wizard never mounts its interactive map. Late explicit geolocation after saved-address selection keeps both draft and actual Leaflet center aligned.

Vite KK/EN dictionaries were empty objects, causing all16 sections to fall back to RU. This slice copies only reviewed common5/newOrder35 keys from Next across RU/KK/EN and wires the four existing pilot note/payment/cancel/submit strings. The only changed preexisting RU value was a fabricated Kaspi Gold4821 label; it now uses the reviewed honest unavailable-payment-method text. Commercial modes, fees, callout amounts, server messages and payloads do not change.

## Evidence

Observed RED: shared controller export absent, mounted Vite Leaflet retained old51/71 center instead of new51.4/71.8, KK/EN current-order dictionaries lacked keys, and actual pilot summary still rendered RU hardcoded copy. GREEN:56shared/19Vite/66Next tests on Node22.12.0/pnpm9.15.0; shared/client/master TypeScript; Vite and Next-client production builds. Vite's existing nonblocking large-chunk warning persists.

Actual installed Leaflet tests cover prop center, latest handler, no programmatic writes, callback removal, equal-center behavior through reused Next regressions, resize and observer cleanup. Mounted wizard checks saved-address→late geo consistency and pending-map absence. Dictionary tests check keys/nonempty values/interpolation parity; mounted KK/EN pilot copy is tested. Native tiles/geometry/hydration/SMS/reload are not established.

## Remaining scope

The other14 Vite dictionary sections still fall back to RU. API-provided category names and backend errors remain actual API content; this is not whole-form or whole-app localization acceptance. Native-language KK review, tracking-map center changes, actual geometry/tiles and full Figma screen parity remain open. Queue proof publication/CI is separate; this UI tree contains no additional runtime or queue changes.
