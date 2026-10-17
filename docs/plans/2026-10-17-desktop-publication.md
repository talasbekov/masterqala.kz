# Desktop publication and isolated test launch

Authorized scope: publish the reviewed desktop work to main through a PR and successful CI; prepare an isolated production-like test launch.

Baseline: main 07699385e66f18252cf412b083fa1097484c088c; reviewed desktop tree 0afc16d5731883454f88590016ef94acecf045ed.

- [x] Confirm current worktree, preserve the user's clean main and staged desktop changes.
- [x] Read repository deployment/security instructions and current CI.
- [x] Inspect accessible deployment signals; disclose any unverified external automation before merging.
- [x] Review cumulative source changes and scan publication contents for credentials and private test artifacts.
- [x] Add a separate test-production package with dedicated database, loopback ports, explicit non-live configuration, build/migrate/seed/health/rollback instructions.
- [ ] Run appropriate local checks and CI on the exact PR head.
- [ ] Merge without force push after CI passes, then verify the remote merge SHA and its push CI.

Constraints: FREE_PILOT; no real payments/SMS, production database changes, purchases, security changes or persistent credentials. ACTIVE profile and submitted-bid editors remain disabled. A server deployment requires an identified test host and authorized access; preparing this package does not deploy to a real production service.

Verification distinguishes production frontend builds and compiled API testing from strict production-environment acceptance. Production validation must not be weakened for a local test harness.

Pre-publication evidence: independent desktop and test-package reviews found no confirmed blockers; API unit tests passed (268 passed, one skipped), API build passed, and all 15 deployment-target guard tests passed. Prior desktop verification recorded 849 UI tests, type checks and all four production UI builds. Full isolated API e2e and container checks are being repeated before merge.

Deployment investigation: the repository workflow only builds/tests; public GitHub deployments and environments are empty, Pages is absent, and no hosting configuration was found. Private webhook administration is inaccessible through the authorized integration, so external automation remains unverified and this limitation was disclosed before publication.
