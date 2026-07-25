CREATE TABLE "PendingUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingUpload_path_key" ON "PendingUpload"("path");
CREATE INDEX "PendingUpload_userId_consumedAt_expiresAt_idx"
  ON "PendingUpload"("userId", "consumedAt", "expiresAt");
CREATE INDEX "PendingUpload_expiresAt_consumedAt_idx"
  ON "PendingUpload"("expiresAt", "consumedAt");

ALTER TABLE "PendingUpload"
  ADD CONSTRAINT "PendingUpload_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
    AND "consumedAt" IS NULL
    AND "expiresAt" > CURRENT_TIMESTAMP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending upload is unavailable, expired, consumed, or belongs to another user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderPhoto_consume_pending_upload"
BEFORE INSERT ON "OrderPhoto"
FOR EACH ROW EXECUTE FUNCTION consume_pending_upload_for_photo();

CREATE TRIGGER "PlannedOrderPhoto_consume_pending_upload"
BEFORE INSERT ON "PlannedOrderPhoto"
FOR EACH ROW EXECUTE FUNCTION consume_pending_upload_for_photo();
