ALTER TABLE "MasterDocument"
  ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
  ADD COLUMN "scanAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "scanError" TEXT,
  ADD COLUMN "cdrStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';

UPDATE "MasterDocument"
SET "cdrStatus" = CASE
  WHEN "mimeType" = 'application/pdf' THEN 'BYPASSED'
  ELSE 'NOT_REQUIRED'
END;

ALTER TABLE "MasterDocument"
  ALTER COLUMN "scanStatus" SET DEFAULT 'PENDING_SCAN';

ALTER TABLE "MasterDocument"
  ADD CONSTRAINT "MasterDocument_scanStatus_check"
    CHECK ("scanStatus" IN ('PENDING_SCAN', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED')),
  ADD CONSTRAINT "MasterDocument_scanAttempts_check"
    CHECK ("scanAttempts" >= 0),
  ADD CONSTRAINT "MasterDocument_cdrStatus_check"
    CHECK ("cdrStatus" IN ('NOT_REQUIRED', 'PENDING', 'SANITIZED', 'BYPASSED', 'CDR_FAILED'));

CREATE INDEX "MasterDocument_scanStatus_createdAt_idx"
  ON "MasterDocument"("scanStatus", "createdAt");

CREATE TABLE "DisputeEvidence" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "scanStatus" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
  "scanAttempts" INTEGER NOT NULL DEFAULT 0,
  "scannedAt" TIMESTAMP(3),
  "scanError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeEvidence_scanStatus_check"
    CHECK ("scanStatus" IN ('PENDING_SCAN', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED')),
  CONSTRAINT "DisputeEvidence_scanAttempts_check"
    CHECK ("scanAttempts" >= 0)
);

CREATE UNIQUE INDEX "DisputeEvidence_path_key" ON "DisputeEvidence"("path");
CREATE INDEX "DisputeEvidence_disputeId_createdAt_idx" ON "DisputeEvidence"("disputeId", "createdAt");
CREATE INDEX "DisputeEvidence_scanStatus_createdAt_idx" ON "DisputeEvidence"("scanStatus", "createdAt");

ALTER TABLE "DisputeEvidence"
  ADD CONSTRAINT "DisputeEvidence_disputeId_fkey"
  FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisputeEvidence"
  ADD CONSTRAINT "DisputeEvidence_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
