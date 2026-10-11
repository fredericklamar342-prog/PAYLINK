-- READ ONLY. Identifies the exact PUBLIC grants behind the pre-executor compact gate.
-- Run in paylink-staging and review every returned row. This changes nothing.
with
extension_objects as (
  select d.classid,d.objid,e.extname
  from pg_catalog.pg_depend d join pg_catalog.pg_extension e on e.oid=d.refobjid
  where d.refclassid='pg_extension'::pg_catalog.regclass and d.deptype='e'
),
schema_grants as (
  select 'schema'::text object_type,n.nspname schema_name,n.nspname object_name,
    x.privilege_type,x.is_grantable,pg_catalog.pg_get_userbyid(n.nspowner) owner,
    null::boolean row_security,eo.extname,
    case
      when x.privilege_type='CREATE' then 'critical: every new role can create objects in this schema'
      when x.privilege_type='USAGE' then 'normal only if no unsafe objects in the schema are PUBLIC-callable/readable'
      else 'review'
    end assessment
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) x
  left join extension_objects eo on eo.classid='pg_namespace'::pg_catalog.regclass and eo.objid=n.oid
  where x.grantee=0 and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
),
relation_grants as (
  select case c.relkind when 'S' then 'sequence' when 'v' then 'view'
      when 'm' then 'materialized view' else 'table' end::text object_type,
    n.nspname schema_name,n.nspname||'.'||c.relname object_name,
    x.privilege_type,x.is_grantable,pg_catalog.pg_get_userbyid(c.relowner) owner,
    c.relrowsecurity row_security,eo.extname,
    case
      when x.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN')
        then 'critical: PUBLIC can modify or control a relation'
      when c.relkind='S' and x.privilege_type in ('USAGE','UPDATE')
        then 'critical: PUBLIC can consume or change a sequence'
      when x.privilege_type='SELECT' and eo.extname is not null
        then 'review: extension-owned data is publicly readable; often intentional metadata'
      when x.privilege_type='SELECT'
        then 'confidentiality blocker unless this relation is intentionally public'
      else 'review relation privilege'
    end assessment
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  left join extension_objects eo on eo.classid='pg_class'::pg_catalog.regclass and eo.objid=c.oid
  where x.grantee=0 and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
),
function_grants as (
  select 'function'::text object_type,n.nspname schema_name,
    n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')' object_name,
    x.privilege_type,x.is_grantable,pg_catalog.pg_get_userbyid(p.proowner) owner,
    null::boolean row_security,eo.extname,
    case
      when p.prosecdef then 'critical review: PUBLIC can execute a SECURITY DEFINER function'
      when eo.extname is not null then 'review: PUBLIC execute is common for extension functions; inspect capabilities'
      else 'review: PostgreSQL defaults new functions to PUBLIC EXECUTE'
    end assessment
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
  left join extension_objects eo on eo.classid='pg_proc'::pg_catalog.regclass and eo.objid=p.oid
  where x.grantee=0 and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
),
all_grants as (
  select * from schema_grants union all select * from relation_grants union all select * from function_grants
)
select object_type,schema_name,object_name,privilege_type,is_grantable,owner,row_security,
  coalesce(extname,'') extension,assessment
from all_grants
order by
  case when assessment like 'critical:%' or assessment like 'critical review:%' then 0
       when assessment like 'confidentiality blocker%' then 1 else 2 end,
  object_type,schema_name,object_name,privilege_type;

-- Exact causes of the current compact assertion. This reproduces its logic and adds identity.
with causes as (
  select 'schema CREATE'::text cause,n.nspname object_name,x.privilege_type
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) x
  where x.grantee=0 and x.privilege_type='CREATE'
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_'
  union all
  select 'relation grant (current gate includes every privilege)',n.nspname||'.'||c.relname,x.privilege_type
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  where x.grantee=0 and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
)
select cause,object_name,privilege_type from causes order by cause,object_name,privilege_type;

-- Refined summary separates modification capability from read-only exposure.
with grants as (
  select 'schema'::text object_type,n.nspname object_name,x.privilege_type,null::"char" relkind
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) x
  where x.grantee=0 and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_'
  union all
  select 'relation',n.nspname||'.'||c.relname,x.privilege_type,c.relkind
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x
  where x.grantee=0 and c.relkind in ('r','p','v','m','S')
    and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
)
select
  not exists(select 1 from grants where
    (object_type='schema' and privilege_type='CREATE')
    or (object_type='relation' and privilege_type in
      ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'))
    or (object_type='relation' and relkind='S' and privilege_type in ('USAGE','UPDATE')))
    as no_public_modification_capability,
  not exists(select 1 from grants where object_type='relation' and privilege_type='SELECT')
    as no_public_relation_read_access,
  (select count(*) from grants where object_type='relation' and privilege_type='SELECT')
    as publicly_readable_relation_count;
