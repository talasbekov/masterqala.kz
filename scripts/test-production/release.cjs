'use strict';
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

function validateTarget(env, local = false) {
  const required = {
    MQ_TEST_PRODUCTION: 'isolated-local-only', NODE_ENV: 'test',
    COMMERCIAL_MODE: 'FREE_PILOT', SMS_PROVIDER_MODE: 'CONSOLE',
    FILE_SCAN_MODE: 'DISABLED', PGBOSS_DISABLED: '0',
  };
  for (const [key, value] of Object.entries(required)) {
    if (env[key] !== value) throw new Error(`Refusing release: ${key} must equal ${value}`);
  }
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Refusing release: invalid database target'); }
  if (url.protocol !== 'postgresql:' || url.username !== 'mq_test_production' ||
      url.pathname !== '/masterqala_test_production' || url.search || url.hash ||
      url.hostname !== (local ? '127.0.0.1' : 'db') || url.port !== (local ? '15432' : '5432') ||
      !/^[a-f0-9]{64}$/.test(url.password)) {
    throw new Error('Refusing release: target is not the dedicated test database');
  }
  return url;
}

async function release(env = process.env, local = false) {
  validateTarget(env, local); // Must happen before loading Prisma or launching a subprocess.
  const apiDir = resolve(__dirname, '../../apps/api');
  const apiRequire = createRequire(resolve(apiDir, 'package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    const [identity] = await db.$queryRaw`SELECT current_database()::text AS db, current_user::text AS username`;
    if (identity?.db !== 'masterqala_test_production' || identity?.username !== 'mq_test_production') {
      throw new Error('Refusing release: database identity mismatch');
    }
    const migration = spawnSync(process.execPath, [apiRequire.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: apiDir, env, stdio: 'inherit',
    });
    if (migration.status !== 0) throw new Error('Test database migration failed');
    const categories = require('./fixtures.cjs');
    await db.$transaction(async tx => {
      for (const { slug, name } of categories) {
        await tx.category.upsert({ where: { slug }, create: { slug, name }, update: {} });
      }
      for (const [phone, role, name] of [
        ['+77000000101', 'CLIENT', 'TEST ONLY Client'],
        ['+77000000102', 'CLIENT', 'TEST ONLY Master Applicant'],
        ['+77000000103', 'OPERATOR', 'TEST ONLY Operator'],
      ]) {
        await tx.user.upsert({ where: { phone }, create: { phone, role, name }, update: {} });
      }
    });
    console.log('Dedicated test database migrated; six categories and three synthetic accounts seeded.');
  } finally { await db.$disconnect(); }
}

if (require.main === module) {
  const local = process.argv.slice(2).join(' ') === '--local';
  if (process.argv.length > 2 && !local) throw new Error('Only --local is supported');
  release(process.env, local).catch(error => {
    // Preserve useful diagnostics without exposing connection strings or generated secrets.
    let message = String(error?.message || 'Unknown failure').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database URL withheld]');
    for (const key of ['TEST_DB_PASSWORD', 'TEST_JWT_SECRET', 'JWT_SECRET', 'DATABASE_URL']) {
      if (process.env[key]) message = message.split(process.env[key]).join('[withheld]');
    }
    console.error(`Test release failed: ${message}`);
    process.exitCode = 1;
  });
}
module.exports = { validateTarget, release };
