-- Note: this migration intentionally does NOT drop "MasterPresence_location_idx" /
-- "Order_location_idx" even though Prisma's diff engine proposed dropping them.
-- Those GIST indexes were created via raw SQL in migration
-- 20260715072332_stage2_urgent_orders because Prisma cannot express indexes on
-- Unsupported("geography(...)") columns in schema.prisma. Since they're invisible
-- to the schema, every future `prisma migrate dev` will keep proposing to drop them;
-- they are load-bearing for the ST_DWithin/ST_Distance queries in
-- src/orders/matching.service.ts, so we preserve them here (same fix as the
-- client_v2_backend_extensions migration).

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "plannedOrderId" TEXT,
    "clientId" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_plannedOrderId_key" ON "Review"("plannedOrderId");

-- CreateIndex
CREATE INDEX "Review_masterUserId_idx" ON "Review"("masterUserId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_plannedOrderId_fkey" FOREIGN KEY ("plannedOrderId") REFERENCES "PlannedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
