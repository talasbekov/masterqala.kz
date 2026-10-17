# Test production-like package — 2026-10-17

## Authorized scope

Create only `infra/test-production/**`, `scripts/test-production/**`, this plan and `docs/test-production.md`. Preserve existing services, databases, code, production validation, ACTIVE/submitted-bid editor behavior and staged changes. No commit, push, external deployment, paid service or host software installation.

## Design and sequence

1. Inspect API environment validation, seeds, health checks, workspace manifests and local Docker availability.
2. Supply a dedicated Compose project and fixed loopback ports; fresh ignored local secrets; no inherited production URL/provider credentials.
3. Build compiled API and production Next applications inside Docker with frozen pnpm dependencies. API runtime stays explicitly test-only because production requires real TLS/SMS/ClamAV dependencies.
4. Guard the exact target before any DB connection, verify database identity, apply existing migrations and seed minimal synthetic accounts/categories. Test rejection of existing databases, external hosts and commercial modes.
5. Verify Compose, guards, dedicated database/migration idempotency and, when build prerequisites are available, readiness and UI endpoints. Keep any unverified build/runtime behavior explicit.
6. Provide startup, OTP, rollback and nondestructive shutdown instructions. Preserve dedicated volumes; no automatic reset/downgrade.

## Acceptance evidence

Record actual checks and outstanding prerequisites in the implementation handoff. A successful migration is not evidence of a successful image build; HTTP readiness is not evidence of production security or complete user flows.

Verified locally during implementation:

- `run.ps1 check`: resolved Compose configuration and 15 database/mode guard tests passed.
- Resolved build context points to the repository; all six published ports bind `127.0.0.1`.
- `git check-ignore infra/test-production/.env`: generated local secrets are ignored.
- New PostgreSQL container became healthy on 15432. All 26 existing migrations deployed successfully.
- Guarded seed completed twice without duplicates; direct read-only counts were 26 migrations, 6 categories and 3 users.
- `down` then `db` removed/recreated only the new project's container/network while preserving its test volume.
- Existing Docker databases retained their original loopback bindings on 5432 and 5433.
- Node base image resolved to `node:22.12.0-slim@sha256:35531c52ce27b6575d69755c73e65d4468dba93a25644eed56dc12879cae9213`.

- `run.ps1 build` completed successfully for API, site, client, master and operator with pnpm 9.15.0 / Node 22.12.0. All Next builds completed compilation, type checks and page generation.
- `run.ps1 up` applied the guarded container release successfully and started all six services healthy.
- `run.ps1 verify` passed: API readiness, queue, six categories and HTTP 200 from all four UI roots.
- API readiness reported `database: UP`, `queue: UP` with `enabled: true`, and intentionally `scanner: DISABLED`.
- `/categories/plumbing` returned HTTP 200 without build-fixture IDs. Built site prerender metadata has empty `routes` and `dynamicRoutes`, preserving request-time category reads.
- Final read-only counts remained 26 migrations, 6 categories and 3 synthetic users; existing database containers remained running on 5432/5433.

Local image IDs after successful builds:

| Image | ID |
| --- | --- |
| masterqala-test-production-api:local | 1f24be61e692 |
| masterqala-test-production-site:latest | 947cd7226221 |
| masterqala-test-production-client:latest | 43d1d4e02840 |
| masterqala-test-production-master:latest | 6bb7066cce5a |
| masterqala-test-production-operator:latest | 95d09e93c6da |

The local stack was left running for browser smoke tests. The checks above do not claim authenticated lifecycle coverage, visual acceptance, public hosting or strict production-mode security acceptance.
