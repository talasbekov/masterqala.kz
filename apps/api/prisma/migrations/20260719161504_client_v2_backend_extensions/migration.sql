/*
  Warnings:

  - You are about to drop the column `scheduledAt` on the `PlannedOrder` table. All the data in the column will be lost.
  - Added the required column `district` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotEnd` to the `PlannedOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotStart` to the `PlannedOrder` table without a default value. This is not possible if the table is not empty.

  Note: this migration intentionally does NOT drop "MasterPresence_location_idx" /
  "Order_location_idx" even though Prisma's diff engine proposed dropping them.
  Those GIST indexes were created via raw SQL in migration
  20260715072332_stage2_urgent_orders because Prisma cannot express indexes on
  Unsupported("geography(...)") columns in schema.prisma. Since they're invisible
  to the schema, every future `prisma migrate dev` will keep proposing to drop them;
  they are load-bearing for the ST_DWithin/ST_Distance queries in
  src/orders/matching.service.ts, so we preserve them here.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressComment" TEXT,
ADD COLUMN     "apartment" TEXT,
ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "entrance" TEXT,
ADD COLUMN     "floor" TEXT;

-- AlterTable
ALTER TABLE "PlannedOrder" DROP COLUMN "scheduledAt",
ADD COLUMN     "addressComment" TEXT,
ADD COLUMN     "apartment" TEXT,
ADD COLUMN     "budget" INTEGER,
ADD COLUMN     "entrance" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "slotEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "slotStart" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "OrderPhoto" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedOrderPhoto" (
    "id" TEXT NOT NULL,
    "plannedOrderId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedOrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "entrance" TEXT,
    "floor" TEXT,
    "apartment" TEXT,
    "comment" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPhoto_orderId_idx" ON "OrderPhoto"("orderId");

-- CreateIndex
CREATE INDEX "PlannedOrderPhoto_plannedOrderId_idx" ON "PlannedOrderPhoto"("plannedOrderId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- AddForeignKey
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrderPhoto" ADD CONSTRAINT "PlannedOrderPhoto_plannedOrderId_fkey" FOREIGN KEY ("plannedOrderId") REFERENCES "PlannedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
