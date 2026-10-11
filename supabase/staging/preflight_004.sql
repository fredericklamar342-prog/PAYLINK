-- READ ONLY. Run in paylink-staging before migration 004. Do not run migration from this file.
select version() as server_version, current_user as audit_role;

with expected(attnum,name,type,not_null) as (values
  (1,'id','uuid',true),(2,'creator_wallet','text',false),(3,'recipient_wallet','text',true),
  (4,'amount','numeric',true),(5,'token_symbol','text',true),(6,'description','text',false),
  (7,'network','text',true),(8,'status','text',true),(9,'transaction_hash','text',false),
  (10,'expires_at','timestamp with time zone',false),(11,'created_at','timestamp with time zone',true),
  (12,'paid_at','timestamp with time zone',false),(13,'owner_id','uuid',true),
  (14,'client_request_id','uuid',true),(15,'recipient_name','text',true)
), actual as (
  select a.attnum,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) type,a.attnotnull
  from pg_catalog.pg_attribute a where a.attrelid='public.payment_requests'::pg_catalog.regclass
    and a.attnum>0 and not a.attisdropped
)
select
  (select count(*) from actual)=15 as exactly_15_columns,
  not exists(select * from expected except select * from actual) as all_expected_columns,
  not exists(select * from actual except select * from expected) as no_unexpected_columns;

select
  c.relowner=pg_catalog.to_regrole('postgres') as table_owned_by_postgres,
  c.relrowsecurity as rls_enabled,
  (select count(*) from public.payment_requests) as row_count,
  (select count(*) from public.payment_requests where status<>'pending'
    or transaction_hash is not null or paid_at is not null) as incompatible_settlement_rows
from pg_catalog.pg_class c where c.oid='public.payment_requests'::pg_catalog.regclass;

select conname,contype,convalidated,pg_catalog.pg_get_constraintdef(oid) definition
from pg_catalog.pg_constraint where conrelid='public.payment_requests'::pg_catalog.regclass
order by conname;
select indexname,indexdef from pg_catalog.pg_indexes
where schemaname='public' and tablename='payment_requests' order by indexname;
select polname,polcmd,pg_catalog.pg_get_userbyid(polroles[1]) first_role,
  pg_catalog.pg_get_expr(polqual,polrelid) using_expression,
  pg_catalog.pg_get_expr(polwithcheck,polrelid) check_expression
from pg_catalog.pg_policy where polrelid='public.payment_requests'::pg_catalog.regclass order by polname;

select
  pg_catalog.to_regrole('paylink_request_api') is not null as request_role_exists,
  pg_catalog.to_regprocedure('public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)') is not null as create_v2_exists,
  pg_catalog.to_regprocedure('public.paylink_get_payment_request_v2(uuid)') is not null as read_v2_exists,
  pg_catalog.to_regrole('paylink_settlement_api') is null as settlement_owner_absent,
  pg_catalog.to_regrole('paylink_settlement_executor') is null as settlement_executor_absent,
  pg_catalog.to_regprocedure('public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)') is null as settlement_rpc_absent,
  pg_catalog.to_regprocedure('public.paylink_get_payment_request_v3(uuid)') is null as read_v3_absent;

select r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolbypassrls
from pg_catalog.pg_roles r where r.rolname in ('postgres','anon','authenticated','paylink_request_api')
order by r.rolname;
select pg_catalog.pg_get_userbyid(m.roleid) granted_role,
  pg_catalog.pg_get_userbyid(m.member) member,m.admin_option,m.inherit_option,m.set_option
from pg_catalog.pg_auth_members m
where pg_catalog.pg_get_userbyid(m.roleid) in ('anon','authenticated','paylink_request_api')
   or pg_catalog.pg_get_userbyid(m.member) in ('anon','authenticated','paylink_request_api')
order by granted_role,member;

select n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) arguments,
  pg_catalog.pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname like 'paylink_%') order by p.proname;

-- Dependency inventory. Review every returned row before migration approval.
select 'trigger' kind,t.tgname name from pg_catalog.pg_trigger t
where t.tgrelid='public.payment_requests'::pg_catalog.regclass and not t.tgisinternal
union all
select 'incoming_fk',c.conname from pg_catalog.pg_constraint c
where c.confrelid='public.payment_requests'::pg_catalog.regclass
union all
select 'dependent_view_or_rule',r.rulename from pg_catalog.pg_rewrite r
join pg_catalog.pg_depend d on d.classid='pg_rewrite'::pg_catalog.regclass and d.objid=r.oid
where d.refclassid='pg_class'::pg_catalog.regclass
  and d.refobjid='public.payment_requests'::pg_catalog.regclass;
