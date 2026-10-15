# Direct urgent order — review checkpoint

This is an implemented urgent-flow increment, not completion of the whole Figma/MVP plan. Original Figma is unchanged. Branch: `feat/figma-mvp-alignment`; draft PR: https://github.com/talasbekov/masterqala.kz/pull/37.

## Implemented and locally verified

- Additive urgent lifecycle v2 with DIRECT_PAYMENT, sequential one-master offers, persisted 30-second expiry, quote versions, explicit consent/start and client acceptance. Existing mode/version stays attached to historical orders.
- Client direct screens and master direct quote/start screens call actual existing API endpoints. They preserve a failed quote draft, refresh server state on reconnect/foreground, block mutations until reconciliation succeeds, and block double submits. Back only navigates.
- Confirmed cancellation previews send amount and updatedAt. Server-side actual departure decides 0 / 2500 KZT directly to the master; platform does not capture or accrue money.
- Read-only pending-offer endpoint restores owner-specific unexpired offers. Monotonic request generation prevents an old GET restoring an accepted offer. Skip calls decline. No invented platform compensation for direct offers.
- Dispute resolution cannot accept direct work for the client. Financial sanctions/refunds for lifecycle v2 return a conflict while policy is undecided. Legacy behavior remains.
- Shared Inter fonts (including Kazakh Cyrillic), tokens, controls and direct-flow RU/KK/EN copy. Local preference/cookie and PATCH profile language. User-entered text is not translated.
- Operator urgent detail shows quote breakdown/cancellation amount separately from platform payments.

Checks observed locally: 38 API unit suites / 182 tests pass; API and shared UI builds pass; web production build passes; client/master/operator TypeScript checks pass. Unit tests initially failed for the new regression cases before the corresponding fixes. Locale formatting test passes with Node 24.

Browser checks exercise the real rendered app with explicit REST/Socket.IO fixtures, **not a real database-backed full browser journey**:

| Application | Languages | Widths | Checked behavior |
|---|---|---|---|
| mobile client (Vite) | ru / kk / en | 360 / 390 / 430 | current quote version, duplicate click, cancellation conflict, Back, assets, horizontal overflow |
| desktop client (Next) | ru / kk / en | 1280 / 1440 / 1920 | same behavior, cookie language, desktop action visibility |
| master (Next) | ru / kk / en | 390 / 1440 | breakdown payload, failed draft retained, server-approved quote, explicit start |
| master delivery | ru | 390 | deferred restore response after accept cannot reopen offer; Skip POSTs decline |

Mobile client reconnect check additionally confirms failed reconciliation leaves cancellation disabled until a successful read. Screenshot files in `screenshots/direct-urgent` show these actual development apps with synthetic identities/order descriptions. Next development indicator is visible in some screenshots. Map tile download is unavailable in this environment; the desktop map background is grey. Avatar uses actual initials, not invented user photos.

## Implemented but awaiting latest CI

The language migration and newly added real PostGIS regression checks (owner offer recovery and operator resolution preserving DONE) await this checkpoint's CI. Earlier backend CI run 38318726764 passed migrations, server tests and builds before these latest UI/review changes. Reconcile this section with actual latest CI before calling the checkpoint complete.

## Not implemented / not fully verified

- Whole-app localization: existing kk/en legacy dictionaries are still incomplete. Direct-order labels and master navigation are localized; old forms and operator screens still need work.
- Exact visual parity of every state, new-order form/layout and public site. The urgent form's DIRECT_PAYMENT copy no longer falsely calls the callout free, but its full Figma redesign remains.
- Draft persistence through SMS login, integrated two-role browser journey with real backend, actual-device PWA/push checks, full network-loss matrix.
- Planned lifecycle v2, ADMIN separation/last-admin protection and push subscriptions (plan Tasks8–10). Existing planned/role behavior is legacy and must not be described as implemented new MVP.
- Financial handling after a master has departed and cancels: endpoint returns support conflict; partner/support policy is pending.

## Product decision required

Actual Figma node 118:1598 displays a fixed 2500 KZT callout in the incoming offer. The approved decision specifies 2500 KZT only for cancellation after departure. Ordinary quote callout pricing remains unapproved. Current API requires an explicit callout amount in the quote; new mode is **not enabled by default**. Resolve fixed 2500 vs master-entered callout before public activation; don't infer that one decision implies the other.
