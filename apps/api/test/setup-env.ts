import { assertIsolatedApiDatabase } from './database-safety';

// Fail before AppModule/config or any database client is constructed.
assertIsolatedApiDatabase(process.env.DATABASE_URL, process.env.ALLOW_ISOLATED_API_TESTS, process.env.NODE_ENV);
process.env.PGBOSS_DISABLED = '1';
