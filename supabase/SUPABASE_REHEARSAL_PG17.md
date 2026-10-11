# Isolated Supabase rehearsal: PostgreSQL 17.11

This procedure is for a separate, disposable Supabase project on PostgreSQL 17.11. It does
not authorize or describe a production execution. Do not link the rehearsal project to the
production deployment, copy production secrets, or import production Auth users.

## 1. Match the provider environment

1. Create a disposable Supabase project and confirm `server_version` is `17.11`.
2. In SQL Editor, confirm `current_user = 'postgres'`, `rolcreaterole = true`, and
   `rolsuper = false`.
3. Create only the confirmed original 12-column `public.payment_requests` schema, its primary
   key, `amount > 0`, `status in ('pending','paid','failed')`, status/created-at indexes, RLS,
   and the same broad PUBLIC/anon/authenticated table and column grants found in production.
4. Reproduce the six reported membership edges: `authenticator`, `postgres`, and
   `supabase_realtime_admin` as members of both `anon` and `authenticated`. Do not alter the
   managed `auth` schema or Supabase-owned roles to force a pass.

For a new empty project, run `staging/001_original_payment_requests.sql` once to create the
reviewed production-shape fixture. Then run `staging/verify_original_payment_requests.sql` and
retain its complete output. The setup refuses an existing table and does not create Auth users,
copy data, alter managed roles, or execute migration 003.

## 2. Preflight without mutation

1. Run `final-readiness-audit.sql` and save the complete output with a timestamp.
2. Require: 0 rows, 12 columns, RLS enabled, no policies, and the expected constraints.
3. Require zero user triggers, incoming foreign keys, dependent rules/views, and request
   functions. Resolve every nonzero result; do not remove dependencies just for rehearsal.
4. Require `can_assume_table_owner = true` and the public USAGE/CREATE grant-option checks to
   be true. Record the expected false Auth grant options; proposal 003 must not alter them.
   Confirm no existing `paylink_request_api` role or versioned RPC names.
5. Record direct and effective privileges for PUBLIC, anon, authenticated, authenticator,
   postgres, and supabase_realtime_admin, including column grants, TRUNCATE, and MAINTAIN.

## 3. Apply only to the isolated project

1. Take a project restore point or schema-only export.
2. Copy the exact reviewed `003_adapt_verified_payment_requests.sql` into SQL Editor and run
   it once as a single transaction. Do not run proposals 001/002 or selected fragments.
3. Save the complete SQL Editor result. A raised `STOP:` exception means the transaction
   failed; issue `ROLLBACK` if the editor still shows an aborted transaction and investigate.
4. Confirm an explicit successful `COMMIT`, then rerun `final-readiness-audit.sql`.

## 4. Database and Auth verification

1. Confirm the original 12 columns/defaults/checks/indexes are unchanged and exactly three
   columns were added.
2. Confirm the restricted role is NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS.
3. Confirm postgres has the expected bootstrap-granted ADMIN/SET-false row plus the
   postgres-granted SET-true row, both INHERIT false. Effective USAGE must be false and browser
   roles must have no membership.
4. Confirm the restricted role has no auth schema USAGE and the new definitions do not reference
   auth.uid(), regardless of any existing PUBLIC function ACL. Verify ownership with both the
   current JSON `request.jwt.claims` setting and the legacy subject setting.
5. Confirm anon has no effective table/column privilege. Confirm authenticated has SELECT
   only. Confirm neither has INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN,
   or writable column grants.
6. Confirm both functions are owned by `paylink_request_api`, are SECURITY DEFINER, have
   `search_path=""`, and have the exact EXECUTE matrix reported by the audit.
7. Enable anonymous Auth only in this disposable project. Create two independent anonymous
   sessions A and B plus an unauthenticated public client.
8. Run the two-user, exact-decimal, invalid-input, direct-write, idempotency, concurrency,
   expiry, and quota cases in `PRODUCTION_VERIFICATION.md`. Inspect stored rows through SQL
   Editor; do not add a browser UPDATE path.
9. Restart or reload PostgREST if necessary and repeat public UUID reads after schema-cache
   refresh and project restart.

## 5. Rehearse containment rollback

1. Stop application traffic to the disposable project.
2. Run `rollback_disable_request_access.sql` as one transaction.
3. Verify authenticated creation, public UUID reads, and authenticated table SELECT now fail.
4. Verify every row and schema object remains. This is access containment, not schema removal.
5. Do not test rollback by disabling RLS, restoring broad grants, dropping the role/columns,
   deleting Auth users, or using CASCADE.

Retain the before/after audits, migration output, Auth/API test results, rollback output, and
the exact migration SHA-256. A successful local PostgreSQL 18 run does not satisfy this hosted
PostgreSQL 17.11 rehearsal.
