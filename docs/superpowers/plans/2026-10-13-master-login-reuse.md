# Master Login Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with TDD and frozen independent review.

**Goal:** Reuse reviewed phone/OTP controls and lifetime safety in the existing master login route.

**Architecture:** Pure shared auth24 translation lookup consumes the existing canonical master language. One thin master route binds shared LoginForm/usePhoneLogin to existing API/AuthProvider/router, preserving '/'. CI runs mounted actual master tests before application builds.

**Tech Stack:** Existing React19/Next15/TypeScript/shared UI, Node22.12.0/pnpm9.15.0, no new dependencies or i18next state.

**Spec:** docs/audits/2026-10-13-master-login-reuse.md.

## Global Constraints

- Existing master AuthProvider permissions/token semantics, auth endpoints/security/rate limits and router.push('/') unchanged.
- Canonical LocaleProvider language only; pure copy adapter reuses exact reviewed auth24 RU/KK/EN values.
-30-second resend is source presentation, server authority unchanged; no inference about first login/role/city/onboarding.
- Shared labelled controls, viewport CSS/focus/action-specific loading and callback cancellation, no fabricated splash/terms destination.
- Native SMS/autofill/geometry and master-specific onboarding remain pending.

## Review Focus

- Retained OTP/phone callbacks and late responses after unmount must never authenticate or navigate.
- Locale-only rerender must preserve current phone/OTP/pending flow and valid current handlers.
- Duplicate send/resend/verify must remain synchronously gated with correct action-specific busy copy.
- Failed send/verify/resend must preserve appropriate input and restore usable actions.
- Master login cannot upgrade server roles or honor unreviewed returnTo query destinations.

### Task1: Pure shared reviewed auth copy

Files: create packages/ui/src/phone-login-copy.ts; export src/index.ts; create test/phone-login-copy.test.mjs.
Interface: phoneLoginText(language:Locale,key:string,values?:Record<string,string>):string, keys auth.* matching reviewed existing24 values; interpolate only supplied phone/time placeholders, unknown key returns key. No hook/provider/storage.
- [x] Write RED three-language exact-value tests against existing Vite auth resources excluding unused splashTagline, plus phone/time interpolation and unknown-key fallback.
- [x] Implement pure typed dictionary/lookup, run focused/full shared tests/types; freeze extraction commit.

### Task2: Actual master adapter and mounted CI tests

Files: replace apps/master/app/(auth)/login/page.tsx; import shared controls/login CSS in apps/master/app/globals.css; add test/login-entry.tsx, test/register-next.mjs, test/next-loader.mjs, test/login-route.test.mjs; add master package test script and CI master-interaction step.
Interface: existing api/request, useAuth.login and router.push('/') inject into shared hook; t is pure lookup over useLocale.language. Scoped mq-auth-shell/main/content supply viewport ancestors. No new permission or auth storage.
- [x] Write actual mounted RED route tests for three locales, labelled/focused controls, duplicate requests and pending copy, failed-code retention, local change number, late verification after soft navigation, locale-only continuity,30-second resend and server-returned role/destination preservation despite external returnTo query.
- [x] Observe old route failures, then replace with shared form/hook/copy and explicit scoped stylesheet imports.
- [x] Run shared/Next/Vite/master full tests, all frontend types and client/Vite/master builds; freeze review checkpoint and document fixture/native boundaries.
- [ ] Publish only accepted exact tree to unchanged PR38 head, then monitor full CI including new master interaction tests, PostGIS/queue/migrations/all builds.
