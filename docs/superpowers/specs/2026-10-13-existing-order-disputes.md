# Existing order-dispute safety and localization

## Finite scope

Four route bindings: Next client `/order/[id]/dispute`, Vite `/order/:id/dispute`, master `/disputes` and `/disputes/[id]`. Reuse presentation/read/action logic across clients. Preserve existing authentication/participant/server permissions, payment decisions and timestamps. Client planned-dispute wrappers retain their original implementation, rather than silently inheriting urgent changes. Master existing planned dispute contexts may still be read/replied to through the same existing contracts; no planned lifecycle v2 changes.

## Inspected source and actual gaps

High-fidelity contexts and screenshots: desktop client `93:1518` order-help form and `99:1504` sent view; desktop master `95:2099` reply/actual order-data aside; mobile `145:1899` help, `145:1909` sent, `285:4337` master help, `338:4584` client help/cancel. Desktop headings32, card padding24/radius16, body16/24, shared field/button primitives; mobile sheet heading24/body14/21/padding24/radius24/56px actions. Reflow rather than fixed card widths. Existing app shell is reused. No exact master-list design counterpart is established; its scoped list presentation is an existing-contract cleanup, not full screen parity.

Mobile general help before work, support intake/contact and notification delivery are absent contracts. Do not wire earlier order help into financial dispute POST, add cancellation controls or promise a notification reply. Desktop sample identities, amounts, PDFs and history claims are not data. Attachments currently allow JPEG/PNG10MiB, not PDF. No fake assets or attachment preview/download buttons. Attachments remain available only after an actual dispute exists; no atomic create-plus-attachment or unsupported preupload flow.

Current client form appears before authoritative GET, reports every dispute as opened, counts only newly selected evidence and invents a review timeline. Master list/detail reads are not owner/lifetime-safe and lack factual retries/locales. Current master confirmation says its reply cannot change, while PATCH does not enforce immutability. Replace that unsupported promise with a neutral explicit submission confirmation, preserving the existing read-only display once an actual statement exists.

## Existing authoritative contracts

`GET /orders/:id` returns order and latest actual dispute; master list uses `GET /disputes/mine`, resolves the actual order/planned target and gets context. `GET /disputes/:id/evidence` returns ID, uploader/isMine, MIME, scanStatus and createdAt; no original filename/preview is available.

`POST /orders/:id/disputes` sends existing `{reason}` string, nonblank/max2000. Existing client four reason-category choices plus description remain a single localized string, not a new DTO. Creation is restricted to participants in IN_PROGRESS/DONE/CLOSED, CLOSED within48 hours with valid closedAt; server remains authoritative. Existing partial unique OPEN indexes cover urgent/planned targets; no permanent one-dispute/replay/idempotency claim. A resolved dispute remains read-only in this existing UI; no new reopen feature.

`PATCH /disputes/:id` sends `{counterStatement}`, max2000, only OPEN and participant other than openedByUserId. Preserve current UI's display of existing nonempty counterstatement. Missing participant/opener context disables mutation. Evidence POST is participant/OPEN-only, JPEG/PNG10MiB and server scan protected. Direct versioned resolution rejects unapproved refund/sanction flags; untouched. Present actual resolution flags as recorded decisions, never proof of payment or fine execution.

## Safety design

Owner + target + API lifetime and verified GET generation guard all reads/writes/retained handlers. No absent-owner request, no old owner/target/ABA response or scan polling under a replacement token. Synchronous shared mutation lock, busy/offline guards, fresh verified context and current status/window checks precede initiation. Explicit local draft revisions reject handlers captured before changed text/Cancel; newest batched input works. Locale-only rerenders preserve current draft.

Initial/failed/malformed GET cannot expose an enabled form. Partial evidence-read failure does not erase valid context; it blocks evidence writes until authoritative evidence reconciliation. Failed refresh preserves current-owner context as explicitly stale and disables writes. Uncertain create/reply/upload outcome preserves current-memory text/file, invalidates freshness and requires authoritative context/evidence GET before another write; failed GET remains blocked. Actual returned statements/doc scan states are shown without filename matching or assumed rollback. Explicit upload retry warns it may create another evidence item. No files/private complaint text stored in browser caches. Full reload-safe upload identity/deduplication is not implemented or claimed.

Optional AbortSignal follows reviewed master upload/poll pattern in existing Next/Vite helper: check before token read/request, before/after each poll/delay, abort current owner/unmount cleanup. Existing endpoints/scan statuses/deadline/errors remain. Existing callers without signal retain behavior; no new automatic uploads or scanner bypass.

Actual GET status/reason/statement/resolution/timestamps/evidence replace local counts and invented steps. Versioned direct amounts use only finite authoritative quoteTotal after quoteVersion>0, actual zero remains0 and missing/prequote is unknown. Legacy/planned data is not given a newly calculated total; absent price-summary contract is an explicit parity gap. Unknown/malformed dates are not fabricated; canonical RU/KK/EN is used for UI labels only. Server/user content stays unchanged. Real order/list/Home links, no inert controls or auto-submission.

## Verification and remaining boundaries

Mounted fixtures must cover owner/target A→B→A, retained handlers after read/draft revision, duplicate writes, initial/error/malformed/partial GET, stale retry, allowed/blocked status/window/opener, all3locales, long/missing content, zero/null quote totals, OPEN/RESOLVED and real navigation. Uncertain committed-write/lost response, failed reconciliation, selected file retention and abort before/during polling are required. Include exact existing payload/no business mutation from render/navigation, native routing/geometry remain unverified. No real sensitive complaint, file or financial action in tests. Pinned full local checks and independent frozen review precede exact-tree PR38 append/full PostGIS+queue CI.
