const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const FILE_SCAN_MODES = ['DISABLED', 'CLAMAV'] as const;
const PDF_CDR_MODES = ['BYPASS', 'REQUIRED'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
type FileScanMode = (typeof FILE_SCAN_MODES)[number];
type PdfCdrMode = (typeof PDF_CDR_MODES)[number];

const DEFAULT_LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'change-me',
  'secret',
  'replace-with-a-random-secret-of-at-least-32-characters',
]);
const MIN_JWT_SECRET_LENGTH = 32;

function requiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNodeEnvironment(value: unknown): NodeEnvironment {
  const normalized = requiredString(value) || 'development';
  if (!NODE_ENVIRONMENTS.includes(normalized as NodeEnvironment)) {
    throw new Error(`Недопустимый NODE_ENV=${normalized}. Допустимые значения: ${NODE_ENVIRONMENTS.join(', ')}`);
  }
  return normalized as NodeEnvironment;
}

function parseFileScanMode(value: unknown, nodeEnv: NodeEnvironment): FileScanMode {
  const normalized = requiredString(value) || (nodeEnv === 'production' ? '' : 'DISABLED');
  if (!FILE_SCAN_MODES.includes(normalized as FileScanMode)) {
    throw new Error(`Недопустимый FILE_SCAN_MODE=${normalized || '<empty>'}. Допустимые значения: ${FILE_SCAN_MODES.join(', ')}`);
  }
  if (nodeEnv === 'production' && normalized !== 'CLAMAV') {
    throw new Error('В production FILE_SCAN_MODE должен быть CLAMAV');
  }
  return normalized as FileScanMode;
}

function parsePdfCdrMode(value: unknown, nodeEnv: NodeEnvironment): PdfCdrMode {
  const normalized = requiredString(value) || (nodeEnv === 'production' ? '' : 'BYPASS');
  if (!PDF_CDR_MODES.includes(normalized as PdfCdrMode)) {
    throw new Error(`Недопустимый PDF_CDR_MODE=${normalized || '<empty>'}. Допустимые значения: ${PDF_CDR_MODES.join(', ')}`);
  }
  return normalized as PdfCdrMode;
}

function parseBinaryFlag(name: string, value: unknown, fallback: '0' | '1'): '0' | '1' {
  const normalized = requiredString(value) || fallback;
  if (normalized !== '0' && normalized !== '1') {
    throw new Error(`Недопустимый ${name}=${String(value)}. Допустимые значения: 0, 1`);
  }
  return normalized;
}

function parseInteger(name: string, value: unknown, fallback: number, min: number, max: number): number {
  const normalized = requiredString(value);
  const parsed = normalized ? Number(normalized) : fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Недопустимый ${name}=${String(value)}. Ожидается целое число от ${min} до ${max}`);
  }
  return parsed;
}

function parseSecurityWebhookUrl(value: unknown, nodeEnv: NodeEnvironment): string {
  const normalized = requiredString(value);
  if (!normalized) return '';

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('SECURITY_ALERT_WEBHOOK_URL должен быть корректным URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SECURITY_ALERT_WEBHOOK_URL должен использовать HTTP или HTTPS');
  }
  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw new Error('В production SECURITY_ALERT_WEBHOOK_URL должен использовать HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('SECURITY_ALERT_WEBHOOK_URL не должен содержать credentials');
  }
  return url.toString();
}

export function parseCorsOrigins(value: unknown, nodeEnv: NodeEnvironment): string[] {
  const configured = requiredString(value);
  const candidates = configured
    ? configured.split(',').map((origin) => origin.trim()).filter(Boolean)
    : nodeEnv === 'production'
      ? []
      : DEFAULT_LOCAL_ORIGINS;

  if (nodeEnv === 'production' && candidates.length === 0) {
    throw new Error('CORS_ORIGINS обязателен в production и должен содержать разрешённые HTTPS origin');
  }

  const normalized = candidates.map((origin) => {
    if (origin === '*') {
      throw new Error('CORS_ORIGINS не может содержать wildcard *');
    }

    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`Некорректный origin в CORS_ORIGINS: ${origin}`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Origin должен использовать http или https: ${origin}`);
    }
    if (nodeEnv === 'production' && url.protocol !== 'https:') {
      throw new Error(`Production origin должен использовать HTTPS: ${origin}`);
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`CORS origin не должен содержать path, query или hash: ${origin}`);
    }

    return url.origin;
  });

  return [...new Set(normalized)];
}

