# PayLink stored-request settlement specification v1

Status: review proposal. This document does not authorize a hosted database change or a
blockchain transfer.

## Scope and trust boundaries

This specification applies only to UUID-backed requests created by
`paylink_create_payment_request_v2` on Monad Testnet. The database request is authoritative for
the recipient, token, amount, creation time, expiry and current status. The browser is allowed to
request a wallet transaction and submit a transaction hash and signature, but neither value is
proof of payment by itself.

The verification server reads the request, reads Monad through a server-only RPC provider,
verifies the payer proof, waits for finality, and only then calls the restricted database
settlement function. The database function records a server attestation atomically; it does not
query the blockchain or perform cryptography. Browser roles retain no direct settlement write
path.

Constants are fixed for version 1:

| Field | Value |
| --- | --- |
| Network | Monad Testnet |
| Chain ID | `10143` |
| Native token | MON, 18 decimals |
| USDC | 6 decimals |
| USDC contract | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

Sources:

- https://docs.monad.xyz/developer-essentials/network-information
- https://docs.monad.xyz/reference/
- https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Wallet transaction requirements

All comparisons use checksummed or normalized EVM addresses and integer base units. Decimal
request amounts are converted with `parseUnits`; JavaScript floating-point numbers are forbidden.

### MON

An externally owned account sends a type-supported Monad transaction with:

- chain ID `10143`;
- `to` equal to the stored recipient;
- `value` equal to `parseUnits(request.amount, 18)`;
- input equal to the existing deterministic `paymentReference(request.id)`; and
- a successful receipt whose transaction and receipt identify the same canonical block.

The payer is the transaction `from` address. Version 1 does not verify native MON sent through an
ERC-4337 account, Safe module, relayer or other internal call because ordinary receipts do not
provide a standard native-transfer event. Supporting those wallets requires a reviewed payment
router contract or a trusted trace-capable verifier.

### USDC

For an externally owned account, the transaction must call `transfer(address,uint256)` on the
exact USDC contract above, send zero native value, and encode the stored recipient and
`parseUnits(request.amount, 6)`. Its successful receipt must contain a `Transfer(address,address,uint256)`
log emitted by that exact contract with the same payer, recipient and amount.

Version 1 accepts externally owned accounts only. Smart accounts, Safes, ERC-4337 entry points,
relayers and EIP-1271 signatures are rejected for both tokens until their execution paths are
implemented and tested. The server requires the transaction `from` address to have no deployed
code at the finalized block and to equal the USDC `Transfer` sender.

A receipt may contain other logs, but there must be exactly one qualifying USDC transfer for this
request. The server records the payer identified by the qualifying transfer.

## Payer settlement proof

After receiving the transaction hash, the wallet signs EIP-712 typed data. The canonical domain is:

```text
name: PayLink Stored Payment
version: 1
chainId: 10143
salt: keccak256(UTF-8("paylink-settlement:<deployment-id>:<canonical-origin>"))
```

`deployment-id` is a non-secret, immutable identifier such as `staging` or `production`.
`canonical-origin` is the exact lowercase HTTPS origin with no trailing slash. Staging and
production must use different salts.

The fixed MVP staging deployment identifier is `paylink-staging-v1`. It must never be reused for
production. The staging origin remains unset until a stable Vercel project domain or owned custom
domain has been reserved and approved; preview-deployment URLs are not canonical origins.

The primary type is `PayLinkSettlement`:

```text
requestId       string   lowercase canonical UUID
transactionHash bytes32
chainId         uint256  10143
token           string   "MON" or "USDC"
recipient       address
amountAtomic    uint256
```

Every field is loaded or recomputed by the server before signature verification. The client cannot
override request details. The proof digest, signature, proof scheme and recovered/validated payer
are retained for audit but the signature is not returned by the public read function.

Replay protection comes from four independent bindings: environment-specific domain salt,
request UUID, transaction hash, and the database-wide unique transaction-hash index. Repeating the
same proof for the same request is idempotent. The same hash cannot settle another request, and a
signature for one deployment cannot settle another deployment. No server challenge is required in
v1 because the immutable transaction hash serves as the one-time nonce.

EOA proof verification recovers the signer from the EIP-712 digest and requires it to equal the
on-chain payer. The server also calls `eth_getCode` for the payer at the finalized block and accepts
only `0x`. It never falls back to EIP-1271 or current-state contract detection in version 1.

## Server verification algorithm

`POST /api/payments/[id]/verify` will eventually implement this sequence. Migration 004 does not
create the route.

