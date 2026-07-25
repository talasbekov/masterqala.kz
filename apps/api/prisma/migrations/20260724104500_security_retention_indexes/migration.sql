CREATE INDEX "PendingUpload_terminal_retention_idx"
  ON "PendingUpload"("scanStatus", "scannedAt")
  WHERE "consumedAt" IS NULL;

CREATE INDEX "PendingUpload_consumedAt_idx"
  ON "PendingUpload"("consumedAt")
  WHERE "consumedAt" IS NOT NULL;

CREATE INDEX "MasterDocument_terminal_retention_idx"
  ON "MasterDocument"("scanStatus", "scannedAt")
  WHERE "purgedAt" IS NULL;

CREATE INDEX "DisputeEvidence_terminal_retention_idx"
  ON "DisputeEvidence"("scanStatus", "scannedAt")
  WHERE "purgedAt" IS NULL;
