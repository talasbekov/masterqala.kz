const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget } = require('./release.cjs');
const env = {
  MQ_TEST_PRODUCTION: 'isolated-local-only', NODE_ENV: 'test', COMMERCIAL_MODE: 'FREE_PILOT',
  SMS_PROVIDER_MODE: 'CONSOLE', FILE_SCAN_MODE: 'DISABLED', PGBOSS_DISABLED: '0',
  DATABASE_URL: `postgresql://mq_test_production:${'a'.repeat(64)}@db:5432/masterqala_test_production`,
};
test('accepts only the dedicated container target or explicit loopback local target', () => {
  assert.doesNotThrow(() => validateTarget(env));
  const local = { ...env, DATABASE_URL: env.DATABASE_URL.replace('@db:5432', '@127.0.0.1:15432') };
  assert.doesNotThrow(() => validateTarget(local, true));
  assert.throws(() => validateTarget(local));
  assert.throws(() => validateTarget(env, true));
});
for (const [label, url] of [
  ['production database', env.DATABASE_URL.replace('/masterqala_test_production', '/masterqala')],
  ['existing test database', env.DATABASE_URL.replace('/masterqala_test_production', '/masterqala_test')],
  ['existing local port 5432', env.DATABASE_URL.replace('@db:5432', '@127.0.0.1:5432')],
  ['existing local port 5433', env.DATABASE_URL.replace('@db:5432', '@127.0.0.1:5433')],
  ['remote host', env.DATABASE_URL.replace('@db:', '@example.com:')],
  ['alternate user', env.DATABASE_URL.replace('mq_test_production:', 'postgres:')],
  ['query override', `${env.DATABASE_URL}?schema=public`],
  ['missing password', env.DATABASE_URL.replace('a'.repeat(64), '')],
]) test(`rejects ${label} before any connection`, () => {
  assert.throws(() => validateTarget({ ...env, DATABASE_URL: url }));
  assert.throws(() => validateTarget({ ...env, DATABASE_URL: url }, true));
});
for (const [key, value] of Object.entries({
  MQ_TEST_PRODUCTION: '', NODE_ENV: 'production', COMMERCIAL_MODE: 'PAID_LIVE',
  SMS_PROVIDER_MODE: 'HTTP', FILE_SCAN_MODE: 'CLAMAV', PGBOSS_DISABLED: '1',
})) test(`rejects unsafe or unintended ${key}`, () => assert.throws(() => validateTarget({ ...env, [key]: value })));
