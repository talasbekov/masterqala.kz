# Local test production-like environment

This package builds the API and all four Next.js applications from the current checkout in Docker. It does not reuse host `.next`, `dist`, databases on 5432/5433, or running services on 3000/4100/4200/4300/4400. Run it only on a developer/test machine with synthetic data.

**This is production-like, not production acceptance.** Next uses production builds/start. The compiled API deliberately uses `NODE_ENV=test`, `FREE_PILOT`, console SMS, disabled file scanning and enabled pg-boss workers. Production API validation remains unchanged: it requires HTTPS CORS origins, an HTTPS HTTP SMS provider, ClamAV and enabled workers. This package does not validate production TLS, real delivery, malware protection, PDF CDR, live payments, public hosting, backups or capacity. Never expose these ports publicly or upload personal documents.

## Prerequisites and reproducibility

- Docker Engine/Compose, PowerShell and Node for package checks; no host services are installed or reconfigured.
- Existing `postgis/postgis:16-3.4` image (database uses `pull_policy: never`). Obtain it separately if missing.
- Building needs access to the pinned `node:22.12.0-slim` base, OS package repositories and the package registry. The build uses repository `pnpm-lock.yaml`, frozen install and pnpm 9.15.0. Tags and OS repositories are not digest-pinned; record image IDs for an exact replay.
- Free loopback ports listed below. Production builds stay inside Docker and are performed sequentially to bound memory usage.
- Run commands from the repository root. Do not use the root `docker-compose.yml` for this task.

```powershell
./scripts/test-production/run.ps1 init
./scripts/test-production/run.ps1 check
./scripts/test-production/run.ps1 build
./scripts/test-production/run.ps1 up
./scripts/test-production/run.ps1 verify
```

If `node` is not on PATH, pass `-NodePath C:\path\to\node.exe` to `check` or `release-local`. `init` refuses to overwrite existing credentials. `.env.example` is documentation; do not copy its placeholder values. Initialization generates a fresh random DB password and JWT secret into `infra/test-production/.env`, ignored by the repository's existing `.env` rule. Never print `docker compose config` without `--quiet`, attach this file, commit it, or publish OTP logs. Container inspection can reveal container environment to the local Docker administrator.

The Docker build context explicitly excludes environment files, host dependencies/builds and uploads. Existing source is copied as-is; the package does not enable any additional ACTIVE-order or submitted-bid editors.

The site's existing `generateStaticParams` reads categories during build. `build-site.cjs` starts a temporary loopback HTTP endpoint serving only the six categories from the same `fixtures.cjs` used by the guarded seed, runs `next build`, then closes it. This requires no running database/API or external service. Its IDs are build-only placeholders. Runtime `API_URL` remains `http://api:3000/api/v1`; category pages use the existing dynamic rendering and read real test-database categories at request time. No authentication or business endpoints are mocked.

## Endpoints and data

| Component | Local endpoint |
| --- | --- |
| Site | http://127.0.0.1:14100 |
| Client | http://127.0.0.1:14200 |
| Master | http://127.0.0.1:14300 |
| Operator | http://127.0.0.1:14400 |
| API readiness | http://127.0.0.1:13000/api/v1/health/ready |
| Dedicated PostgreSQL | 127.0.0.1:15432 |

Use `127.0.0.1` in the browser: these exact origins are compiled into the frontend and permitted by API CORS. Database name is `masterqala_test_production`, role is `mq_test_production`, Compose project is `masterqala-test-production`, and volumes are `masterqala_test_production_db` / `masterqala_test_production_uploads`.

The guarded release runs `prisma migrate deploy` and then idempotently seeds six service categories and three clearly labelled synthetic accounts:

| Role | Test identifier |
| --- | --- |
| Client | +77000000101 |
| Master applicant (CLIENT role until normal onboarding) | +77000000102 |
| Operator | +77000000103 |

These identifiers are fixtures, not contacts. There are no real SMS requests, fixed OTPs, payments, purchases, balances, orders, bids, documents or automatic master approval. Request an OTP normally in the browser and read that request's randomly generated code in the local API container log. Codes expire after five minutes; existing rate limits remain active. Do not share those logs. Master onboarding/approval is a separate manual test flow.

Before any migration or seed, `release.cjs` requires the test marker, exact mode flags, role, database name and container host `db:5432`; `--local` permits only `127.0.0.1:15432`. It also verifies `current_database()` and `current_user` before launching Prisma. Existing ports 5432/5433 and arbitrary external database URLs are rejected. Secrets have no command-line arguments. Always use the wrapper, which sets exact values rather than inheriting another project's database URL.

If base-image downloads are unavailable, the dedicated database and migration can still be verified with existing host Prisma dependencies:

```powershell
./scripts/test-production/run.ps1 db
./scripts/test-production/run.ps1 release-local -NodePath C:\path\to\node.exe
```

This fallback proves migrations/seeds only; it does not prove container builds or UI readiness. It does not regenerate the host Prisma client. Ensure the installed client matches the checkout before running it.

## Stop, rollback and cleanup

```powershell
./scripts/test-production/run.ps1 down
```

This stops/removes only containers and the network belonging to `masterqala-test-production`. Both dedicated volumes and local secrets remain so `up` can resume. It never removes volumes, touches the existing database projects or runs global Docker cleanup.

Before changing revisions, stop this test stack and preserve the prior image IDs plus a backup of its test data if needed. This package only deploys forward migrations. It cannot safely downgrade the schema. To roll back code, rebuild a known compatible revision and run `up`; for an incompatible schema, use a separate clean test environment or explicitly back up and remove **only** these two named test volumes after inspecting their labels and mounts. Do not remove `.env` while reusing a volume: its database password must remain consistent. No automated destructive reset is provided.

Readiness requires the database and pg-boss queue to be UP. `scanner: DISABLED` is expected for this test profile and is not a production security pass. `verify` additionally checks six categories and HTTP 200 from all four UI roots. Full lifecycle/browser smoke tests remain separate from those basic checks.
