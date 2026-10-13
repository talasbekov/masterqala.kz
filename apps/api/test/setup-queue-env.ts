import {assertIsolatedQueueDatabase} from './queue-safety';
assertIsolatedQueueDatabase(process.env.DATABASE_URL,process.env.ALLOW_ISOLATED_QUEUE_TESTS,process.env.NODE_ENV);
// setupFiles runs before AppModule/config construction; normal E2E remains disabled.
process.env.PGBOSS_DISABLED='0';
process.env.COMMERCIAL_MODE='DIRECT_PAYMENT';
