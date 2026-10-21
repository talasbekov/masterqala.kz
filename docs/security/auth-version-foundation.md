# Access-token version foundation (inactive revocation)

This package adds a compatibility boundary, not an ADMIN, recovery, logout-all,
MFA, or live-session revocation feature. There is no application writer that
increments `User.authVersion`, no new role, and no permission expansion.
Existing CLIENT accounts (including MasterProfile owners) and OPERATOR phone
login remain supported. Ordinary unblock behavior is not changed into permanent
session revocation.

## Narrow contract

- Additive User.authVersion INTEGER NOT NULL DEFAULT 0, constrained nonnegative.
- All new ordinary phone-login JWTs carry sub, role and authVersion; existing
  configured 30-day expiry remains unchanged. Issuance rejects malformed version,
  identity, or unknown role instead of accidentally issuing a legacy token.
- HTTP authentication and NEW Socket.IO handshakes use one validator: verify
  signature/expiry, validate identity/role/version shape and finite expiry,
  reload User, reject missing/blocked users, and require token role and version
  to match the DB snapshot. Request authority remains the database User.
- Legacy tokens with no authVersion are accepted only with an explicit CLIENT or
  OPERATOR role matching the DB and DB version zero. Explicit null/string/etc.
  is not legacy. Production legacy issuance already included role and expiry.
- A role change cannot silently upgrade an already-issued token. Test helpers
  now establish the role before login instead of upgrading it afterward.
- Existing connected sockets are NOT revalidated. Handshake DB-read/join races,
  stale in-flight HTTP mutations, outgoing delivery, and cross-process eviction
  remain unresolved. This foundation must NOT be described as session revocation.
- This foundation alone does not change phone-OTP concurrent-consumption or
  generation selection. If the separate atomic OTP patch is applied, consult
  `atomic-phone-otp.md` for its contract and unverified DB acceptance gates.

## Deployment prerequisites (not performed)

1. Review/apply only the additive SQL migration before running code whose Prisma
   queries require the new column. Do not run db push, migrate dev, or reset.
2. Deploy version-aware issuers/validators to every API process; drain old ones.
   Only after the last legacy issuer is stopped does its normal 30-day token
   lifetime bound the remaining compatibility window.
3. Do not enable ANY version-changing operation until a separate implementation
   validates ongoing socket traffic/delivery, join races, in-flight mutation
   checks, multi-process topology and atomic security changes with real isolated
   DB/socket tests. Never enable an ADMIN or recovery UI as a substitute.
4. Before such future activation, define rollback rules. Old code ignores the
   version and must not be restored after version-changing operations occur.

No deployment, database migration, real SMS/email, or real-account action is
included. Unit tests cover the pure/module/HTTP/handshake boundaries using fakes;
they are not PostgreSQL, network Socket.IO, or browser acceptance tests.

## Destructive test protection

Standard API e2e tests require explicit `ALLOW_ISOLATED_API_TESTS=1`, NODE_ENV=test,
and the exact local isolated test target. Queue tests retain their separate
opt-in/target. Setup and shared helpers fail closed, and resetDb checks connected
database/schema identity before TRUNCATE. See the test instructions in README.
Do not set these flags against any real data. This standalone foundation was
initially reviewed without an isolated DB. The subsequent atomic OTP package
records combined real PostgreSQL/API e2e acceptance in `atomic-phone-otp.md`.
That acceptance does not activate version-changing writers or solve ongoing
session revocation.
