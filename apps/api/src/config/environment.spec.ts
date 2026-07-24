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
    expect(env.CLAMAV_HOST).toBe('127.0.0.1');
    expect(env.CLAMAV_PORT).toBe(3310);
    expect(env.CLAMAV_TIMEOUT_MS).toBe(15000);
    expect(env.UPLOAD_SCAN_MAX_ATTEMPTS).toBe(3);
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
    };

    expect(() => validateEnvironment(productionBase)).toThrow('FILE_SCAN_MODE');
    expect(() => validateEnvironment({ ...productionBase, FILE_SCAN_MODE: 'DISABLED' })).toThrow(
      'должен быть CLAMAV',
    );
    expect(validateEnvironment({ ...productionBase, FILE_SCAN_MODE: 'CLAMAV' }).FILE_SCAN_MODE).toBe('CLAMAV');
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
  });

  it('нормализует origins и scanner параметры', () => {
    const env = validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: secureSecret,
      CORS_ORIGINS: 'https://masterqala.kz/, https://masterqala.kz, https://app.masterqala.kz',
      PORT: '3100',
      TRUST_PROXY_HOPS: '1',
      UPLOAD_TTL_HOURS: '12',
      FILE_SCAN_MODE: 'CLAMAV',
      CLAMAV_HOST: 'clamav.internal',
      CLAMAV_PORT: '3311',
      CLAMAV_TIMEOUT_MS: '20000',
      UPLOAD_SCAN_MAX_ATTEMPTS: '5',
    });

    expect(corsOriginsFromValue(env.CORS_ORIGINS)).toEqual([
      'https://masterqala.kz',
      'https://app.masterqala.kz',
    ]);
    expect(env.PORT).toBe(3100);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.UPLOAD_TTL_HOURS).toBe(12);
    expect(env.FILE_SCAN_MODE).toBe('CLAMAV');
    expect(env.CLAMAV_HOST).toBe('clamav.internal');
    expect(env.CLAMAV_PORT).toBe(3311);
    expect(env.CLAMAV_TIMEOUT_MS).toBe(20000);
    expect(env.UPLOAD_SCAN_MAX_ATTEMPTS).toBe(5);
  });
});
