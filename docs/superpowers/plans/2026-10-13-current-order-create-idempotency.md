# Current-order creation idempotency proposal

Status: design only; backend implementation requires review. Applies to POST /orders, not planned orders, payments or quote actions.

## Existing evidence

- `apps/api/src/orders/dto.ts`: CreateOrderDto has no request identity.
- `orders.controller.ts`: photo-reference authorization precedes service creation; authenticated owned-order GET routes already exist.
- `orders.service.ts:80–155`: category/pricing checks precede a transaction. The transaction locks the client's User row and rechecks active orders, then creates Order/OrderPhoto/location. This prevents simultaneous active-order duplicates but does not identify a replay after the first order has completed/cancelled.
- Payment hold, CREATED→SEARCHING transition and queue enqueue occur after the creation transaction. Their failure may leave an actual created order despite an unsuccessful HTTP response. A retry must not blindly create another order or repeat side effects.
- Prisma uses additive migrations and nullable fields for existing data. No legacy rows need rewriting.

## Proposed contract and storage

Add optional UUID `clientRequestId` to validated CreateOrderDto, preserving callers that omit it. The client allocates one stable key for an intentional submission and retains it while its result is uncertain; editing a previously submitted payload must not silently reuse that key.

Add `OrderCreationRequest` with ownerId (User relation), requestKey, payloadHash, orderId (Order relation), optional successfulResponse JSON, createdAt. Add a unique `(ownerId, requestKey)` constraint and unique orderId. Historical orders have no associated request record. This is an additive table/migration, not a legacy backfill or fee change.

Compute SHA256 over a documented canonical representation of validated submitted category/description/address/district/coordinates/optional address fields and uploaded references. Preserve array ordering, normalize omitted optional values consistently, exclude clientRequestId and server-derived prices/mode. Do not hash tokens or log the submitted address/body. The owner is part of the unique identity, so another account cannot replay or inspect an owner's request.

## Transaction and replay

1. Validate authentication and request syntax. If a key is present, look up that owner's existing record before active-order and expiring-photo checks. This replay lookup must occur in the controller/coordinator before `photoReferences.assertAvailable`, not only inside OrdersService after that assertion. Equal key with unequal hash returns 409 with a stable machine code; never mutate the original order.
2. For a new key, retain existing validation and the User-row lock. The keyed path must not reject on the existing outside-transaction active count: an identical request can commit between the outside lookup and that count. Inside the User-row lock, recheck the owner/key record FIRST and only then apply active-order rejection for a genuinely new key. Create the Order and request mapping atomically. Unique constraints remain a second concurrency barrier. No durable mapping is created for a pre-creation validation/active-order rejection.
3. A concurrent equal-key request waits for the transaction and returns the mapped order, not an active-order conflict. A concurrent changed-body request returns the deterministic conflict. Different keys retain the existing active-order policy.
4. After successful normal completion, persist the successful creation response snapshot only AFTER the normal controller presentation/redaction (including canonical commercial-mode presentation and permitted fields). Replay that presented/redacted snapshot, not a raw Prisma object, for exact successful response replay. The original and replays identify the same order. A replay header may identify the replay without altering existing response shape.
5. If the order transaction committed but post-commit payment/transition/queue work failed, the mapping still identifies the exact order. A missing snapshot means committed-but-processing/unknown post-commit completion, not a failed create. Return a distinct 202 recovery response keeping the presented order at the response top level (including its exact `id`) plus a machine-readable `creationProcessing: true` flag; do not cache this interim response as a successful creation snapshot. The client follows the exact owned order instead of unlocking a new submission. Return its authenticated canonical current state on recovery when no successful snapshot exists; do not infer failure, create another order, repeat a hold or blindly enqueue. Explicitly distinguish this recovery response from cached successful replay in documentation/tests. Existing GET /orders/:id then supplies authoritative current lifecycle state.

Post-commit dispatch/payment recovery is a separate existing open loop: confirm existing queue-enabled recovery or an outbox/recovery worker before promising automatic recovery of a CREATED order. Request idempotency establishes exact order identity, not successful dispatch. No queue/security/financial change is included without its own evidence and review.

## Tests and release checks

- DTO optional/invalid UUID; legacy no-key compatibility.
- Identical same-owner replay returns the same order and successful cached response; different owner with identical key remains isolated.
- Changed payload (including coordinates/photos) conflicts without mutating the original.
- Real PostGIS concurrency: equal key/equal body produces one Order/one mapping; equal key/changed body conflicts; different keys preserve existing row-lock active-order behavior.
- Rollback before order commit leaves no reservation; failure after order commit retains exact mapping and recovery never performs another create/hold/queue call.
- Photo expiry/consumption after a successful submission does not invalidate an already authorized exact replay.
- Client reload/back/auth return retains key; response loss can replay that exact request rather than match similar orders. Confirmed response clears only its matching local draft/marker. No offline automatic submission queue.
- Additive migration on existing fixture rows, fresh migration chain, pinned unit/PostGIS E2E/all builds; queue-enabled recovery remains separately verified.

Review questions: approve snapshot replay versus canonical current-state recovery behavior; confirm request-key retention policy (retaining the mapping for the order's lifetime avoids a timed-out key becoming a fresh submission); choose explicit post-commit recovery ownership. Implementation is not authorized by this proposal alone.
