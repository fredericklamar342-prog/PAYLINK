---
name: frontend-ui-engineering
description: Implement maintainable PayLink presentation components, tokens, and client interactions within the existing Next.js architecture. Use for frontend UI engineering, not backend, deployment, or changes to financial settlement rules.
---

# PayLink frontend UI engineering

## Project constraints

Read `package.json`, `AGENTS.md`, the relevant installed guides under `node_modules/next/dist/docs/`, and the affected modules before editing. Next.js in this project may differ from remembered conventions. Preserve the existing App Router, React, Tailwind integration, Wagmi, Viem, and TanStack Query configuration.

The primary application styling lives in `app/globals.css`; reusable UI belongs under `components/`, while payment domain types and verification belong under `lib/`. Keep request encodings and receipt URLs backwards-compatible during a presentation task.

## Component boundaries

- Keep static layout/content as server components. Isolate client leaves for navigation state, feedback, dialogs, and motion.
- Reuse existing wallet/payment hooks. Never duplicate transfer submission or receipt verification inside an animation or button component.
- Extract a primitive when multiple consumers share behavior, not just because their markup looks similar. Prefer typed native element props and explicit variants over an elaborate polymorphic API.
- Give single-purpose components descriptive names. Keep unique form logic near its form rather than adding global state.
- Preserve SSR-safe browser access and the existing hydration strategy. Do not suppress hydration warnings to conceal different server/client output.

## Styling and dependency discipline

Use semantic color, typography, spacing, radius, and motion tokens. Refactor existing declarations instead of adding a cascade of overrides. Keep layout selectors distinct from component variants. Use CSS for basic interaction feedback; add Motion only for a concrete React animation need and read its official current APIs.

Inspect installed packages before installing a new one. Keep npm and the lockfile consistent. Do not force an unrelated dependency downgrade to hide an audit warning. A UI task does not authorize changing blockchain networks or adding secret-bearing configuration.

## State correctness

Presentation derives from real operation state. Preserve disabled signing guards, exact amount conversion, recipient validation, expiry checks, and transaction matching. Timers may reset transient UI feedback; they may not manufacture confirmation or financial progress.

Effects and timers must clean up. Handle rejected clipboard access, wallet refusal, and interrupted animations. Prevent stale feedback when props change. Prefer existing React/TanStack state over a new global state library.

## Verification and delivery

Run the available formatter, lint, TypeScript check, relevant tests, and production build. Fix introduced errors rather than silencing rules. Check changed routes in a browser, inspect console/hydration messages, and review narrow/long-content screenshots. Review the final diff for unrelated files and secrets. Describe functional limits and test coverage accurately; mock-wallet tests do not prove a real transfer happened.
