# Stage 9 follow-up: Kazakh dates and planned acceptance

Completed 2026-10-16. Prior result tree: 13a92881a7df8a3d9714825b94215dc91aca7a4d.

- Reproduced installed Chrome returning M01..M12 for supported kk-KZ locale while Node ICU returns native names.
- Added shared formatServiceDate with explicit twelve Kazakh month names. Date and numeric month use Asia/Almaty, including historical offsets. Client/master long dates and shared owned-order dates use it. Master planned slot end now also uses the service zone.
- Regression tests: twelve reduced-ICU month cases, device-zone/year boundary, historic UTC+6 and native RU/EN parity. All 14 new tests pass.
- UI package 204, client 241, master 167, operator 207, site 30 tests passed (849 total). TypeScript passed for UI and all four apps. UI and four production app builds passed.
- Installed Chrome: 36 month assertions across UTC, America/Los_Angeles and Asia/Tokyo device zones, plus six boundary assertions. These use synthetic dates in the production helper and are distinct from live API checks.
- Existing FREE_PILOT LEGACY planned order 3b8ebf35-7945-4e13-8f0a-f0f530e96e7a accepted through client UI, DONE to CLOSED at 2026-10-16T18:54:00.509Z. Exactly one confirm-completion POST. Client/master history verified; no active-list entry. All earlier lifecycle timestamps retained.
- Order counts unchanged: 19 urgent, 12 planned. Payments, accruals, withdrawals, credit purchases and reserved planned orders all zero. 16 live screenshots; zero page errors and no horizontal overflow at 1440/390.
- Independent reviewer found no blocking issues; independently ran 14 tests and diff check.
- Figma was read-only: after reported 36-reaction candidate, fresh Present at 1440x900 still stays Russian with RU selected through RU/KZ/EN/RU on 621:192, 621:196, 621:201. Four screenshots per node are byte-identical. This defect remains owned by the separate Figma task.

No editor activation, real integration, financial change, production migration, commit, push, merge or deployment. Stage 9's earlier full route matrix remains historical evidence; this follow-up adds focused fresh checks, not a repeated 528-case claim.

Subsequent Figma diagnostic (2026-10-16): fresh Present with `hide-ui=1` at 1440x900 verified RU -> KZ -> EN -> RU on all three nodes, including selected language and translated content. The earlier apparent failure above was not reproduced after excluding the Present toolbar from click coordinates. No Figma edits were made.
