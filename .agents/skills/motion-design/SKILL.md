---
name: motion-design
description: Add or refine purposeful motion in PayLink for state feedback, disclosures, and continuity. Use when an interaction needs animation; exclude blockchain state decisions and decorative animation requests outside this project.
---

# PayLink motion design

## Choose the smallest useful treatment

Inspect installed animation dependencies, current client boundaries, and reduced-motion styles before choosing an implementation. Read the installed Next.js documentation before changing rendering boundaries. Check official Motion documentation when introducing an API; do not assume a legacy Framer Motion import works.

Use CSS for hover, focus, press, and simple pending indicators. Use `motion/react` for coordinated React state changes, presence, or a shared transition that would otherwise duplicate imperative state. Prefer the existing LazyMotion boundary and `m` elements if present. Do not add GSAP unless a specific timeline or scroll interaction needs capabilities unavailable in the existing tools.

## Motion vocabulary

- Immediate feedback: 100–140ms for press, copy acknowledgement, or an icon change.
- State continuity: 160–220ms for feedback or disclosure transitions.
- A single intentional entrance, if justified: at most 300ms and 4–8px of travel.
- Prefer decelerating ease-out curves. Avoid bounce, elastic scaling, background loops, and substantial parallax.
- Keep exact amounts, recipient addresses, QR matrices, and transaction hashes visually stable. Do not animate numbers through intermediate values.

Use the shared duration/easing tokens rather than new values in each component. Prefer opacity and transforms; assess height animations for layout shifts and focus movement before using them.

## State and accessibility

- Animation follows application state; it must never establish a successful payment or postpone a wallet request.
- Render essential content on the server without depending on animation to reveal it. Initial hidden state is inappropriate for payment details or primary actions.
- Honor `prefers-reduced-motion` in both CSS and Motion. Disable positional movement and looping animation; provide immediate state changes or a short opacity transition only when useful.
- Keep announcements in a stable live region, outside exiting elements. Avoid duplicate screen-reader content during presence transitions.
- Use keys representing the actual state being replaced. Rapid interactions should interrupt or supersede the prior transition, not queue it.
- Clean up timers and event listeners. A loading indicator stops when its operation stops, and reduced motion receives a static indicator with readable status text.

## Verify

Exercise enter, exit, interruption, errors, and repeated actions with keyboard and pointer. Check reduced motion in Playwright. Confirm content remains visible without JavaScript on public pages. Inspect console errors and build output for SSR or client-boundary regressions. Report why each animation exists and whether a dependency was added.
