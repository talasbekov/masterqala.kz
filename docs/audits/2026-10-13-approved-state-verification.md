# Approved-state frontend increment

Published baseline:399dd09e05ef950a80ba81a33c06ad2523b55838 (draftPR38, exact-head CI green). Local isolated next branch:continuation/figma-approved-state-delta-20261013. Initial publication is unchanged.

## Sources and implementation

Actual current Figma contexts/screenshots: desktop client287:1507 and mobile master143:1877. Read-only comparison used original4060 committed intercepted-API fixture PNGs, not a new render.

- Approved-only desktop consent-change notice:330px right card at fitting desktop breakpoint, intermediate stacked arrangement,24px padding/radius16/title20/body16/24. Existing left actions and real map preserved; no fake messaging/profile behavior.
- Approved master uses real client name and quote total, generic missing/blank-name fallback, approved green status, agreed-scope heading, additional-work approval instruction and actual task/address/quote-title fallback. Start still sends current quoteVersion; revision retains expectedQuoteVersion and new quote requires fresh consent.
- Mobile primary/help56px target class fixes a real generated Tailwind cascade issue: shared arbitrary52px came after numeric min-h-14. Scoped arbitrary56px now wins; master desktop retains52px. Original SVG24px dimensions untouched.
- Existing revise/help actions remain accessible; their complete visual placement and all desktop left-card details are not claimed finished.

## Evidence and limits

Tests failed first for missing notice/explanation. Pinned Node22.12.0/pnpm9.15.0: shared20DOM/locale/generated-CSS tests and client26regressions pass on the final frozen code, as do shared/client/master typechecks and client/master production builds. Tests cover3languages, long/missing names, actual description/address, approved-only visibility, quoteVersion/start and revision transition, busy/offline/reconciling guards, no render/Back business mutations. Generated CSS ordering is checked, not inferred from class presence alone.

Fixture QA scripts add notice/copy/action assertions and unambiguous h1 selectors; node syntax checks pass. Browser scripts were not executed because the previously rejected renderer route remains unavailable; no workaround attempted. Native geometry/scroll/focus/Next navigation and final screenshots remain pending. No backend, fee policy, legacy data, new assets, ETA or invented identity fields changed. KK wording needs native-language review.

Review correction: RU/KK/EN additional-work instruction explicitly requires customer consent. Semantic regression failed on ambiguous wording and passed on corrected copy; shared20/client26 tests, typechecks and client/master builds rerun successfully.
