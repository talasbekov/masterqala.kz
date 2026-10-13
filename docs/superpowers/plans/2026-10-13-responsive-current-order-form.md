# Responsive current-order wizard

Approved bounded UI scope, based on inspected mobile118:1427 and desktop74:1333: preserve the existing four-step state, draft storage, server preview/creation flow, fees and timing behavior. No combined-form redesign, fabricated map ETA/identities, OS chrome or image substitutions.

- Scoped NewOrderLayout removes fixed560px shrink-zero overflow. Mobile has full-width24px-inset content,44px Back/help targets and56px primary actions; desktop uses400px card/map columns and52px actions. Intermediate widths stack safely.
- One correctly mounted map: mobile only during address step3, desktop alongside all steps. On step/width changes the current draft center is passed; only step3 provides coordinate callbacks. Layout itself never requests geolocation or writes coordinates. Form child identity remains stable across responsive transitions.
- Reuse accessible shared fields for existing address inputs, associate description/photo controls with labels, retain exact fields and edits. Safe-area bottom spacing without arbitrary fixed form width.
- DOM/matchMedia tests cover width/step transitions, draft input identity/current center/callback absence; stylesheet/source checks establish scoped constraints, not measured native geometry. Existing map center-prop synchronization is separately recorded and must be addressed before asserting complete saved-address visual behavior.
- Actual Next/mobile/browser geometry and live maps/SMS remain unverified. Final visual parity requires supported rendering.
