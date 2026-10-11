# Migration 004 review and test plan

Review completed: 2026-10-10 (Africa/Lagos). No hosted Supabase SQL was executed. No blockchain
transaction was performed.

## Proposed change

`proposals/004_add_verified_settlement.sql` requires migration 003 and is additive. It preserves
all 15 migration-003 columns, existing defaults, constraints, indexes, policies, grants and v2
functions. It adds 11 nullable settlement-evidence columns, one coherent-state check, a global
partial unique transaction-hash index, a paid-at index, two restricted roles, two RLS policies and
two versioned functions.

The migration refuses to run when the migration-003 shape or objects are missing, when an existing
row is already non-pending/partially settled, when a migration-004 object name exists, or when a
browser role bypasses RLS. It does not drop, truncate, rename, rewrite or backfill existing data.

The executor is deliberately created `NOLOGIN`. This proposal does not set or contain a password,
connection string, Supabase secret key or RPC credential.

## Local validation actually performed

The exact proposal was applied to a temporary clone of the existing disposable migration-003
database on local PostgreSQL 18.6. The clone contained 35 pending requests and the migration-003
roles, RLS policies, constraints, indexes and functions. This was not PostgreSQL 17.11 and was not
hosted Supabase.

Observed results:

- complete migration transaction executed and committed;
- USDC settlement stored the exact 6-decimal integer amount;
- MON settlement stored the exact 18-decimal integer amount and null token contract;
- an identical settlement retry returned the existing result;
- two concurrent identical settlement calls both returned the same paid result;
- reuse of a transaction hash on another request failed with `PT409`;
- a one-unit atomic amount mismatch failed with `PT409`;
- direct table update as the executor failed with `42501`;
- settlement-function execution as `anon` failed with `42501`;
- the v3 public function returned the allowlisted paid receipt and omitted ownership/proof fields;
- the temporary database and roles were removed after testing.

The MVP revision then restricted both tokens to EOA payers, removed payer and internal block
evidence from the v3 public projection, and made dual-RPC production verification explicit. The
exact revised proposal was applied to a fresh disposable clone. EIP-1271 evidence failed with
`PT400`; two concurrent identical settlements converged on one result; cross-request hash reuse
failed with `PT409`; and the public projection contained exactly request fields plus transaction
hash and verification timestamp. Both read-only audit scripts executed successfully. All temporary
databases and roles were removed.

The reviewed final migration SHA-256 is
`ef82120bc67837bfe8098132cbba056f549a40cc6ce365db1f9d5e51e862cfcb`.

The EIP-712 adversarial runner passed six assertions: valid staging proof, wrong environment/origin,
wrong transaction hash, wrong request UUID, wrong chain and wrong atomic amount.

## Required automated review suite

Create a dedicated runner modelled on `scripts/review-payment-migration.mjs`. It must start or use
only a verified disposable local cluster, filter all Supabase and database environment variables,
apply the migration-003 fixture and exact migration 003, then apply exact migration 004.

The suite must assert:

1. Original and migration-003 columns, defaults, constraints, indexes, policies, grants and v2
   function definitions are unchanged.
2. Migration 004 refuses missing/drifted 003 objects, partial settlements, role/function collisions
   and browser `BYPASSRLS`.
3. MON and USDC exact atomic amounts, canonical lowercasing, token-address rules, creation/expiry
   block-time bounds, finite timestamps and proof field bounds.
4. Only the EOA proof scheme is accepted as a database attestation; EIP-1271 and malformed evidence
   are rejected. Cryptographic verification belongs in server tests, not SQL tests.
5. Same-request/same-evidence retry is idempotent; any changed field conflicts.
6. Concurrent identical calls return one settlement; concurrent different hashes permit only one;
   the losing hash remains reusable for its legitimate request.
7. One hash cannot settle two requests, including case variants.
8. `pending -> paid` is the only state transition; `failed`, unknown and already-different paid
   requests reject settlement.
9. `anon` and `authenticated` cannot execute settlement or write any table/column. The executor
   cannot read/write the table directly and cannot execute the public-read function.
