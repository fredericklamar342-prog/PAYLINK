# PayLink

A focused payment-link MVP for Monad: create a request, share a URL or QR code, review the exact transfer, and receive an onchain-verified receipt.

## Run locally

Requires Node.js 20.9+ and npm.

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

The application explicitly uses **Monad Testnet**, chain 10143, through Viem's installed chain definition. Network, RPC, and explorer configuration live in `lib/chain.ts`. No private keys or API credentials are required. All transfers use testnet MON; USDC is a clearly labeled landing-page illustration and disabled in the create form until a verified contract and token adapter are added. Do not use this MVP with real funds.

Wallet discovery uses Wagmi 3's injected connector and EIP-6963 wallet discovery. Desktop users need a browser wallet; mobile users need their wallet's built-in browser. The wallet dialog supports connection, disconnect, address copying, rejected requests, and chain switching. External mobile WalletConnect sessions are not configured.

References: [Wagmi wallet guide](https://wagmi.sh/react/guides/connect-wallet), [Monad network documentation](https://docs.monad.xyz/developer-essentials/network-information), [QR renderer](https://github.com/zpao/qrcode.react). The installed Viem `monadTestnet` definition is the source of truth for testnet endpoints.

## Routes

- `/`: editorial landing page with an explicitly illustrative USDC ticket.
- `/create`: validated composer, live ticket preview, portable link and QR sharing.
- `/pay/[id]`: validated payment request, full transaction review, wallet and payment states.
- `/success?request=...&tx=...`: independently verified receipt, explorer, sharing and print.
- Invalid links and direct visits to `/success` show useful empty/error states, never fabricated receipts.

## Architecture

- `app/`: Next.js App Router pages, metadata, error boundary, global visual tokens and responsive CSS. Existing Next.js 16.4 caching and Turbopack configuration is preserved.
- `components/branding`, `layout`, `ui`: wordmark, header/footer, icons, copy feedback and status badges.
- `components/wallet`: reusable native-dialog wallet controls with keyboard focus management.
- `components/payment`: ticket, form, QR panel, summary, payment state hook, request page and printable receipt.
- `components/providers.tsx`: per-provider Wagmi config and TanStack Query client, with SSR enabled.
- `lib/types.ts`: shared payment, status, draft and receipt models.
- `lib/payments.ts`: strict input validation, versioned portable request encoding, exact unit amounts and request reference.
- `lib/transactions.ts`: onchain transaction/receipt verification and readable wallet errors.
- `lib/browser-state.ts`: SSR-safe hydration state and same-browser transaction persistence.
- `tests/`: input and browser tests, with test-only injected wallet/RPC fixtures.

## Payment lifecycle

1. The creator specifies an amount, recipient, purpose, optional display name and optional expiry. No wallet or transaction is required to create a link.
2. A versioned UTF-8/base64url payload carries the request in the URL. No local database is needed to open it on another device. All fields are revalidated when decoded.
3. The payer checks the full address and amount, connects a wallet and switches to Monad Testnet if necessary.
4. The app checks expiry, balances and estimated gas, and requests a native transfer with an explicit chain and request-specific reference in transaction data.
5. The wallet asks the user to sign. The returned hash is saved locally and the pay action is disabled. Signing is guarded with a browser lock to prevent competing tabs.
6. The app queries Monad for the transaction, successful receipt and block timestamp. The chain ID, recipient, exact value and request reference must match before the app shows a completed receipt.
7. Receipt links can be shared and verified again without connecting a wallet. Explorer links always use the configured network.

No app path fabricates a hash or successful transaction. Test fixtures are isolated under `tests/` and are not part of production behavior.

## Deliberate MVP limits

- Requests are public and unsigned. Display names are not verified identities; anyone with a link can read its contents. Always confirm the address independently. There is no backend, user account, encrypted payload, signed request, server-side expiry or revocation.
- Local transaction hashes prevent accidental repeats in the same browser and survive refresh. Another browser/device cannot see that status. Global one-time settlement requires backend indexing and ultimately a payment contract or equivalent onchain enforcement.
- Expiry is checked before submitting the wallet request. It cannot cancel a transfer already awaiting a wallet signature or already submitted onchain.
- After a failed or unknown broadcast, inspect the explorer and contact the recipient before retrying. The app conservatively keeps a submitted hash and does not offer automatic resubmission. Repriced/replaced transactions are not automatically resolved.
- Receipt verification relies on the configured public RPC, checks an included successful transaction, and is not a guarantee against reorgs or an independent RPC failure.
- A wallet may sign even if a browser closes before the hash is persisted. Check wallet history before trying again after an interrupted signature flow.
- QR codes are generated locally. Long international descriptions increase QR density. Public HTTPS hosting is needed for links shared outside the local development machine and for browser lock/clipboard support.
- No live funded wallet is bundled. Browser tests use clearly isolated wallet/RPC fixtures; they do not establish that a real transfer has been made.

## Verification

- `npm run lint`, `npx tsc --noEmit` and `npm run build` passed during implementation.
- All 10 Playwright tests passed: amount and payload validation, cross-browser-context links, form errors, disconnected wallets, expiry, responsive layouts at 375/667/820/1440px, chain switching, explicit review, successful receipts, rejected/pending/failed transactions and mismatched receipts.
- Browser console and hydration checks passed in the tested flow. Automated axe WCAG A/AA scans returned no violations on the landing, creation, payment and empty-receipt screens. Clipboard output matched the generated link; reduced-motion mode disabled smooth scrolling.
- The public testnet RPC returned the expected chain ID. No real wallet transaction was signed or broadcast. Successful transaction behavior was tested with isolated wallet and RPC fixtures.
- Desktop, mobile, form, payment and receipt screenshots were inspected. Generated screenshots and traces remain in ignored `test-results/`.

## Design

Warm near-white `#f8f8f5`, charcoal `#25262b`, slate `#676a75`, indigo `#5951d8`, white paper and restrained semantic state colors. Existing Geist/Geist Mono fonts are retained. The signature object is a perforated payment ticket; the surrounding page stays quiet. Full addresses, hashes and network metadata use monospace. No animation library or dashboard framework was added. QR rendering is the only additional runtime dependency; Playwright is a development dependency.

## Next engineering priorities

Dependency audit: npm currently reports five high-severity entries in the existing development-only ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → Next ESLint). npm proposes downgrading the Next ESLint configuration to 14.x; that incompatible downgrade has not been applied. Review the upstream fix before processing untrusted glob patterns. These entries are not runtime payment dependencies.

1. Add signed requests and persistent storage with canonical IDs, revocation and indexed payment status.
2. Enforce globally unique settlement and expiry onchain, with a reviewed minimal payment contract.
3. Add a verified Monad USDC configuration, token balance/decimals checks, transfer simulation and event-based receipt matching.
4. Add WalletConnect mobile sessions and exercise real testnet wallets, replacements, disconnects and RPC outages end to end.
5. Add confirmation policy, redundant RPCs, monitoring, abuse controls and deployment hardening before any mainnet release.
