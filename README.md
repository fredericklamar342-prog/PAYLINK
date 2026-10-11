# PayLink

A payment-request MVP for Monad Testnet. Requests are stored through Supabase and shared by UUID link or QR code. Stored MON and USDC requests can submit a wallet transaction, but the application does not yet record or publicly confirm their settlement.

## Supabase setup requires owner action

The integration supports MON and USDC requests and maps to the owner's existing `recipient_wallet`, `token_symbol`, numeric `amount`, text `network` and `pending` status columns. No hosted database, RLS policy, or Auth setting has been changed. Existing check definitions and dependencies must be reviewed before applying the additive SQL proposal. Root `.env.local` is present and ignored by Git; `lib/env.local` is not a Next.js configuration file.

Follow [Supabase setup and approval instructions](supabase/README.md). Supply the project URL and publishable key locally, inspect the database with [read-only audit SQL](supabase/audit-payment-requests.sql), and review [proposal 003](supabase/proposals/003_adapt_verified_payment_requests.sql) with its [rollback procedure](supabase/ROLLBACK.md). Do not run proposals 001/002. Anonymous Auth sessions preserve the no-account form; enabling them is a separate dashboard action.

## Run locally

Requires Node.js 22 and npm. Vercel uses the same major version through `package.json`.

```sh
npm install
npm run dev
npm run lint
npm run build
npx playwright install chromium
npm test
```

On Windows with PowerShell script restrictions, use `npm.cmd` and `npx.cmd`.

## Environment and tokens

The application explicitly uses **Monad Testnet**, chain 10143, through Viem's installed chain definition. Network, RPC, and explorer configuration live in `lib/chain.ts`; verified MON/USDC metadata lives in `lib/tokens.ts`. New request creation requires Supabase public configuration; no wallet private key or service-role key is used. The create form supports MON (18 decimals) and USDC (6 decimals). Stored requests can request a browser-wallet transfer, but cannot record a paid status. Do not use this MVP with real funds.

Wallet discovery uses Wagmi 3's injected connector and EIP-6963 wallet discovery. Desktop users need a browser wallet; mobile users need their wallet's built-in browser. The wallet dialog supports connection, disconnect, address copying, rejected requests, and chain switching. External mobile WalletConnect sessions are not configured.

