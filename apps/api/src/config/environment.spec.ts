import { corsOriginsFromValue, parseCorsOrigins, validateEnvironment } from './environment';

describe('environment security validation', () => {
  const secureSecret = 'test-only-secret-with-at-least-32-characters';

  it('отклоняет отсутствующий JWT_SECRET', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'test' })).toThrow('JWT_SECRET обязателен');
  });

  it('отклоняет известные заглушки и короткий secret', () => {
    for (const insecure of [
      'dev-secret-change-me',
      'replace-with-a-random-secret-of-at-least-32-characters',
    ]) {
      expect(() => validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: insecure })).toThrow(
        'небезопасное значение-заглушку',
      );
    }
    expect(() => validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: 'too-short' })).toThrow(
      'не менее 32 символов',
    );
  });

  it('использует безопасные local defaults вне production', () => {
    const env = validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret });

    expect(corsOriginsFromValue(env.CORS_ORIGINS)).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
    expect(env.PORT).toBe(3000);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.UPLOAD_TTL_HOURS).toBe(24);
    expect(env.FILE_SCAN_MODE).toBe('DISABLED');
    expect(env.PDF_CDR_MODE).toBe('BYPASS');
    expect(env.CLAMAV_HOST).toBe('127.0.0.1');
    expect(env.CLAMAV_PORT).toBe(3310);
    expect(env.CLAMAV_TIMEOUT_MS).toBe(15000);
    expect(env.UPLOAD_SCAN_MAX_ATTEMPTS).toBe(3);
    expect(env.SECURITY_AUDIT_RETENTION_DAYS).toBe(365);
    expect(env.FILE_QUARANTINE_RETENTION_DAYS).toBe(30);
    expect(env.CONSUMED_UPLOAD_METADATA_RETENTION_DAYS).toBe(30);
  });

  it('требует явный HTTPS allowlist в production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', JWT_SECRET: secureSecret })).toThrow(
      'CORS_ORIGINS обязателен',
    );
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: secureSecret,
        CORS_ORIGINS: 'http://masterqala.kz',
      }),
    ).toThrow('должен использовать HTTPS');
  });

  it('запрещает отключать malware scan в production', () => {
    const productionBase = {
      NODE_ENV: 'production',
      JWT_SECRET: secureSecret,
      CORS_ORIGINS: 'https://masterqala.kz',
      PDF_CDR_MODE: 'REQUIRED',
    };

    expect(() => validateEnvironment(productionBase)).toThrow('FILE_SCAN_MODE');
    expect(() => validateEnvironment({ ...productionBase, FILE_SCAN_MODE: 'DISABLED' })).toThrow(
      'должен быть CLAMAV',
    );
    expect(validateEnvironment({ ...productionBase, FILE_SCAN_MODE: 'CLAMAV' }).FILE_SCAN_MODE).toBe('CLAMAV');
  });

  it('требует явную PDF CDR policy в production', () => {
    const productionBase = {
      NODE_ENV: 'production',
      JWT_SECRET: secureSecret,
      CORS_ORIGINS: 'https://masterqala.kz',
      FILE_SCAN_MODE: 'CLAMAV',
    };

    expect(() => validateEnvironment(productionBase)).toThrow('PDF_CDR_MODE');
    expect(validateEnvironment({ ...productionBase, PDF_CDR_MODE: 'REQUIRED' }).PDF_CDR_MODE).toBe('REQUIRED');
    expect(validateEnvironment({ ...productionBase, PDF_CDR_MODE: 'BYPASS' }).PDF_CDR_MODE).toBe('BYPASS');
    expect(() => validateEnvironment({ ...productionBase, PDF_CDR_MODE: 'UNKNOWN' })).toThrow('PDF_CDR_MODE');
  });

  it('отклоняет wildcard, path и неизвестный протокол', () => {
    expect(() => parseCorsOrigins('*', 'development')).toThrow('wildcard');
    expect(() => parseCorsOrigins('https://masterqala.kz/app', 'production')).toThrow('не должен содержать path');
    expect(() => parseCorsOrigins('file://masterqala.kz', 'development')).toThrow('http или https');
  });

  it('валидирует числовые security параметры', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, PORT: '0' })).toThrow(
      'Недопустимый PORT',
    );
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, TRUST_PROXY_HOPS: '11' }),
    ).toThrow('Недопустимый TRUST_PROXY_HOPS');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, UPLOAD_TTL_HOURS: '0' }),
    ).toThrow('Недопустимый UPLOAD_TTL_HOURS');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, CLAMAV_PORT: '0' }),
    ).toThrow('Недопустимый CLAMAV_PORT');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, CLAMAV_TIMEOUT_MS: '999' }),
    ).toThrow('Недопустимый CLAMAV_TIMEOUT_MS');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, UPLOAD_SCAN_MAX_ATTEMPTS: '11' }),
    ).toThrow('Недопустимый UPLOAD_SCAN_MAX_ATTEMPTS');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, SECURITY_AUDIT_RETENTION_DAYS: '29' }),
    ).toThrow('Недопустимый SECURITY_AUDIT_RETENTION_DAYS');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, FILE_QUARANTINE_RETENTION_DAYS: '0' }),
    ).toThrow('Недопустимый FILE_QUARANTINE_RETENTION_DAYS');
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        JWT_SECRET: secureSecret,
        CONSUMED_UPLOAD_METADATA_RETENTION_DAYS: '366',
      }),
    ).toThrow('Недопустимый CONSUMED_UPLOAD_METADATA_RETENTION_DAYS');
  });

  it('нормализует origins, scanner и retention параметры', () => {
    const env = validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: secureSecret,
      CORS_ORIGINS: 'https://masterqala.kz/, https://masterqala.kz, https://app.masterqala.kz',
      PORT: '3100',
      TRUST_PROXY_HOPS: '1',
      UPLOAD_TTL_HOURS: '12',
      FILE_SCAN_MODE: 'CLAMAV',
      PDF_CDR_MODE: 'REQUIRED',
      CLAMAV_HOST: 'clamav.internal',
      CLAMAV_PORT: '3311',
      CLAMAV_TIMEOUT_MS: '20000',
      UPLOAD_SCAN_MAX_ATTEMPTS: '5',
      SECURITY_AUDIT_RETENTION_DAYS: '730',
      FILE_QUARANTINE_RETENTION_DAYS: '45',
      CONSUMED_UPLOAD_METADATA_RETENTION_DAYS: '60',
    });

    expect(corsOriginsFromValue(env.CORS_ORIGINS)).toEqual([
      'https://masterqala.kz',
      'https://app.masterqala.kz',
    ]);
    expect(env.PORT).toBe(3100);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.UPLOAD_TTL_HOURS).toBe(12);
    expect(env.FILE_SCAN_MODE).toBe('CLAMAV');
    expect(env.PDF_CDR_MODE).toBe('REQUIRED');
    expect(env.CLAMAV_HOST).toBe('clamav.internal');
    expect(env.CLAMAV_PORT).toBe(3311);
    expect(env.CLAMAV_TIMEOUT_MS).toBe(20000);
    expect(env.UPLOAD_SCAN_MAX_ATTEMPTS).toBe(5);
    expect(env.SECURITY_AUDIT_RETENTION_DAYS).toBe(730);
    expect(env.FILE_QUARANTINE_RETENTION_DAYS).toBe(45);
    expect(env.CONSUMED_UPLOAD_METADATA_RETENTION_DAYS).toBe(60);
  });
});
