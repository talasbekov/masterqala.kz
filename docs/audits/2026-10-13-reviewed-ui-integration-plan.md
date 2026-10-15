# Reviewed frontend delta integration

Base: `4060ba904675a599ec975c7f0d58a4096b1f6f4e`. Isolated branch: `continuation/figma-reviewed-ui-20261013`.
Preserved frontend checkpoint: `6d7d2a9569aed47177b477f414abf4edb7c7ccd5` on `continuation/figma-local`.
No shared PR37 push, rebase, merge or deployment.

## Remote kept

- All API, direct client/master lifecycle views, containers, quote/cancellation contracts and recovery tests.
- `packages/ui/src/Locale.tsx`, `locale-data.ts`: canonical `mq.locale`, `mq_locale`, server language and shared events.
- Root client layout server cookie, Providers profile-language persistence and remote auth logout semantics.
- Shared tokens, Inter fonts, original source SVGs and all lifecycle exports.
- Private layout `/order/*` shell exception; shared Tailwind source discovery.
- Remote CI command correction and fixture screenshot evidence.

## Targeted local improvements to adapt

- TextField/CodeInput and field/OTP tests: labels, description/error associations, loading/disabled guards, stable focus geometry.
- LoginForm/usePhoneLogin/AuthGuard/auth-return: intentional OTP focus, action-specific busy states, repeated-click guard, safe interrupted-login return route, deferred async tests.
- AddressEditor/AddressDetails and ProfileForm: responsive existing-data forms and translated address abbreviations; retain exact API payloads.
- Figma language dialog with query-owned history and single host, adapted to canonical shared LocaleProvider. Do not restore a second storage key/provider.
- Non-order header/mobile shell alignment only after retaining lifecycle exceptions and accessible navigation.

## Manual overlaps

- `Providers.tsx`, `lib/i18n.ts`: unify language state; keep server-cookie/profile synchronization, remove duplicate persistence architecture.
- `packages/ui/src/Button.tsx`: preserve remote caller sizing/Tailwind; add useful loadingLabel/fullWidth/native ref compatibility only with regressions. Local fixed-width unlayered CSS must not override existing `w-full`/`flex-1` callers.
- `packages/ui/src/index.ts`: preserve every remote lifecycle export; reuse canonical Locale type.
- Private layout/globals: retain order exceptions, token/font imports and @source; integrate scoped form/dialog styles.
- `lib/auth.tsx`: remote selective token/user removal remains authoritative; do not port local clear-all logout.
- Shared locale tests: merge canonical persistence tests; do not overwrite remote coverage.
- Dependency/test scripts/lockfile: additive test tooling only, validated pinned Node22.12.0/pnpm9.15.0.

## Evidence and remaining gaps

Committed client approved-state PNGs at390/1440 were inspected as pixels. They show rendered fixture UI, synthetic identity/work text, unavailable gray map background, desktop dev indicator. They establish neither real backend journey nor exact Figma parity. Existing browser route restriction remains; no bypass attempted.

Still required: inspected-source pixel comparison for relevant states, real two-role backend browser journey/SMS/draft persistence, full app localization/public site/new-order parity, planned lifecycle/admin boundaries, queue-enabled recovery/PWA/push. Ordinary callout pricing remains undecided; do not invent a fee policy or migrate legacy data.

## Verification sequence

Small commits per primitive/form/locale/shell slice. Run focused DOM/state tests, shared build, client typecheck and production build after adaptation. Final aggregate checks against final SHA; remote CI must validate publication SHA separately. Local focused tests are not full app acceptance.

## First verified delta

Actual mobile approved-state comparison: committed base screenshot `client-approved-ru-390.png` versus current Figma `142:1562`. Added dedicated approved green token (#047857), total information-row16px inset and12px semibold caption/14px amount, mobile help action56px. Kept original SVG24px geometry and all mutation handlers. Fixture missing category yields no specialty row; no experience field exists in DirectOrder contract, so no fabricated content. OS status/home indicator is native chrome, not injected application content.

Imported reviewed TextField/CodeInput without duplicate fonts or button CSS. Offline pinned dependency install completed. Shared build/typecheck and8tests pass, including remote existing locale test. New approved-layout test failed before the delta and passed afterward; DOM class assertions are not browser geometry or final rendered parity proof. Browser QA remains pending.

## Login delta verification

Button API integration preserves existing Tailwind sizing and callers; localized loadingLabel/fullWidth/React19 native ref added,11shared tests/build pass. Login adapted without copying local shell or parallel locale provider: native phone/OTP focus, separate send/resend/verify busy labels, duplicate guard, safe returnTo and server payloads retained. Canonical provider/cookie/profile PATCH unchanged. Root Suspense now supports query-driven login/guard. Client8DOM/async/security tests, TypeScript and production build pass on this exact staged slice. Real SMS/Next navigation/native autofill still pending.

## Canonical locale and forms integration

Language dialog412:1520 is a single root host, uses shared LocaleProvider/setLanguage and canonical mq.locale/mq_locale, with a shared→i18next translation bridge. No legacy second storage key/provider/clear-all logout copied. Client initialization now tolerates blocked storage; profile PATCH remains remote-owned. Router-owned dismissal, rapid reopen, navigation-before-popstate/unmount and direct query entry tests preserved. Actual mounted canonical provider test verifies3languages, cookie/storage/i18next, draft DOM identity and token unchanged; fresh-runtime test verifies reload.

Reviewed existing-data address/profile fields integrated, responsive columns and localized entrance/floor/apartment. Name-only and address API payloads unchanged; no city/Kaspi/experience data fabricated. Auth layout now owns a100dvh flex viewport, fixing the review-confirmed missing mobile CTA flex ancestor without touching direct-order layout exceptions.

Frozen source: shared build/tests15pass; client22tests, typecheck and production build pass. Native browser focus/geometry/Next behavior/live CRUD still pending; DOM/style-source tests are scoped regressions, not rendered acceptance.

## Non-order shell checkpoint

Desktop header93:1599 integrated on non-order private routes, responsive width-free mobile navigation fallback preserves four destinations and active/accessibility state. Original mobile icon retrieval remains unavailable; text fallback is functional, not visual parity. `/order/*` retains authoritative remote shell exception and lifecycle headers/actions; regression asserts no added header/tab shell. Auth viewport wrapper remains independent. Client26tests/typecheck/production build pass. Added pinned CI execution for shared and client interaction tests before backend stages. Final aggregate cross-app checks follow on this frozen batch.
