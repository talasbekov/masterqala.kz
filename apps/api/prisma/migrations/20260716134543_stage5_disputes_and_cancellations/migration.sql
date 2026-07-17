-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeTargetRole" AS ENUM ('CLIENT', 'MASTER');

-- CreateEnum
CREATE TYPE "CancelledOrderType" AS ENUM ('URGENT', 'PLANNED');

-- AlterEnum
ALTER TYPE "LeadCreditTxType" ADD VALUE 'PENALTY';

-- AlterTable
ALTER TABLE "MasterProfile" ADD COLUMN     "blockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "plannedOrderId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "openedByRole" "DisputeTargetRole" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceDocIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "counterStatement" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "refundServiceFee" BOOLEAN,
    "penalizeMaster" BOOLEAN,
    "resolutionNote" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCancellation" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "orderType" "CancelledOrderType" NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_plannedOrderId_idx" ON "Dispute"("plannedOrderId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "MasterCancellation_masterUserId_createdAt_idx" ON "MasterCancellation"("masterUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_plannedOrderId_fkey" FOREIGN KEY ("plannedOrderId") REFERENCES "PlannedOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCancellation" ADD CONSTRAINT "MasterCancellation_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Dispute_open_order_unique" ON "Dispute" ("orderId") WHERE status = 'OPEN' AND "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "Dispute_open_planned_order_unique" ON "Dispute" ("plannedOrderId") WHERE status = 'OPEN' AND "plannedOrderId" IS NOT NULL;
