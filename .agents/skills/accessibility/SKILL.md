---
name: accessibility
description: Audit and improve PayLink keyboard access, semantics, form feedback, contrast, motion preferences, and screen-reader behavior. Use for accessibility work or interaction changes that affect these behaviors.
---

# PayLink accessibility

## Start with the actual behavior

Inspect semantic HTML and test the relevant flow using a keyboard. Identify the observable problem before adding ARIA. Native links, buttons, form controls, details, and dialogs are preferred when they supply the required behavior.

Preserve the skip link, main landmark, document language, heading hierarchy, visible focus, and meaningful page titles. New client components must not remove server-rendered essential content.

## Forms and payment review

- Use persistent labels, `required` where applicable, and `aria-describedby` for helpers/errors. Set `aria-invalid` only when invalidity has been evaluated.
- Keep error text near the control; never rely on a red border alone. Move focus to the first actionable error or a linked error summary on submit.
- Expose the full recipient address, exact amount, token, and network as readable text. A shortened visual address needs an accessible full-text review elsewhere before signing.
- Announce asynchronous status using a stable polite live region. Keep error alerts scoped and avoid duplicated announcements from entering/exiting motion elements.
- Busy controls need understandable labels; a spinner by itself is insufficient. Do not use an indeterminate progress bar for a known success or failure.

## Focus and input

Ensure a logical tab order and visible focus that is not clipped or covered. Dialogs must trap focus while open, close with Escape, and restore focus to the trigger. Do not autofocus ordinary page inputs; deliberately focus results or errors after user-initiated transitions.

Use 44px or larger touch targets. Essential actions cannot depend on hover, dragging, animation, or color. Keep browser zoom enabled and test text reflow at 200%.

## Contrast and motion

Measure normal text at 4.5:1, large text at 3:1, and meaningful control/focus boundaries at 3:1 against adjacent surfaces. Treat disabled controls separately, but keep their labels usable. Distinguish errors, pending states, and confirmation with words or icons as well as color.

Honor `prefers-reduced-motion` in CSS and JavaScript animation. Remove translation, scale, parallax, and spinning indicators for those users while preserving status text. Do not hide content when JavaScript is unavailable.

## Evidence

Use the existing Playwright infrastructure for behavioral regressions and an available axe installation for automated checks. Test keyboard operation, focus return, dynamic announcements, and reduced motion manually or through browser assertions; axe does not prove these behaviors. Report scope and limits instead of claiming complete WCAG conformance from a scan.
