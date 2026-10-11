# Adapt the existing Paylink table: review required

**No migration, role, policy, grant or Auth setting has been applied.** This is a production-marked
project. Proposal 003 targets the exact column names/types supplied by the owner. The remaining
constraint definitions, grants and dependency inventory still need review in SQL Editor.
A previous read-only REST schema probe with only the public key returned HTTP 401; no privileged
key was used. Environment-variable presence alone does not prove successful authentication.

## What to approve

Review [003_adapt_verified_payment_requests.sql](proposals/003_adapt_verified_payment_requests.sql).
Do NOT execute proposals 001 or 002. The new proposal:

See [the production approval review](MIGRATION_REVIEW.md) for corrected findings, 69 actual
disposable-database checks, limitations, and the remaining audit gate.

- Preserves all 12 original columns, defaults, amount/status checks, primary key and indexes.
  No table/column is dropped, renamed, recreated or converted. No rows are deleted or rewritten.
- Adds `owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`,
  `client_request_id uuid NOT NULL`, and `recipient_name text NOT NULL DEFAULT ''`.
  The extra display-name field preserves the existing form feature.
- Adds uniqueness on `(owner_id, client_request_id)`, an owner/time quota index and a
  validation constraint for supported tokens, network, precision, recipients and expiry.
- Revokes PUBLIC/anon/authenticated table AND column grants, then permits only authenticated
  owner reads. Browser roles have no direct INSERT/UPDATE/DELETE or settlement-field writes.
  Check other applications before approving this grant change.
- Adds a NOLOGIN, NOINHERIT, NOBYPASSRLS `paylink_request_api` role with SELECT/INSERT only.
  Only the trusted `postgres` administrator receives membership. RLS stays enabled; this
  role is not the table owner and remains subject to explicit read/insert policies.
- Adds owner-read and dedicated-role read/insert policies. The insert policy requires Auth
  ownership, pending status, null creator wallet/hash/paid_at and the supported network/token.
- Creates two versioned SECURITY DEFINER RPCs with empty search_path and qualified references.
  Only authenticated sessions may create; anon/authenticated may read a single UUID's public
  details. Function ownership transfers to the restricted role. Temporary schema CREATE for
  that transfer is revoked before commit. No existing functions are replaced.

The locked preflight requires the supplied empty 12-column schema and aborts on changed types,
nullability, constraint inventory, existing policies, user triggers, dependent views/rules,
incoming foreign keys, request functions or role-name collisions. If rows appeared, it stops
instead of fabricating ownership. Preserve new data and prepare a separately reviewed backfill.
Names alone cannot verify existing check definitions. Do not remove guards to force a migration.

## Existing schema and application mapping

| Existing database field | Behavior |
| --- | --- |
| `id uuid` | Database-generated UUID; existing default preserved |
| `creator_wallet text NULL` | Preserved, remains null; never used as Auth identity |
| `recipient_wallet text` | Validated address; RPC stores normalized lowercase, UI shows checksum |
| `amount numeric` | Exact numeric unchanged; RPC accepts/returns decimal TEXT |
| `token_symbol text DEFAULT 'USDC'` | Default preserved; creation explicitly supplies MON or USDC |
| `description text NULL` | Original column preserved; new requests require a purpose |
| `network text DEFAULT 'Monad Testnet'` | Preserved; RPC validates chain 10143, writes this name |
| `status text DEFAULT 'pending'` | Preserved; mapped to UI `unpaid`, never on-chain `pending` |
| `transaction_hash text NULL` / `paid_at timestamptz NULL` | Preserved; creation explicitly writes null |
| `expires_at` / `created_at` | Existing timestamptz columns/defaults preserved |

The public DTO retains existing UI names `recipient`, `recipientName`, `token`, numeric `network`
and `unpaid` status. Only `lib/stored-payments.ts` maps the database contract. API creation calls
`paylink_create_payment_request_v2` with `p_recipient_wallet`, `p_token_symbol` and `p_chain_id`;
`lib/payment-storage.ts` reads through `paylink_get_payment_request_v2`. Browser code uses the
Next.js API. Repository SQL references and test fixtures were inspected; external consumers
and hosted functions/triggers/views cannot be verified from this repository alone.

## Manual Supabase steps before testing

1. Save backups and run [the expanded read-only audit](audit-payment-requests.sql). Review exact
   amount/status check definitions, both directions of foreign keys, views/materialized views,
   triggers, functions in all schemas, grants (including columns), roles, indexes and defaults.
   Check scheduled jobs, Edge Functions, Realtime/reporting consumers and other applications.
   Catalog searches cannot discover all dynamic SQL or external references.
2. Approve the exact changes above and [rollback procedure](ROLLBACK.md), rehearse 003 against an
   isolated copy of the actual schema, then apply the approved SQL manually in SQL Editor.
   A failed transaction must be rolled back; do not run fragments. Verify COMMIT, rerun the audit
   and confirm the two RPCs, grants, owners, policies and constraints before deploying the app.