1. Validate the UUID, 32-byte transaction hash, proof size and request body size. Apply per-IP,
   per-request and per-hash rate limits.
2. Read the UUID through a server read path and require `pending`. Do not accept client-supplied
   amount, recipient, token, expiry or network metadata.
3. Query a server-only Monad RPC and require `eth_chainId == 10143`.
4. Fetch the transaction and receipt. Require a successful receipt and matching transaction hash,
   block hash and block number.
5. Fetch the `finalized` block. Require the receipt block number not to exceed it, then fetch the
   receipt block again and require its hash to equal the receipt block hash. Transaction-hash RPC
   results are provisional until this check passes.
6. Require a finite block timestamp not earlier than `created_at` and not later than `expires_at`
   when an expiry exists. Server processing after expiry is allowed only when the finalized block
   timestamp proves the payment occurred in time.
7. Verify the MON transaction or USDC call/log rules above and compute the payer and integer amount.
8. Rebuild the EIP-712 message from database and chain data, verify the EOA proof, require no code
   at the payer address at the finalized block, and compute the proof digest.
9. Confirm chain ID, transaction, receipt, finalized height and canonical block hash with an
   independently operated second RPC provider before production settlement. Staging may run with
   one provider only when explicitly configured and visibly reported as degraded verification;
   this cannot detect a lying, corrupted or provider-specific stale/forked response.
10. Call `paylink_record_verified_settlement_v1` through the scoped settlement database role. Treat
    a hash conflict as a permanent rejection and an identical result as success.
11. Re-read the versioned public receipt and return it. Never return owner IDs, client request IDs,
    database credentials or proof signatures.

RPC outages, missing receipts and non-finalized receipts are retryable and leave the request
pending. Failed receipts, mismatched transfers, invalid proofs and reused hashes are terminal for
that submitted hash but do not mark the request `failed`.

## Database behavior

Migration 004 is additive to migration 003. It preserves the original columns, constraints,
indexes, RLS policies and v2 functions. It adds nullable settlement evidence, validates that every
pre-existing row is still an unsettled `pending` request, and adds a coherent-state constraint.

`paylink_record_verified_settlement_v1`:

- is owned by a non-login, non-bypass-RLS role;
- is executable only by a separate settlement executor role;
- row-locks the request;
- permits only `pending -> paid`;
- validates shape, chain, token contract, integer amount and block-time bounds;
- returns an existing identical settlement idempotently;
- rejects a different settlement for an already-paid request; and
- relies on a global unique lowercased transaction hash to stop cross-request reuse under races.

`paylink_get_payment_request_v3` returns the existing recipient-facing request fields for pending
and paid requests. Its only public settlement additions are transaction hash and verification
timestamp; token, amount and status already belong to the request projection. Payer wallet, payment
block time, block number/hash, token contract, proof material and verification version remain
private. The v2 read remains unchanged for compatibility and therefore continues to return pending
requests only.

## Settlement authorization

Migration 004 creates `paylink_settlement_executor` as `NOLOGIN`. After a hosted rehearsal and a
separate effective-privilege audit, an administrator may assign it a generated password and enable
`LOGIN`. The Next.js server then connects through the Supabase transaction pooler as
`paylink_settlement_executor.<project-ref>` with prepared statements disabled. The credential is a
server-only secret and grants only schema usage plus execution of the settlement function. It is
not a Supabase secret/service-role key and cannot bypass RLS.

Custom roles still inherit privileges granted to PostgreSQL `PUBLIC`. Before enabling LOGIN, audit
effective schema, table, sequence, function, large-object, temporary-table, extension and `pg_net`
access. If the hosted project cannot sufficiently contain the custom role, stop and choose a
separate settlement service/database boundary. Do not silently fall back to a Supabase secret key,
which has broad `service_role` and `BYPASSRLS` access.

## Approval decisions still open

1. Approve EIP-712 and each exact deployment identifier/origin. The verifier must refuse startup
   when either value is missing; no production origin is assumed by this proposal.
2. EOA MON and EOA USDC are the v1 wallet scope. All smart-contract wallets remain unsupported
   until separately implemented and tested.
3. Production requires two independently operated RPC providers. Approve whether single-provider
   degraded mode is acceptable in staging.
4. Approve exposing only the transaction hash and verification timestamp as new public receipt
   evidence to anyone holding the unguessable payment link.
5. Approve a scoped custom database login after the hosted effective-privilege audit and secret
   rotation/runbook review.
6. Decide whether a paid request can receive later overpayments. V1 records one exact transaction
   and rejects all later hashes; extra on-chain transfers remain outside PayLink accounting.
