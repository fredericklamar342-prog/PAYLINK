---
name: interaction-design
description: Improve PayLink control behavior, feedback, focus flow, and recovery paths. Use for forms, copying, wallet dialogs, disclosures, and payment-review interactions; do not rewrite transaction verification as a UI enhancement.
---

# PayLink interaction design

## Define the interaction contract

For the control being changed, identify its trigger, current state, next state, pending behavior, completion feedback, failure feedback, and recovery action. Reuse the state already owned by the relevant hook. Avoid a second success flag or timer that diverges from the source operation.

Read `lib/types.ts`, the relevant component, and its hook before changing payment-facing controls. The signing action must continue to depend on explicit review, the correct chain, a valid unexpired request, and the existing duplicate-attempt checks.

## Control patterns

- Use links for navigation and buttons for operations. Set `type="button"` on form-local auxiliary controls.
- Keep button geometry stable between default, loading, and success labels. Include readable status text when disabling a busy control.
- Clipboard feedback must correspond to the current value. Clear stale acknowledgement when the value changes or the feedback expires. Handle unavailable clipboard access and clean up timers.
- Retain entered values after validation or network errors. Associate field errors with controls and focus the first invalid field or a useful linked summary.
- Announce asynchronous updates in a stable live region. Do not announce every live-preview keystroke.
- Use a native dialog for wallet selection unless an existing component already supplies equivalent focus management. Escape, close button, backdrop behavior, and focus return must work; rejected requests must leave a recovery path.
- Prefer a simple always-visible navigation row when there are only a few mobile links. A hamburger adds another interaction and should solve a real space constraint.
- Use native disclosure semantics when possible. The trigger must describe what opens and expose its expanded state.

## Financial interaction invariants

Amounts and recipient addresses remain visible and selectable. Opening a wallet, copying a link, or navigating to a receipt does not imply payment success. Submitted transactions retain a visible explorer/recovery path. Never introduce automatic retries for signing or transfer submission.

## Verification

Exercise keyboard-only navigation, pointer/touch, double activation, interrupted operations, refusal, and retry. Verify wallet dialog focus return and clipboard feedback. Keep existing browser tests for the successful, pending, failed, expired, and mismatched-receipt flows. Add behavioral tests only for new or materially changed interactions.
