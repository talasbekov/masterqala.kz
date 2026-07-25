ALTER TABLE "SecurityAlert"
  ADD COLUMN "responseDueAt" TIMESTAMP(3),
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "lastDeliveryAt" TIMESTAMP(3);

UPDATE "SecurityAlert"
SET "responseDueAt" = "firstSeenAt" + CASE "severity"
  WHEN 'CRITICAL' THEN INTERVAL '15 minutes'
  WHEN 'HIGH' THEN INTERVAL '1 hour'
  ELSE INTERVAL '4 hours'
END
WHERE "responseDueAt" IS NULL;

ALTER TABLE "SecurityAlert"
  ALTER COLUMN "responseDueAt" SET NOT NULL;

CREATE INDEX "SecurityAlert_status_responseDueAt_idx"
  ON "SecurityAlert"("status", "responseDueAt")
  WHERE "status" = 'OPEN';

CREATE TABLE "SecurityAlertDelivery" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "alertId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "deliveryKind" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAlertDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityAlertDelivery_channel_check" CHECK ("channel" IN ('WEBHOOK')),
  CONSTRAINT "SecurityAlertDelivery_kind_check" CHECK ("deliveryKind" IN ('OPENED', 'REPEATED', 'ESCALATED', 'RESOLVED')),
  CONSTRAINT "SecurityAlertDelivery_status_check" CHECK ("status" IN ('SUCCESS', 'FAILED', 'SKIPPED')),
  CONSTRAINT "SecurityAlertDelivery_attempt_check" CHECK ("attempt" >= 1)
);

ALTER TABLE "SecurityAlertDelivery"
  ADD CONSTRAINT "SecurityAlertDelivery_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "SecurityAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SecurityAlertDelivery_alertId_createdAt_idx"
  ON "SecurityAlertDelivery"("alertId", "createdAt" DESC);

CREATE FUNCTION security_alert_sla_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."responseDueAt" IS NULL THEN
    NEW."responseDueAt" := NEW."firstSeenAt" + CASE NEW."severity"
      WHEN 'CRITICAL' THEN INTERVAL '15 minutes'
      WHEN 'HIGH' THEN INTERVAL '1 hour'
      ELSE INTERVAL '4 hours'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SecurityAlert_sla_defaults"
BEFORE INSERT ON "SecurityAlert"
FOR EACH ROW EXECUTE FUNCTION security_alert_sla_defaults();