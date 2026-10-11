-- READ ONLY. Run in paylink-staging before migration 004.
-- The executor role does not exist yet; this inventories privileges every newly created role
-- would inherit from PostgreSQL PUBLIC. Review every row before enabling any custom LOGIN.
with public_grants(object_type,object_name,privilege,source) as (
  select 'database',pg_catalog.quote_ident(d.datname),x.privilege_type,'database ACL'
  from pg_catalog.pg_database d
  cross join lateral pg_catalog.aclexplode(
    coalesce(d.datacl,pg_catalog.acldefault('d',d.datdba))
  ) x
  where d.datname=current_database() and x.grantee=0
  union all
  select 'schema',pg_catalog.quote_ident(n.nspname),x.privilege_type,'schema ACL'
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(
    coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))
  ) x
  where x.grantee=0 and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname !~ '^pg_toast'
  union all
  select case c.relkind when 'S' then 'sequence' when 'v' then 'view'
      when 'm' then 'materialized view' else 'table' end,
    pg_catalog.quote_ident(n.nspname)||'.'||pg_catalog.quote_ident(c.relname),
    x.privilege_type,'relation ACL'
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  where x.grantee=0 and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
  union all
  select 'function',pg_catalog.quote_ident(n.nspname)||'.'||p.proname||'('
      ||pg_catalog.pg_get_function_identity_arguments(p.oid)||')',
    x.privilege_type,'function ACL'
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))
  ) x
  where x.grantee=0 and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname !~ '^pg_toast'
  union all
  select 'default privilege',coalesce(pg_catalog.quote_ident(n.nspname),'all schemas')
      ||' owner='||pg_catalog.pg_get_userbyid(d.defaclrole),
    x.privilege_type,'ALTER DEFAULT PRIVILEGES for object type '||d.defaclobjtype::text
  from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
  cross join lateral pg_catalog.aclexplode(d.defaclacl) x
  where x.grantee=0
), classified as (
  select *,case
    when object_type='database' and privilege in ('CONNECT','TEMPORARY') then 'expected platform surface; review'
    when object_type='schema' and privilege='CREATE' then 'BLOCKER: PUBLIC can create in schema'
    when object_type in ('table','view','materialized view','sequence') then 'BLOCKER: PUBLIC data privilege'
    when object_type='function' then 'review callable function and containing-schema USAGE'
    when object_type='default privilege' then 'review future-object exposure'
    else 'review'
  end as assessment
  from public_grants
)
select object_type,object_name,privilege,source,assessment
from classified
order by case when assessment like 'BLOCKER:%' then 0 else 1 end,object_type,object_name,privilege;

-- Separate compact gate. False means the detailed rows contain a direct PUBLIC blocker.
with public_relation_or_schema_write as (
  select 1 from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) x
  where x.grantee=0 and x.privilege_type='CREATE'
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_'
  union all
  select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  where x.grantee=0 and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
)
select
  not exists(select 1 from public_relation_or_schema_write) as no_direct_public_schema_or_data_blocker,
  'Function EXECUTE, database CONNECT/TEMP, extensions, pg_net and default privileges still require manual review' as limitation;
