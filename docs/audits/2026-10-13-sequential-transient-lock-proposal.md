# Sequential transient-lock reproduction and minimal proposal

## Evidence and test-only checkpoint

Source `sequential-matching.service.ts` currently selects the next eligible master with `FOR UPDATE OF u SKIP LOCKED`, writes terminal NO_MASTERS if that result is empty, and recovery scans only SEARCHING. This establishes a suspicious code path, not yet an observed database failure.

New `test/sequential-transient-lock.e2e-spec.ts` uses an actual Prisma transaction holding the only eligible master's User row. An acquisition promise barrier (no sleep) starts dispatch only after the row is locked; a finally block always releases/awaits the holder. An explicit25-second Jest bound covers5-second acquisition and10-second transaction cleanup without an arbitrary sleep. It captures status/offers while locked, releases, runs actual recovery and asserts SEARCHING→one PENDING30-second offer. A second control requires NO_MASTERS when no eligible candidate exists. Existing nearest/expiry/decline/cross-order acceptance tests remain unchanged.

Full API TypeScript and diff checks pass with pinned Node22.12.0/pnpm9.15.0. No local PostgreSQL/PostGIS is available, so these new tests have not run. This checkpoint deliberately contains no service fix. Authorized exact-tree PR CI should establish the first real failing/passing evidence; do not claim reproduced behavior in advance.

## Minimal fix proposed only after actual RED

1. Reuse one bound Prisma.sql eligible-candidate query, preserving every existing filter, distance ordering and LIMIT1.
2. Keep the original SKIP LOCKED row-locked selection. If it returns no row, rerun the same eligibility query without the locking clause to distinguish a currently qualifying but unavailable locked row from a truly empty candidate set.
3. If a candidate still qualifies, keep SEARCHING and mark the result deferred. Preserve expiry outcome and old-master close notification, do not fabricate an offer or emit NO_MASTERS. Existing minute recovery may retry after release; this minimal proposal does not promise immediate latency or change cron timing.
4. Truly empty eligibility still transitions to NO_MASTERS. Existing pending offer/deadline, attempt guards, nearest available selection, ownership/active-order exclusions, acceptance locks and payments remain unchanged.
5. New DB reproduction must pass, then full existing sequential/direct/API suites/builds. Add narrow unit assertions only for deferred event/expiry behavior; do not substitute them for real PostGIS evidence.

## Separate bounded queue integration proposal

Installed original dependency is pg-boss10.4.2 (`apps/api/package.json` permits^10.4.2). QueueService constructs PgBoss with DATABASE_URL/default settings, registers persisted handlers/queues and minute cron, sends delayed jobs via startAfter, and stops nongracefully without waiting. Source/types verified from the installed package.

Correction to broad coverage wording: `queue.e2e-spec.ts` explicitly supplies PGBOSS_DISABLED0 and already verifies real generic job delivery in current CI. Global setup1 disables application urgent dispatch/timeout/recovery workers, not that standalone self-test.

Propose a separate dedicated CI test config/step after normal DB suites, against the existing isolated PostGIS test database with workers stopped between cases. Do not change global E2E setup or production infrastructure. Explicitly enable queue before constructing each test app; do not reset/truncate while workers run. Cases: actual queued creation delivers one nearest offer; persisted expiry advances exactly once with real handler and deadline (no direct dispatch shortcut); stop/restart workers resumes persisted pending/delayed work without duplicate offer; recovery repairs a missed dispatch for SEARCHING. Use bounded polling of actual database outcomes and always shutdown in finally. Keep the original30s deadline, grant a sufficient dedicated Jest/CI timeout rather than falsifying elapsed time. A separate case for committed order without job distinguishes identity from actual dispatch recovery; replay must not repeat creation/payment.

No queue retry/default/cron/security configuration changes in this proposal. Queue-enabled tests, postcommit recovery/outbox design and latency acceptance remain separate reviewed work. Direct payment holds/platform collection are not introduced. Legacy contracts/data are not rewritten.

## Observed RED and local minimal correction

Exact published test-only head80250e118c1227dc84400f17bf419eb2c76bee19, CI38344304003/job115122040124 reproduced the intended real PostGIS failure: line55 expected SEARCHING, received NO_MASTERS. The test acquired/released its transaction successfully; true-empty control passed. E2E264passed/1failed in62suites,198unit and53shared/66client passed; later frontend builds skipped. This is observed behavioral failure rather than a transaction/test timeout.

The local correction now implements the proposed same-query/nonlocking eligibility distinction and deferred SEARCHING event, preserving all predicates/ordering/locks/expired closure and existing minute recovery. Three focused unit cases cover deferred event/no fabricated offer, expired-offer closure and true empty exhaustion; two were observed RED before code, then GREEN. Bound SQL/values equivalence verifies the nonlocking check has the same filters as selection. Full local API42suites201tests, API TypeScript and production build pass. Real PostGIS GREEN of the new recovery regression is still pending publication/CI; local unit success does not establish that database result. No added retry interval, changed pricing, payment/dispatch compensation or legacy data rewrite.
