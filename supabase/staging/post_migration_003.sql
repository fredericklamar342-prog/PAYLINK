-- READ ONLY. Run in paylink-staging immediately after migration 003 commits.
-- Save all output. Every boolean in the final row must be true before API tests.

select a.attnum,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) data_type,
  a.attnotnull,pg_catalog.pg_get_expr(d.adbin,d.adrelid) column_default
from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d
  on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid='public.payment_requests'::regclass and a.attnum>0 and not a.attisdropped
order by a.attnum;

select conname,contype,convalidated,pg_catalog.pg_get_constraintdef(oid,true) definition
from pg_catalog.pg_constraint where conrelid='public.payment_requests'::regclass
order by conname;

select indexname,indexdef from pg_catalog.pg_indexes
where schemaname='public' and tablename='payment_requests' order by indexname;

select policyname,roles,cmd,qual,with_check from pg_catalog.pg_policies
where schemaname='public' and tablename='payment_requests' order by policyname;

select p.oid::regprocedure function_signature,pg_catalog.pg_get_userbyid(p.proowner) owner,
  p.prosecdef security_definer,p.proconfig settings,p.proacl acl,
  p.prosrc ilike '%auth.uid%' references_auth_uid
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('paylink_create_payment_request_v2','paylink_get_payment_request_v2')
order by p.proname;

select r.rolname,r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,
  r.rolbypassrls,pg_catalog.has_schema_privilege(r.oid,'public','CREATE') public_create,
  pg_catalog.has_schema_privilege(r.oid,'auth','USAGE') auth_usage
from pg_catalog.pg_roles r where r.rolname='paylink_request_api';

select pg_catalog.pg_get_userbyid(m.roleid) granted_role,
  pg_catalog.pg_get_userbyid(m.member) member,m.admin_option,m.inherit_option,m.set_option
from pg_catalog.pg_auth_members m
where m.roleid=pg_catalog.to_regrole('paylink_request_api') order by member;

select r.rolname,p.privilege,
  pg_catalog.has_table_privilege(r.oid,'public.payment_requests',p.privilege) effective
from pg_catalog.pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
where r.rolname in ('anon','authenticated','paylink_request_api')
order by r.rolname,p.privilege;

select r.rolname,p.privilege,
  pg_catalog.has_any_column_privilege(r.oid,'public.payment_requests',p.privilege)
    effective_any_column
from pg_catalog.pg_roles r cross join
  (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
where r.rolname in ('anon','authenticated','paylink_request_api')
order by r.rolname,p.privilege;

select r.rolname,
  pg_catalog.has_function_privilege(r.oid,
    'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)',
    'EXECUTE') can_create,
  pg_catalog.has_function_privilege(r.oid,'public.paylink_get_payment_request_v2(uuid)',
    'EXECUTE') can_read_exact_id
from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated') order by r.rolname;

select
  current_setting('server_version_num')::integer=170011 as postgres_17_11,
  (select count(*)=15 from pg_catalog.pg_attribute
    where attrelid='public.payment_requests'::regclass and attnum>0 and not attisdropped)
    as fifteen_columns,
  not exists(select 1 from public.payment_requests) as zero_rows_before_api_tests,
  (select relrowsecurity from pg_catalog.pg_class
    where oid='public.payment_requests'::regclass) as rls_enabled,
  (select count(*)=3 from pg_catalog.pg_policy
    where polrelid='public.payment_requests'::regclass) as three_policies,
  (select count(*)=2 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('paylink_create_payment_request_v2','paylink_get_payment_request_v2')) as two_rpcs,
  (select count(*)=2 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('paylink_create_payment_request_v2','paylink_get_payment_request_v2')
      and p.prosecdef and p.proowner=pg_catalog.to_regrole('paylink_request_api')
      and p.proconfig @> array['search_path=""'] and p.prosrc not ilike '%auth.uid%')
    as secure_rpc_definitions,
  not pg_catalog.has_schema_privilege('paylink_request_api','public','CREATE')
    as api_no_public_create,
  not pg_catalog.has_schema_privilege('paylink_request_api','auth','USAGE')
    as api_no_auth_usage,
  pg_catalog.pg_has_role('postgres','paylink_request_api','SET')
    and pg_catalog.pg_has_role('postgres','paylink_request_api','MEMBER WITH ADMIN OPTION')
    and not pg_catalog.pg_has_role('postgres','paylink_request_api','USAGE')
    as postgres_membership_expected,
  not pg_catalog.pg_has_role('anon','paylink_request_api','MEMBER')
    and not pg_catalog.pg_has_role('authenticated','paylink_request_api','MEMBER')
    as browser_roles_not_members,
  not pg_catalog.has_table_privilege('anon','public.payment_requests',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    and not pg_catalog.has_any_column_privilege('anon','public.payment_requests',
      'SELECT,INSERT,UPDATE,REFERENCES') as anon_has_no_table_or_column_access,
  pg_catalog.has_table_privilege('authenticated','public.payment_requests','SELECT')
    and not pg_catalog.has_table_privilege('authenticated','public.payment_requests',
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    and not pg_catalog.has_any_column_privilege('authenticated','public.payment_requests',
      'INSERT,UPDATE,REFERENCES') as authenticated_owner_read_only,
  pg_catalog.has_table_privilege('paylink_request_api','public.payment_requests','SELECT')
    and pg_catalog.has_table_privilege('paylink_request_api','public.payment_requests','INSERT')
    and not pg_catalog.has_table_privilege('paylink_request_api','public.payment_requests',
      'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') as api_select_insert_only,
  not pg_catalog.has_function_privilege('anon',
    'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)',
    'EXECUTE')
    and pg_catalog.has_function_privilege('authenticated',
      'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)',
      'EXECUTE')
    and pg_catalog.has_function_privilege('anon','public.paylink_get_payment_request_v2(uuid)',
      'EXECUTE')
    and pg_catalog.has_function_privilege('authenticated',
      'public.paylink_get_payment_request_v2(uuid)','EXECUTE') as rpc_execute_matrix;
