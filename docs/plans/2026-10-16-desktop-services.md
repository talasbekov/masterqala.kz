# Desktop client completion — stage four

Continue `feat/desktop-map-first` from stage-three tree `ebb252b288c9745ce03d57b0521ee6be7908b07f`; preserve earlier staged changes and patch artifacts. No production, merge, push, deployment or paid-mode activation.

## Existing contracts and CURRENT design

Use CURRENT frames 579:1000 (payment help), 583:1163 (problem draft), 583:1091 (problem submitted), file 0yR2Q2iy5rT9qrW3M83L1N. Their desktop hierarchy informs appearance; future financial behavior is not implemented. Support channel and notification feed have no backend. Payments display actual public configuration, including read failure. Disputes use existing urgent/planned eligibility, submission and evidence endpoints.

## Implementation and verification

1. Keep one workspace/header for services, catalog, profile, orders and creation. Redirect historical `/dashboard` to `/orders`; catalog selection passes validated category intent to map without destroying existing draft. Preserve step form for photos.
2. Saved address selection uses authenticated owner-bound GET, explicit loading/error/retry/empty states, and an atomic draft patch. Copy all address details; clear missing district. Coordinates are optional: do not assert an old pin belongs to a new address. Require explicit confirmation before submission and retain that guard across reload.
3. Desktop support/notifications remain honest unavailable states with working internal links. Payments never create a payment. Desktop urgent/planned disputes retain owner/target drafts and reconcile interrupted submission before another attempt.
4. Run client/shared UI tests, types, production build and independent review. Exercise real local API in Chrome at desktop and 390px, RU/KZ/EN, errors, reload/back and interrupted requests. Record actual request counts and screenshots. Check FREE_PILOT configuration and absence of financial records.
5. Export cumulative and stage-four-only patches; verify each applies to its recorded tree and yields the same final tree. Upload report and selected screenshots to Library, keeping earlier stage-three image IDs available for handoff.

## Explicit limits

No support messaging, push feed, geocoding, payment processing or future platform financial model is introduced. Master/operator desktop work is a separate next stage. Local browser evidence is synthetic QA data against the real local API, not production evidence.

## Completed local verification

- Client 232/232, shared UI 190/190, isolated account/address helpers 7/7; client TypeScript and production build passed.
- Independent source review: one saved-address reselect defect corrected with a mounted regression test; no remaining P1/P2 findings.
- Chrome 155 exercised support, notifications, disabled payments, catalog/map/wizard, urgent and planned dispute draft/submitted states, and evidence at 1440px and 390px in RU/KZ/EN. No page exceptions or horizontal overflow in the passing runs.
- Actual API accepted two disputes on previously completed synthetic QA orders. Double click plus lost response produced one creation request per order; failed reconciliation blocked retry until real GET succeeded. Order statuses remain CLOSED. Evidence upload with intentionally rejected fetch result recovered through GET without automatic resubmission.
- Transport failure injection is explicit and does not substitute successful mock responses. The first multipart replay using Playwright route.fetch returned 400; direct multipart and native browser multipart succeeded. The final interrupted upload uses a real browser fetch whose successful response is intentionally discarded. Two stored images consist of the diagnostic upload plus the browser upload, not an automatic duplicate.
- Existing local file scanning is DISABLED, so CLEAN validates storage/UI flow only. Financial database counts and reserved planned-model count remained zero.
