-- Additive owner-scoped identity and durable expiry dispatch intent.
-- Historical planned orders and their commercial/lifecycle modes are unchanged.
CREATE TABLE "PlannedOrderCreationRequest" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "expiryScheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannedOrderCreationRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlannedOrderCreationRequest_ownerId_requestKey_key" ON "PlannedOrderCreationRequest" ("ownerId", "requestKey");
CREATE UNIQUE INDEX "PlannedOrderCreationRequest_orderId_key" ON "PlannedOrderCreationRequest" ("orderId");
CREATE INDEX "PlannedOrderCreationRequest_expiryScheduledAt_createdAt_idx" ON "PlannedOrderCreationRequest" ("expiryScheduledAt", "createdAt");
ALTER TABLE "PlannedOrderCreationRequest" ADD CONSTRAINT "PlannedOrderCreationRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedOrderCreationRequest" ADD CONSTRAINT "PlannedOrderCreationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PlannedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
