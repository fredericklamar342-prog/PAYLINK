# Proposal 003 production verification checklist

No step authorizes execution. Obtain explicit approval after the pre-migration gate.

## Pre-migration read-only gate

- [ ] Run `final-readiness-audit.sql`; save the complete timestamped output.
- [ ] Confirm row count 0, column count 12, RLS true and the supplied column/default shape.
- [ ] Confirm `amount > 0`; status permits pending (paid/failed may remain for future verified settlement).
- [ ] Confirm SQL Editor current role owns/can assume the table owner and has CREATEROLE.
- [ ] Confirm it has grant option for public USAGE and CREATE. Auth grant options may remain
      false; proposal 003 does not alter or depend on managed Auth-schema privileges.
- [ ] Confirm zero existing policies, user triggers, incoming foreign keys, dependent rules/views,
      and request-related functions. Review every nonzero row rather than forcing the preflight.
- [ ] Review direct and effective table/column grants, including PUBLIC and memberships.
- [ ] Confirm external application, Edge Function, Realtime, reporting and scheduled-job consumers.
- [ ] Confirm PostgreSQL version and provider backup/restore point.
- [ ] Rehearse proposal 003 and verification in an isolated Supabase project.
- [ ] Approve the semantic changes in `MIGRATION_003_DIFF.md` and containment rollback.

## Immediately after a manually approved transaction

- [ ] Confirm COMMIT; if any statement failed, issue ROLLBACK and do not run fragments.
- [ ] Re-run `final-readiness-audit.sql` and the expanded audit.
- [ ] Anon effective table and column privileges are all false, including TRUNCATE and MAINTAIN.
- [ ] Authenticated direct writes/column writes/TRUNCATE are false; SELECT is true.
- [ ] `paylink_request_api` cannot login/bypass RLS/create schema; has only SELECT/INSERT.
- [ ] `paylink_request_api` has no auth schema USAGE; function/policy definitions have no
      dependency on auth.uid() even if that function retains a PUBLIC EXECUTE ACL.
- [ ] `postgres` has SET and bootstrap-granted ADMIN, but not inherited USAGE, in
      `paylink_request_api`; review every membership row and grantor.
- [ ] Anon/authenticated cannot inherit or SET ROLE to `paylink_request_api`.
- [ ] Create RPC: authenticated true, anon false. Exact-ID read: both true.
- [ ] Function owner/search_path/ACL and three policy definitions match proposal 003.
- [ ] Original 12 columns/defaults/checks/indexes are unchanged; exactly three columns added.

## Isolated application verification before production traffic

- [ ] Anonymous Auth is enabled and rate limits/abuse controls are configured.
- [ ] Sessions A/B: A creates MON and USDC; B cannot table-read A; public UUID read is allowlisted.
- [ ] Direct insert/update/delete/truncate and hash/status/paid-at writes fail for browser roles.
- [ ] Exact amounts, token precision, chain, wallet and expiry rejection behave as documented.
- [ ] Concurrent duplicates yield one ID; changed payload conflicts; quota remains atomic.
- [ ] New stored links remain view-only. Legacy MON links retain their existing isolated flow.

## Failure containment

- [ ] Stop new request traffic.
- [ ] Apply only the separately approved `rollback_disable_request_access.sql`.
- [ ] Verify create/read execution and authenticated SELECT are disabled; rows/schema remain.
- [ ] Prefer a reviewed forward fix. Never disable RLS, restore broad grants or use CASCADE.