References: [Wagmi wallet guide](https://wagmi.sh/react/guides/connect-wallet), [Monad network documentation](https://docs.monad.xyz/developer-essentials/network-information), [QR renderer](https://github.com/zpao/qrcode.react). The installed Viem `monadTestnet` definition is the source of truth for testnet endpoints.

## Routes

- `/`: editorial landing page with an explicitly illustrative USDC ticket.
- `/create`: existing composer and live preview, now saving through the authenticated API before showing the UUID link and QR code.
- `/pay/[uuid]`: saved request details and browser-wallet MON/USDC submission, without server settlement recording.
- `/pay/[legacy-encoded-id]`: backward-compatible transaction review, wallet and testnet payment states.
- `POST /api/payments`: verified Supabase session, bounded/validated input, idempotent creation.
- `GET /api/payments/[uuid]`: public exact-link lookup with recipient-only fields and no shared caching.
- `/success?request=...&tx=...`: independently verified receipt, explorer, sharing and print.
- Invalid links and direct visits to `/success` show useful empty/error states, never fabricated receipts.

## Architecture

- `app/`: Next.js App Router pages, metadata, error boundary, global visual tokens and responsive CSS. Existing Next.js 16.4 caching and Turbopack configuration is preserved.
- `components/branding`, `layout`, `ui`: wordmark, header/footer, icons, copy feedback and status badges.
- `components/wallet`: reusable native-dialog wallet controls with keyboard focus management.
- `components/payment`: ticket, form, QR panel, summary, payment state hook, request page and printable receipt.
- `components/providers.tsx`: per-provider Wagmi config and TanStack Query client, with SSR enabled.
- `lib/types.ts`: shared payment, status, draft and receipt models.
- `lib/supabase/`: browser anonymous sessions and per-request server clients with publishable credentials.
- `lib/stored-payments.ts`, `lib/payment-storage.ts`: strict API parsing, public-field projection and server-only exact-ID reads.
- `supabase/`: read-only audit, unapplied schema proposal and setup/verification instructions.
- `lib/payments.ts`: strict input validation, versioned portable request encoding, exact unit amounts and request reference.
- `lib/transactions.ts`: onchain transaction/receipt verification and readable wallet errors.
- `lib/browser-state.ts`: SSR-safe hydration state and same-browser transaction persistence.
- `tests/`: input/API/browser tests, with test-only wallet/RPC fixtures and an isolated Supabase HTTP fixture. `npm test` uses ports 3100/3101 and `.next-test`, never real database credentials. These fixtures do not prove SQL/RLS enforcement; see the isolated-project verification checklist in `supabase/README.md`.

## New stored-request lifecycle

1. Validate the draft and establish or reuse a Supabase creator session.
2. POST to `/api/payments` with the access token and a stable submission UUID. The server verifies identity, validates again, and calls a constrained database function.
3. Supabase generates the request UUID and timestamp. Retried submissions recover the original record; the form only shows success after the API confirms a saved record.
4. Recipients open `/pay/[uuid]` without signing in. Only allowlisted request fields are exposed. The page can submit the exact MON or USDC transfer through a connected wallet, but it cannot mutate paid status or publish a receipt.

## Legacy portable-link lifecycle

1. The creator specifies an amount, recipient, purpose, optional display name and optional expiry. No wallet or transaction is required to create a link.
2. A versioned UTF-8/base64url payload carries the request in the URL. No local database is needed to open it on another device. All fields are revalidated when decoded.
3. The payer checks the full address and amount, connects a wallet and switches to Monad Testnet if necessary.
4. The app checks expiry, balances and estimated gas, and requests a native transfer with an explicit chain and request-specific reference in transaction data.
5. The wallet asks the user to sign. The returned hash is saved locally and the pay action is disabled. Signing is guarded with a browser lock to prevent competing tabs.
6. The app queries Monad for the transaction, successful receipt, canonical block and finalized height. Native token, chain ID, recipient, exact value, transaction/receipt identity and request reference must match, and the block must be finalized, before a completed receipt appears.
7. Receipt links can be shared and verified again without connecting a wallet. Explorer links always use the configured network.

No app path fabricates a hash or successful transaction. Test fixtures are isolated under `tests/` and are not part of production behavior.

## Deliberate MVP limits

- Requests are public and unsigned. Display names are not verified identities; anyone with a link can read its contents. Always confirm the address independently. Legacy encoded links have no backend ownership or revocation. Stored requests have a Supabase creator identity, but their display names remain unverified; neither link type is an encrypted or signed identity claim.
- Local transaction hashes prevent accidental repeats in the same browser and survive refresh. Another browser/device cannot see that status. Global one-time settlement requires backend indexing and ultimately a payment contract or equivalent onchain enforcement.
- Expiry is checked before submitting the wallet request. It cannot cancel a transfer already awaiting a wallet signature or already submitted onchain.
- After a failed or unknown broadcast, inspect the explorer and contact the recipient before retrying. The app conservatively keeps a submitted hash and does not offer automatic resubmission. Repriced/replaced transactions are not automatically resolved.
- Receipt verification relies on the configured public RPC's canonical and finalized history; it does not provide independent multi-provider verification. A failed or unsupported finality query cannot confirm payment.
- A wallet may sign even if a browser closes before the hash is persisted. Check wallet history before trying again after an interrupted signature flow.
- QR codes are generated locally. Long international descriptions increase QR density. Public HTTPS hosting is needed for links shared outside the local development machine and for browser lock/clipboard support.
- No live funded wallet is bundled. Browser tests use clearly isolated wallet/RPC fixtures; they do not establish that a real transfer has been made.

## Verification

- `npm run lint`, `npx tsc --noEmit` and `npm run build` passed during implementation.
- All 50 Playwright scenarios pass against an isolated local Supabase HTTP fixture and production Next.js server. Coverage includes authentication, exact decimal strings, token/chain validation, existing-column and pending-status mapping, concurrent/equivalent-value retries, public-field filtering, settlement-field injection, lost-response recovery, and MON/USDC wallet submission failures. These fixtures do not prove hosted database permissions or real-chain behavior.
- Existing interface and wallet coverage includes keyboard navigation, focus recovery, cross-browser links, responsive layouts at 320/375/667/820/1440/1920px, reduced motion, public content without JavaScript, clipboard refusal, expiry, chain switching, explicit approval, successful/rejected/pending/failed transfers, mismatched receipts, unfinalized blocks and canonical-history mismatches. USDC creation and public-request desktop/mobile screenshots were inspected.
- Browser console and hydration checks passed in the tested flow. Nine automated axe WCAG A/AA scans returned no violations: landing, creation, payment and empty-receipt screens at desktop and mobile widths, plus the wallet dialog. These scans supplement keyboard and interaction tests; they do not establish complete WCAG conformance.
- The public testnet RPC returned the expected chain ID. No real wallet transaction was signed or broadcast. Successful transaction behavior was tested with isolated wallet and RPC fixtures.
- Desktop, mobile, form, payment and receipt screenshots were inspected. Generated screenshots and traces remain in ignored `test-results/`.

## Design

Warm near-white `#f8f8f5`, charcoal `#25262b`, slate `#676a75`, indigo `#5951d8`, white paper and restrained semantic state colors. Existing Geist/Geist Mono fonts are retained. The signature object is a perforated payment ticket; the surrounding page stays quiet. Full addresses, hashes and network metadata use monospace.

`app/globals.css` defines shared typography, spacing, control, radius, shadow and motion tokens. Navigation remains available on narrow screens, form inputs stay at 16px on mobile, and the full payment review precedes approval. Dialogs have unique accessible labels and native focus return. Copy feedback resets without moving adjacent controls, while errors and payment states use readable text and semantic live regions.

The UI refinement keeps this system and the existing payment implementation. The homepage includes a switchable illustrative ticket for freelance work, splitting a bill, and everyday payments. These examples never submit transactions or prefill a real recipient. Stronger display typography, a dedicated preview area, and a contrasting security section establish the page hierarchy. The creator groups its fields into amount, recipient, and purpose/timing, with a required-details checklist derived from the existing validator. Checklist links focus the corresponding fields; the final submit still validates every field, including optional expiry. No statistics, testimonials, integrations, or payment capabilities were added.

[Motion's mini React API](https://motion.dev/docs/react-reduce-bundle-size) handles short dialog and feedback transitions. CSS handles hover, press and busy indicators. Both respect reduced motion; content is visible without entrance animations or JavaScript. No GSAP or scroll-animation framework is used.

Seven project-specific skills live in `.agents/skills/`: `ui-ux-design`, `motion-design`, `interface-polish`, `interaction-design`, `responsive-design`, `accessibility` and `frontend-ui-engineering`. They document the product's design decisions, payment invariants and review workflow.

## Next engineering priorities

Dependency audit: npm currently reports five high-severity entries in the existing development-only ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → Next ESLint). npm proposes downgrading the Next ESLint configuration to 14.x; that incompatible downgrade has not been applied. Review the upstream fix before processing untrusted glob patterns. These entries are not runtime payment dependencies.

1. Review and apply the proposed persistent-request schema in an isolated Supabase project, verify RLS, then consider signed requests, revocation and indexed payment status.
2. Enforce globally unique settlement and expiry onchain, with a reviewed minimal payment contract.
3. Extend the verified Monad Testnet USDC request configuration with separately reviewed transfer simulation and event-based, finalized settlement verification before enabling collection.
4. Add WalletConnect mobile sessions and exercise real testnet wallets, replacements, disconnects and RPC outages end to end.
5. Add confirmation policy, redundant RPCs, monitoring, abuse controls and deployment hardening before any mainnet release.
