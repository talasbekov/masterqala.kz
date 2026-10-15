# Approved mobile master action placement

Source: original Figma MasterQala node143:1877 (390×844), inspected through the supported design-context/screenshot tools. This increment follows the approved bounded action-placement plan, preserving existing lifecycle and quote semantics.

For PRICE_APPROVED outside quote editing, the mobile sticky action area contains Start work and a real customer telephone link when the API provides a phone. Both targets remain56px. No substitute telephone or identity is fabricated. Guarded Revise quote is available in scroll content; existing mobile header Help remains accessible. Desktop actions, pending-consent actions and quote-editing footer behavior are retained.

Start uses the actual quoteVersion; quote revision still requires a new consent through the existing workflow. Busy/offline/reconciling disables Start and Revise. Moving Revise changes no order state until existing server-backed actions run.

Evidence: a red mounted DOM test first reproduced the four-action footer. Shared mounted regression coverage verifies two-action order, real/missing telephone behavior, RU/KK/EN targets, disabled revisions, header Help, edit transition, retained awaiting-consent actions and existing start/revise quote-version assertions. Generated CSS rules and component typechecks are covered separately.

Native sticky geometry, safe-area rendering, focus, Next routing and real two-role backend journey remain unverified because the supported renderer route cannot access this execution namespace. DOM classes and callbacks establish structural/interaction constraints, not final visual parity. No assets, payment policy or API changes are included.
