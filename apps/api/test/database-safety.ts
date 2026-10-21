import { assertIsolatedQueueDatabase } from './queue-safety';

/** API e2e cleanup is destructive; neither NODE_ENV nor a *_test suffix is sufficient. */
export function assertIsolatedApiDatabase(
  databaseUrl: string | undefined,
  optIn: string | undefined,
  nodeEnv: string | undefined,
): void {
  if (optIn !== '1' || nodeEnv !== 'test' || !databaseUrl) {
    throw new Error(
      'API tests require ALLOW_ISOLATED_API_TESTS=1 and NODE_ENV=test',
    );
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Invalid isolated API-test database URL');
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '5433' ||
    url.pathname !== '/masterqala_test' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'API tests require the dedicated loopback 5433/masterqala_test database without URL options',
    );
  }
}

/** Shared helpers also serve the independently opted-in, isolated queue suite. */
export function assertIsolatedTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): string {
  let databasePath: string | undefined;
  try {
    databasePath = new URL(env.DATABASE_URL ?? '').pathname;
  } catch {
    // The API guard below rejects missing/malformed targets without leaking credentials.
  }

  if (databasePath === '/masterqala_urgent_queue_ci') {
    assertIsolatedQueueDatabase(
      env.DATABASE_URL,
      env.ALLOW_ISOLATED_QUEUE_TESTS,
      env.NODE_ENV,
    );
    return 'masterqala_urgent_queue_ci';
  }

  assertIsolatedApiDatabase(
    env.DATABASE_URL,
    env.ALLOW_ISOLATED_API_TESTS,
    env.NODE_ENV,
  );
  return 'masterqala_test';
}
