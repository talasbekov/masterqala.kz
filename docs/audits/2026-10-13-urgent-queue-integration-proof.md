# Urgent application queue integration proof

## Test-only scope

Existing normal E2E setup disables AppModule queues, while `queue.e2e-spec.ts` separately enables real generic pg-boss delivery. The new dedicated config/file tests actual urgent application workers, not manual dispatch/recovery methods. Production QueueService, pg-boss defaults, deadlines, minute cron, matching/payment/dispatch runtime and fees are untouched.

CI uses a separate disposable PostGIS service/database on loopback5434/masterqala_urgent_queue_ci. Setup requires NODE_ENV=test and explicit ALLOW_ISOLATED_QUEUE_TESTS=1, checks exact loopback/port/database/no alternate schema, then enables queue/direct mode before AppModule/config construction. Cleanup additionally verifies actual `current_database()` before clearing jobs or application fixtures. No normal/shared/deployed database or jobs are purged. Additive existing migrations apply to the isolated service; regular E2E regex excludes the new integration/safety files.

## Cases requiring real CI

1. Real keyed HTTP creation invokes queued dispatcher, creates one nearest-master offer with original30s persisted deadline; exact replay returns same order without another dispatch/offer.
2. Actual elapsed30s timeout causally changes PENDING→EXPIRED and creates the next eligible offer. Two additional distinct marked real queued jobs both reach completed without another offer.
3. At least one original delayed job is read from pg-boss10.4.2 persisted `start_after`; its selected exact ID survives worker stop/restart and reaches completed afterward. Actual timeout handler changes PENDING→EXPIRED and creates the next offer. No expiry shortening, fake clock or direct service dispatch/recover call.
4. Queues are stopped while a keyed request commits SEARCHING; replay preserves one identity and zero offers. Restart lets the real minute cron recover missed dispatch. This establishes only that scenario, not generic outbox/payment/postcommit failure recovery.

Timeout/expiry and delayed-restart cases explicitly isolate only sequential recovery scheduling: while the original QueueService bootstrap runs, its test-only cron list snapshot excludes SEQUENTIAL_RECOVERY, then is restored immediately. The dedicated database's old recovery schedule is removed before bootstrap; its jobs were cleared only after quiescence. All actual handlers/other scheduling/deadlines remain. Handler observer records real before/after offer outcomes and post-handler offer IDs; the timeout must cause PENDING→EXPIRED and the next offer, with zero recovery invocations. This is test isolation, not a production scheduling change. The independent minute recovery case runs complete original scheduling and proves actual cron separately.

Injected duplicate timeout data adds harmless unique testDeliveryMarker values. Assertions require both distinct persisted exact jobs to be completed and both corresponding actual handler observations to finish, so incidental cron/same-offer job counts cannot satisfy them.

Every wait polls observed conditions with a deadline, not a fixed sleep asserting elapsed success. Each Jest case has180s including actual30s/cron windows; cleanup has a separate15s quiescence bound. CI logs are uploaded even on failure.

## Cleanup instrumentation

QueueService's original registered handlers are wrapped only to observe start/completion/error; actual handlers still execute. Original pg-boss10.4.2 Manager.getWorkers is observed to retain actual worker references. After original nongraceful QueueService shutdown, tests wait for every observed worker's stopped flag AND every AppModule handler to finish before destructive reset. This observation is version-pinned/test-only and changes neither fetch, stop nor handler behavior. Cleanup client has no scheduling/supervision/workers and exists only in the guarded disposable database.

## Local evidence and limits

11 pure database/opt-in guard cases pass. An intentionally no-op guard produces10 expected assertion failures (then restored GREEN), establishing safety assertions are meaningful. API TypeScript and full42unit suites201tests pass; dedicated Jest discovery lists exactly the integration/safety files, normal E2E lists only its preexisting standalone queue test. No local PostGIS service exists, so the four real cases have not executed. They require exact-head CI; failures must be diagnosed as runtime assertion versus setup/infrastructure before any runtime change. No queue recovery claim is made from compilation.

Latest published preceding Vite14a9935e exact CI38347293744 passed15Vite/55shared/66Next,201unit/265PostGIS,migrations/all builds. This queue batch is separate and unreviewed until its frozen checkpoint is accepted.

Review corrections preserve offer-count invariants while allowing duplicate persisted timeout records, establish timeout causality with recovery isolated in only those cases, and identify both duplicate deliveries precisely. Guards/types rerun on corrected checkpoint; real database cases remain unexecuted locally.
