-- CreateEnum
CREATE TYPE "PlannedOrderStatus" AS ENUM ('CREATED', 'PUBLISHED', 'MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER', 'DISPUTE');

-- CreateEnum
CREATE TYPE "LeadCreditTxType" AS ENUM ('PURCHASE', 'SPEND', 'REFUND');

-- DropIndex
DROP INDEX "MasterPresence_location_idx";

-- DropIndex
DROP INDEX "Order_location_idx";

-- AlterTable
ALTER TABLE "MasterProfile" ADD COLUMN     "priorityPenaltyUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlannedOrder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PlannedOrderStatus" NOT NULL DEFAULT 'CREATED',
    "masterId" TEXT,
    "selectedBidId" TEXT,
    "workPrice" INTEGER,
    "cancelReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "selectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedOrderBid" (
    "id" TEXT NOT NULL,
    "plannedOrderId" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedOrderBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCreditAccount" (
    "masterUserId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadCreditAccount_pkey" PRIMARY KEY ("masterUserId")
);

-- CreateTable
CREATE TABLE "LeadCreditTransaction" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "type" "LeadCreditTxType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "bidId" TEXT,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCreditPurchase" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceTenge" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannedOrder_selectedBidId_key" ON "PlannedOrder"("selectedBidId");

-- CreateIndex
CREATE INDEX "PlannedOrder_clientId_status_idx" ON "PlannedOrder"("clientId", "status");

-- CreateIndex
CREATE INDEX "PlannedOrder_masterId_status_idx" ON "PlannedOrder"("masterId", "status");

-- CreateIndex
CREATE INDEX "PlannedOrder_categoryId_status_idx" ON "PlannedOrder"("categoryId", "status");

-- CreateIndex
CREATE INDEX "PlannedOrderBid_plannedOrderId_idx" ON "PlannedOrderBid"("plannedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedOrderBid_plannedOrderId_masterUserId_key" ON "PlannedOrderBid"("plannedOrderId", "masterUserId");

-- CreateIndex
CREATE INDEX "LeadCreditTransaction_masterUserId_createdAt_idx" ON "LeadCreditTransaction"("masterUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlannedOrder" ADD CONSTRAINT "PlannedOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrder" ADD CONSTRAINT "PlannedOrder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrder" ADD CONSTRAINT "PlannedOrder_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrder" ADD CONSTRAINT "PlannedOrder_selectedBidId_fkey" FOREIGN KEY ("selectedBidId") REFERENCES "PlannedOrderBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrderBid" ADD CONSTRAINT "PlannedOrderBid_plannedOrderId_fkey" FOREIGN KEY ("plannedOrderId") REFERENCES "PlannedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOrderBid" ADD CONSTRAINT "PlannedOrderBid_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCreditAccount" ADD CONSTRAINT "LeadCreditAccount_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCreditTransaction" ADD CONSTRAINT "LeadCreditTransaction_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCreditPurchase" ADD CONSTRAINT "LeadCreditPurchase_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
