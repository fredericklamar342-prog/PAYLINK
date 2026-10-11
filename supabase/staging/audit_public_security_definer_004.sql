-- READ ONLY. Run in paylink-staging before enabling any settlement executor login.
-- Returns SECURITY DEFINER routines that the proposed executor could call through
-- PUBLIC privileges. Zero rows is the desired result.
with extension_objects as (
  select d.classid, d.objid, e.extname
  from pg_catalog.pg_depend d
  join pg_catalog.pg_extension e on e.oid = d.refobjid
  where d.refclassid = 'pg_extension'::pg_catalog.regclass
    and d.deptype = 'e'
)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  l.lanname as language,
  coalesce(eo.extname, '') as extension_name,
  p.prosecdef as security_definer,
  pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  pg_catalog.has_schema_privilege('public', n.oid, 'USAGE') as public_schema_usage,
  (n.nspname = 'public'
    or pg_catalog.has_schema_privilege('public', n.oid, 'USAGE')) as proposed_executor_schema_access,
  (pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
    and (n.nspname = 'public'
      or pg_catalog.has_schema_privilege('public', n.oid, 'USAGE'))) as callable_by_proposed_executor,
  p.proconfig as function_configuration,
  pg_catalog.pg_get_function_result(p.oid) as result_type,
  pg_catalog.pg_get_functiondef(p.oid) as function_definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
left join extension_objects eo
  on eo.classid = 'pg_proc'::pg_catalog.regclass and eo.objid = p.oid
where p.prosecdef
  and pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
  and (n.nspname = 'public'
    or pg_catalog.has_schema_privilege('public', n.oid, 'USAGE'))
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname !~ '^pg_toast'
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);
