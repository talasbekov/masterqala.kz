import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnPath, protectedLoginUrl } from '../.test-build/lib/auth-return.js';

test('protected order/account route and query survive login round trip', () => {
  for (const target of ['/order/1842?tab=quote&version=3', '/planned/1842/compare', '/addresses', '/profile', '/']) {
    const path = target.split('?')[0];
    const search = target.includes('?') ? target.split('?')[1] : '';
    const login = protectedLoginUrl(path, search);
    assert.equal(login.startsWith('/login?'), true);
    assert.equal(safeReturnPath(new URL(login, 'https://masterqala.local').searchParams.get('returnTo')), target);
  }
});

test('return path cannot redirect outside the client or loop into login', () => {
  for (const target of [null, '', 'https://evil.test/order/1842', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/login?returnTo=/login', '/%6cogin', '/%2fexternal.test', '/order/1842\n', '/unknown', '/order/%ZZ', '/order/%0a1842']) {
    assert.equal(safeReturnPath(target), '/', `reject ${JSON.stringify(target)}`);
  }
});
