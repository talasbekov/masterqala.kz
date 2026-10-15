# Current-order create identity: local implementation evidence

## Additive contract

The dedicated POST /orders/idempotent requires a validated UUID clientRequestId. Old APIs have no such route and return404 before mutation; clients must never fall back from this route to legacy creation. POST /orders also retains the optional key contract, while callers without a key retain existing behavior. Legacy callers retain the existing response and behavior. Keyed submissions hash only canonical validated task/address/location/photo fields; owner + key is unique. Order and exact request mapping are created atomically under the existing User-row lock. The under-lock key lookup precedes active-order rejection; keyed creation avoids the racy unlocked outside active count. A changed payload for the same owner/key returns 409 IDEMPOTENCY_PAYLOAD_MISMATCH.

The controller replay lookup precedes photo-reference revalidation. Successful response snapshots are stored only after existing commercial-mode presentation/redaction and JSON HTTP serialization. Replays return that snapshot. A mapping with no successful snapshot proves an exact committed order, not failed creation: response202 retains the presented order/id at top level and adds creationProcessing:true. A post-commit exception also resolves this exact identity where possible. Recovery does not repeat order creation, payment hold, lifecycle transition or dispatch enqueue.

The new OrderCreationRequest table is additive, with owner/key and order unique constraints and owner/order foreign keys. No historical order rows or prices are rewritten. Deleting an order or user through an existing authorized path cascades its mapping; normal request mappings otherwise remain for the order's lifetime.

## Verified locally

Node22.12.0/pnpm9.15.0: Prisma generation, API production build and41unit suites198tests pass. Sixteen new unit tests cover DTO optional/invalid key, canonical hashing, owner isolation/changed-body conflict, JSON presented snapshot retention, additive migration source constraints, transaction key-before-active ordering, unchanged fresh dispatch, replay side-effect suppression, presented controller replay before photo guard, committed-processing response and legacy compatibility. Migration source assertions are not database application evidence.

Eight real PostGIS HTTP E2E cases are added for successful replay, expired guard ordering, same-key concurrency, changed concurrent payload, owner isolation/different-key active protection, rejected request reservation and post-commit enqueue failure recovery, dedicated-route missing-key rejection and PAID_MOCK hold-failure identity/replay. They have not run locally: this workspace has no PostgreSQL/PostGIS service. Applying the additive migration and running these database/concurrency tests requires the existing CI service after independent review/publication. No real database success is claimed yet.

## Remaining integration and limits

The reviewed client draft-safety checkpoint remains preserved separately. The dedicated endpoint contract is required before rolling out client exact-key recovery. Its current POST still omits clientRequestId, so this backend contract is opt-in and does not yet complete native reload recovery. The next client integration must transmit the retained exact key and recover only that submitted intent; never match orders by similar fields or blindly reset an unknown result.

Committed-but-processing identification does not recover failed dispatch/payment work automatically. Existing queue-enabled/post-commit recovery must be verified separately; no outbox, payment policy or production setting is changed here. Real two-role browser/SMS/reload/queue-enabled journeys and native Figma geometry remain unverified. This backend batch is local and requires independent review before publication.
