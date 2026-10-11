-- READ ONLY. Run only after an explicitly approved migration-004 staging rehearsal.
select version() as server_version,current_user as audit_role;

select
  (select count(*) from pg_catalog.pg_attribute where attrelid='public.payment_requests'::pg_catalog.regclass
    and attnum>0 and not attisdropped)=26 as exactly_26_columns,
  exists(select 1 from pg_catalog.pg_constraint where conrelid='public.payment_requests'::pg_catalog.regclass
    and conname='paylink_settlement_state_v1' and contype='c' and convalidated) as state_constraint_valid,
  pg_catalog.to_regclass('public.paylink_transaction_hash_v1') is not null as hash_index_exists,
  pg_catalog.to_regclass('public.paylink_paid_at_v1') is not null as paid_index_exists,
  pg_catalog.to_regprocedure('public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)') is not null as settlement_rpc_exists,
  pg_catalog.to_regprocedure('public.paylink_get_payment_request_v3(uuid)') is not null as read_v3_exists;

select r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolbypassrls
from pg_catalog.pg_roles r where r.rolname in ('paylink_settlement_api','paylink_settlement_executor')
order by r.rolname;
select pg_catalog.pg_get_userbyid(m.roleid) granted_role,
  pg_catalog.pg_get_userbyid(m.member) member,m.admin_option,m.inherit_option,m.set_option
from pg_catalog.pg_auth_members m
where pg_catalog.pg_get_userbyid(m.roleid) in ('paylink_settlement_api','paylink_settlement_executor')
   or pg_catalog.pg_get_userbyid(m.member) in ('paylink_settlement_api','paylink_settlement_executor')
order by granted_role,member;

select polname,polcmd,polroles::pg_catalog.regrole[],
  pg_catalog.pg_get_expr(polqual,polrelid) using_expression,
  pg_catalog.pg_get_expr(polwithcheck,polrelid) check_expression
from pg_catalog.pg_policy where polrelid='public.payment_requests'::pg_catalog.regclass order by polname;

select n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) arguments,
  pg_catalog.pg_get_userbyid(p.proowner) owner,p.prosecdef,p.provolatile,p.proconfig,p.proacl
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('paylink_create_payment_request_v2','paylink_get_payment_request_v2',
   'paylink_record_verified_settlement_v1','paylink_get_payment_request_v3')
order by p.proname;

select role_name,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','SELECT') table_select,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','INSERT') table_insert,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','UPDATE') table_update,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','DELETE') table_delete,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','TRUNCATE') table_truncate,
  pg_catalog.has_table_privilege(role_name,'public.payment_requests','MAINTAIN') table_maintain,
  pg_catalog.has_any_column_privilege(role_name,'public.payment_requests','UPDATE') any_column_update
from (values('anon'),('authenticated'),('paylink_settlement_api'),('paylink_settlement_executor')) r(role_name);

select role_name,
  pg_catalog.has_function_privilege(role_name,
    'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE') settlement_execute,
  pg_catalog.has_function_privilege(role_name,'public.paylink_get_payment_request_v3(uuid)','EXECUTE') read_v3_execute
from (values('public'),('anon'),('authenticated'),('paylink_request_api'),
  ('paylink_settlement_api'),('paylink_settlement_executor')) r(role_name);

-- Effective PUBLIC-inherited surface for the disabled executor. Every returned row needs review.
select 'schema' object_type,n.nspname object_name,null::text privilege
from pg_catalog.pg_namespace n
where n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
  and (pg_catalog.has_schema_privilege('paylink_settlement_executor',n.oid,'USAGE')
   or pg_catalog.has_schema_privilege('paylink_settlement_executor',n.oid,'CREATE'))
union all
select c.relkind::text,pg_catalog.quote_ident(n.nspname)||'.'||pg_catalog.quote_ident(c.relname),p.privilege
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
where n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
  and c.relkind in ('r','p','v','m','S')
  and pg_catalog.has_table_privilege('paylink_settlement_executor',c.oid,p.privilege)
union all
select 'function',pg_catalog.quote_ident(n.nspname)||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')','EXECUTE'
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
  and pg_catalog.has_function_privilege('paylink_settlement_executor',p.oid,'EXECUTE')
order by 1,2,3;

select
  pg_catalog.has_database_privilege('paylink_settlement_executor',current_database(),'CONNECT') database_connect,
  pg_catalog.has_database_privilege('paylink_settlement_executor',current_database(),'TEMP') database_temp,
  pg_catalog.has_schema_privilege('paylink_settlement_executor','public','CREATE') public_create,
  case when pg_catalog.to_regnamespace('net') is null then false
    else pg_catalog.has_schema_privilege('paylink_settlement_executor','net','USAGE') end net_schema_usage;
