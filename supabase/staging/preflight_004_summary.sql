-- READ ONLY. One result table for the migration-004 hosted-staging approval gate.
-- Every row must be reviewed. Do not execute migration 004 from this file.
with
objects as (
  select
    pg_catalog.to_regclass('public.payment_requests') as request_table,
    pg_catalog.to_regrole('postgres') as postgres_role,
    pg_catalog.to_regrole('anon') as anon_role,
    pg_catalog.to_regrole('authenticated') as authenticated_role,
    pg_catalog.to_regrole('paylink_request_api') as request_role,
    pg_catalog.to_regprocedure(
      'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)'
    ) as create_v2,
    pg_catalog.to_regprocedure('public.paylink_get_payment_request_v2(uuid)') as read_v2
),
expected_columns(attnum,name,type,not_null) as (values
  (1,'id','uuid',true),(2,'creator_wallet','text',false),(3,'recipient_wallet','text',true),
  (4,'amount','numeric',true),(5,'token_symbol','text',true),(6,'description','text',false),
  (7,'network','text',true),(8,'status','text',true),(9,'transaction_hash','text',false),
  (10,'expires_at','timestamp with time zone',false),(11,'created_at','timestamp with time zone',true),
  (12,'paid_at','timestamp with time zone',false),(13,'owner_id','uuid',true),
  (14,'client_request_id','uuid',true),(15,'recipient_name','text',true)
),
actual_columns as (
  select a.attnum,a.attname as name,pg_catalog.format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null
  from pg_catalog.pg_attribute a,objects o
  where a.attrelid=o.request_table and a.attnum>0 and not a.attisdropped
),
facts as (
  select
    o.*,
    c.relkind,c.relowner,c.relrowsecurity,
    (select count(*) from actual_columns) as column_count,
    (select count(*) from public.payment_requests) as row_count,
    (select count(*) from public.payment_requests
      where status<>'pending' or transaction_hash is not null or paid_at is not null) as incompatible_rows,
    (select count(*) from pg_catalog.pg_policy p where p.polrelid=o.request_table) as policy_count,
    (select count(*) from pg_catalog.pg_trigger t
      where t.tgrelid=o.request_table and not t.tgisinternal) as user_trigger_count,
    (select count(*) from pg_catalog.pg_constraint x where x.confrelid=o.request_table) as incoming_fk_count,
    (select count(*) from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d
      on d.classid='pg_rewrite'::pg_catalog.regclass and d.objid=r.oid
      where d.refclassid='pg_class'::pg_catalog.regclass and d.refobjid=o.request_table) as dependent_rule_count
  from objects o left join pg_catalog.pg_class c on c.oid=o.request_table
),
assertions(section,assertion,passed,observed) as (
  select 'runtime','PostgreSQL is version 17 or newer',
    current_setting('server_version_num')::integer>=170000,
    version()
  union all select 'authority','SQL Editor role has CREATEROLE',
    coalesce((select rolcreaterole from pg_catalog.pg_roles where rolname=current_user),false),current_user
  union all select 'authority','SQL Editor can act as table owner',
    coalesce(pg_catalog.pg_has_role(current_user,(select relowner from facts),'USAGE'),false)
      or coalesce((select rolsuper from pg_catalog.pg_roles where rolname=current_user),false),current_user
  union all select 'authority','Public schema USAGE grant option is available',
    pg_catalog.has_schema_privilege(current_user,'public','USAGE WITH GRANT OPTION'),'public'
  union all select 'authority','Public schema CREATE grant option is available',
    pg_catalog.has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION'),'public'
  union all select 'table','payment_requests is an ordinary table',
    (select request_table is not null and relkind='r' from facts),
    coalesce((select request_table::text from facts),'missing')
  union all select 'table','Table owner is postgres',
    (select relowner=postgres_role from facts),
    coalesce((select pg_catalog.pg_get_userbyid(relowner) from facts),'missing')
  union all select 'table','RLS is enabled',coalesce((select relrowsecurity from facts),false),
    coalesce((select relrowsecurity::text from facts),'missing')
  union all select 'columns','Exactly 15 columns exist',(select column_count=15 from facts),
    (select column_count::text from facts)
  union all select 'columns','All expected columns match position, type and nullability',
    not exists(select * from expected_columns except select * from actual_columns),'expected minus actual = 0'
  union all select 'columns','No unexpected columns exist',
    not exists(select * from actual_columns except select * from expected_columns),'actual minus expected = 0'
  union all select 'data','Every existing row is unsettled pending',
    (select incompatible_rows=0 from facts),
    (select format('rows=%s incompatible=%s',row_count,incompatible_rows) from facts)
  union all select 'constraints','Required migration-003 constraints exist and are validated',
    (select count(*)=5 from pg_catalog.pg_constraint c,objects o
      where c.conrelid=o.request_table and c.convalidated and c.conname in
       ('payment_requests_pkey','payment_requests_amount_check','payment_requests_status_check',
        'paylink_owner_submission_v2','paylink_request_values_v2')),
    (select count(*)::text from pg_catalog.pg_constraint c,objects o
      where c.conrelid=o.request_table and c.convalidated and c.conname in
       ('payment_requests_pkey','payment_requests_amount_check','payment_requests_status_check',
        'paylink_owner_submission_v2','paylink_request_values_v2'))
  union all select 'constraints','Status constraint supports pending and paid',
    coalesce((select pg_catalog.pg_get_constraintdef(c.oid) ilike '%pending%'
      and pg_catalog.pg_get_constraintdef(c.oid) ilike '%paid%'
      from pg_catalog.pg_constraint c,objects o
      where c.conrelid=o.request_table and c.conname='payment_requests_status_check'),false),
    coalesce((select pg_catalog.pg_get_constraintdef(c.oid)
      from pg_catalog.pg_constraint c,objects o
      where c.conrelid=o.request_table and c.conname='payment_requests_status_check'),'missing')
  union all select 'indexes','Required migration-003 indexes exist',
    (select count(*)=5 from pg_catalog.pg_indexes
      where schemaname='public' and tablename='payment_requests' and indexname in
       ('payment_requests_pkey','payment_requests_status_idx','payment_requests_created_at_idx',
        'paylink_owner_submission_v2','paylink_owner_created_v2')),
    (select count(*)::text from pg_catalog.pg_indexes
      where schemaname='public' and tablename='payment_requests' and indexname in
       ('payment_requests_pkey','payment_requests_status_idx','payment_requests_created_at_idx',
        'paylink_owner_submission_v2','paylink_owner_created_v2'))
  union all select 'rls','Exactly the three migration-003 policies exist',
    (select policy_count=3 from facts) and
      (select count(*)=3 from pg_catalog.pg_policy p,objects o where p.polrelid=o.request_table
        and p.polname in ('paylink_owner_read_v2','paylink_rpc_read_v2','paylink_rpc_insert_v2')),
    (select policy_count::text from facts)
  union all select 'roles','Restricted request role exists with safe attributes',
    coalesce((select not rolsuper and not rolcanlogin and not rolinherit and not rolbypassrls
      and not rolcreaterole and not rolcreatedb from pg_catalog.pg_roles,objects
      where oid=request_role),false),'paylink_request_api'
  union all select 'roles','Browser roles cannot assume request role',
    not coalesce(pg_catalog.pg_has_role((select anon_role from objects),(select request_role from objects),'MEMBER'),true)
    and not coalesce(pg_catalog.pg_has_role((select authenticated_role from objects),(select request_role from objects),'MEMBER'),true),
    'anon/authenticated MEMBER=false'
  union all select 'functions','Both exact v2 functions exist',
    (select create_v2 is not null and read_v2 is not null from objects),'create_v2/read_v2'
  union all select 'functions','Both v2 functions have reviewed owner, SECURITY DEFINER and empty search_path',
    (select count(*)=2 from pg_catalog.pg_proc p,objects o
      where p.oid in (o.create_v2,o.read_v2) and p.proowner=o.request_role and p.prosecdef
        and p.proconfig @> array['search_path=""']),
    (select count(*)::text from pg_catalog.pg_proc p,objects o
      where p.oid in (o.create_v2,o.read_v2) and p.proowner=o.request_role and p.prosecdef
        and p.proconfig @> array['search_path=""'])
  union all select 'functions','V2 execution grants match the browser matrix',
    coalesce(pg_catalog.has_function_privilege((select authenticated_role from objects),(select create_v2 from objects),'EXECUTE'),false)
    and not coalesce(pg_catalog.has_function_privilege((select anon_role from objects),(select create_v2 from objects),'EXECUTE'),true)
    and coalesce(pg_catalog.has_function_privilege((select anon_role from objects),(select read_v2 from objects),'EXECUTE'),false)
    and coalesce(pg_catalog.has_function_privilege((select authenticated_role from objects),(select read_v2 from objects),'EXECUTE'),false),
    'create=authenticated only; read=anon+authenticated'
  union all select 'privileges','Browser roles have no direct write privileges',
    not coalesce(pg_catalog.has_table_privilege('anon',(select request_table from objects),
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),true)
    and not coalesce(pg_catalog.has_any_column_privilege('anon',(select request_table from objects),
      'INSERT,UPDATE,REFERENCES'),true)
    and not coalesce(pg_catalog.has_table_privilege('authenticated',(select request_table from objects),
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),true)
    and not coalesce(pg_catalog.has_any_column_privilege('authenticated',(select request_table from objects),
      'INSERT,UPDATE,REFERENCES'),true),'anon/authenticated'
  union all select 'dependencies','No user triggers exist',(select user_trigger_count=0 from facts),
    (select user_trigger_count::text from facts)
  union all select 'dependencies','No incoming foreign keys exist',(select incoming_fk_count=0 from facts),
    (select incoming_fk_count::text from facts)
  union all select 'dependencies','No dependent views or rules exist',(select dependent_rule_count=0 from facts),
    (select dependent_rule_count::text from facts)
  union all select '004 names','Settlement roles are absent',
    pg_catalog.to_regrole('paylink_settlement_api') is null
      and pg_catalog.to_regrole('paylink_settlement_executor') is null,
    'paylink_settlement_api/paylink_settlement_executor'
  union all select '004 names','Settlement functions are absent',
    pg_catalog.to_regprocedure('public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)') is null
      and pg_catalog.to_regprocedure('public.paylink_get_payment_request_v3(uuid)') is null,
    'settlement_v1/read_v3'
)
select result.section,result.assertion,result.passed,result.observed
from (
  select section,assertion,passed,observed from assertions
  union all
  select 'summary','ALL REQUIRED ASSERTIONS PASS',coalesce(pg_catalog.bool_and(passed),false),
    format('%s of %s passed',count(*) filter(where passed),count(*))
  from assertions
) result
order by case result.section when 'summary' then 2 else 1 end,result.section,result.assertion;
