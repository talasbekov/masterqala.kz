-- Existing rows remain lifecycle v1; new rules are explicitly stamped on creation.
ALTER TYPE "CommercialMode" ADD VALUE IF NOT EXISTS 'DIRECT_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PRICE_APPROVED';
ALTER TABLE "Order"
 ADD COLUMN "lifecycleVersion" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "dispatchMode" TEXT NOT NULL DEFAULT 'WAVE',
 ADD COLUMN "departedAt" TIMESTAMP(3),
 ADD COLUMN "materialsPrice" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "quoteVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "consentedVersion" INTEGER,
 ADD COLUMN "quoteApprovedAt" TIMESTAMP(3),
 ADD COLUMN "workStartedAt" TIMESTAMP(3),
 ADD COLUMN "cancellationAmount" INTEGER;
ALTER TABLE "OrderOffer" ADD COLUMN "expiresAt" TIMESTAMP(3), ADD COLUMN "sequential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD CONSTRAINT "Order_v2_amounts_nonnegative" CHECK ("lifecycleVersion" < 2 OR ("calloutPrice" >= 0 AND "serviceFee" = 0 AND "materialsPrice" >= 0 AND ("workPrice" IS NULL OR "workPrice" >= 0) AND ("cancellationAmount" IS NULL OR "cancellationAmount" >= 0)));
CREATE UNIQUE INDEX "OrderOffer_one_pending_sequential" ON "OrderOffer" ("orderId", "attempt") WHERE "outcome" = 'PENDING' AND "sequential" = true;
