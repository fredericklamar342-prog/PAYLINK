---
name: interface-polish
description: Perform a focused visual finishing pass on existing PayLink screens using screenshots and existing tokens. Use for spacing, alignment, readability, and component consistency without changing product scope or payment logic.
---

# PayLink interface polish

## Establish a baseline

Read the changed components and their styles. Capture the current screen at a representative desktop width and a narrow phone width. Include a real empty state and a populated state; a screenshot of only the landing page is insufficient for a payment-interface change.

Preserve the ticket identity, content, and information hierarchy unless the identified defect requires a small adjustment. Do not add illustrations, feature cards, statistics, or background effects to fill perceived empty space.

## Inspect in this order

1. **Hierarchy:** is the payment amount dominant, the recipient legible, and the next action identifiable? Does a secondary action compete with it?
2. **Alignment:** check baselines, label/control edges, row gaps, ticket gutters, and section/container edges. Fix the layout rule instead of nudging individual items without a reason.
3. **Type:** remove orphaned headings, unreadably small helpers, inappropriate tracking, and inconsistent weights. Use balanced wrapping for headings and normal readable wrapping for explanatory text.
4. **Rhythm:** choose existing spacing tokens for repeated gaps. Reduce empty vertical space only when it improves task flow; do not crowd touch targets.
5. **Surfaces:** reuse the correct radius and shadow for inputs, dialogs, tickets, and background sections. These roles need not share one universal radius.
6. **States:** compare default, hover, focus, pressed, loading, disabled, error, and success treatments. Keep disabled text readable and state labels explicit.
7. **Edges:** inspect long names, long descriptions, 18-decimal amounts, narrow modals, and unusually dense QR codes.

## Implementation discipline

Patch the source style where possible; do not accumulate override blocks whose only purpose is to defeat earlier declarations. Separate a component class from a page-layout class. Avoid broad element selectors that change unrelated controls. Prefer reusable rules over equivalent per-route styling.

Do not equate visual greenness with confirmed payment. Keep decorative examples clearly labeled. Do not replace actual addresses with shortened text in the transaction-review region.

## Done criteria

Inspect new screenshots after the change, not just the code. Check horizontal overflow, visible keyboard focus, increased text size, and reduced motion. Run relevant regression tests and the required project checks. Summarize concrete before/after improvements and the screens inspected.
