-- REVIEW ONLY. Emergency access containment, not destructive schema rollback.
-- Apply manually ONLY after approving this plan and confirming proposal 003 was applied.
-- Keeps every row, column, default, constraint, index, function and role intact.
-- This intentionally disables new creation AND public request viewing until a reviewed fix.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Migration 003 grants postgres SET TRUE / INHERIT FALSE membership in the function owner.
-- Assume that owner explicitly for function ACL changes, then return to postgres for table ACLs.
set local role paylink_request_api;
revoke all on function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)
  from public, anon, authenticated;
revoke all on function public.paylink_get_payment_request_v2(uuid) from public, anon, authenticated;
reset role;
revoke select on public.payment_requests from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
