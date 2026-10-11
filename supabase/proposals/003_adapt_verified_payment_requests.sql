-- REVIEW ONLY. Never executed against production. See ../MIGRATION_REVIEW.md for disposable tests.
-- DO NOT run proposals 001/002. This file does not drop/recreate/rename the table or existing columns.
-- All existing defaults, constraints and indexes are preserved. No data backfill is performed.
-- Before approval: inspect audit-payment-requests.sql, exact check definitions, grants, dependencies
-- and external consumers; rehearse on an isolated schema copy. Read ../ROLLBACK.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.payment_requests in access exclusive mode;

do $$
declare expected record; actual record; sample jsonb; check_result boolean;
begin
  -- Supabase SQL Editor normally runs as postgres. Role creation and ownership transfer
  -- need CREATEROLE, and ALTER TABLE needs ownership (or superuser). Stop before DDL otherwise.
  if not exists (select 1 from pg_catalog.pg_roles where rolname=current_user and rolcreaterole)
    or not (pg_catalog.pg_has_role(current_user,
      (select relowner from pg_catalog.pg_class where oid='public.payment_requests'::regclass),
      'USAGE') or exists (select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)) then
    raise exception 'STOP: current role lacks reviewed CREATEROLE/table-owner authority';
  end if;
  if not pg_catalog.has_schema_privilege(current_user,'public','USAGE WITH GRANT OPTION')
    or not pg_catalog.has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') then
    raise exception 'STOP: current role cannot grant the reviewed public schema privileges';
  end if;
  if not exists (select 1 from pg_catalog.pg_class where oid = 'public.payment_requests'::regclass
      and relkind = 'r' and relrowsecurity) then
    raise exception 'STOP: expected an ordinary table with RLS already enabled';
  end if;
  -- Owner verified zero rows. If production has changed, stop rather than invent ownership or lose data.
  if exists (select 1 from public.payment_requests limit 1) then
    raise exception 'STOP: table is no longer empty; ownership/backfill needs a separate review';
  end if;
  if (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.payment_requests'::regclass
      and attnum > 0 and not attisdropped) <> 12 then
    raise exception 'STOP: column count changed; do not rerun or adapt automatically';
  end if;
  for expected in select * from (values
    ('id','uuid',true), ('creator_wallet','text',false), ('recipient_wallet','text',true),
    ('amount','numeric',true), ('token_symbol','text',true), ('description','text',false),
    ('network','text',true), ('status','text',true), ('transaction_hash','text',false),
    ('expires_at','timestamp with time zone',false), ('created_at','timestamp with time zone',true),
    ('paid_at','timestamp with time zone',false)
  ) as required(name, type, not_null) loop
    select pg_catalog.format_type(a.atttypid,a.atttypmod) as type, a.attnotnull,
      a.attgenerated, a.attidentity into actual from pg_catalog.pg_attribute a
      where a.attrelid = 'public.payment_requests'::regclass and a.attname = expected.name and not a.attisdropped;
    if not found or actual.type <> expected.type or actual.attnotnull <> expected.not_null
      or actual.attgenerated <> '' or actual.attidentity <> '' then
      raise exception 'STOP: column % differs from the reviewed schema; no type conversion is attempted', expected.name;
    end if;
  end loop;
  -- Preserve all existing checks. Their definitions still need human review, not just their names.
  -- PostgreSQL 18 also catalogs NOT NULL constraints (contype = 'n'); those are checked
  -- through attnotnull above, not counted as additional application checks here.
  if (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.payment_requests'::regclass
      and contype <> 'n') <> 3
    or not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.payment_requests'::regclass
      and conname = 'payment_requests_amount_check' and contype = 'c' and convalidated)
    or not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.payment_requests'::regclass
      and conname = 'payment_requests_status_check' and contype = 'c' and convalidated)
    or not exists (select 1 from pg_catalog.pg_constraint c join pg_catalog.pg_attribute a
      on a.attrelid = c.conrelid and a.attname = 'id'
      where c.conrelid = 'public.payment_requests'::regclass and c.conname = 'payment_requests_pkey'
      and c.contype = 'p' and c.conkey = array[a.attnum]) then
    raise exception 'STOP: constraints changed; existing constraints must be preserved and reviewed';
  end if;
  -- Check actual expressions, not just constraint names, against supported creation values.
  -- Evaluates synthetic records only; never inserts a probe row or changes existing checks.
  for expected in select * from (values
      ('MON','0.000000000000000001'), ('MON','999999999.123456789012345678'),
      ('USDC','0.000001'), ('USDC','999999999.123456')
    ) as supported(token, amount) loop
    sample := jsonb_build_object('id',gen_random_uuid(), 'creator_wallet',null,
      'recipient_wallet','0x1234567890123456789012345678901234567890',
      'amount',expected.amount,'token_symbol',expected.token,'description','Compatibility check',
      'network','Monad Testnet','status','pending','transaction_hash',null,'expires_at',null,
      'created_at',clock_timestamp(),'paid_at',null);
    for actual in select conname, pg_get_expr(conbin,conrelid) as expression
        from pg_catalog.pg_constraint where conrelid='public.payment_requests'::regclass and contype='c' loop
      execute format('select (%s) is not false from (select (jsonb_populate_record(null::public.payment_requests,$1)).*) as payment_requests',actual.expression)
        into check_result using sample;
      if check_result is distinct from true then
        raise exception 'STOP: existing constraint % rejects supported % creation; preserve it and review explicitly',actual.conname,expected.token;
      end if;
    end loop;
  end loop;
  if exists (select 1 from pg_catalog.pg_constraint where confrelid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: incoming foreign keys require dependency review';
  end if;
  if exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: policies already exist; none will be overwritten';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.payment_requests'::regclass and not tgisinternal) then
    raise exception 'STOP: existing user triggers require review';
  end if;
  if exists (select 1 from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d
      on d.classid = 'pg_rewrite'::regclass and d.objid = r.oid
      where d.refclassid = 'pg_class'::regclass and d.refobjid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: dependent rules/views require review';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog','information_schema') and p.prokind = 'f'
      and (p.prosrc ilike '%payment_requests%' or p.proname in
        ('create_payment_request','get_payment_request','paylink_create_payment_request_v2','paylink_get_payment_request_v2')
        or exists (select 1 from pg_catalog.pg_depend d where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid and d.refclassid = 'pg_class'::regclass
          and d.refobjid = 'public.payment_requests'::regclass))) then
    raise exception 'STOP: existing request functions require dependency/permission review';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'paylink_request_api') then
    raise exception 'STOP: dedicated role already exists; review before proceeding';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
    or exists (select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
      where r.rolname in ('anon','authenticated')) then
    raise exception 'STOP: client role bypass/membership needs a separate security review';
  end if;
  -- Expected Supabase direction is the reverse: authenticator/postgres/system roles can be
  -- members OF anon/authenticated. That does not grant their privileges back to browser roles.
