-- READ ONLY. Catalog-only inspection of non-system relations readable by PostgreSQL PUBLIC.
-- This query does not read relation contents and changes nothing.
with extension_objects as (
  select d.classid,d.objid,e.extname
  from pg_catalog.pg_depend d
  join pg_catalog.pg_extension e on e.oid=d.refobjid
  where d.refclassid='pg_extension'::pg_catalog.regclass and d.deptype='e'
),
public_relation_acl as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as object_name,
    c.relkind,
    pg_catalog.pg_get_userbyid(c.relowner) as owner,
    c.relrowsecurity as rls_enabled,
    eo.extname as extension_name,
    pg_catalog.string_agg(distinct x.privilege_type,', ' order by x.privilege_type) as public_privileges,
    pg_catalog.bool_or(x.privilege_type='SELECT') as public_can_select,
    pg_catalog.bool_or(x.privilege_type in
      ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'))
      or (c.relkind='S' and pg_catalog.bool_or(x.privilege_type in ('USAGE','UPDATE')))
      as public_can_modify
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  left join extension_objects eo on eo.classid='pg_class'::pg_catalog.regclass and eo.objid=c.oid
  where x.grantee=0
    and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname !~ '^pg_toast'
  group by c.oid,n.nspname,c.relname,c.relkind,c.relowner,c.relrowsecurity,eo.extname
),
readable as (
  select *,
    case relkind when 'r' then 'table' when 'p' then 'partitioned table'
      when 'v' then 'view' when 'm' then 'materialized view' when 'S' then 'sequence'
      else relkind::text end as object_type,
    case
      when schema_name in ('auth','storage','vault','realtime','supabase_functions','net')
        then 'managed authentication/storage/secret/infrastructure data; potentially sensitive'
      when schema_name='public' and object_name='payment_requests'
        then 'PayLink application payment data; sensitive'
      when schema_name='public' and extension_name is null
        then 'application or user-created public-schema data; sensitivity requires owner review'
      when extension_name is not null
        then 'extension-owned relation; usually metadata, but catalog ownership alone does not prove contents are harmless'
      else 'non-system relation; sensitivity requires owner review'
    end as data_classification
  from public_relation_acl
  where public_can_select
)
select
  schema_name,
  object_name,
  object_type,
  owner,
  public_privileges,
  coalesce(extension_name,'') as extension_name,
  rls_enabled,
  data_classification,
  case
    when public_can_modify then false
    when schema_name in ('auth','storage','vault','realtime','supabase_functions','net') then false
    when schema_name='public' and object_name='payment_requests' then false
    when extension_name is null then false
    else true
  end as provisionally_safe_for_settlement_executor,
  case
    when public_can_modify then 'unsafe: PUBLIC has a modification privilege'
    when schema_name in ('auth','storage','vault','realtime','supabase_functions','net')
      then 'unsafe: publicly readable managed or sensitive schema'
    when schema_name='public' and object_name='payment_requests'
      then 'unsafe: publicly readable PayLink payment table'
    when extension_name is null
      then 'not approved: non-extension relation requires explicit data-owner review'
    else 'likely expected extension metadata with read-only PUBLIC access; confirm the extension purpose and returned object names before approval'
  end as safety_assessment
from readable
order by schema_name,object_name;
