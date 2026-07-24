ALTER TABLE "PendingUpload"
  ADD COLUMN "purgedAt" TIMESTAMP(3);

ALTER TABLE "MasterDocument"
  ADD COLUMN "purgedAt" TIMESTAMP(3);

ALTER TABLE "DisputeEvidence"
  ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE TABLE "SecurityAuditEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "action" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityAuditEvent_severity_check"
    CHECK ("severity" IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  CONSTRAINT "SecurityAuditEvent_outcome_check"
    CHECK ("outcome" IN ('SUCCESS', 'REJECTED', 'ERROR', 'DELETED'))
);

CREATE INDEX "SecurityAuditEvent_createdAt_idx"
  ON "SecurityAuditEvent"("createdAt" DESC);
CREATE INDEX "SecurityAuditEvent_resource_idx"
  ON "SecurityAuditEvent"("resourceType", "resourceId", "createdAt" DESC);
CREATE INDEX "SecurityAuditEvent_action_createdAt_idx"
  ON "SecurityAuditEvent"("action", "createdAt" DESC);
CREATE INDEX "SecurityAuditEvent_severity_createdAt_idx"
  ON "SecurityAuditEvent"("severity", "createdAt" DESC);

CREATE FUNCTION security_append_audit(
  action_name TEXT,
  severity_name TEXT,
  outcome_name TEXT,
  resource_type_name TEXT,
  resource_id_value TEXT,
  actor_user_id_value TEXT,
  metadata_value JSONB
) RETURNS VOID AS $$
  INSERT INTO "SecurityAuditEvent" (
    "action", "severity", "outcome", "resourceType", "resourceId", "actorUserId", "metadata"
  ) VALUES (
    action_name,
    severity_name,
    outcome_name,
    resource_type_name,
    resource_id_value,
    actor_user_id_value,
    COALESCE(metadata_value, '{}'::jsonb)
  );
$$ LANGUAGE SQL;

CREATE FUNCTION security_scan_action(status_value TEXT)
RETURNS TEXT AS $$
  SELECT CASE status_value
    WHEN 'SCANNING' THEN 'FILE_SCAN_STARTED'
    WHEN 'CLEAN' THEN 'FILE_SCAN_CLEAN'
    WHEN 'INFECTED' THEN 'FILE_SCAN_INFECTED'
    WHEN 'SCAN_FAILED' THEN 'FILE_SCAN_FAILED'
    ELSE 'FILE_SCAN_STATE_CHANGED'
  END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE FUNCTION security_scan_severity(status_value TEXT)
RETURNS TEXT AS $$
  SELECT CASE status_value
    WHEN 'INFECTED' THEN 'CRITICAL'
    WHEN 'SCAN_FAILED' THEN 'WARNING'
    ELSE 'INFO'
  END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE FUNCTION security_scan_outcome(status_value TEXT)