end;
$$;

-- Additive only: the locked table is empty, so no fabricated historical ownership is needed.
alter table public.payment_requests
  add column owner_id uuid not null references auth.users(id) on delete restrict,
  add column client_request_id uuid not null,
  add column recipient_name text not null default '';
alter table public.payment_requests add constraint paylink_owner_submission_v2 unique (owner_id, client_request_id);
create index paylink_owner_created_v2 on public.payment_requests (owner_id, created_at desc);
-- Keep the original amount/status constraints, all existing defaults and all existing indexes.
alter table public.payment_requests add constraint paylink_request_values_v2 check (
  token_symbol in ('MON','USDC') and network = 'Monad Testnet'
  and amount > 0 and amount < 1000000000
  and amount = trunc(amount, case token_symbol when 'USDC' then 6 else 18 end)
  and recipient_wallet ~ '^0x[0-9a-fA-F]{40}$'
  and lower(recipient_wallet) <> '0x0000000000000000000000000000000000000000'
  and char_length(recipient_name) <= 50
  and description is not null and char_length(btrim(description)) between 1 and 140
  and isfinite(created_at)
  and (expires_at is null or (isfinite(expires_at) and expires_at > created_at))
);

-- Explicitly reviewed grant changes. No status/hash/paid_at write path for any browser role.
create role paylink_request_api nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
-- PostgreSQL 17 automatically gives a non-superuser CREATEROLE creator ADMIN TRUE,
-- INHERIT FALSE, SET FALSE membership, granted by the bootstrap superuser. That ADMIN grant
-- cannot be removed by postgres. Add SET for ownership transfer while keeping INHERIT false.
grant paylink_request_api to postgres with inherit false;
grant paylink_request_api to postgres with set true;
grant usage on schema public to paylink_request_api;
grant select, insert on public.payment_requests to paylink_request_api;
revoke all on public.payment_requests from public, anon, authenticated;
-- Table-level revocation alone would leave any pre-existing column grants intact.
do $$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ') into cols from pg_catalog.pg_attribute
    where attrelid = 'public.payment_requests'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all (%s) on public.payment_requests from public, anon, authenticated', cols);
