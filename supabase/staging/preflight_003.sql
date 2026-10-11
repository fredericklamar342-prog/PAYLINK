-- READ ONLY. Run in paylink-staging immediately before migration 003.
-- Every boolean in the final row must be true. Save the complete output.

with expected(attnum,attname,data_type,not_null,column_default) as (values
  (1,'id','uuid',true,'gen_random_uuid()'),
  (2,'creator_wallet','text',false,null),
  (3,'recipient_wallet','text',true,null),
  (4,'amount','numeric',true,null),
  (5,'token_symbol','text',true,'''USDC''::text'),
  (6,'description','text',false,null),
  (7,'network','text',true,'''Monad Testnet''::text'),
  (8,'status','text',true,'''pending''::text'),
  (9,'transaction_hash','text',false,null),
  (10,'expires_at','timestamp with time zone',false,null),
  (11,'created_at','timestamp with time zone',true,'now()'),
  (12,'paid_at','timestamp with time zone',false,null)
), actual as (
  select a.attnum,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) data_type,
    a.attnotnull not_null,pg_catalog.pg_get_expr(d.adbin,d.adrelid) column_default
  from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d
    on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.payment_requests'::regclass and a.attnum>0 and not a.attisdropped
)
select
  current_setting('server_version_num')::integer=170011 as postgres_17_11,
  current_user='postgres' as editor_postgres,
  (select rolcreaterole and not rolsuper from pg_catalog.pg_roles where rolname=current_user)
    as editor_capabilities_match,
  (select pg_catalog.pg_get_userbyid(relowner)='postgres' and relrowsecurity and relkind='r'
    from pg_catalog.pg_class where oid='public.payment_requests'::regclass) as owner_rls_kind_match,
  pg_catalog.has_schema_privilege(current_user,'public','USAGE WITH GRANT OPTION')
    as can_grant_public_usage,
  pg_catalog.has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION')
    as can_grant_public_create,
  not exists ((select * from expected except select * from actual)
    union all (select * from actual except select * from expected)) as exact_12_columns,
  not exists(select 1 from public.payment_requests) as zero_rows,
  (select count(*)=3 from pg_catalog.pg_constraint
    where conrelid='public.payment_requests'::regclass and contype<>'n') as three_original_constraints,
  (select count(*)=3 from pg_catalog.pg_indexes
    where schemaname='public' and tablename='payment_requests') as three_original_indexes,
  not exists(select 1 from pg_catalog.pg_policy
    where polrelid='public.payment_requests'::regclass) as zero_policies,
  not exists(select 1 from pg_catalog.pg_trigger
    where tgrelid='public.payment_requests'::regclass and not tgisinternal) as zero_user_triggers,
  not exists(select 1 from pg_catalog.pg_constraint
    where confrelid='public.payment_requests'::regclass) as zero_incoming_foreign_keys,
  not exists(select 1 from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d
    on d.classid='pg_rewrite'::regclass and d.objid=r.oid
    where d.refclassid='pg_class'::regclass
      and d.refobjid='public.payment_requests'::regclass) as zero_dependent_rules_views,
  not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema')
      and p.prokind='f' and (p.prosrc ilike '%payment_requests%' or p.proname in
        ('create_payment_request','get_payment_request','paylink_create_payment_request_v2',
         'paylink_get_payment_request_v2'))) as zero_request_functions,
  pg_catalog.to_regrole('paylink_request_api') is null as api_role_absent,
  pg_catalog.has_table_privilege('anon','public.payment_requests','TRUNCATE')
    as anon_original_truncate,
  pg_catalog.has_table_privilege('authenticated','public.payment_requests','TRUNCATE')
    as authenticated_original_truncate;