RETURNS TEXT AS $$
  SELECT CASE status_value
    WHEN 'INFECTED' THEN 'REJECTED'
    WHEN 'SCAN_FAILED' THEN 'ERROR'
    ELSE 'SUCCESS'
  END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE FUNCTION audit_pending_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM security_append_audit(
      'FILE_REGISTERED', 'INFO', 'SUCCESS', 'PENDING_UPLOAD', NEW."id", NEW."userId",
      jsonb_build_object('mimeType', NEW."mimeType", 'sizeBytes', NEW."sizeBytes")
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM security_append_audit(
      'FILE_METADATA_PURGED', 'INFO', 'DELETED', 'PENDING_UPLOAD', OLD."id", OLD."userId",
      jsonb_build_object('scanStatus', OLD."scanStatus", 'consumed', OLD."consumedAt" IS NOT NULL)
    );
    RETURN OLD;
  END IF;

  IF OLD."scanStatus" IS DISTINCT FROM NEW."scanStatus" THEN
    PERFORM security_append_audit(
      security_scan_action(NEW."scanStatus"),
      security_scan_severity(NEW."scanStatus"),
      security_scan_outcome(NEW."scanStatus"),
      'PENDING_UPLOAD', NEW."id", NEW."userId",
      jsonb_strip_nulls(jsonb_build_object(
        'mimeType', NEW."mimeType",
        'sizeBytes', NEW."sizeBytes",
        'scanAttempts', NEW."scanAttempts",
        'scanError', NEW."scanError"
      ))
    );
  END IF;

  IF OLD."consumedAt" IS NULL AND NEW."consumedAt" IS NOT NULL THEN
    PERFORM security_append_audit(
      'FILE_CONSUMED', 'INFO', 'SUCCESS', 'PENDING_UPLOAD', NEW."id", NEW."userId",
      jsonb_build_object('consumedAt', NEW."consumedAt")
    );
  END IF;

  IF OLD."purgedAt" IS NULL AND NEW."purgedAt" IS NOT NULL THEN
    PERFORM security_append_audit(
      'FILE_BINARY_PURGED', 'INFO', 'DELETED', 'PENDING_UPLOAD', NEW."id", NEW."userId",
      jsonb_build_object('scanStatus', NEW."scanStatus", 'purgedAt', NEW."purgedAt")
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PendingUpload_security_audit"
AFTER INSERT OR UPDATE OR DELETE ON "PendingUpload"
FOR EACH ROW EXECUTE FUNCTION audit_pending_upload();

CREATE FUNCTION audit_master_document()
RETURNS TRIGGER AS $$
DECLARE
  actor_id TEXT;
  profile_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    profile_id := OLD."masterProfileId";
  ELSE
    profile_id := NEW."masterProfileId";
  END IF;

  SELECT "userId" INTO actor_id
  FROM "MasterProfile"
  WHERE "id" = profile_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM security_append_audit(
      'FILE_REGISTERED', 'INFO', 'SUCCESS', 'MASTER_DOCUMENT', NEW."id", actor_id,
      jsonb_build_object('mimeType', NEW."mimeType", 'sizeBytes', NEW."sizeBytes", 'documentType', NEW."type")
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM security_append_audit(
      'FILE_METADATA_PURGED', 'INFO', 'DELETED', 'MASTER_DOCUMENT', OLD."id", actor_id,
      jsonb_build_object('scanStatus', OLD."scanStatus", 'cdrStatus', OLD."cdrStatus")
    );
    RETURN OLD;
  END IF;

  IF OLD."scanStatus" IS DISTINCT FROM NEW."scanStatus" THEN
    PERFORM security_append_audit(
      security_scan_action(NEW."scanStatus"),
      security_scan_severity(NEW."scanStatus"),
      security_scan_outcome(NEW."scanStatus"),
      'MASTER_DOCUMENT', NEW."id", actor_id,
      jsonb_strip_nulls(jsonb_build_object(
        'mimeType', NEW."mimeType",
        'sizeBytes', NEW."sizeBytes",
        'scanAttempts', NEW."scanAttempts",
        'scanError', NEW."scanError"
      ))
    );
  END IF;

  IF OLD."cdrStatus" IS DISTINCT FROM NEW."cdrStatus" THEN
    PERFORM security_append_audit(
      'PDF_CDR_' || NEW."cdrStatus",
      CASE WHEN NEW."cdrStatus" = 'CDR_FAILED' THEN 'HIGH' ELSE 'INFO' END,
      CASE WHEN NEW."cdrStatus" = 'CDR_FAILED' THEN 'ERROR' ELSE 'SUCCESS' END,
      'MASTER_DOCUMENT', NEW."id", actor_id,
      jsonb_build_object('cdrStatus', NEW."cdrStatus")
    );
  END IF;

  IF OLD."purgedAt" IS NULL AND NEW."purgedAt" IS NOT NULL THEN
    PERFORM security_append_audit(
      'FILE_BINARY_PURGED', 'INFO', 'DELETED', 'MASTER_DOCUMENT', NEW."id", actor_id,
      jsonb_build_object('scanStatus', NEW."scanStatus", 'purgedAt', NEW."purgedAt")
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MasterDocument_security_audit"
AFTER INSERT OR UPDATE OR DELETE ON "MasterDocument"
FOR EACH ROW EXECUTE FUNCTION audit_master_document();

CREATE FUNCTION audit_dispute_evidence()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM security_append_audit(
      'FILE_REGISTERED', 'INFO', 'SUCCESS', 'DISPUTE_EVIDENCE', NEW."id", NEW."uploadedByUserId",
      jsonb_build_object('mimeType', NEW."mimeType", 'sizeBytes', NEW."sizeBytes", 'disputeId', NEW."disputeId")
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM security_append_audit(
      'FILE_METADATA_PURGED', 'INFO', 'DELETED', 'DISPUTE_EVIDENCE', OLD."id", OLD."uploadedByUserId",
      jsonb_build_object('scanStatus', OLD."scanStatus", 'disputeId', OLD."disputeId")
    );
    RETURN OLD;
  END IF;

  IF OLD."scanStatus" IS DISTINCT FROM NEW."scanStatus" THEN
    PERFORM security_append_audit(
      security_scan_action(NEW."scanStatus"),
      security_scan_severity(NEW."scanStatus"),
      security_scan_outcome(NEW."scanStatus"),
      'DISPUTE_EVIDENCE', NEW."id", NEW."uploadedByUserId",
      jsonb_strip_nulls(jsonb_build_object(
        'mimeType', NEW."mimeType",
        'sizeBytes', NEW."sizeBytes",
        'scanAttempts', NEW."scanAttempts",
        'scanError', NEW."scanError",
        'disputeId', NEW."disputeId"
      ))
    );
  END IF;

  IF OLD."purgedAt" IS NULL AND NEW."purgedAt" IS NOT NULL THEN
    PERFORM security_append_audit(
      'FILE_BINARY_PURGED', 'INFO', 'DELETED', 'DISPUTE_EVIDENCE', NEW."id", NEW."uploadedByUserId",
      jsonb_build_object('scanStatus', NEW."scanStatus", 'purgedAt', NEW."purgedAt", 'disputeId', NEW."disputeId")
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DisputeEvidence_security_audit"
AFTER INSERT OR UPDATE OR DELETE ON "DisputeEvidence"
FOR EACH ROW EXECUTE FUNCTION audit_dispute_evidence();

CREATE FUNCTION prevent_security_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SecurityAuditEvent rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SecurityAuditEvent_immutable"
BEFORE UPDATE ON "SecurityAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_security_audit_update();
