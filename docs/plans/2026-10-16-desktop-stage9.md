# MasterQala desktop stage 9 — remaining routes and states

Goal: compare the remaining 17 routes in the 44-route inventory against actual Figma sources, fix confirmed implementation gaps, and distinguish visual review from functional coverage.

Baseline: branch `feat/desktop-map-first`, HEAD `07699385e66f18252cf412b083fa1097484c088c`; stages 1–8 staged tree `dba6d405993fe4cf5a984c35002b70dcae6ea21f`. Preserve that baseline and the user's separate clean main checkout.

Architecture: existing Next.js applications, shared UI, local API/PostgreSQL, installed Chrome/Playwright. Independent application owners work only in their assigned files; parent coordinates fixtures, service builds, live verification and delivery.

Constraints: FREE_PILOT only; PAID_LIVE and PLATFORM_V1_RESERVED stay disabled. ACTIVE profile editing and submitted-bid editing remain off. No Figma writes, production operations, merge, push, deploy, new software or security changes. No mocked responses represented as live. Native paid/admin layouts require explicit contract-preserving adaptation. Do not send external interchat reports; parent reads this thread.

## Work

1. Preserve baseline; identify real local fixtures and capture remaining-route baseline screenshots.
2. Client: dashboard redirect, urgent creation/detail/orders, planned creation/detail/compare, both dispute routes. Review relevant Figma nodes and supported additional states.
3. Master: urgent/planned details, disputes list/detail/forms, login. Preserve inactive editor guards and report absent role-specific native designs.
4. Operator: login plus orders/verification/disputes detail, error, empty and confirmation states. Preserve OPERATOR permissions.
5. Integrate confirmed discrepancies; run meaningful regression tests, types and production builds. Restart local frontends only after builds, without altering API financial configuration.
6. Verify actual browser routes at 1440, 1366, 768, 390 in RU/KK/EN. Exercise available workflows and separately label deliberate network-failure tests. Record actual fixtures and coverage gaps.
7. Produce 44-route visual/function map, Figma Present language reproduction, screenshots/comparisons, review, stage-only/cumulative patches and verification manifests.

Review focus: route ownership and auth, failed requests and recovery, empty data vs missing integrations, locale/hydration, responsive overflow, dispute lifecycle and duplicate-write guards, financial/editor feature gates, preservation of stages 1–8.

## Results

Completed local verification: 615 tests, three changed-app production builds/types, 528 route/locale/width checks with 176 selected screens, 24 terminal-locale cases, 240 operator-state cases, and 15 functional groups. All final route cases have zero overflow/page errors/failed HTTP. Independent review found no remaining source blocker. See stage9 report, route CSV and manifests outside repository. A route screenshot does not prove every lifecycle state/mutation; missing/role-adapted frames and unavailable integrations remain explicit. The three final local financial switches stay false; all financial counters and reserved orders are zero. No publication or Figma writes.
