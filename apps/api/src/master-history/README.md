# Master assigned-order reads

`GET /api/v1/master/orders` uses the existing JWT guard. The authenticated user must have a master profile; the user ID is never accepted as a request parameter. A profile in any status can read its own historical assignments. Blocked users remain denied by the JWT guard. This endpoint grants no operator override.

Query parameters:

- `filter=all|active|history` (default `all`). `history` includes urgent `CLOSED`, `NO_MASTERS`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_MASTER`, and planned `CLOSED`, `EXPIRED`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_MASTER`. `active` contains the other statuses, including `DONE` while awaiting closure and planned `MASTER_SELECTED` while awaiting confirmation.
- `limit=1..50` (default `20`). Both database reads are bounded to `limit + 1`.
- `cursor=<opaque nextCursor>` from the preceding page, for the same owner and filter. Invalid, foreign-owner, and filter-mismatched cursors return 400. Unknown query parameters return 400.

Response: `{ items: Array<{ kind: 'urgent' | 'planned', id, status, district, createdAt, category: { slug, name } }>, nextCursor: string | null }`. It excludes addresses, client identities/contact details, free-text descriptions, photographs, disputes/evidence, bids, and financial data. `Cache-Control: private, no-store` applies.

Membership is exactly `masterId = authenticated user.id`. Offers and bids do not establish membership. Planned results are restricted to supported `LEGACY` lifecycle records. Records whose master assignment has been cleared are absent; this is an assigned-order list, not an immutable audit log of every past offer or assignment.

Ordering is `createdAt DESC`, then `kind ASC` (`planned` before `urgent`), then `id DESC`. Cursor pagination uses these immutable keys, and does not offset through changing rows. Changes to assignment or status between requests are reflected at read time; this API does not claim a transactionally frozen snapshot across pages. Reload starts a new first page. All operations are reads and do not create, accept, change, or pay for orders.

Detail navigation uses existing `/orders/:id` and `/planned-orders/:id` APIs. Urgent detail already checks client/master/operator access. Planned detail now denies foreign assigned/terminal records; unassigned `PUBLISHED` detail remains available to an ACTIVE master in the matching category with existing contact redaction. That feed response additionally exposes only the caller's `ownBid` summary (or null) and `_count.bids`, clears `dispute`, and keeps other bidders hidden, to support the existing bid reconciliation UI.

Tests: `src/master-history/master-history.spec.ts` exercises the actual JWT guard and HTTP controller with a deterministic Prisma fixture layer; `test/master-history.e2e-spec.ts` verifies actual Prisma/PostgreSQL owner predicates, field projection, and cross-table cursor ties against local port 5433 using only suite-owned UUID fixtures. The frontend suite `apps/master/test/master-history.test.mjs` covers RU/KK/EN, links, read errors, filtering, pagination and request lifetime isolation.
