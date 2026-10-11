-- READ ONLY. Final production gate for proposal 003. Does not expose row contents.
-- Run before and after the manually approved migration; retain both outputs.

select current_setting('server_version') as server_version,
  current_user as audit_role,
  (select rolcreaterole from pg_catalog.pg_roles where rolname=current_user) as audit_role_createrole,
  pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
  pg_catalog.pg_has_role(current_user,c.relowner,'USAGE') as can_assume_table_owner,
  c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
  (select count(*) from public.payment_requests) as row_count,
  (select count(*) from pg_catalog.pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped) as column_count
from pg_catalog.pg_class c where c.oid='public.payment_requests'::regclass;

-- Only the first two values are required. The auth values document why proposal 003 does
-- not grant or depend on managed auth-schema objects.
select
  pg_catalog.has_schema_privilege(current_user,'public','USAGE WITH GRANT OPTION') as can_grant_public_usage,
  pg_catalog.has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') as can_grant_public_create,
  pg_catalog.has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') as can_grant_auth_usage,
  pg_catalog.has_function_privilege(current_user,'auth.uid()','EXECUTE WITH GRANT OPTION') as can_grant_auth_uid_execute;

select r.rolname,
  pg_catalog.has_schema_privilege(r.oid,'auth','USAGE') as effective_auth_usage,
  pg_catalog.has_function_privilege(r.oid,'auth.uid()','EXECUTE') as effective_auth_uid_execute
from pg_catalog.pg_roles r
where r.rolname in ('anon','authenticated','postgres','paylink_request_api')
order by r.rolname;

select p.oid::regprocedure as auth_function, pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.proacl as acl
from pg_catalog.pg_proc p
where p.oid=pg_catalog.to_regprocedure('auth.uid()');

select conname, contype, convalidated, pg_catalog.pg_get_constraintdef(oid,true) as definition
from pg_catalog.pg_constraint
where conrelid='public.payment_requests'::regclass or confrelid='public.payment_requests'::regclass
order by conrelid::regclass::text, conname;

-- Zero counts are required for the first five pre-migration dependency categories.
-- Catalog/source searches cannot discover dynamic SQL or external services.
select
  (select count(*) from pg_catalog.pg_policy where polrelid='public.payment_requests'::regclass) as policy_count,
  (select count(*) from pg_catalog.pg_trigger where tgrelid='public.payment_requests'::regclass and not tgisinternal) as user_trigger_count,
  (select count(*) from pg_catalog.pg_constraint where confrelid='public.payment_requests'::regclass) as incoming_fk_count,
  (select count(*) from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d
    on d.classid='pg_rewrite'::regclass and d.objid=r.oid
    where d.refclassid='pg_class'::regclass and d.refobjid='public.payment_requests'::regclass) as dependent_rule_view_count,
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f'
      and (p.prosrc ilike '%payment_requests%' or exists (select 1 from pg_catalog.pg_depend d
        where d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_class'::regclass
          and d.refobjid='public.payment_requests'::regclass))) as dependent_function_count,
  (select count(*) from pg_catalog.pg_indexes where schemaname='public' and tablename='payment_requests') as index_count;

select schemaname, viewname, viewowner from pg_catalog.pg_views
where definition ilike '%payment_requests%'
union all
select schemaname, matviewname, matviewowner from pg_catalog.pg_matviews
where definition ilike '%payment_requests%';

select p.oid::regprocedure as function_signature, pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig as settings, p.proacl as acl
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f'
  and (p.proname in ('create_payment_request','get_payment_request',
    'paylink_create_payment_request_v2','paylink_get_payment_request_v2')
    or p.prosrc ilike '%payment_requests%')
order by p.oid::regprocedure::text;

-- Direct ACLs, including PUBLIC. Empty output does not prove effective privilege absence.
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='payment_requests'
order by grantee, privilege_type;
select grantee, column_name, privilege_type from information_schema.column_privileges
where table_schema='public' and table_name='payment_requests'
order by grantee, column_name, privilege_type;

-- Effective privilege truth table. These functions include PUBLIC and inherited memberships.
select r.rolname, p.privilege,
  pg_catalog.has_table_privilege(r.oid,'public.payment_requests',p.privilege) as effective
from pg_catalog.pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
where r.rolname in ('anon','authenticated','authenticator','supabase_realtime_admin','paylink_request_api')
order by r.rolname,p.privilege;
select r.rolname, p.privilege,
  pg_catalog.has_any_column_privilege(r.oid,'public.payment_requests',p.privilege) as effective_any_column
from pg_catalog.pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
where r.rolname in ('anon','authenticated','authenticator','supabase_realtime_admin','paylink_request_api')
order by r.rolname,p.privilege;

-- Membership direction matters: granted_role privileges flow to member subject to membership options.
select pg_catalog.pg_get_userbyid(m.roleid) as granted_role,
  pg_catalog.pg_get_userbyid(m.member) as member,
  m.admin_option,
  pg_catalog.to_jsonb(m)->>'inherit_option' as inherit_option,
  pg_catalog.to_jsonb(m)->>'set_option' as set_option
from pg_catalog.pg_auth_members m
where m.roleid in (select oid from pg_catalog.pg_roles where rolname in
    ('anon','authenticated','paylink_request_api'))
   or m.member in (select oid from pg_catalog.pg_roles where rolname in
    ('anon','authenticated','paylink_request_api'))
order by granted_role,member;

select r.rolname,r.rolcanlogin,r.rolsuper,r.rolcreaterole,r.rolinherit,r.rolbypassrls,
  pg_catalog.has_schema_privilege(r.oid,'public','USAGE') as public_usage,
  pg_catalog.has_schema_privilege(r.oid,'public','CREATE') as public_create
from pg_catalog.pg_roles r where r.rolname in
  ('anon','authenticated','authenticator','postgres','supabase_realtime_admin','paylink_request_api')
order by r.rolname;

-- After migration: all rows below must match the expected values.
select
  pg_catalog.has_table_privilege('anon','public.payment_requests','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') as anon_has_any_table_privilege,
  pg_catalog.has_any_column_privilege('anon','public.payment_requests','SELECT,INSERT,UPDATE,REFERENCES') as anon_has_any_column_privilege,
  pg_catalog.has_table_privilege('authenticated','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') as authenticated_has_any_direct_write,
  pg_catalog.has_any_column_privilege('authenticated','public.payment_requests','INSERT,UPDATE,REFERENCES') as authenticated_has_any_column_write,
  pg_catalog.has_table_privilege('authenticated','public.payment_requests','SELECT') as authenticated_has_select,
  case when pg_catalog.to_regrole('paylink_request_api') is null then null
    else pg_catalog.pg_has_role('anon','paylink_request_api','MEMBER') end as anon_can_become_function_owner,
  case when pg_catalog.to_regrole('paylink_request_api') is null then null
    else pg_catalog.pg_has_role('authenticated','paylink_request_api','MEMBER') end as authenticated_can_become_function_owner;

-- Expected after migration: create is authenticated-only; exact-ID read is anon+authenticated.
select r.rolname,
  case when pg_catalog.to_regprocedure('public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)') is null then null
    else pg_catalog.has_function_privilege(r.oid,'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)','EXECUTE') end as can_create,
  case when pg_catalog.to_regprocedure('public.paylink_get_payment_request_v2(uuid)') is null then null
    else pg_catalog.has_function_privilege(r.oid,'public.paylink_get_payment_request_v2(uuid)','EXECUTE') end as can_read_exact_id
from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated') order by r.rolname;
