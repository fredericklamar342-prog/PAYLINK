-- READ ONLY. Run immediately after the staging setup and save the complete output.
-- This does not execute migration 003 and does not display row contents.

select current_setting('server_version') as server_version,
  current_setting('server_version_num') as server_version_num,
  current_database() as database_name,
  current_user as sql_editor_role,
  r.rolcreaterole, r.rolsuper
from pg_catalog.pg_roles r where r.rolname = current_user;

select pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
  c.relkind, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
  (select count(*) from public.payment_requests) as row_count,
  (select count(*) from pg_catalog.pg_attribute
    where attrelid = c.oid and attnum > 0 and not attisdropped) as column_count,
  (select count(*) from pg_catalog.pg_policy where polrelid = c.oid) as policy_count
from pg_catalog.pg_class c
where c.oid = 'public.payment_requests'::regclass;

select a.attnum as ordinal_position, a.attname as column_name,
  pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
  a.attnotnull as not_null,
  pg_catalog.pg_get_expr(d.adbin,d.adrelid) as column_default,
  a.attidentity, a.attgenerated
from pg_catalog.pg_attribute a
left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid='public.payment_requests'::regclass
  and a.attnum > 0 and not a.attisdropped
order by a.attnum;

select conname, contype, convalidated,
  pg_catalog.pg_get_constraintdef(oid,true) as definition
from pg_catalog.pg_constraint
where conrelid='public.payment_requests'::regclass
order by conname;

select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname='public' and tablename='payment_requests'
order by indexname;

select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='payment_requests'
order by grantee, privilege_type;

select grantee, column_name, privilege_type, is_grantable
from information_schema.column_privileges
where table_schema='public' and table_name='payment_requests'
order by grantee, column_name, privilege_type;

select r.rolname, p.privilege,
  pg_catalog.has_table_privilege(r.oid,'public.payment_requests',p.privilege) as effective
from pg_catalog.pg_roles r
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),
  ('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
where r.rolname in ('anon','authenticated','authenticator','postgres','supabase_realtime_admin')
order by r.rolname,p.privilege;

select r.rolname, p.privilege,
  pg_catalog.has_any_column_privilege(r.oid,'public.payment_requests',p.privilege)
    as effective_any_column
from pg_catalog.pg_roles r
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
where r.rolname in ('anon','authenticated','authenticator','postgres','supabase_realtime_admin')
order by r.rolname,p.privilege;

select pg_catalog.pg_get_userbyid(m.roleid) as granted_role,
  pg_catalog.pg_get_userbyid(m.member) as member,
  m.admin_option, m.inherit_option, m.set_option
from pg_catalog.pg_auth_members m
where m.roleid in (select oid from pg_catalog.pg_roles
    where rolname in ('anon','authenticated'))
  and m.member in (select oid from pg_catalog.pg_roles
    where rolname in ('authenticator','postgres','supabase_realtime_admin'))
order by granted_role,member;

select
  (select count(*) from pg_catalog.pg_trigger
    where tgrelid='public.payment_requests'::regclass and not tgisinternal) as user_trigger_count,
  (select count(*) from pg_catalog.pg_constraint
    where confrelid='public.payment_requests'::regclass) as incoming_fk_count,
  (select count(*) from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d
    on d.classid='pg_rewrite'::regclass and d.objid=r.oid
    where d.refclassid='pg_class'::regclass
      and d.refobjid='public.payment_requests'::regclass) as dependent_rule_view_count,
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace
    where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f'
      and (p.prosrc ilike '%payment_requests%' or exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid='pg_proc'::regclass and d.objid=p.oid
          and d.refclassid='pg_class'::regclass
          and d.refobjid='public.payment_requests'::regclass))) as dependent_function_count;

-- One-row pass/fail summary for the confirmed production facts.
select
  current_setting('server_version_num')::integer = 170011 as is_postgresql_17_11,
  current_user = 'postgres' as editor_is_postgres,
  (select pg_catalog.pg_get_userbyid(relowner)='postgres'
    from pg_catalog.pg_class where oid='public.payment_requests'::regclass) as owner_is_postgres,
  (select count(*)=12 from pg_catalog.pg_attribute
    where attrelid='public.payment_requests'::regclass and attnum>0 and not attisdropped)
    as has_12_columns,
  not exists (select 1 from public.payment_requests) as has_zero_rows,
  (select relrowsecurity from pg_catalog.pg_class
    where oid='public.payment_requests'::regclass) as rls_enabled,
  not exists (select 1 from pg_catalog.pg_policy
    where polrelid='public.payment_requests'::regclass) as has_zero_policies,
  (select count(*)=3 from pg_catalog.pg_constraint
    where conrelid='public.payment_requests'::regclass and contype <> 'n') as has_three_constraints,
  (select count(*)=3 from pg_catalog.pg_indexes
    where schemaname='public' and tablename='payment_requests') as has_three_indexes,
  pg_catalog.has_table_privilege('anon','public.payment_requests','TRUNCATE')
    as anon_has_confirmed_truncate,
  pg_catalog.has_table_privilege('authenticated','public.payment_requests','TRUNCATE')
    as authenticated_has_confirmed_truncate;
