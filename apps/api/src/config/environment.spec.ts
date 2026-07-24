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

  it('отклоняет wildcard, path и неизвестный протокол', () => {
    expect(() => parseCorsOrigins('*', 'development')).toThrow('wildcard');
    expect(() => parseCorsOrigins('https://masterqala.kz/app', 'production')).toThrow('не должен содержать path');
    expect(() => parseCorsOrigins('file://masterqala.kz', 'development')).toThrow('http или https');
  });

  it('валидирует PORT, TRUST_PROXY_HOPS и UPLOAD_TTL_HOURS', () => {
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
      validateEnvironment({ NODE_ENV: 'test', JWT_SECRET: secureSecret, UPLOAD_TTL_HOURS: '169' }),
    ).toThrow('Недопустимый UPLOAD_TTL_HOURS');
  });

  it('нормализует origins и числовые параметры', () => {
    const env = validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: secureSecret,
      CORS_ORIGINS: 'https://masterqala.kz/, https://masterqala.kz, https://app.masterqala.kz',
      PORT: '3100',
      TRUST_PROXY_HOPS: '1',
      UPLOAD_TTL_HOURS: '12',
    });

    expect(corsOriginsFromValue(env.CORS_ORIGINS)).toEqual([
      'https://masterqala.kz',
      'https://app.masterqala.kz',
    ]);
    expect(env.PORT).toBe(3100);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.UPLOAD_TTL_HOURS).toBe(12);
  });
});
