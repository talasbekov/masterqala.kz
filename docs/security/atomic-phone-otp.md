# Ordinary phone OTP atomic slice

Depends on the inactive auth-version foundation. This does not activate ADMIN,
recovery, role changes, version increments, or existing-socket revocation.

## Contract

Both requestCode and verifyCode take the existing transaction advisory lock
`pg_advisory_xact_lock(hashtext(normalizedPhone))`. Transactions explicitly use
ReadCommitted: a query after waiting for the lock must see the preceding
transaction's committed state, not a snapshot taken before the wait.

A database clock_timestamp sample taken after the lock supplies actual request
createdAt/expiry/rate-window timestamps and verification expiry checks. Request
limits remain three per ten minutes, code TTL five minutes, failed verification
limit five. A rejected wrong attempt is returned as an outcome from the
transaction, then converted to the same HTTP error after commit. Throwing inside
that transaction would erase the failed-attempt increment.

SmsCode.generation is a database sequence assigned on insert, which occurs only
after the phone lock. It defines issuance order independently of API clocks,
transaction-start timestamps, ties, and SMS delivery order. Verification selects
the maximum generation for the phone across ALL states, then rejects it if used,
expired, or exhausted. It never falls back to an older eligible code. Older
rows are not relabeled as used merely because a newer code was requested.

Successful consume and User upsert happen in one transaction. Failure to resolve
User rolls back consume. Existing blocked-user behavior remains: code consumed,
403, no JWT. JWT signing occurs after commit. Signing failure can consume a code
without delivering a token, as before; no outbox/provider retry feature is added.
User.id, role, MasterProfile, authVersion and existing relations are preserved.

## Migration and rollout gates (not executed)

The additive SQL migration locks SmsCode in ACCESS EXCLUSIVE mode inside an
explicit transaction, backfills generation by recorded createdAt/id order,
creates/owns/initializes the sequence and adds NOT NULL/default and indexes.
Historical real lock order cannot be reconstructed from old data. Recorded
chronology plus deterministic tie-breaking is a compatibility fallback, not a
claim to repair prior historical concurrency.

Review lock duration, table size, empty/nonempty migration replay and application
role USAGE permission on the new sequence (if distinct from migration owner) in
a disposable isolated PostgreSQL/PostGIS environment before any deployment. Migration precedes new
Prisma queries. Do not use db push/migrate dev/reset. Old writers can still use
the default sequence, but old verifiers do not acquire the phone lock. Drain all
old auth handlers before claiming the new atomic contract; mixed old/new
processes are NOT race-safe. Rollback to old verifier code reintroduces the bugs.

SMS sending remains outside the transaction, and concurrent sends can arrive out
of issuance order. Latest issuance wins, not latest delivery. A repeated numeric
code across distinct generations is inherently indistinguishable to the current
phone+six-digit-code API; this slice prevents repeated consumption of a generation,
not knowledge reuse when a later issuance randomly produces identical digits.
No extra OTP policy or client challenge identifier is introduced.

## Verification limits

Database-free unit tests assert transaction composition, committed failed
attempts, rollback, latest-generation state behavior and issuance timing. They do
NOT prove PostgreSQL concurrency. The dedicated auth-otp-atomic.e2e-spec.ts uses
real PostgreSQL transactions/lock barriers and a fake SMS sender; it must be run
only on the guarded isolated test target with explicit opt-in. On 2026-10-21, a disposable owned-workspace PostgreSQL16.15/PostGIS3.4.3
runtime was prepared from checksum/signature-verified official packages without
system installation. All17 OTP PostgreSQL cases and all292 standard API e2e
cases (65 suites, including existing Socket.IO tests) passed. Full migration
history and generation-migration empty/populated probes passed. The separate queue
suite also passed all 17 tests in two suites, including expiry, restart and cron
recovery. The temporary
server used loopback TCP only, UTC, isolated guards and shutdown cleanup.

This verifies the tested concurrency scenarios, not every possible production
race or deployment topology. GEOS3.13.1/PROJ9.6 differ from the container image;
version-family parity is not byte-identical CI image parity. Production migration
lock duration, separate runtime-role grants and mixed-process rollout still need
operational review. No real SMS/email, production database, real account or VPS
was used. Migrations/test fixtures touched only freshly initialized disposable
local databases.
