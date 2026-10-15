# Required exact-head CI gate

Run the existing `.github/workflows/ci.yml` on the reviewed final commit before readiness claims. Publication, merge and deployment remain separately controlled. Do not replace the isolated databases with a live connection string.

## Environment

- Node 22.12.0, pnpm 9.15.0; frozen lockfile
- `postgis/postgis:16-3.4` service on localhost:5433, database `masterqala_test`
- Separate `postgis/postgis:16-3.4` service on localhost:5434, database `masterqala_urgent_queue_ci`
- Use the test-only credentials and JWT secret from the workflow; NODE_ENV=test, ordinary suites PGBOSS_DISABLED=1

## Commands

From repository root, follow the workflow order:

```sh
pnpm install --frozen-lockfile
pnpm --filter @masterqala/ui run test
pnpm --filter client run test
pnpm --filter web run test
pnpm --filter master run test
pnpm --filter operator run test
pnpm --filter site run test
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build
pnpm --filter api run test --runInBand
pnpm --filter api test:e2e
```

The migration and ordinary API commands use the isolated 5433 database. The E2E command must include `admin-withdrawals.e2e-spec.ts`, `direct-order-lifecycle.e2e-spec.ts` and `planned-lifecycle-boundary.e2e-spec.ts` in the full suite, not just their unit counterparts.

Then use the isolated 5434 database for `prisma migrate deploy` and `test:queue:e2e`, with `ALLOW_ISOLATED_QUEUE_TESTS=1`, `PGBOSS_DISABLED=0`, `COMMERCIAL_MODE=DIRECT_PAYMENT`, as in the workflow. These are real existing queue/restart tests; the new reserved planned handler tests alone are not a new end-to-end scheduler test.

Build web, client, master and operator. Start the real test API and wait for `/api/v1/health/ready`, then build site with `API_URL=http://localhost:3000/api/v1`; stop the test API afterward. A site build without an API, fixture-only UI tests or old-head CI cannot stand in for this step.

## Additional migration rehearsal before rollout

In a disposable database, apply migrations through `20261013000400_order_creation_request`, seed representative historical planned rows for DIRECT_PAYMENT/FREE_PILOT/PAID_MOCK and credit histories, record their values, then apply `20261015000100_planned_lifecycle_boundary`. Verify all existing data is unchanged apart from the new LEGACY field and that older queue payloads still operate only on LEGACY. This rehearsal has not been executed locally.

## Stopping conditions

Stop publication/readiness progression for any failing test, migration, concurrency/rollback invariant, unexpected history change or unverified head mismatch. Investigate and fix only within the authorized scope. Never compensate for an absent test database by using production, disabling security checks, removing assertions or enabling real payments. A green run still does not activate PLATFORM_V1_RESERVED, establish provider readiness, or authorize merge/deployment.

## Local blocker

The task workspace has no PostgreSQL/pg_ctl/psql/initdb or Docker/Podman executable, no cached database packages, and localhost:5433 returns ECONNREFUSED. Targeted E2E was attempted and failed at application initialization (`Can't reach database server at localhost:5433`). Tests did not execute. Installing system database components was not attempted by altering access controls or bypassing the managed package/network path. The existing CI service setup is the reproducible next verification environment.
