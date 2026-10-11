-- READ ONLY. One-table migration-004 verification for hosted paylink-staging.
-- Run as a single SQL Editor query after migration 004. No data or ACLs are changed.
with checks(check_name, passed, expected) as (
  values
    ('schema.exactly_26_columns',
      (select count(*) = 26 from pg_catalog.pg_attribute
       where attrelid = 'public.payment_requests'::pg_catalog.regclass
         and attnum > 0 and not attisdropped), 'true'),
    ('schema.settlement_constraint_valid',
      exists(select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.payment_requests'::pg_catalog.regclass
         and conname = 'paylink_settlement_state_v1' and contype = 'c' and convalidated), 'true'),
    ('schema.transaction_hash_index_exists',
      pg_catalog.to_regclass('public.paylink_transaction_hash_v1') is not null, 'true'),
    ('schema.paid_at_index_exists',
      pg_catalog.to_regclass('public.paylink_paid_at_v1') is not null, 'true'),
    ('role.api_restricted_nologin',
      exists(select 1 from pg_catalog.pg_roles where rolname = 'paylink_settlement_api'
        and not rolcanlogin and not rolsuper and not rolcreaterole and not rolcreatedb
        and not rolinherit and not rolbypassrls), 'true'),
    ('role.executor_restricted_NOLOGIN',
      exists(select 1 from pg_catalog.pg_roles where rolname = 'paylink_settlement_executor'
        and not rolcanlogin and not rolsuper and not rolcreaterole and not rolcreatedb
        and not rolinherit and not rolbypassrls), 'true'),
    ('role.executor_not_assumable',
      not exists(select 1 from pg_catalog.pg_auth_members m
        where pg_catalog.pg_get_userbyid(m.roleid) = 'paylink_settlement_executor'
          and (m.inherit_option or m.set_option)), 'true'),
    ('role.browser_cannot_assume_settlement_roles',
      not (pg_catalog.pg_has_role('anon','paylink_settlement_api','MEMBER')
        or pg_catalog.pg_has_role('authenticated','paylink_settlement_api','MEMBER')
        or pg_catalog.pg_has_role('anon','paylink_settlement_executor','MEMBER')
        or pg_catalog.pg_has_role('authenticated','paylink_settlement_executor','MEMBER')), 'true'),
    ('rls.enabled',
      (select relrowsecurity from pg_catalog.pg_class
       where oid = 'public.payment_requests'::pg_catalog.regclass), 'true'),
    ('rls.settlement_read_policy_exists',
      exists(select 1 from pg_catalog.pg_policy
       where polrelid = 'public.payment_requests'::pg_catalog.regclass
         and polname = 'paylink_settlement_read_v1' and polcmd = 'r'
         and polroles = array['paylink_settlement_api'::pg_catalog.regrole]::oid[]), 'true'),
    ('rls.settlement_update_policy_exists',
      exists(select 1 from pg_catalog.pg_policy
       where polrelid = 'public.payment_requests'::pg_catalog.regclass
         and polname = 'paylink_settlement_update_v1' and polcmd = 'w'
         and polroles = array['paylink_settlement_api'::pg_catalog.regrole]::oid[]
         and polqual is not null and polwithcheck is not null), 'true'),
    ('function.settlement_rpc_exists',
      pg_catalog.to_regprocedure('public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)') is not null, 'true'),
    ('function.public_read_v3_exists',
      pg_catalog.to_regprocedure('public.paylink_get_payment_request_v3(uuid)') is not null, 'true'),
    ('function.settlement_owner_and_security',
      exists(select 1 from pg_catalog.pg_proc p
        where p.oid = 'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)'::pg_catalog.regprocedure
          and pg_catalog.pg_get_userbyid(p.proowner) = 'paylink_settlement_api'
          and p.prosecdef and p.proconfig = array['search_path=""']), 'true'),
    ('function.read_v3_owner_and_security',
      exists(select 1 from pg_catalog.pg_proc p
        where p.oid = 'public.paylink_get_payment_request_v3(uuid)'::pg_catalog.regprocedure
          and pg_catalog.pg_get_userbyid(p.proowner) = 'paylink_request_api'
          and p.prosecdef and p.proconfig = array['search_path=""']), 'true'),
    ('grant.executor_settlement_execute_only',
      pg_catalog.has_function_privilege('paylink_settlement_executor',
        'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE')
      and not pg_catalog.has_function_privilege('paylink_settlement_executor',
        'public.paylink_get_payment_request_v3(uuid)','EXECUTE'), 'true'),
    ('grant.browser_cannot_execute_settlement',
      not pg_catalog.has_function_privilege('public',
        'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE')
      and not pg_catalog.has_function_privilege('anon',
        'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated',
        'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE'), 'true'),
    ('grant.public_read_v3_browser_only',
      not pg_catalog.has_function_privilege('public','public.paylink_get_payment_request_v3(uuid)','EXECUTE')
      and pg_catalog.has_function_privilege('anon','public.paylink_get_payment_request_v3(uuid)','EXECUTE')
      and pg_catalog.has_function_privilege('authenticated','public.paylink_get_payment_request_v3(uuid)','EXECUTE')
      and not pg_catalog.has_function_privilege('paylink_settlement_executor','public.paylink_get_payment_request_v3(uuid)','EXECUTE'), 'true'),
    ('grant.executor_no_direct_table_or_column_access',
      not pg_catalog.has_table_privilege('paylink_settlement_executor','public.payment_requests',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      and not pg_catalog.has_any_column_privilege('paylink_settlement_executor','public.payment_requests',
        'SELECT,INSERT,UPDATE,REFERENCES'), 'true'),
    ('grant.browser_no_direct_writes',
      not pg_catalog.has_table_privilege('anon','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      and not pg_catalog.has_table_privilege('authenticated','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      and not pg_catalog.has_any_column_privilege('anon','public.payment_requests','INSERT,UPDATE,REFERENCES')
      and not pg_catalog.has_any_column_privilege('authenticated','public.payment_requests','INSERT,UPDATE,REFERENCES'), 'true'),
    ('grant.executor_public_schema_create_denied',
      not pg_catalog.has_schema_privilege('paylink_settlement_executor','public','CREATE'), 'true'),
    ('grant.executor_net_schema_usage_denied',
      case when pg_catalog.to_regnamespace('net') is null then true
        else not pg_catalog.has_schema_privilege('paylink_settlement_executor','net','USAGE') end, 'true'),
    ('platform.executor_database_connect_expected',
      pg_catalog.has_database_privilege('paylink_settlement_executor',current_database(),'CONNECT'), 'true (normal PUBLIC default)'),
    ('platform.executor_database_temp_expected',
      pg_catalog.has_database_privilege('paylink_settlement_executor',current_database(),'TEMP'), 'true (normal PUBLIC default)')
), report as (
  select check_name, passed, expected from checks
  union all
  select 'OVERALL_MIGRATION_004', pg_catalog.bool_and(passed), 'true'
  from checks
)
select check_name,
  case when passed then 'PASS' else 'FAIL' end as result,
  passed,
  expected
from report
order by case when check_name = 'OVERALL_MIGRATION_004' then 1 else 0 end, check_name;