10. Function owners are `NOLOGIN`, `NOSUPERUSER`, `NOINHERIT`, `NOBYPASSRLS`; both functions have
    empty search paths and resist caller/temp-schema shadowing.
11. The v3 pending/paid projections contain exactly the documented allowlist. Owner ID, client
    request ID, creator/payer wallet, block evidence, proof material and internal versions remain
    private. Transaction hash and verification timestamp are the only public settlement additions.
12. Disabling settlement function execution contains new writes without deleting rows or breaking
    the v2 creation path.

## Hosted Supabase staging rehearsal

After separate approval, recreate the current production-equivalent migration-003 state in
`paylink-staging`, verify PostgreSQL 17.11 and capture a schema/grants/dependency audit. Apply the
reviewed migration 004 in SQL Editor only after its hash is recorded.

Post-migration read-only checks must cover role membership options, effective table and column
privileges including `PUBLIC`, policy commands/roles/expressions, function owners/ACLs/search paths,
indexes and constraints. Confirm the executor remains `NOLOGIN`. Do not enable a password yet.

The local post-migration audit demonstrated why the hosted audit is mandatory: the disabled custom
role inherited database `CONNECT` and `TEMP`, public-schema usage and catalog visibility from
`PUBLIC`. The local fixture also reported function-level `auth.uid()` execution without auth-schema
usage. Hosted results can differ because of Supabase extensions and grants; every non-system object
reported by `post_migration_004.sql` requires review before LOGIN is enabled.

Then audit all effective privileges inherited from PostgreSQL `PUBLIC`, especially database
`CONNECT`/`TEMP`, schema usage/create, function execution outside PayLink, sequences, large objects,
extensions and `pg_net` tables/functions. Supabase warns that custom roles can inherit more than
explicit grants through `PUBLIC`; the settlement login is blocked until that audit is reviewed.

Once the role audit is approved, enable LOGIN with a generated staging-only password, connect using
the Supavisor transaction-pooler username `paylink_settlement_executor.<project-ref>`, disable
prepared statements, and run database-only settlement calls. Rotate/remove that password after the
rehearsal. Never reuse it in production.

## Server verification test plan

Before enabling database writes in application code, use mocked RPC fixtures for:

- wrong chain, missing transaction/receipt, failed receipt and transaction/receipt disagreement;
- proposed/safe but not finalized blocks, canonical block-hash mismatch and RPC reorg behavior;
- MON wrong recipient/value/reference and a transaction predating or exceeding request expiry;
- USDC wrong contract, selector, recipient, amount, decimals, native value and forged/duplicate
  logs;
- EOA proof with wrong domain, deployment, request, hash, chain, token, recipient, amount or signer;
- contract code at the payer address, relayed/smart-account transactions and EIP-1271 proofs, all
  of which must be rejected in v1;
- rate limiting, request-size limits, RPC timeouts and retries;
- settlement hash reuse, same-hash idempotency and concurrent verifier processes.

Real funded-wallet transfers belong to a later explicitly approved hosted-staging phase.

## Security review and remaining blockers

- The database function attests evidence supplied by the executor; it cannot establish on-chain
  truth. Compromise of the scoped executor can create false paid records. Its password, runtime and
  network access need the same protection as a payment-signing service even though its database
  privileges are narrow.
- A custom login still inherits `PUBLIC` privileges. The hosted audit is a production blocker.
- All smart-contract wallets are intentionally unsupported in v1. A router, trace or EIP-1271
  design requires separate implementation and testing.
- Canonical deployment IDs/origins remain open. Production verification requires independent dual
  RPCs; staging single-provider mode must be explicitly accepted as degraded.
- Public v3 receipts expose the transaction hash and verification timestamp to link holders. Payer
  and internal finalized-block evidence remain private.
- PostgreSQL 17.11 and hosted Supabase behavior remain untested for migration 004.
- No destructive rollback is proposed. Initial containment is to revoke executor execution and
  disable LOGIN while preserving every column and receipt. A full rollback must be a separately
  reviewed migration after exporting settlement data.
