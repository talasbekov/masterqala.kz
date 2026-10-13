# Client result acceptance summary

Source: original Figma mobile node142:1671, inspected through high-fidelity design context and screenshot. That source displays the agreed quote when the customer checks the result, with explicit acceptance and problem actions. The previous view exposed acceptance but omitted the agreed quote in DONE.

This DONE-only increment displays actual work/materials/callout/total through the existing QuoteCard, the real agreed workComment (request description fallback), generic result-check guidance and existing direct-payment wording. The plumbing-specific sample checklist is not applied to unrelated categories. No sample identity, amount or paid flag is introduced.

Acceptance keeps the existing confirm-completion command and server checks. It remains disabled while busy/offline/reconciling, with56px mobile/52px desktop primary targets. The explicit problem action uses the existing support handler and does not accept or otherwise mutate the order. Header help remains available. Other lifecycle states retain their prior structure/actions.

Mounted tests first failed on the absent quote, then covered actual distinct scope/amount, RU/KK/EN guidance/payment/problem access, disabled acceptance, exact completion command, no support/render side effects and absence outside DONE. Native focus/scroll/geometry/Next navigation and a live backend two-role journey remain open; these DOM checks are not final visual or end-to-end acceptance.

Review correction: shared QuoteCard now retains null workPrice/quoteTotal as an unavailable dash instead of coercing them to zero; explicitly supplied zero remains formatted0. This is presentation only across client/master callers, with no payload or price computation change. DONE null/zero regression and existing quote-state tests cover the distinction.
