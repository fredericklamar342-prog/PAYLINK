# Migration 003: final reviewed database diff

This is the semantic diff from the confirmed empty 12-column production table. It is not
evidence that production SQL was applied. Proposal 003 remains the executable source.

## Preserved unchanged

- Table `public.payment_requests`; all 12 existing columns, types, nullability and order.
- Defaults: generated UUID, USDC token, Monad Testnet network, pending status, creation time.
- Primary key, `amount > 0`, status values including pending/paid/failed.
- Existing status and created-at indexes and any other accepted existing index.
- RLS remains enabled. No original row is rewritten; preflight requires zero rows.

## Added

- `owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`.
- `client_request_id uuid NOT NULL`.
- `recipient_name text NOT NULL DEFAULT ''`.
- Unique `(owner_id, client_request_id)` and `(owner_id, created_at DESC)` index.
- `paylink_request_values_v2` validation for token/network, per-token decimals, wallet,
  description, finite timestamps and future expiry.
- Restricted `paylink_request_api` role: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE,
  NOINHERIT, NOBYPASSRLS; SELECT/INSERT only; never UPDATE/DELETE/TRUNCATE.
- No grant or ownership change in the managed `auth` schema. Ownership is derived from the
  verified request JWT settings using the same current/legacy claim sources as `auth.uid()`.
- PostgreSQL 17 automatically gives the non-superuser CREATEROLE creator an immutable
  bootstrap-granted `ADMIN TRUE, INHERIT FALSE, SET FALSE` membership. Migration 003 adds a
  separate `SET TRUE, INHERIT FALSE` grant for ownership transfer. `postgres` does not inherit
  the function owner's object privileges; its ADMIN option is expected platform behavior.
- Owner SELECT, restricted-role SELECT, and restricted-role INSERT RLS policies.
- Versioned exact-ID read and authenticated creation SECURITY DEFINER functions.

## Intentionally removed or restricted

- All table and column grants from PUBLIC, anon and authenticated, including the confirmed
  browser-facing INSERT, UPDATE, DELETE, TRUNCATE and MAINTAIN grants.
- Authenticated receives table SELECT only, constrained to the verified request subject matching
  `owner_id` by RLS.
- Anon receives no table privilege. It can execute only the exact-ID public projection RPC.
- Authenticated can execute creation and exact-ID read. Neither browser role can become the
  function owner or write settlement fields.

## Not added

- No payment transfer, token approval, status-update RPC, webhook, transaction hash write,
  paid timestamp write, table recreation, rename, truncation, data backfill or service key.
