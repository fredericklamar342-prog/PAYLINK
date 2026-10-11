# Production approval review: proposal 003

Review date: 2026-10-09 (Africa/Lagos). No production SQL was executed.

## Decision

Proposal 003 is syntactically valid and passed the disposable PostgreSQL review described
below. The confirmed `amount > 0` check and status values `pending`, `paid`, `failed` accept
the migration's creation behavior (`pending` only); both existing checks remain unchanged.
This report does **not approve production application**. Remaining gates are the production
table-owner and managed `auth` grant capabilities, effective column and inherited privileges,
confirmed zero counts/details for functions, triggers, views/rules and foreign-key dependencies,
and an isolated hosted Supabase PostgreSQL 17.11 rehearsal.

## Corrections made during review

1. PostgreSQL 18 represents NOT NULL constraints in `pg_constraint` (`contype = 'n'`).
   The original `count(*) = 3` preflight rejected a matching 12-column fixture. Proposal
   003 now excludes NOT NULL catalog entries from the three named application constraints;
   it continues to verify every column's `attnotnull` value separately.
2. Creation used `now()`, the transaction start time. After waiting on the per-owner lock,
   a request could have an expiry earlier than wall-clock creation. It now captures
   `clock_timestamp()` after locking and uses it for quota, expiry and `created_at`.
3. The preflight previously checked only amount/status constraint names. It now evaluates
   every existing CHECK expression against synthetic minimum/maximum MON and USDC pending
   requests without inserting rows. Any false result aborts the transaction before changes.
4. Final privilege assertions now test required privileges independently and forbidden
   privileges with deliberate ANY semantics. Function execution grants are asserted too.
   PostgreSQL treats a comma-separated privilege string as true when **any** listed
   privilege is held; it does not mean all privileges are held.
5. The audit now reports server version, audit role, effective table/column/schema
   privileges individually, role membership options when available, and exact known check
   definitions.
6. The PostgreSQL 17 review added explicit denial checks for the `MAINTAIN` privilege. PostgreSQL
   automatically grants a non-superuser CREATEROLE creator ADMIN TRUE, INHERIT FALSE, SET FALSE
   membership in a role it creates; that bootstrap grant cannot be removed by the creator.
   Proposal 003 adds SET TRUE with INHERIT FALSE and verifies effective SET/ADMIN without USAGE.
   Function ACLs are finalized before ownership transfer so they do not depend on inheritance.
7. Production lacks grant options for auth schema USAGE and auth.uid() EXECUTE. Proposal 003 no
   longer grants or calls either managed Auth object. It derives the UUID from the verified request
   JWT settings using the same current and legacy claim sources as auth.uid(). The preflight now
   requires only public USAGE/CREATE grant options. The containment rollback explicitly SETs the
   function-owner role before revoking function ACLs, then resets to postgres for the table ACL.

## PostgreSQL 17.11 compatibility review

The production version and reported SQL Editor attributes are compatible at the SQL-language
level. PostgreSQL 17 supports every role attribute, role-membership option, RLS construct,
function attribute, privilege inquiry, and catalog column used by proposal 003. In PostgreSQL
17, relation NOT NULL state remains in `pg_attribute`; `contype <> 'n'` is harmless and the
migration independently verifies `attnotnull`. `pg_auth_members.inherit_option` and
`set_option` exist in 17. PostgreSQL 17 also supports MAINTAIN, now included in every forbidden
effective-privilege check.

Function ownership transfer requires SET access to the new owner plus CREATE on the containing
schema. Proposal 003 establishes exactly that relationship and checks SET is true while inherited
USAGE is false. The restricted owner remains a non-owner of the table and NOBYPASSRLS, so RLS
applies to both SECURITY DEFINER functions. TRUNCATE, REFERENCES and MAINTAIN are table-wide and
not protected by RLS; their effective absence is therefore checked explicitly.

This is a documentation/catalog compatibility conclusion, not an executed PostgreSQL 17 or
hosted Supabase test. Only PostgreSQL 18.6 is installed locally. Follow
`SUPABASE_REHEARSAL_PG17.md` before any production approval.

## Disposable database test

Actually executed locally against PostgreSQL 18.6 on loopback port 55442 in an isolated
cluster under ignored `test-results/db-review/`. Production URLs, credentials and environment
variables were filtered out of the runner. The server was stopped after testing.

The table fixture reproduces all supplied columns, nullability, defaults and confirmed checks:

- `payment_requests_amount_check`: `amount > 0`
- `payment_requests_status_check`: status in `pending`, `paid`, `failed`

It includes the existing primary/status/created-at indexes, RLS, deliberately broad client
table and column grants, three Auth users, and minimal local stand-ins for `auth.users` and
`auth.uid()`. This was PostgreSQL compatibility/security testing, **not a hosted Supabase
project test**. It did not test PostgREST schema-cache behavior, GoTrue anonymous sign-in,
Supabase dashboard permissions, provider backups, Realtime, Edge Functions, or production
external dependencies.

Proposal 003 ran and committed as a non-superuser role named `postgres` with CREATEROLE,
CREATEDB and BYPASSRLS while all six reported Supabase membership edges existed. All
**69 database assertions passed**, including:

