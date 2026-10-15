-- Additive identity mapping: historical orders remain unchanged.
CREATE TABLE "OrderCreationRequest" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "successfulResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderCreationRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderCreationRequest_ownerId_requestKey_key" ON "OrderCreationRequest" ("ownerId", "requestKey");
CREATE UNIQUE INDEX "OrderCreationRequest_orderId_key" ON "OrderCreationRequest" ("orderId");
ALTER TABLE "OrderCreationRequest" ADD CONSTRAINT "OrderCreationRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCreationRequest" ADD CONSTRAINT "OrderCreationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
