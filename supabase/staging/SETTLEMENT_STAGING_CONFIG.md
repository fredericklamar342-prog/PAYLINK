# PayLink staging settlement configuration

Status: configuration proposal only. It does not authorize migration 004, a database login,
deployment or blockchain transfer.

## Fixed identity

The staging deployment identifier is permanently:

```text
paylink-staging-v1
```

The EIP-712 salt input is:

```text
paylink-settlement:paylink-staging-v1:<canonical-origin>
```

The production deployment identifier and origin remain undecided. Production must never reuse the
staging identifier, origin or resulting salt.

## Selecting the canonical HTTPS origin

Use one stable origin that the project controls. Preferred order:

1. an owned staging subdomain such as `https://staging.<owned-domain>`; or
2. the stable Vercel project production alias reserved for the staging project.

Do not use a branch-preview URL, commit URL, localhost, an HTTP URL, a URL with a path, query,
fragment or trailing slash, or an origin that merely appears available but has not been reserved.

Before application deployment, create/reserve the Vercel project name or configure and verify the
owned staging domain. Record the exact lowercase origin. DNS may be configured later, but the team
must control the selected name before signatures are enabled. Changing the origin changes the
EIP-712 domain and invalidates outstanding proofs, so an origin change requires an explicit domain
version decision rather than a silent environment-variable edit.

## Proposed server-only variables

Names only; no values or credentials are stored in the repository:

```text
PAYLINK_SETTLEMENT_DEPLOYMENT_ID=paylink-staging-v1
PAYLINK_CANONICAL_ORIGIN=https://<reserved-stable-staging-origin>
PAYLINK_SETTLEMENT_CHAIN_ID=10143
MONAD_SETTLEMENT_RPC_PRIMARY_URL=<server-only authenticated HTTPS RPC>
MONAD_SETTLEMENT_RPC_SECONDARY_URL=
PAYLINK_REQUIRE_SECONDARY_RPC=false
PAYLINK_ALLOW_SINGLE_RPC_STAGING=true
PAYLINK_SETTLEMENT_DATABASE_URL=<scoped executor Supavisor URL; unavailable until separately approved>
```

The verifier must refuse startup when the deployment ID, canonical origin, chain ID or primary RPC
is missing or malformed. It must reject `PAYLINK_REQUIRE_SECONDARY_RPC=false` unless the deployment
ID is exactly `paylink-staging-v1` and `PAYLINK_ALLOW_SINGLE_RPC_STAGING=true`. Production must
require a secondary RPC.

None of these names should be prefixed `NEXT_PUBLIC_`. The RPC URL and database URL are secrets.

## Single-RPC finalized verification

For every submitted hash, the staging verifier must use the primary server RPC to:

1. require `eth_chainId == 10143`;
2. load the transaction and receipt and require matching hash, block number and block hash;
3. require receipt status success;
4. fetch `eth_getBlockByNumber("finalized", false)`;
5. require the receipt block number not to exceed the finalized block number;
6. fetch the receipt block by number and require its hash to equal the receipt block hash;
7. fetch transaction, receipt and canonical block again immediately before recording settlement;
8. perform every MON/USDC/request/proof/expiry check in `SETTLEMENT_SPEC_V1.md`; and
9. pass evidence to the restricted settlement RPC only after every check succeeds.

Missing, inconsistent, rate-limited or unavailable responses leave the request pending. The server
must never downgrade from `finalized` to `safe` or `latest`.

### Limitation

A single RPC is one trust and availability domain. Finalized-height and canonical-hash checks guard
against ordinary provisional reads and reorgs, but they cannot detect a provider that consistently
lies, serves a corrupted fork, has a provider-specific indexing defect, or returns internally
consistent fabricated data. It is also a single availability bottleneck. Staging receipts must be
identified operationally as single-provider verified. Production settlement remains blocked until
the same evidence agrees across two independently operated providers.
