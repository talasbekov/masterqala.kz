# Stage 5 — master desktop workspace

Implemented on `feat/desktop-map-first`, extending stage 4 tree `233c83fc03fb5d8d41c2cd06b85192cbc5490fd5`. No merge, push, deployment, production data or real financial operation.

## Design and contracts

CURRENT Figma file `0yR2Q2iy5rT9qrW3M83L1N`, canvas `558:5008`: header, typography, cards and spacing adapted from nodes `583:1217`, `583:1163`, `560:2721`, `583:1191`, `560:3338`, `579:1052`. These frames include future-model client screens; they are visual references only. Dedicated confirmed master workspace/profile/history frames were not found. Existing design source and original mobile components are preserved; the master adaptation does not claim pixel equality with a dedicated master design.

The workspace supplies Work, My orders, Disputes and Profile navigation, language selection and sign out. Protected routes preserve a validated same-origin destination through login. Stored-user loading is hydration-safe.

Urgent legacy orders use an authenticated owner-validated controller for accept, departure, arrival, quote and completion. Lifecycle >=2 retains its existing container. Quote drafts are owner/order/tab scoped. Every mutation has a synchronous lock and reconciles through GET; lost acceptance responses never trigger automatic POST replay.

Planned LEGACY feed supports saved unsent bid drafts, own submitted response, selection confirmation/decline, arrival, completion, cancellation and disputes. Submitted responses cannot be edited because the API has no such endpoint. Selected requests are available through My orders. Unassigned published details expose only the caller's bid, a total bid count and the existing redacted feed content.

`GET /master/orders` is a new read-only JWT contract. It returns assigned urgent and LEGACY planned summaries for the authenticated master, with bounded cursor pagination and all/active/history filters. It excludes client identity, address, task text, financial amounts, photographs and evidence. The full contract and access tests are documented in `apps/api/src/master-history/README.md`. Previously exposed foreign assigned planned details now return 403.

Application drafts persist per owner/tab, including unknown submission markers. Reopening requires fresh application data before another submit. Documents remain memory-only until explicit upload. ACTIVE profiles are honestly read-only under the current API. No local approval or production onboarding was fabricated.

Master dispute opening, replies and evidence use strict assigned-master checks, expected dispute identity and persisted owner/target/tab drafts. Unknown create/reply/upload outcomes require authoritative reads before another write. Both order routes and dispute-list detail routes use the desktop view.

## Verification

- Master suite: 159/159 tests passed; final production build passed.
- API suite: 266 passed, one pre-existing skipped test; 47 suites passed.
- Final PostgreSQL integration: 6/6 planned feed/history tests passed on isolated port 5433. No application database reset.
- Chrome 155 live local synthetic flows: urgent offer → accepted → on-way → inspection → price → in-progress → done → closed; planned feed → bid → client selection → confirmed → on-site → done → closed.
- Additional live checks: planned decline/cancel release private details; foreign-master reads return 403; anonymous history returns 401; minimal paginated history; recoverable history read failure; master-created dispute with attachment; master reply to a client dispute.
- Registration: real local CONSOLE OTP, safe return route, draft reload/Back, unknown POST outcome reconciliation, single submission, document upload and logout cleanup.
- RU/KK/EN; desktop 1440/1366 and mobile 390; no horizontal overflow or JavaScript page errors in completed browser runs.
- Independent source review identified two navigation gaps; both corrected and rechecked. No remaining P1/P2 findings.

## Limits retained

Local mode is FREE_PILOT with CONSOLE SMS. No PAID_LIVE or PLATFORM_V1_RESERVED activation. Local DB verification: payment transactions, accruals, withdrawal requests and reserved planned records remain zero. Work amounts are synthetic test quotes, not platform payment evidence.

`FILE_SCAN_MODE=DISABLED` is the pre-existing local application attachment scanner. Its CLEAN result does not validate malware scanning. Read-only Windows Defender status confirmed antivirus, real-time protection, behavior monitor and IOAV enabled; no system security setting changed.

The history is the current assigned-order set, not an immutable audit log of released assignments. ACTIVE profile editing, submitted-bid editing, operator approval and the new platform financial model are not implemented here. Operator desktop is a separate stage. External merge-triggered hosting/deploy remains outside this local verification.
