# Honest support and notification availability

Scope: the existing Next-client and Vite `/support` and `/notifications` routes. This bounded frontend batch does not implement an operational support inbox, general intake, notification feed or push delivery. Those dependencies remain unimplemented on the fixed 55-route inventory.

## Verified sources and current contracts

High-fidelity Figma context and screenshots were inspected: mobile notifications181:3634 and empty181:3748; account help164:3956; order help145:1899 and338:4584; desktop order-bound dispute93:1518. Mobile sources use24px content insets,28/34 notification heading,14/21 body,16px-radius soft cards and56px actions. Account help uses24px heading and Order question/Account login actions. No standalone generic desktop support page was found on the inspected pages. Sample event identity/ETA/amount/date are not production data.

Both prior notification pages always rendered an empty inbox without a read API. No notification feed controller/module/model or owner event-history GET was found in the current AppModule/schema/controllers; Socket.IO status delivery is not a persisted inbox. The generic support pages contained an unverified tel:7666/free-call claim and four inert FAQ rows. No verified support contact or FAQ answers were found.

Existing `POST orders/:id/disputes` is participant/owner checked, accepts reason1–2000 characters, and permits only IN_PROGRESS/DONE/CLOSED with the existing48-hour closed window. It is not a general pre-work intake. This batch does not broaden that contract or change lifecycle/financial policy. Direct Help still uses the existing support destination; unavailable general help must be stated honestly.

## Bounded frontend behavior

Shared source-styled RU/KK/EN views state that the service-event feed and general contact channel are not connected in this interface. They never assert zero events, invent contacts/events, promise an operational inbox, request push permissions, mark read, submit a problem or automatically log in/out. Real internal links open My orders, Help, Home and the current account/profile. A signed-out view may link to the existing login route; actual protected route boundaries remain unchanged.

Original mobile icons/desktop shell and native geometry remain separate gaps. No screenshot, redrawn icon, OS chrome, sample identity/ETA/date or placeholder amount is used as implementation content.

## Verification and remaining dependencies

Shared DOM tests cover all three locales and both view kinds, honest unavailable copy, internal destinations, authenticated versus signed-out account navigation, accessible targets and no network/external-call/submission. Mounted tests now exercise the actual four route components in all three locales with installed Next Link context adapters and Vite MemoryRouter. Both preserve the owner-scoped draft/pending identity through soft support→orders navigation, then settle the exact original late create callback without another POST. Availability rendering/navigation itself does not call a service API. Existing authentication layouts/guards are unchanged; this is not native App Router or full protected-shell acceptance. Native Next App Router/history/hydration, browser geometry/focus and live journeys remain unverified; KK wording requires native-language review.

A verified support contact/channel and any free-call statement require owner confirmation. General order help across pre-work stages needs a separate owned intake contract. Populated/true-empty/error notification states need a persisted owner-safe feed contract. Neither service dependency is completed by an availability view, and no planned-v2/admin/financial policy is inferred.

The unverified `support.call` resource is removed from both legacy RU dictionaries; unused old FAQ strings are not rendered. Shared service copy supplies all three languages without falling back to those old resources. General support/notification dependencies remain explicitly unimplemented in the fixed inventory.

Final local checks on Node22.12.0 / pnpm9.15.0: 87 shared,76 Next-client and29 Vite tests passed; UI/client/master TypeScript and client/Vite/master production builds passed. Existing Vite large-chunk warning remains. Six shared cases and seven actual-route cases per client observed RED before implementation, then GREEN. These checks cover the availability UI and existing draft callback, not actual service intake/feed or native screenshots. Independent review and exact new-head CI remain required before publication.
