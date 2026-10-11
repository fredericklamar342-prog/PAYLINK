# Review and rollback procedure

No SQL in this directory has been executed by the assistant. The database is production-marked.
Proposal 003 is for the supplied 12-column, empty table. Proposals 001/002 must not be applied.
Read `MIGRATION_REVIEW.md` for tested behavior and remaining production approval gates.

## Before approval

1. Save a schema-only backup and the full read-only audit output, including column defaults,
   check definitions, constraints, indexes, grants (including columns), role membership,
   function owners/search paths, views and triggers. Keep a provider backup/restore point.
2. Confirm the table is still empty. Proposal 003 checks this under a short exclusive lock
   and aborts if rows appeared. Do not delete new rows to satisfy the check; adapt ownership
   and backfill separately if the production state changed.
3. Review the definitions, not only names, of `payment_requests_amount_check` and
   `payment_requests_status_check`. They must allow positive MON/USDC numeric amounts and
   status `pending`. Proposal 003 preserves them, and all original defaults, unchanged.
4. Resolve any dependencies reported by the audit: incoming/outgoing foreign keys,
   triggers, rules/views/materialized views, functions in all schemas, indexes, default
   expressions, grants, and roles. Function source searches/catalog dependencies cannot
   discover all dynamic SQL or external consumers. Inspect Edge Functions, scheduled jobs,
   Realtime consumers, reporting tools and other deployed applications manually.
5. Rehearse the proposed transaction against an isolated copy of the actual schema.
   Test both success and preflight failures. Run the two-user/RPC checks in README.md.
   A browser test fixture is not a substitute for this database validation.

## Application order and failure handling

Apply only the reviewed 003 proposal manually in SQL Editor. It takes a short exclusive
table lock and adds identity/display-name columns, constraints/index, policies, a dedicated
role and two versioned RPCs. No existing object is dropped or replaced. Client grants are
deliberately restricted and must be approved. An exception aborts the transaction; if the
SQL session remains in a failed transaction, issue `ROLLBACK`. Do not continue with fragments.
Confirm a successful COMMIT and rerun the audit; do not infer success from an empty result.
Deploy/restart the matching application only after the versioned RPCs are available.

## Non-destructive rollback after commit

If verification fails, stop request creation in the application and apply the separately
reviewed [access-containment SQL](proposals/rollback_disable_request_access.sql). This revokes
client execution/read grants. It preserves every row and all schema objects, so no request
or dependency is lost. Public links will be unavailable until access is restored.
Confirm creation/public-read RPCs are denied and direct writes remain denied. Legacy
portable MON links do not use these RPCs; decide operationally whether to pause those too.
The containment transaction uses postgres' SET-true, non-inherited membership to assume
`paylink_request_api` for function ACL revocation, then resets to postgres for the table ACL.
PostgreSQL 17 also retains its automatic bootstrap-granted ADMIN membership. If the SET access
or function ownership differs from the reviewed post-migration state, stop and prepare a new rollback.

Prefer a reviewed forward fix. Restore execution grants only after identifying the cause
and repeating the database verification checklist. Do not restore broad old grants, disable
RLS, drop added columns/roles, or use CASCADE as a generic rollback. If a full schema rollback
is eventually needed, first export newly created requests and review their dependencies;
prepare it as a separate migration. Supabase Auth users created during testing are not
removed by this plan and must not be deleted as unreviewed production cleanup.
