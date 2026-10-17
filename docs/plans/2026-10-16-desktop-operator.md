# Stage 6 — operator desktop: factual scope and implementation plan

Baseline stage5 tree `1f8366c4488ced7ec4044d0ad3c9b1ddc3db712f` on `feat/desktop-map-first`. Preserve earlier stages. Local FREE_PILOT only; no merge/push/deploy/production migration or real payment/SMS.

## Confirmed design and permissions

CURRENT Figma `0yR2Q2iy5rT9qrW3M83L1N`, canvas `558:5008`, operator nodes `560:996` cancellation review and `560:1054` requested evidence inspected with screenshots. Shared header80, workspace24, sidebar224, white cards16, warm background and navy type are visual references. Their territorial finance/process controls have no implemented role/process contract. No duplicate Figma screens are needed for adapting existing queues. Admin commission/version/payout and Partner queue frames are future-model specifications, not authorization.

Database UserRole contains CLIENT and OPERATOR only. Every /admin API below requires JWT and OPERATOR. There is no implemented ADMIN or PARTNER role, region scope, role grant, commission control or compensation approval. Existing operator rights must not be broadened.

| Screen | Actual contract | Permitted scope / gaps |
| --- | --- | --- |
| Overview | GET /admin/metrics | Real aggregate counts and delayed search queue; link actual IDs |
| Orders | GET /admin/orders, /:id?type=urgent|planned, /:id/candidates?type=urgent|planned; POST /:id/assign?type=urgent | Existing urgent manual assignment only when UI canAssign; planned display only. Preserve SEARCHING mutation contract and eligible-master checks. No new payment or order state editing |
| Disputes | GET /admin/disputes, /:id; POST /:id/resolve; authenticated /disputes/:id/evidence/:path | Record nonfinancial note and server audit. No refund/penalty selection in desktop. No evidence-request/notification workflow API |
| Verification | GET /admin/applications, /:id, /:id/documents/:docId; POST /:id/decision | Existing APPROVE/REQUEST_INFO/REJECT with document safety gate; no ACTIVE profile editing |
| Masters | GET /admin/masters | Existing active master directory/category/district filters, no invented live statistics |
| Users | GET /admin/users; existing block/unblock | Existing account restrictions only. Operator targets cannot be blocked. No role grants/admin impersonation |
| Journal | GET /admin/journal?page | Actual operator audit entries; no invented staff/date/export filters |
| Security | Existing /admin/security observations/alerts/deliveries | Existing application alert triage only; not operating-system security or account 2FA settings |
| Financial features | Legacy withdrawal APIs exist but are held out of this UI | Disabled explanation; no financial reads/writes initiated by screen. PAID_LIVE and PLATFORM_V1_RESERVED remain inactive |

## Work and evidence plan

1. Apply CURRENT shared desktop styling to existing protected routes and make stored-user loading hydration safe.
2. Add URL-backed selected cards plus owner/tab-scoped draft and unknown mutation recovery to orders/disputes/verification. Persist marker before POST, reconcile via GET, never replay automatically.
3. Fix proven candidate mismatch and document-upload/verification race within existing backend contracts, without changing manual assignment policy or role definitions.
4. Test existing operator suite, targeted API tests, isolated PostgreSQL integration and live local Chrome desktop/mobile RU/KK/EN. Verify private attachments, foreign-role denial, repeated and interrupted actions, single audit writes and zero financial activity.
5. Independently review, deliver cumulative and stage-only verified patches, screenshots and complete desktop coverage/remaining-decision matrix.

This stage does not claim the whole product is ready. Active master profile edits, submitted-bid edits, client chat/notification feed/geocoding, financial model and dedicated admin/partner RBAC remain separate gaps.

## Final verification

- Operator: 207/207 tests; production build passes.
- API: 268 passed, one pre-existing skipped, 48 suites; full TypeScript emit passes.
- Isolated PostgreSQL on5433: 41/41 tests in six suites, including document/decision concurrency and direct-DONE candidate exclusion. Legacy payment assertions use the existing PAID_MOCK test provider only; running application on5432 remains FREE_PILOT.
- Real Chrome155: nine protected routes plus login; RU/KK/EN;1440/1366/390. Real delayed-search manual assignment, private dispute evidence, nonfinancial dispute resolution, application document and approval, exact related order navigation, fresh-read recovery, foreign403/anonymous401, one audit per accepted mutation and logout cleanup.
- Known HTTP refusals persist separately from ambiguous transport outcomes. Fresh validated reads precede explicit retry; transport/5xx pending states never automatically replay.
- Backend review found no remaining P1/P2; independent frontend review confirmed both known-refusal recovery fixes and paid-legacy resolution hold.
- Final copy-only change explicitly labels FREE_PILOT stored callout/service-fee values as reference data, not collected payments; final Chrome checks cover all three locales.
- Application payment transactions, accruals, withdrawal requests and reserved planned orders remain zero. Synthetic assigned order cancelled using client API after verification.
- Initial mobile-users overflow was reproduced and corrected by responsive fields and positioned table scroll container. An edge-run logout selector matched a second aside button; its four completed edge cases remain recorded, and the final browser run verifies the precise navigation logout selector and cleanup.

See `2026-10-16-desktop-coverage.md` for all44 existing desktop routes and remaining contract gaps. No whole-project or commercial-readiness claim.
