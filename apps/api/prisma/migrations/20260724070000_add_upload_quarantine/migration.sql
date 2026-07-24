ALTER TABLE "PendingUpload"
  ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
  ADD COLUMN "scanAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "scanError" TEXT;

ALTER TABLE "PendingUpload"
  ADD CONSTRAINT "PendingUpload_scanStatus_check"
  CHECK ("scanStatus" IN ('PENDING_SCAN', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED'));

ALTER TABLE "PendingUpload"
  ADD CONSTRAINT "PendingUpload_scanAttempts_check"
  CHECK ("scanAttempts" >= 0);

CREATE INDEX "PendingUpload_scanStatus_expiresAt_scanAttempts_idx"
  ON "PendingUpload"("scanStatus", "expiresAt", "scanAttempts");

CREATE OR REPLACE FUNCTION consume_pending_upload_for_photo()
RETURNS TRIGGER AS $$
DECLARE
  expected_user_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'OrderPhoto' THEN
    SELECT "clientId" INTO expected_user_id
    FROM "Order"
    WHERE "id" = NEW."orderId";
  ELSIF TG_TABLE_NAME = 'PlannedOrderPhoto' THEN
    SELECT "clientId" INTO expected_user_id
    FROM "PlannedOrder"
    WHERE "id" = NEW."plannedOrderId";
  ELSE
    RAISE EXCEPTION 'Unsupported photo table: %', TG_TABLE_NAME;
  END IF;

  UPDATE "PendingUpload"
  SET "consumedAt" = CURRENT_TIMESTAMP
  WHERE "path" = NEW."path"
    AND "userId" = expected_user_id
    AND "scanStatus" = 'CLEAN'
    AND "consumedAt" IS NULL
    AND "expiresAt" > CURRENT_TIMESTAMP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending upload is unavailable, not clean, expired, consumed, or belongs to another user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
