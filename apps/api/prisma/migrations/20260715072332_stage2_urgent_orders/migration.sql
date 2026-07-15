CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'SEARCHING', 'ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION', 'AWAITING_PRICE_CONFIRM', 'IN_PROGRESS', 'DONE', 'CLOSED', 'NO_MASTERS', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER', 'DISPUTE');

-- CreateEnum
CREATE TYPE "OfferOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('HOLD', 'CAPTURE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccrualType" AS ENUM ('CALLOUT_COMPENSATION');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "location" geography(Point, 4326),
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "masterId" TEXT,
    "wave" INTEGER NOT NULL DEFAULT 0,
    "searchAttempt" INTEGER NOT NULL DEFAULT 1,
    "calloutPrice" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL,
    "workPrice" INTEGER,
    "workComment" TEXT,
    "cancelReason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "onSiteAt" TIMESTAMP(3),
    "priceProposedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "wave" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "outcome" "OfferOutcome" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterPresence" (
    "masterUserId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" geography(Point, 4326),

    CONSTRAINT "MasterPresence_pkey" PRIMARY KEY ("masterUserId")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accrual" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "AccrualType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_clientId_status_idx" ON "Order"("clientId", "status");

-- CreateIndex
CREATE INDEX "Order_masterId_status_idx" ON "Order"("masterId", "status");

-- CreateIndex
CREATE INDEX "OrderOffer_masterUserId_outcome_idx" ON "OrderOffer"("masterUserId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOffer_orderId_masterUserId_attempt_key" ON "OrderOffer"("orderId", "masterUserId", "attempt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_type_idx" ON "PaymentTransaction"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Accrual_orderId_key" ON "Accrual"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPresence" ADD CONSTRAINT "MasterPresence_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Order_location_idx" ON "Order" USING GIST ("location");
CREATE INDEX "MasterPresence_location_idx" ON "MasterPresence" USING GIST ("location");