end;
$$;
grant select on public.payment_requests to authenticated;
create policy paylink_owner_read_v2 on public.payment_requests for select to authenticated
  using ((select nullif(coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
    nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
  ),'')::uuid) = owner_id);
create policy paylink_rpc_read_v2 on public.payment_requests for select to paylink_request_api using (true);
create policy paylink_rpc_insert_v2 on public.payment_requests for insert to paylink_request_api
  with check ((select nullif(coalesce(
      nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
      nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
    ),'')::uuid) = owner_id and status = 'pending'
    and transaction_hash is null and paid_at is null and creator_wallet is null
    and network = 'Monad Testnet' and token_symbol in ('MON','USDC'));
-- No UPDATE/DELETE policy. The dedicated role is neither table owner nor a BYPASSRLS role.

create function public.paylink_get_payment_request_v2(p_id uuid)
returns table (id uuid, amount text, recipient_wallet text, recipient_name text, description text,
  token_symbol text, network text, status text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  -- numeric is rendered as TEXT before PostgREST/JavaScript see it. Remove insignificant zeroes.
  select r.id, pg_catalog.trim_scale(r.amount)::text, r.recipient_wallet, r.recipient_name,
    r.description, r.token_symbol, r.network, r.status, r.created_at, r.expires_at
  from public.payment_requests r
  where r.id = p_id and r.network = 'Monad Testnet' and r.token_symbol in ('MON','USDC')
    and r.status = 'pending' and r.transaction_hash is null and r.paid_at is null;
$$;

create function public.paylink_create_payment_request_v2(
  p_client_request_id uuid, p_amount text, p_recipient_wallet text, p_recipient_name text,
  p_description text, p_expires_at timestamptz, p_token_symbol text, p_chain_id integer
)
returns table (id uuid, amount text, recipient_wallet text, recipient_name text, description text,
  token_symbol text, network text, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare creator uuid := nullif(coalesce(
  nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
  nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
),'')::uuid; saved public.payment_requests%rowtype; creation_time timestamptz;
begin
  if creator is null then raise sqlstate 'PT403' using message = 'Authentication required'; end if;
  if p_client_request_id is null or p_client_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_token_symbol is null or p_token_symbol not in ('MON','USDC') or p_chain_id is distinct from 10143
    or p_amount is null or p_amount !~ ('^(0|[1-9][0-9]{0,8})(\.[0-9]{1,' || case p_token_symbol when 'USDC' then '6' else '18' end || '})?$')
    or p_recipient_wallet is null or p_recipient_wallet !~ '^0x[0-9a-fA-F]{40}$'
    or lower(p_recipient_wallet) = '0x0000000000000000000000000000000000000000'
    or p_recipient_name is null or char_length(p_recipient_name) > 50
    or p_description is null or char_length(btrim(p_description)) not between 1 and 140 then
    raise sqlstate 'PT400' using message = 'Invalid payment request';
  end if;
  if p_amount::numeric <= 0 then raise sqlstate 'PT400' using message = 'Amount must be positive'; end if;
  -- Serializes same-owner retries and the rolling quota across processes/transactions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(creator::text, 0));
  select * into saved from public.payment_requests r
    where r.owner_id = creator and r.client_request_id = p_client_request_id;
  if found then
    if saved.amount is distinct from p_amount::numeric
      or lower(saved.recipient_wallet) is distinct from lower(p_recipient_wallet)
      or saved.recipient_name is distinct from btrim(p_recipient_name)
      or saved.description is distinct from btrim(p_description)
      or saved.expires_at is distinct from p_expires_at or saved.token_symbol is distinct from p_token_symbol
      or saved.network is distinct from 'Monad Testnet' then
      raise sqlstate 'PT409' using message = 'Submission already used with different details';
    end if;
  else
    -- now() is the transaction start, which can precede a lock wait. Use actual creation time.
    creation_time := pg_catalog.clock_timestamp();
    if (select count(*) from public.payment_requests r where r.owner_id = creator
      and r.created_at > creation_time - interval '1 hour') >= 30 then
      raise sqlstate 'PT429' using message = 'Creation limit reached';
    end if;
    if p_expires_at is not null and (not pg_catalog.isfinite(p_expires_at) or p_expires_at <= creation_time) then
      raise sqlstate 'PT400' using message = 'Expiry must be in the future';
    end if;
    insert into public.payment_requests
      (id, owner_id, client_request_id, recipient_name, creator_wallet, recipient_wallet,
       amount, token_symbol, description, network, status, transaction_hash, paid_at, created_at, expires_at)
    values (pg_catalog.gen_random_uuid(), creator, p_client_request_id, btrim(p_recipient_name), null,
      lower(p_recipient_wallet), p_amount::numeric, p_token_symbol, btrim(p_description),
      'Monad Testnet', 'pending', null, null, creation_time, p_expires_at)
    returning * into saved;
  end if;
  return query select * from public.paylink_get_payment_request_v2(saved.id);
end;
$$;

-- Set ACLs while postgres still owns the functions. With INHERIT FALSE on its membership,
-- postgres does not implicitly retain owner authority after the ownership transfer.
revoke all on function public.paylink_get_payment_request_v2(uuid) from public, anon, authenticated;
revoke all on function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) from public, anon, authenticated;
grant execute on function public.paylink_get_payment_request_v2(uuid) to anon, authenticated;
grant execute on function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) to authenticated;
-- New owner needs schema CREATE only for ownership transfer; revoke before commit.
grant create on schema public to paylink_request_api;
alter function public.paylink_get_payment_request_v2(uuid) owner to paylink_request_api;
alter function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) owner to paylink_request_api;
revoke create on schema public from paylink_request_api;
do $$
begin
  if has_schema_privilege('paylink_request_api','public','CREATE') then
    raise exception 'STOP: inherited PUBLIC schema CREATE requires separate review';
  end if;
  if pg_has_role('anon','paylink_request_api','MEMBER')
    or pg_has_role('authenticated','paylink_request_api','MEMBER') then
    raise exception 'STOP: a browser role can inherit or SET ROLE to the function owner';
  end if;
  if not pg_has_role('postgres','paylink_request_api','SET')
    or pg_has_role('postgres','paylink_request_api','USAGE')
    or not pg_has_role('postgres','paylink_request_api','MEMBER WITH ADMIN OPTION') then
    raise exception 'STOP: administrator function-owner membership options do not match';
  end if;
  -- Comma-separated privileges mean ANY, not ALL. This is intentional for denial checks.
  -- Do not add authenticated SELECT to these lists: owner reads are explicitly permitted.
  if has_table_privilege('anon','public.payment_requests','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or has_any_column_privilege('anon','public.payment_requests','SELECT,INSERT,UPDATE,REFERENCES')
    or has_table_privilege('authenticated','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or has_any_column_privilege('authenticated','public.payment_requests','INSERT,UPDATE,REFERENCES') then
    raise exception 'STOP: inherited client privileges remain; review separately';
  end if;
  -- Positive requirements need independent checks: a combined 'SELECT,INSERT' would be insufficient.
  if not has_table_privilege('authenticated','public.payment_requests','SELECT')
    or not has_table_privilege('paylink_request_api','public.payment_requests','SELECT')
    or not has_table_privilege('paylink_request_api','public.payment_requests','INSERT')
    or has_table_privilege('paylink_request_api','public.payment_requests','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or has_any_column_privilege('paylink_request_api','public.payment_requests','UPDATE,REFERENCES') then
    raise exception 'STOP: required restricted role privileges do not match';
  end if;
  if has_function_privilege('anon','public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)','EXECUTE')
    or not has_function_privilege('anon','public.paylink_get_payment_request_v2(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.paylink_get_payment_request_v2(uuid)','EXECUTE') then
    raise exception 'STOP: RPC execution privileges do not match';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
