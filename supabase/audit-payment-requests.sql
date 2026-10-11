-- READ ONLY. Run in Supabase SQL Editor; contains no request/customer data.
select current_setting('server_version') as server_version, current_user as audit_role;
select to_regclass('public.payment_requests') as table_name;
select column_name, data_type, udt_schema, udt_name, is_nullable, column_default,
  numeric_precision, numeric_scale, character_maximum_length, is_identity, is_generated
from information_schema.columns
where table_schema = 'public' and table_name = 'payment_requests'
order by ordinal_position;
select c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'payment_requests';
select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'payment_requests';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'payment_requests';
select indexname, indexdef from pg_catalog.pg_indexes
where schemaname = 'public' and tablename = 'payment_requests';
select p.oid::regprocedure as function_signature, p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner, p.proconfig as settings, p.proacl as grants,
  pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog','information_schema') and p.prokind = 'f' and
  (p.proname in ('create_payment_request', 'get_payment_request',
    'paylink_create_payment_request_v2', 'paylink_get_payment_request_v2')
   or p.prosrc ilike '%payment_requests%');

-- All constraints, including incoming and outgoing foreign keys. Never remove them blindly.
select conname, contype, conrelid::regclass as source_table, confrelid::regclass as referenced_table,
  convalidated, pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where conrelid = to_regclass('public.payment_requests')
   or confrelid = to_regclass('public.payment_requests');
select tgname, tgenabled, tgisinternal, pg_get_triggerdef(oid, true) as definition,
  tgfoid::regprocedure as function_signature
from pg_catalog.pg_trigger where tgrelid = to_regclass('public.payment_requests');
select schemaname, viewname, viewowner, definition from pg_catalog.pg_views
where definition ilike '%payment_requests%';
select schemaname, matviewname, matviewowner, definition from pg_catalog.pg_matviews
where definition ilike '%payment_requests%';
select pg_describe_object(d.classid, d.objid, d.objsubid) as dependent,
  pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as referenced, d.deptype
from pg_catalog.pg_depend d
where (d.refclassid = 'pg_class'::regclass and d.refobjid = to_regclass('public.payment_requests'))
   or (d.classid = 'pg_class'::regclass and d.objid = to_regclass('public.payment_requests'));
select grantee, column_name, privilege_type from information_schema.column_privileges
where table_schema = 'public' and table_name = 'payment_requests';
select c.relname, pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_catalog.pg_class c where c.oid = to_regclass('public.payment_requests');
select nspname, pg_get_userbyid(nspowner) as owner, nspacl
from pg_catalog.pg_namespace where nspname in ('public','auth');
select pg_get_userbyid(defaclrole) as owner, defaclnamespace::regnamespace as schema,
  defaclobjtype, defaclacl from pg_catalog.pg_default_acl;
select rolname, rolcanlogin, rolsuper, rolbypassrls, rolinherit
from pg_catalog.pg_roles where rolname in ('anon', 'authenticated', 'postgres', 'paylink_request_api');
select pg_get_userbyid(roleid) as granted_role, pg_get_userbyid(member) as member, admin_option,
  to_jsonb(m)->>'inherit_option' as inherit_option, to_jsonb(m)->>'set_option' as set_option
from pg_catalog.pg_auth_members m
where roleid in (select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated','paylink_request_api'))
   or member in (select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated','paylink_request_api'));
-- Catalog dependencies do not discover dynamic SQL, external applications, or Edge Functions.
-- Inspect those separately before approving grants and new functions/policies.

-- Effective privileges, individually listed to avoid confusing ANY with ALL semantics.
select r.rolname, p.privilege,
  has_table_privilege(r.oid,'public.payment_requests',p.privilege) as table_privilege
from pg_catalog.pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
where r.rolname in ('anon','authenticated','paylink_request_api');
select r.rolname, p.privilege,
  has_any_column_privilege(r.oid,'public.payment_requests',p.privilege) as any_column_privilege
from pg_catalog.pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
where r.rolname in ('anon','authenticated','paylink_request_api');
select r.rolname, has_schema_privilege(r.oid,'public','CREATE') as public_schema_create,
  has_schema_privilege(r.oid,'public','USAGE') as public_schema_usage
from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','paylink_request_api');
-- Known check definitions must be reviewed. A default of pending alone does not prove acceptance.
select conname, pg_get_constraintdef(oid,true) as definition, convalidated
from pg_catalog.pg_constraint where conrelid='public.payment_requests'::regclass
  and conname in ('payment_requests_amount_check','payment_requests_status_check');