export function validateEnvironment(raw: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = parseNodeEnvironment(raw.NODE_ENV);
  const jwtSecret = requiredString(raw.JWT_SECRET);

  if (!jwtSecret) {
    throw new Error('JWT_SECRET обязателен');
  }
  if (INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET содержит небезопасное значение-заглушку');
  }
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET должен содержать не менее ${MIN_JWT_SECRET_LENGTH} символов`);
  }

  const corsOrigins = parseCorsOrigins(raw.CORS_ORIGINS, nodeEnv);
  const port = parseInteger('PORT', raw.PORT, 3000, 1, 65535);
  const trustProxyHops = parseInteger('TRUST_PROXY_HOPS', raw.TRUST_PROXY_HOPS, 0, 0, 10);
  const uploadTtlHours = parseInteger('UPLOAD_TTL_HOURS', raw.UPLOAD_TTL_HOURS, 24, 1, 168);
  const fileScanMode = parseFileScanMode(raw.FILE_SCAN_MODE, nodeEnv);
  const pdfCdrMode = parsePdfCdrMode(raw.PDF_CDR_MODE, nodeEnv);
  const pgBossDisabled = parseBinaryFlag('PGBOSS_DISABLED', raw.PGBOSS_DISABLED, '0');
  const clamavHost = requiredString(raw.CLAMAV_HOST) || '127.0.0.1';
  const clamavPort = parseInteger('CLAMAV_PORT', raw.CLAMAV_PORT, 3310, 1, 65535);
  const clamavTimeoutMs = parseInteger('CLAMAV_TIMEOUT_MS', raw.CLAMAV_TIMEOUT_MS, 15000, 1000, 120000);
  const uploadScanMaxAttempts = parseInteger('UPLOAD_SCAN_MAX_ATTEMPTS', raw.UPLOAD_SCAN_MAX_ATTEMPTS, 3, 1, 10);
  const securityAuditRetentionDays = parseInteger(
    'SECURITY_AUDIT_RETENTION_DAYS', raw.SECURITY_AUDIT_RETENTION_DAYS, 365, 30, 3650,
  );
  const fileQuarantineRetentionDays = parseInteger(
    'FILE_QUARANTINE_RETENTION_DAYS', raw.FILE_QUARANTINE_RETENTION_DAYS, 30, 1, 365,
  );
  const consumedUploadMetadataRetentionDays = parseInteger(
    'CONSUMED_UPLOAD_METADATA_RETENTION_DAYS', raw.CONSUMED_UPLOAD_METADATA_RETENTION_DAYS, 30, 1, 365,
  );
  const securityAlertWebhookUrl = parseSecurityWebhookUrl(raw.SECURITY_ALERT_WEBHOOK_URL, nodeEnv);
  const securityAlertWebhookSecret = requiredString(raw.SECURITY_ALERT_WEBHOOK_SECRET);
  const securityAlertWebhookTimeoutMs = parseInteger(
    'SECURITY_ALERT_WEBHOOK_TIMEOUT_MS', raw.SECURITY_ALERT_WEBHOOK_TIMEOUT_MS, 5000, 1000, 30000,
  );
  const securityAlertDeliveryMaxAttempts = parseInteger(
    'SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS', raw.SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS, 5, 1, 10,
  );

  if (fileScanMode === 'CLAMAV' && !clamavHost) {
    throw new Error('CLAMAV_HOST обязателен при FILE_SCAN_MODE=CLAMAV');
  }
  if (nodeEnv === 'production' && pgBossDisabled === '1') {
    throw new Error('В production PGBOSS_DISABLED не может быть 1');
  }
  if (securityAlertWebhookUrl && securityAlertWebhookSecret.length < 32) {
    throw new Error('SECURITY_ALERT_WEBHOOK_SECRET должен содержать не менее 32 символов');
  }
  if (!securityAlertWebhookUrl && securityAlertWebhookSecret) {
    throw new Error('SECURITY_ALERT_WEBHOOK_URL обязателен, если задан SECURITY_ALERT_WEBHOOK_SECRET');
  }

  return {
    ...raw,
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret,
    CORS_ORIGINS: corsOrigins.join(','),
    PORT: port,
    TRUST_PROXY_HOPS: trustProxyHops,
    UPLOAD_TTL_HOURS: uploadTtlHours,
    FILE_SCAN_MODE: fileScanMode,
    PDF_CDR_MODE: pdfCdrMode,
    PGBOSS_DISABLED: pgBossDisabled,
    CLAMAV_HOST: clamavHost,
    CLAMAV_PORT: clamavPort,
    CLAMAV_TIMEOUT_MS: clamavTimeoutMs,
    UPLOAD_SCAN_MAX_ATTEMPTS: uploadScanMaxAttempts,
    SECURITY_AUDIT_RETENTION_DAYS: securityAuditRetentionDays,
    FILE_QUARANTINE_RETENTION_DAYS: fileQuarantineRetentionDays,
    CONSUMED_UPLOAD_METADATA_RETENTION_DAYS: consumedUploadMetadataRetentionDays,
    SECURITY_ALERT_WEBHOOK_URL: securityAlertWebhookUrl,
    SECURITY_ALERT_WEBHOOK_SECRET: securityAlertWebhookSecret,
    SECURITY_ALERT_WEBHOOK_TIMEOUT_MS: securityAlertWebhookTimeoutMs,
    SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS: securityAlertDeliveryMaxAttempts,
  };
}

export function corsOriginsFromValue(value: unknown): string[] {
  const configured = requiredString(value);
  if (!configured) throw new Error('Проверенная конфигурация CORS_ORIGINS отсутствует');
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}