3. Enable anonymous sign-ins in Supabase Auth for the no-account form. These are real Auth sessions;
   wallet connection does not authenticate a database owner. Existing sessions are reused.
   Clearing browser storage can lose an anonymous creator identity.
4. Configure Auth signup limits and an abuse-prevention strategy. The database serializes writes
   and caps each creator at 30 new requests per rolling hour. New anonymous identities can bypass
   per-user quotas: this is not a global/IP quota or billing cap. Direct Supabase RPC access must
   be considered, not only the Next.js endpoint. CAPTCHA needs a challenge/token UI not included
   here; do not enable it and assume the current sign-in call supplies a CAPTCHA token.
5. Configure matching project `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   in root `.env.local`; legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is an alternative. No secret or
   service-role key is needed. The current presence check passes and the file is ignored,
   untracked and unstaged. Resolve the observed public-key HTTP 401 before live testing.
   `node scripts/check-supabase-env.mjs` prints presence/Git flags, not credential values.
6. Restart dev or rebuild deployment after public env changes. The new API requires the 003 RPC
   contract; neither old proposal is a prerequisite. Test using an isolated Supabase project
   first; automated HTTP fixtures do not execute SQL or prove production RLS enforcement.

## Verified token metadata and exact amounts

| Token | Network / chain ID | Decimals | Contract |
| --- | --- | --- | --- |
| MON | Monad Testnet / 10143 | 18 | Native currency; no ERC-20 contract |
| USDC | Monad Testnet / 10143 | 6 | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

Sources: [Circle addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) and
[Monad token list](https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json).
A read-only live RPC check also confirmed chain 10143, deployed bytecode, symbol USDC and 6 decimals.
No transaction was broadcast. Metadata is fixed in `lib/tokens.ts`; clients cannot override it.
Amounts remain strings in JavaScript/JSON. Validation rejects excess precision before bigint
conversion; PostgreSQL casts validated text to the existing unconstrained numeric. The read RPC
uses `trim_scale(amount)::text` before PostgREST serialization, so no JS float or rounding occurs.
For example, `12.340000` may return `12.34`; the exact value is unchanged.

## API, sharing and payment separation

POST `/api/payments` requires a Bearer session verified with `auth.getUser`, then invokes the RPC
under that same user's token. Accepted strings: `amount`, `recipient`, `recipientName`, `description`,
`expiry`, `token`, `clientRequestId`; numeric `network` must be 10143. Expiry is empty or future ISO
with timezone; token is explicit MON or USDC. Body limit: 4096 bytes. Owner, creator wallet, status,
hash, paid_at, contract and decimals overrides are rejected. RPC validates independently.

Idempotency is per owner. Exact-value retries return the original ID; changed token/amount/details
return 409. Public reads contain only ID, amount text, recipient address/display name, token,
network, description, creation/expiry dates and pending status (mapped to UI unpaid). Owner,
submission ID, creator wallet, transaction_hash and paid_at are never in the public RPC projection.
Knowing a UUID permits reading its request; there is no public table/list query. Reads are uncached.

Creation never sends a transfer, asks for approval, records a hash or marks a request paid. Stored
MON and USDC requests remain view-only. Legacy MON links retain their existing wallet flow, with
explicit native-token/chain guards and verification of receipt/transaction identity, recipient,
exact amount, reference, canonical block hash and finalized height. Failed/unsupported finality
reads cannot confirm payment. USDC/stored UUIDs are rejected by that legacy transfer/verifier path.
Future settlement needs separately reviewed contract/event verification, finality, replay binding
and narrowly authorized status updates. The current role has no UPDATE permission.

## Isolated-project verification after approval

Use authenticated anonymous sessions A/B plus a public client:

1. Create MON `0.000000000000000001` and USDC `0.000001`, reload and open in a fresh browser.
   Verify numeric storage exactly, pending/null hash/null paid_at, correct owner and public fields.
2. Reject excess precision, numeric JSON amounts, zero/negative/scientific notation, invalid
   wallets, expiry, wrong chain/token and settlement-field injection at API and direct RPC.
3. Verify anon cannot list the table, B cannot read A's row, and clients cannot INSERT, UPDATE,
   DELETE, set paid status/hash, or invoke creation without authentication. Test column grants too.
4. Check role ownership, NOLOGIN/NOBYPASSRLS, no client membership, empty function search paths,
   exact execute grants, and no effective schema CREATE privilege for the dedicated role.
5. Concurrent identical submissions yield one ID; equivalent decimals recover it; changed token
   conflicts. Session B's identifier is independent. Direct RPC retries after expiry recover an
   existing row; the form still validates draft expiry before submitting.
6. Creation 31 within an hour fails while an existing retry succeeds. Verify signup protection
   and document the remaining anonymous-identity quota limitation.
7. Re-audit schema/dependencies; confirm original 12 columns/defaults/checks/indexes remain,
   plus exactly 3 new columns. Confirm no unexpected changes and persistence across restarts.

References: [Auth verification](https://supabase.com/docs/reference/javascript/auth-getuser),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[function security](https://supabase.com/docs/guides/database/functions),
[Monad RPC](https://docs.monad.xyz/reference/json-rpc/api).