- complete SQL execution; PL/pgSQL `RETURN QUERY SELECT * FROM function(...)` syntax;
- exact 18-decimal MON and 6-decimal USDC storage/return, equivalent decimal retries;
- owner isolation, public UUID allowlist, unknown-ID behavior and no public table listing;
- current JSON and legacy subject JWT settings, with no auth-schema access for the restricted owner;
- denied direct insert/update/delete, paid status/hash updates, role assumption and owner
  argument injection;
- NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT function owner, pinned empty search paths,
  table/column/function/schema privileges and altered caller/temp-table search paths;
- idempotent same-owner retries, changed-token conflicts, cross-owner identifiers, eight
  simultaneous duplicate creations producing one row;
- 32 concurrent new requests producing exactly 30 successes and two quota failures;
  idempotent retry still succeeding at quota;
- expired/infinite timestamps, invalid token/chain/address and invalid decimal forms;
- wall-clock expiry after a delayed transaction;
- preservation of the original 12 columns, nullability, defaults, named checks and indexes;
- atomic refusal/rollback for data drift, incompatible amount/status checks, policies,
  incoming foreign keys, views, triggers and request functions;
- expanded and final-readiness audit SQL execution; containment rollback removing access
  while preserving rows/schema.

The exact executable evidence is produced by `scripts/review-payment-migration.mjs`. The
generated detailed result JSON and cluster are ignored test artifacts, not repository proof.
Rerunning requires a dedicated local PostgreSQL cluster on the hard-coded loopback port;
the script verifies its data directory and refuses another server.

The supplied Supabase memberships are directionally compatible: `authenticator`, `postgres`
and `supabase_realtime_admin` are members of `anon` and `authenticated`. Privileges flow from
the granted role to those members; this does not make `anon`/`authenticated` members of an
administrator role. Proposal 003 rejects the unsafe reverse direction and, after creation,
asserts that browser roles cannot inherit or `SET ROLE` to `paylink_request_api`. A final
disposable run explicitly recreates all six reported membership edges.

## Security conclusion

Creation derives `owner_id` only from PostgREST's verified request JWT settings and accepts no
owner parameter. It checks the current JSON claims setting first while retaining the legacy
individual-subject setting for compatibility. Its
SECURITY DEFINER owner cannot log in or bypass RLS, is not the table owner, and has only
SELECT/INSERT on the table. Insert RLS independently requires matching Auth ownership,
`pending`, null creator wallet/hash/paid-at, Monad Testnet and MON/USDC. There is no client
UPDATE/DELETE grant, policy, RPC or settlement function. Direct clients therefore cannot
set paid state or transaction hashes through this migration.

The public function accepts one UUID and returns an explicit recipient projection only.
It deliberately reveals a pending request to anyone who knows that unguessable UUID. It
does not expose owner ID, idempotency ID, creator wallet, transaction hash or paid-at.

Both functions are SECURITY DEFINER because their restricted owner is the only table writer
and public exact-ID reader. They set an empty search path and schema-qualify database objects.
Creation uses an Auth-scoped advisory transaction lock before its idempotency lookup and quota
count, making concurrent retries and the per-owner quota atomic. The unique constraint remains
the final duplicate guard.

## Preservation and dependency limits

The tested migration leaves every original column/default/check/index intact and adds three
columns, two indexes/unique constraints, one value check, three policies, one role and two
versioned functions. It deliberately changes table/column grants. That grant restriction may
break another consumer and requires explicit approval.

The preflight aborts on rows, changed shape/constraint inventory, policies, user triggers,
incoming foreign keys, dependent rules/views, discoverable request functions and role/function
name collisions. It cannot prove the absence of dynamic SQL, application-generated queries,
Edge Functions, scheduled jobs, Realtime/reporting consumers, or another external application.
Those dependencies require manual inventory. The expanded audit must be run and reviewed.

## Network and token verification

Monad's official testnet token list identifies chain ID **10143**, native MON with 18 decimals,
and USDC with 6 decimals at `0x534b2f3A21130d7a60830c2Df862319e593943A3`.
Circle's official USDC address page lists the same Monad Testnet address. A read-only live RPC
check during implementation also returned chain 10143, deployed bytecode, symbol USDC and
decimals 6. No transaction was submitted.

Sources:

- https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Approval gate

Before approval, run and retain `final-readiness-audit.sql`. Confirm the server version and
SQL Editor role capabilities; effective table/column/schema grants; and zero dependency
counts/details for functions, triggers, rules/views and incoming foreign keys. Inventory
external consumers separately. Rehearse the final file in an isolated Supabase project if
one is available; the PostgreSQL fixture does not replace that provider-specific check.

Then approve these intentional changes as one unit:

- adding `owner_id`, `client_request_id`, `recipient_name` and their constraints/indexes;
- revoking all existing PUBLIC/anon/authenticated table and column grants;
- granting authenticated owner SELECT only;
- creating and granting the restricted `paylink_request_api` role to `postgres`;
- creating three RLS policies and the two versioned SECURITY DEFINER RPCs;
- public exact-UUID request reads and authenticated anonymous-session creation;
- the 30-new-requests-per-owner rolling-hour quota and its documented anonymous-identity limit.

Apply only the reviewed proposal manually. Do not run proposals 001/002 and do not execute
fragments after a failed transaction. Follow `ROLLBACK.md` and retain a provider restore point.
