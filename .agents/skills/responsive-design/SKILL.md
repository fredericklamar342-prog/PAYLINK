---
name: responsive-design
description: Adapt PayLink layouts and controls across phone, tablet, and desktop sizes without changing content or payment semantics. Use for reflow, overflow, touch usability, and viewport-specific composition.
---

# PayLink responsive design

## Inspect before changing breakpoints

Read `app/globals.css` and the relevant DOM order. Record the existing layout thresholds before adding one; PayLink originally uses 480, 760, 1050, and 1450px boundaries. Treat these as implementation history, not immutable device categories. Introduce a threshold only where content demonstrably stops fitting.

Prefer intrinsic sizing, `minmax(0, 1fr)`, wrapping, and constrained measures before new media queries. CSS variables cannot be used directly in native media-query conditions; document breakpoint roles near the actual rules rather than pretending a custom property controls them.

## Payment-specific composition

- Keep amount, token, and recipient dominant on phones. The full review must be reachable before the user can meaningfully approve signing.
- If moving the live composer preview on mobile, preserve the ability to inspect it while editing. A disclosure can save vertical space without removing it.
- Preserve DOM reading order. Do not use CSS reordering that creates a confusing keyboard sequence.
- Give primary actions a useful full width on narrow screens, with comfortable safe-area spacing. Avoid sticky controls that cover fields, dialogs, or the footer.
- Keep navigation available rather than hiding every link below a breakpoint.
- Allow wallet addresses, hashes, and share URLs to wrap without clipping characters. Avoid globally hiding horizontal overflow to mask layout defects.

## Controls and text

Use at least 44px touch targets and adequate separation. Use 16px input text on narrow touch screens to avoid focus zoom. Keep selects, date inputs, and dialogs within the viewport. Names and descriptions must wrap; amount precision must never be truncated to fit.

Use fluid heading sizes with sensible bounds, consistent container gutters, and readable body measures. Reduce decorative space before shrinking useful text. A transformed decorative pseudo-element can cause overflow even when DOM element bounds fit; inspect it explicitly.

## QA matrix

Check at least 320/375px, a landscape phone, 768/820px, a laptop, and a large desktop when layout is changed. Include 200% zoom or enlarged text, reduced motion, long content, empty fields, validation errors, an open wallet dialog, and generated QR output.

Measure `scrollWidth` against the viewport and investigate the offending element. Capture screenshots to judge composition; a passing overflow assertion alone is not visual QA. Preserve print behavior for receipts.
