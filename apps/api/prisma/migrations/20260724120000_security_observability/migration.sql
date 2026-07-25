CREATE TABLE "SecurityAlert" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ruleKey" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "operatorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityAlert_severity_check"
    CHECK ("severity" IN ('WARNING', 'HIGH', 'CRITICAL')),
  CONSTRAINT "SecurityAlert_status_check"
    CHECK ("status" IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  CONSTRAINT "SecurityAlert_occurrenceCount_check"
    CHECK ("occurrenceCount" > 0)
);

ALTER TABLE "SecurityAlert"
  ADD CONSTRAINT "SecurityAlert_sourceEventId_fkey"
  FOREIGN KEY ("sourceEventId") REFERENCES "SecurityAuditEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecurityAlert"
  ADD CONSTRAINT "SecurityAlert_acknowledgedByUserId_fkey"
  FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecurityAlert"
  ADD CONSTRAINT "SecurityAlert_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SecurityAlert_open_rule_resource_key"
  ON "SecurityAlert"("ruleKey", "resourceType", "resourceId")
  WHERE "status" = 'OPEN';
CREATE INDEX "SecurityAlert_status_severity_lastSeenAt_idx"
  ON "SecurityAlert"("status", "severity", "lastSeenAt" DESC);
CREATE INDEX "SecurityAlert_lastSeenAt_idx"
  ON "SecurityAlert"("lastSeenAt" DESC);

CREATE FUNCTION security_alert_title(rule_key_value TEXT)
RETURNS TEXT AS $$
  SELECT CASE rule_key_value
    WHEN 'MALWARE_DETECTED' THEN 'Обнаружен заражённый файл'
    WHEN 'FILE_SCAN_FAILED' THEN 'Проверка файла завершилась ошибкой'
    WHEN 'PDF_CDR_FAILED' THEN 'CDR-обработка PDF завершилась ошибкой'
    WHEN 'RETENTION_PARTIAL_FAILURE' THEN 'Retention выполнен с ошибками'
    WHEN 'DEPENDENCY_UNAVAILABLE' THEN 'Security-зависимость недоступна'
    ELSE 'Событие безопасности требует внимания'
  END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE FUNCTION create_security_alert_from_audit()
RETURNS TRIGGER AS $$
DECLARE
  rule_key_value TEXT;
  severity_value TEXT;
BEGIN
  rule_key_value := CASE NEW."action"
    WHEN 'FILE_SCAN_INFECTED' THEN 'MALWARE_DETECTED'
    WHEN 'FILE_SCAN_FAILED' THEN 'FILE_SCAN_FAILED'
    WHEN 'PDF_CDR_CDR_FAILED' THEN 'PDF_CDR_FAILED'
    WHEN 'SECURITY_RETENTION_PARTIAL_FAILURE' THEN 'RETENTION_PARTIAL_FAILURE'
    WHEN 'SECURITY_DEPENDENCY_DOWN' THEN 'DEPENDENCY_UNAVAILABLE'
    ELSE NULL
  END;

  IF rule_key_value IS NULL THEN
    RETURN NEW;
  END IF;

  severity_value := CASE
    WHEN NEW."severity" IN ('HIGH', 'CRITICAL') THEN NEW."severity"
    ELSE 'WARNING'
  END;

  INSERT INTO "SecurityAlert" (
    "ruleKey", "severity", "title", "resourceType", "resourceId", "sourceEventId",
    "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt"
  ) VALUES (
    rule_key_value,
    severity_value,
    security_alert_title(rule_key_value),
    NEW."resourceType",
    NEW."resourceId",
    NEW."id",
    NEW."createdAt",
    NEW."createdAt",
    NEW."createdAt",
    NEW."createdAt"
  )
  ON CONFLICT ("ruleKey", "resourceType", "resourceId") WHERE "status" = 'OPEN'
  DO UPDATE SET
    "occurrenceCount" = "SecurityAlert"."occurrenceCount" + 1,
    "lastSeenAt" = EXCLUDED."lastSeenAt",
    "severity" = CASE
      WHEN "SecurityAlert"."severity" = 'CRITICAL' OR EXCLUDED."severity" = 'CRITICAL' THEN 'CRITICAL'
      WHEN "SecurityAlert"."severity" = 'HIGH' OR EXCLUDED."severity" = 'HIGH' THEN 'HIGH'
      ELSE 'WARNING'
    END,
    "sourceEventId" = EXCLUDED."sourceEventId",
    "updatedAt" = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SecurityAuditEvent_create_alert"
AFTER INSERT ON "SecurityAuditEvent"
FOR EACH ROW EXECUTE FUNCTION create_security_alert_from_audit();
