# Desktop planned requests and related views

Continue feat/desktop-map-first from the preserved stage-one tree 9872e9fc5c013fdec95080008621da901e636a33. Original main and exported patches stay untouched.

## Scope and design
Use CURRENT Figma 560:3338 and 583:1217 for desktop hierarchy, spacing, typography, locale control and two-column request/context cards. These are future-model demo screens: do not copy demo names, amounts, payment promises or activate PLATFORM_V1_RESERVED. The supported local flow remains LEGACY + FREE_PILOT, with explicit pilot wording. A new composition screen follows the existing design language because CURRENT has no verified production-ready planned creation contract/layout.

Planned composition uses a durable calendar date and one of the existing four time ranges. Display Astana time explicitly and convert via Asia/Almaty timezone data; never restore a relative day index. Drafts are tab-scoped and owner-bound, preserve reload/Back/Forward and locale changes, and clear on logout. Existing urgent text fields may prefill a new planned draft without modifying the urgent record. Single-use photo references are not copied from the urgent draft. Photos retain the existing safe upload contract.

Before creation, persist an exact UUID request key and submitted payload. Use new POST /planned-orders/idempotent (same response shape) to prevent duplicates. Mount/reload never submits automatically; recovery is an explicit same-key action. The backend adds only durable creation identity and replay, preserving LEGACY transitions and commercial-mode stamping. Local additive migrations only; never production migrations.

Related request and history surfaces reuse existing API reads and state guards, show real status and timestamps, and introduce no financial mutations. Date/time/category text must follow RU/KK/EN. Missing backend evidence stays unavailable, not invented history. The whole master/operator product is outside this coherent client stage.

## Tasks
- [x] Inspect Figma and current planned API; identify draft/time/idempotency gaps.
- [x] Backend agent: idempotent planned creation with additive schema/migration and tests (apps/api only).
- [x] Parent: tested planned draft/time helpers and desktop composition.
- [x] Parent: related desktop request/history presentation and guarded reads/actions.
- [x] Integrate backend, apply migrations only to local databases, build and run.
- [x] Test real Chrome: input/login transfer, dates, double submit, lost response/recovery, API errors, reload/Back/Forward, RU/KK/EN and desktop widths.
- [x] Independent review, final verification, updated patch/report/screenshots.
