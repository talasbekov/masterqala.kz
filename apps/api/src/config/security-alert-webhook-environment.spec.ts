import { validateEnvironment } from './environment';

describe('security alert webhook environment', () => {
  const base = {
    NODE_ENV: 'production',
    // Не тестовое значение из package.json/ci.yml — они отвергаются в production.
    JWT_SECRET: 'unit-spec-secret-with-at-least-32-characters',
    CORS_ORIGINS: 'https://masterqala.kz',
    FILE_SCAN_MODE: 'CLAMAV',
    PDF_CDR_MODE: 'REQUIRED',
    PGBOSS_DISABLED: '0',
    SMS_PROVIDER_MODE: 'HTTP',
    SMS_HTTP_URL: 'https://sms.internal/send',
  };

  it('разрешает отключённую внешнюю доставку', () => {
    const env = validateEnvironment(base);
    expect(env.SECURITY_ALERT_WEBHOOK_URL).toBe('');
    expect(env.SECURITY_ALERT_WEBHOOK_SECRET).toBe('');
    expect(env.SECURITY_ALERT_WEBHOOK_TIMEOUT_MS).toBe(5000);
    expect(env.SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS).toBe(5);
  });

  it('требует HTTPS и длинный HMAC secret в production', () => {
    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_URL: 'http://alerts.internal/hook',
      SECURITY_ALERT_WEBHOOK_SECRET: 'x'.repeat(32),
    })).toThrow('должен использовать HTTPS');

    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_URL: 'https://alerts.internal/hook',
      SECURITY_ALERT_WEBHOOK_SECRET: 'short',
    })).toThrow('не менее 32 символов');
  });

  it('не принимает credentials и orphan secret', () => {
    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_URL: 'https://user:password@alerts.internal/hook',
      SECURITY_ALERT_WEBHOOK_SECRET: 'x'.repeat(32),
    })).toThrow('credentials');

    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_SECRET: 'x'.repeat(32),
    })).toThrow('WEBHOOK_URL обязателен');
  });

  it('нормализует webhook и валидирует retry параметры', () => {
    const env = validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_URL: 'https://alerts.internal/hook',
      SECURITY_ALERT_WEBHOOK_SECRET: 'x'.repeat(48),
      SECURITY_ALERT_WEBHOOK_TIMEOUT_MS: '12000',
      SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS: '7',
    });

    expect(env.SECURITY_ALERT_WEBHOOK_URL).toBe('https://alerts.internal/hook');
    expect(env.SECURITY_ALERT_WEBHOOK_SECRET).toBe('x'.repeat(48));
    expect(env.SECURITY_ALERT_WEBHOOK_TIMEOUT_MS).toBe(12000);
    expect(env.SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS).toBe(7);

    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_WEBHOOK_TIMEOUT_MS: '999',
    })).toThrow('SECURITY_ALERT_WEBHOOK_TIMEOUT_MS');
    expect(() => validateEnvironment({
      ...base,
      SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS: '11',
    })).toThrow('SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS');
  });
});
