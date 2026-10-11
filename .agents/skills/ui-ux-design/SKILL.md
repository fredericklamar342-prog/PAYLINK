---
name: ui-ux-design
description: Design or revise PayLink screen hierarchy, navigation, and visual systems while preserving the payment journey. Use for structural UI design work, not isolated CSS defects or blockchain implementation.
---

# PayLink UI/UX design

## Start from the payment decision

Read the relevant route, its components, `app/globals.css`, and the architecture and limits in `README.md`. Identify the user's immediate decision and the information needed to make it. For a payment, that means recipient, exact amount, token, network, purpose, and the effect of the next action.

Preserve the distinction between an illustrative ticket, an unsigned request, a submitted transaction, and an independently verified receipt. Design must not imply that a display name is verified or that a pending transfer has succeeded. Keep the testnet context visible.

## Design direction

- Keep the warm near-white, charcoal, slate, and controlled indigo identity. Reserve green, amber, and red for meaningful status.
- Retain the perforated payment ticket as the distinctive object. Use alignment, whitespace, and typographic weight around it instead of adding enclosing cards.
- Use Geist for interface text and Geist Mono for addresses, hashes, and technical references. Preserve every significant digit in transaction amounts.
- Prefer a compact hierarchy: screen purpose, payment information, next action, supporting detail. Do not enlarge headings at the expense of the amount or action.
- Start with existing color, spacing, type, radius, and motion tokens. Add a token only for a repeated design role, not each individual measurement.

## Workflow

1. Inspect current behavior and screenshots at desktop and phone sizes. Name concrete friction, not broad aesthetic preferences.
2. Record a short plan that relates each structural change to an observable improvement. Compare alternatives when mobile ordering or disclosure changes the signing flow.
3. Preserve route names, form semantics, URLs, and payment integration boundaries. Refactor presentation only where it improves comprehension.
4. Implement the hierarchy before adding motion. Empty, error, loading, long-content, and connected states must fit the same system.
5. Inspect the result as an image. Remove redundant labels, misplaced emphasis, and decorative containers. Do not remove useful context to simplify the screenshot.

## Acceptance

- A payer can locate amount, full recipient, network, and purpose before the signing action.
- A creator can understand required fields, correct errors, and reach their link or QR code without a tutorial.
- Navigation remains available on phones and keyboard focus follows reading order.
- Existing payment tests still pass. New behavior is tested where it affects navigation or a consequential action.
- Summarize what changed and its purpose; state any behavior that could not be checked.
