ALTER TABLE "SecurityAlert"
  ADD COLUMN "assignedToUserId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgeBy" TIMESTAMP(3),
  ADD COLUMN "resolveBy" TIMESTAMP(3),
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SecurityAlert"
  ADD CONSTRAINT "SecurityAlert_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SecurityAlert_escalationLevel_check"
  CHECK ("escalationLevel" >= 0 AND "escalationLevel" <= 2);

CREATE INDEX "SecurityAlert_assigned_status_idx"
  ON "SecurityAlert"("assignedToUserId", "status", "lastSeenAt" DESC);
CREATE INDEX "SecurityAlert_acknowledgeBy_open_idx"
  ON "SecurityAlert"("acknowledgeBy") WHERE "status" = 'OPEN';
CREATE INDEX "SecurityAlert_resolveBy_ack_idx"
  ON "SecurityAlert"("resolveBy") WHERE "status" = 'ACKNOWLEDGED';

CREATE TABLE "SecurityAlertDelivery" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "alertId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'WEBHOOK',
  "reason" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "responseCode" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAlertDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityAlertDelivery_channel_check"
    CHECK ("channel" IN ('WEBHOOK')),
  CONSTRAINT "SecurityAlertDelivery_reason_check"
    CHECK ("reason" IN ('INITIAL', 'SEVERITY_UPGRADE', 'ACK_SLA_BREACH', 'RESOLUTION_SLA_BREACH', 'MANUAL_RETRY')),
  CONSTRAINT "SecurityAlertDelivery_status_check"
    CHECK ("status" IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'EXHAUSTED')),
  CONSTRAINT "SecurityAlertDelivery_attemptCount_check"
    CHECK ("attemptCount" >= 0),
  CONSTRAINT "SecurityAlertDelivery_responseCode_check"
    CHECK ("responseCode" IS NULL OR ("responseCode" >= 100 AND "responseCode" <= 599))
);

ALTER TABLE "SecurityAlertDelivery"
  ADD CONSTRAINT "SecurityAlertDelivery_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "SecurityAlert"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SecurityAlertDelivery_dedupeKey_key"
  ON "SecurityAlertDelivery"("dedupeKey");
CREATE INDEX "SecurityAlertDelivery_dispatch_idx"
  ON "SecurityAlertDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "SecurityAlertDelivery_alert_createdAt_idx"
  ON "SecurityAlertDelivery"("alertId", "createdAt" DESC);

CREATE FUNCTION security_alert_ack_interval(severity_value TEXT)
RETURNS INTERVAL AS $$
  SELECT CASE severity_value
    WHEN 'CRITICAL' THEN INTERVAL '15 minutes'
    WHEN 'HIGH' THEN INTERVAL '60 minutes'
    ELSE INTERVAL '240 minutes'
  END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE FUNCTION security_alert_resolve_interval(severity_value TEXT)
RETURNS INTERVAL AS $$
  SELECT CASE severity_value
    WHEN 'CRITICAL' THEN INTERVAL '120 minutes'
    WHEN 'HIGH' THEN INTERVAL '480 minutes'
    ELSE INTERVAL '1440 minutes'
  END;
$$ LANGUAGE SQL IMMUTABLE;

UPDATE "SecurityAlert"
SET "acknowledgeBy" = "firstSeenAt" + security_alert_ack_interval("severity"),
    "resolveBy" = "firstSeenAt" + security_alert_resolve_interval("severity")
WHERE "status" != 'RESOLVED';

CREATE FUNCTION set_security_alert_deadlines()
RETURNS TRIGGER AS $$
DECLARE
  ack_deadline TIMESTAMP(3);
  resolve_deadline TIMESTAMP(3);
BEGIN
  IF TG_OP = 'INSERT' OR OLD."severity" IS DISTINCT FROM NEW."severity" THEN
    ack_deadline := NEW."firstSeenAt" + security_alert_ack_interval(NEW."severity");
    resolve_deadline := NEW."firstSeenAt" + security_alert_resolve_interval(NEW."severity");

    IF NEW."acknowledgeBy" IS NULL OR ack_deadline < NEW."acknowledgeBy" THEN
      NEW."acknowledgeBy" := ack_deadline;
    END IF;
    IF NEW."resolveBy" IS NULL OR resolve_deadline < NEW."resolveBy" THEN
      NEW."resolveBy" := resolve_deadline;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SecurityAlert_set_deadlines"
BEFORE INSERT OR UPDATE OF "severity" ON "SecurityAlert"
FOR EACH ROW EXECUTE FUNCTION set_security_alert_deadlines();

CREATE FUNCTION queue_security_alert_delivery()
RETURNS TRIGGER AS $$
DECLARE
  reason_value TEXT;
  dedupe_value TEXT;
BEGIN
  IF NEW."severity" NOT IN ('HIGH', 'CRITICAL') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    reason_value := 'INITIAL';
    dedupe_value := NEW."id" || ':INITIAL';
  ELSIF OLD."severity" IS DISTINCT FROM NEW."severity" AND NEW."severity" = 'CRITICAL' THEN
    reason_value := 'SEVERITY_UPGRADE';
    dedupe_value := NEW."id" || ':SEVERITY_UPGRADE:CRITICAL';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO "SecurityAlertDelivery" (
    "alertId", "reason", "dedupeKey", "createdAt", "updatedAt"
  ) VALUES (
    NEW."id", reason_value, dedupe_value, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT ("dedupeKey") DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SecurityAlert_queue_delivery"
AFTER INSERT OR UPDATE OF "severity" ON "SecurityAlert"
FOR EACH ROW EXECUTE FUNCTION queue_security_alert_delivery();

INSERT INTO "SecurityAlertDelivery" ("alertId", "reason", "dedupeKey", "createdAt", "updatedAt")
SELECT "id", 'INITIAL', "id" || ':INITIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SecurityAlert"
WHERE "status" != 'RESOLVED' AND "severity" IN ('HIGH', 'CRITICAL')
ON CONFLICT ("dedupeKey") DO NOTHING;
