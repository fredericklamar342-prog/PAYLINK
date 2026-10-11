# Hosted staging rehearsal for migration 003

Target only the disposable `paylink-staging` project. The reviewed migration SHA-256 is:

`89dec15c1f8ec1bc32f20bd6e6022e4c620eda05f42784bd6d16f92040f5eb89`

The earlier `b2c69a9c99e20b49018bfc9c4c2110cda9651ea93a096c5d96b7573383d42a95`
artifact must not be used. The review corrected PostgreSQL 17's automatic creator-admin role
membership handling after that hash was calculated.

## Before running the migration

1. In the Supabase dashboard header, confirm the selected project is `paylink-staging`.
2. Run `preflight_003.sql` in a new SQL Editor query and save the complete output.
3. Require every final-row boolean to be true. An unseen, false, null, or missing column is a stop.
4. Recalculate the local migration SHA-256 and require the reviewed value above.
5. Keep `rollback_disable_request_access.sql` open in a separate editor tab for containment only.

## Run once as one transaction

1. Open `proposals/003_adapt_verified_payment_requests.sql` locally.
2. Copy the entire file without edits into a new SQL Editor query in `paylink-staging`.
3. Reconfirm the dashboard project name, then click Run once.
4. Require a successful final `COMMIT`. A `STOP:` exception or any SQL error means failure.
5. If the editor leaves an aborted transaction open, issue `ROLLBACK`; never run fragments.

## Verify before API testing

1. Run `post_migration_003.sql`; save all output.
2. Require every final-row boolean to be true and manually review the detailed role, policy,
   function, table, column, and membership rows above it.
3. PostgreSQL 17 should show an automatic bootstrap-granted ADMIN/SET-false membership plus a
   postgres-granted SET-true membership. Both must be INHERIT false; effective USAGE must be false.
4. Enable anonymous Auth in staging only, with appropriate staging rate limits.
5. Set the three `PAYLINK_STAGING_*` variables in the current terminal process only. Do not edit
   `.env.local` or any production/deployment environment configuration.
6. Run `node scripts/rehearse-staging-supabase.mjs` and retain its output.
7. Rerun `post_migration_003.sql`. `zero_rows_before_api_tests` is then expected to be false
   because the rehearsal intentionally leaves two pending test rows; all security assertions
   must remain true.

If post-migration security verification fails, stop staging traffic and run only the separately
reviewed containment transaction. It disables creation and public reads without removing data or
schema. Do not disable RLS, restore broad grants, drop objects, or use CASCADE.
