# Owned-orders source and contract mapping

Scope: Next client /orders and Vite /orders only. Original Figma was inspected through high-fidelity context with included screenshots: mobile153:2151(active),153:2243(history),153:2342(active empty),285:4520(actual cancellation amount); desktop93:1365(list),204:1525(after acceptance),257:1501/1555(active data). No implementation renderer was used.

Mobile:24px content inset/gap,28/34 medium heading,44px filter targets, soft order cards with actual reference/status/task/date/master, separated amount and real detail navigation,56px new-request CTA. Desktop:1328px maximum content,24px inset,32px semibold heading,16/24 explanatory text, responsive list/table and actual new-request side card. Keep existing shells; source icon/navigation asset and desktop Vite shell gaps remain explicit.

Contract evidence: GET /orders is owner-scoped and returns full Prisma order fields plus category/master (orders.service.ts174–181). GET /planned-orders/mine is the existing owned planned list. Both current frontend pages use workPrice??calloutPrice for urgent price and workPrice??budget for planned price. The urgent formula incorrectly shows8000 rather than authoritative14000 for a versioned direct quote; unquoted direct callout0 is a placeholder.

Versioned direct means lifecycleVersion>=2 and commercialMode DIRECT_PAYMENT. Before a positive quoteVersion, price is unknown/cost after inspection. After quoting, use quoteTotal exactly, null/malformed unavailable, actual0 preserved. Neutral proposed-price language before consent; never imply paid. For cancelled versioned direct orders, do not display the obsolete work quote as payable: show actual nonnull cancellationAmount separately only when cancellationAmount is finite/nonnegative and (departedAt is present or cancellationAmount>0); no calculated tariff or paid assertion. Before-assignment cancellation can omit the amount row as153:2243; screenshot285:4520 visibly contains an actual fee row, overriding generic metadata saying cancelled money is always hidden. Legacy urgent and all existing planned amount/status semantics remain unchanged. Their DONE/CLOSED labels are neutral Completed/Closed; explicit result-check/acceptance labels apply only to the versioned direct contract.

Active terminal predicates remain CLOSED/CANCELLED_BY_CLIENT/CANCELLED_BY_MASTER for urgent, plus EXPIRED for planned. DONE stays active pending existing explicit/legacy completion semantics; NO_MASTERS remains active and recoverable. No planned-v2 transition, legacy migration or timer change.

Owner/session isolation: no cross-owner cache. A mounted old owner's response, error or finally cannot write after logout/account change or superseding retry. No request while owner is absent. Server remains authoritative for ownership; no client-supplied owner filter or credentials persistence. Render, filter changes, detail navigation and retry are read-only; no POST.

All UI-owned strings/status labels in this slice use the canonical shared RU/KK/EN provider. Server-entered descriptions/names/categories are actual content, not translated identities. Vite visible tab navigation's four labels and existing new-request aria-label require small dictionary completion in this route prerequisite; other missing sections remain on the55-route inventory. Native browser geometry/focus/routing, dates/timezone and KK native-language review remain unverified.

Keep active/history controls and current destinations. Desktop Figma also contains All/Planned filters and planned CTA; these additional controls are outside this bounded two-route active/history contract and remain an explicit future parity item. Do not invent planned-v2 behavior or silently remove existing history access.

Partial failure requirement: a planned-list failure must not erase a valid urgent response. Track independent source outcomes, show partial/stale failure honestly, retain same-owner verified data while retrying and never show a global empty assertion when a source is unavailable. Logout/new owner discards every old source.

## Local implementation verification

The shared view and thin Next/Vite adapters preserve actual detail destinations, active/history predicates and independent owned GETs. A failed planned read retains urgent results, shows a localized incomplete-list warning and offers GET-only retry. Valid timestamps use the current locale; invalid/missing dates display a dash. Source tests preserve versioned direct totals/unknowns/real zero, actual cancellation amount applicability and legacy/planned amount selection. Invalid/noninteger quote versions do not establish a quote.

Mounted tests use the real route components and AuthProvider. Vite navigation uses MemoryRouter. Next tests use the installed Node next/link component with RouterContext and AppRouterContext adapters; this verifies href/click delegation and account/read behavior, not actual Next App Router hydration/history. The test-only resolver normalizes next/link and next/navigation to their installed .js entry points; native App Router/browser behavior remains unverified. Shared DOM tests cover three languages, active/history/empty/loading/partial retry, long/missing fields, statuses and encoded links. No implementation screenshot or live API journey is claimed.

Residual visual scope: desktop All/Planned filters, planned CTA and original side-card placement, original card/navigation icons and Vite desktop shell remain incomplete. No newly invented illustration/icon or ETA was added. KK wording still needs native-language review. Existing Vite large-chunk build warning remains; this batch adds no chunk-policy change.

Final local batch checks: 81 shared, 69 Next-client and 22 Vite tests; UI/client/master TypeScript; client/Vite/master production builds passed on Node 22.12.0 / pnpm 9.15.0. Exact-head CI is pending publication and is not implied by local checks.

### Source-token CTA correction

Follow-up source review found new-request CTA bg-primary and text-ink both resolve to #123B52, leaving no label contrast. The source153:2241 uses accent #FFE34A, primary brand text,12px radius and56px minimum height. The corrective delta restores those canonical tokens/classes and adds all-three-locale DOM regressions. This is source-token evidence, not a native screenshot.
