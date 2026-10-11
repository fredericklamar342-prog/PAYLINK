-- SUPERSEDED: actual columns are recipient_wallet/token_symbol/network text/status pending.
-- DO NOT RUN. Retained as historical draft; use 003_adapt_verified_payment_requests.sql.
-- Production table exists. Its actual column definitions/dependencies have NOT been supplied.
-- This proposal supports the explicit shape checked below; it is NOT a verified migration
-- for an unknown 12-column table. Any incompatible shape aborts the whole transaction.
-- No row deletion, table recreation, rename, column type conversion, or function replacement.
-- Specifically review: the exact MON-only check replacement, grants, two optional columns,
-- dedicated NOLOGIN role, its membership, policies, new indexes and versioned functions.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Short exclusive lock prevents concurrent DDL/data changes between preflight and adaptation.
lock table public.payment_requests in access exclusive mode;
do $$
declare
  expected record;
  actual record;
  token_check record;
begin
  if not exists (select 1 from pg_class where oid = 'public.payment_requests'::regclass
      and relkind = 'r' and relrowsecurity) then
    raise exception 'STOP: expected an ordinary existing table with RLS enabled';
  end if;
  for expected in select * from (values
    ('id','uuid'), ('recipient','text'), ('recipient_name','text'),
    ('description','text'), ('token','text'), ('network','integer'),
    ('status','text'), ('created_at','timestamp with time zone'),
    ('expires_at','timestamp with time zone')
  ) as required(name, type) loop
    select format_type(a.atttypid, a.atttypmod) as type, a.attgenerated, a.attidentity
      into actual from pg_attribute a where a.attrelid = 'public.payment_requests'::regclass
      and a.attname = expected.name and not a.attisdropped;
    if not found or actual.type <> expected.type or actual.attgenerated <> '' or actual.attidentity <> '' then
      raise exception 'STOP: column % must be ordinary %, review actual schema', expected.name, expected.type;
    end if;
  end loop;
  select * into actual from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_requests' and column_name = 'amount';
  if not found or actual.is_generated <> 'NEVER' or actual.is_identity <> 'NO'
    or not (actual.data_type = 'text' or (actual.data_type = 'numeric' and
      (actual.numeric_precision is null or
       (actual.numeric_scale >= 18 and actual.numeric_precision - actual.numeric_scale >= 9)))) then
    raise exception 'STOP: amount must be text or exact numeric supporting 9 integer and 18 fractional digits; no automatic conversion';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'payment_requests' and column_name in ('owner_id','client_request_id')
      and (data_type <> 'uuid' or is_generated <> 'NEVER' or is_identity <> 'NO')) then
    raise exception 'STOP: existing identity columns have incompatible types';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'payment_requests' and column_name not in
      ('id','amount','recipient','recipient_name','description','token','network','status',
       'created_at','expires_at','owner_id','client_request_id')
      and is_nullable = 'NO' and column_default is null and is_generated = 'NEVER' and is_identity = 'NO') then
    raise exception 'STOP: extra required columns need an explicitly reviewed insert mapping';
  end if;
  if not exists (select 1 from pg_constraint c join pg_attribute a on
      a.attrelid = c.conrelid and a.attname = 'id'
      where c.conrelid = 'public.payment_requests'::regclass and c.contype = 'p'
      and c.conkey = array[a.attnum]) then
    raise exception 'STOP: expected the existing primary key to be id alone';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: existing policies require review; none will be replaced';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.payment_requests'::regclass and not tgisinternal) then
    raise exception 'STOP: existing user triggers require review';
  end if;
  if exists (select 1 from pg_rewrite r join pg_depend d on d.classid = 'pg_rewrite'::regclass
      and d.objid = r.oid where d.refobjid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: existing rules/views require a dependency review';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and
      (p.prosrc ilike '%payment_requests%' or p.proname in
       ('create_payment_request','get_payment_request','paylink_create_payment_request_v2','paylink_get_payment_request_v2'))) then
    raise exception 'STOP: existing functions require ownership/grant/dependency review; no functions are replaced';
  end if;
  if exists (select 1 from pg_roles where rolname = 'paylink_request_api') then
    raise exception 'STOP: dedicated role already exists; review its membership and privileges';
  end if;
  -- Only this exact historical MON-only check is eligible for replacement after approval.
  for token_check in select c.conname, pg_get_expr(c.conbin,c.conrelid) as expression
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attname = 'token'
      where c.conrelid = 'public.payment_requests'::regclass and c.contype = 'c'
      and a.attnum = any(c.conkey) loop
    if token_check.conname <> 'payment_requests_token_check'
      or token_check.expression <> '(token = ''MON''::text)' then
      raise exception 'STOP: unreviewed token constraint %; preserve and adapt explicitly', token_check.conname;
    end if;
  end loop;
end;
$$;

-- Missing identity columns are additive and nullable for historical rows. No ownership is invented.
alter table public.payment_requests add column if not exists owner_id uuid;
alter table public.payment_requests add column if not exists client_request_id uuid;
-- Existing foreign keys are preserved. Add the Auth relationship only if not already present.
do $$
begin
  if not exists (select 1 from pg_constraint c join pg_attribute a on
      a.attrelid = c.conrelid and a.attname = 'owner_id'
      join pg_attribute b on b.attrelid = c.confrelid and b.attname = 'id'
      where c.conrelid = 'public.payment_requests'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass and c.conkey = array[a.attnum] and c.confkey = array[b.attnum]) then
    alter table public.payment_requests add constraint paylink_owner_auth_fk
      foreign key (owner_id) references auth.users(id) on delete restrict;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.payment_requests'::regclass
      and conname = 'payment_requests_token_check') then
    -- Preflight checked both name and exact definition; this is the sole replaced constraint.
    alter table public.payment_requests drop constraint payment_requests_token_check;
  end if;
end;
$$;
alter table public.payment_requests add constraint paylink_supported_token_v2
  check (token is not null and token in ('MON','USDC'));
-- NOT VALID preserves historical rows without rewriting them; enforced for all new/updated rows.
-- Validate separately after the audit confirms all existing rows satisfy the new contract.
alter table public.payment_requests add constraint paylink_request_values_v2 check (
  owner_id is not null and client_request_id is not null and network = 10143 and network is not null
  and status = 'unpaid' and status is not null
  and amount is not null and amount::numeric > 0 and amount::numeric < 1000000000
  and amount::numeric = trunc(amount::numeric, case token when 'USDC' then 6 else 18 end)
  and recipient is not null and recipient ~ '^0x[0-9a-fA-F]{40}$'
  and lower(recipient) <> '0x0000000000000000000000000000000000000000'
  and recipient_name is not null and char_length(recipient_name) <= 50
  and description is not null and char_length(btrim(description)) between 1 and 140
  and created_at is not null and isfinite(created_at)
  and (expires_at is null or (isfinite(expires_at) and expires_at > created_at))
) not valid;
create unique index paylink_owner_submission_v2 on public.payment_requests (owner_id, client_request_id);
create index paylink_owner_created_v2 on public.payment_requests (owner_id, created_at desc);

-- This role cannot log in, bypass RLS, update/delete rows, or create schema objects.
create role paylink_request_api nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant paylink_request_api to postgres; -- trusted SQL Editor administrator only; review explicitly
grant usage on schema public, auth to paylink_request_api;
grant execute on function auth.uid() to paylink_request_api;
grant select, insert on public.payment_requests to paylink_request_api;
-- Remove both table-level AND column-level public/client grants (review application dependencies).
revoke all on public.payment_requests from public, anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ') into cols from pg_attribute
    where attrelid = 'public.payment_requests'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all (%s) on public.payment_requests from public, anon, authenticated', cols);
end;
$$;
grant select on public.payment_requests to authenticated;
create policy paylink_owner_read_v2 on public.payment_requests for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy paylink_rpc_read_v2 on public.payment_requests for select to paylink_request_api using (true);
create policy paylink_rpc_insert_v2 on public.payment_requests for insert to paylink_request_api
  with check ((select auth.uid()) = owner_id and status = 'unpaid' and network = 10143);
-- No UPDATE/DELETE policy or privilege is granted. RLS remains enabled throughout.

create function public.paylink_get_payment_request_v2(p_id uuid)
returns table (id uuid, amount text, recipient text, recipient_name text, description text,
  token text, network integer, status text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, case when pg_typeof(r.amount)::text = 'text' then r.amount::text
    else pg_catalog.trim_scale(r.amount::numeric)::text end,
    r.recipient, r.recipient_name, r.description, r.token, r.network, r.status, r.created_at, r.expires_at
  from public.payment_requests r where r.id = p_id;
$$;

create function public.paylink_create_payment_request_v2(
  p_client_request_id uuid, p_amount text, p_recipient text, p_recipient_name text,
  p_description text, p_expires_at timestamptz, p_token text, p_network integer
)
returns table (id uuid, amount text, recipient text, recipient_name text, description text,
  token text, network integer, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  creator uuid := auth.uid();
  saved public.payment_requests%rowtype;
  incoming public.payment_requests%rowtype;
begin
  if creator is null then raise sqlstate 'PT403' using message = 'Authentication required'; end if;
  if p_client_request_id is null or p_client_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_token is null or p_token not in ('MON','USDC') or p_network is distinct from 10143
    or p_amount is null or p_amount !~ ('^(0|[1-9][0-9]{0,8})(\.[0-9]{1,' || case p_token when 'USDC' then '6' else '18' end || '})?$')
    or p_recipient is null or p_recipient !~ '^0x[0-9a-fA-F]{40}$'
    or lower(p_recipient) = '0x0000000000000000000000000000000000000000'
    or p_recipient_name is null or char_length(p_recipient_name) > 50
    or p_description is null or char_length(btrim(p_description)) not between 1 and 140 then
    raise sqlstate 'PT400' using message = 'Invalid payment request';
  end if;
  if p_amount::numeric <= 0 then raise sqlstate 'PT400' using message = 'Amount must be positive'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(creator::text, 0));
  select * into saved from public.payment_requests r
    where r.owner_id = creator and r.client_request_id = p_client_request_id;
  if found then
    if saved.amount::numeric is distinct from p_amount::numeric or lower(saved.recipient) is distinct from lower(p_recipient)
      or saved.recipient_name is distinct from btrim(p_recipient_name) or saved.description is distinct from btrim(p_description)
      or saved.expires_at is distinct from p_expires_at or saved.token is distinct from p_token
      or saved.network is distinct from p_network then
      raise sqlstate 'PT409' using message = 'Submission already used with different details';
    end if;
  else
    if (select count(*) from public.payment_requests r where r.owner_id = creator
      and r.created_at > now() - interval '1 hour') >= 30 then
      raise sqlstate 'PT429' using message = 'Creation limit reached';
    end if;
    if p_expires_at is not null and (not pg_catalog.isfinite(p_expires_at) or p_expires_at <= now()) then
      raise sqlstate 'PT400' using message = 'Expiry must be in the future';
    end if;
    -- PostgreSQL casts the validated decimal TEXT to the existing text/numeric column type.
    -- No JS float, numeric column conversion, or rounding of accepted values is involved.
    select * into incoming from pg_catalog.jsonb_populate_record(null::public.payment_requests,
      pg_catalog.jsonb_build_object('amount', p_amount));
    insert into public.payment_requests
      (id, owner_id, client_request_id, amount, recipient, recipient_name, description,
       token, network, status, created_at, expires_at)
    values (pg_catalog.gen_random_uuid(), creator, p_client_request_id, incoming.amount,
      lower(p_recipient), btrim(p_recipient_name), btrim(p_description), p_token, p_network, 'unpaid', now(), p_expires_at)
    returning * into saved;
  end if;
  return query select * from public.paylink_get_payment_request_v2(saved.id);
end;
$$;

-- PostgreSQL requires CREATE on the containing schema during ownership transfer.
-- Grant only inside this transaction and revoke before commit.
grant create on schema public to paylink_request_api;
alter function public.paylink_get_payment_request_v2(uuid) owner to paylink_request_api;
alter function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) owner to paylink_request_api;
revoke create on schema public from paylink_request_api;
do $$
begin
  if has_schema_privilege('paylink_request_api', 'public', 'CREATE') then
    raise exception 'STOP: inherited schema CREATE privilege requires separate review; no global privileges changed';
  end if;
end;
$$;
revoke all on function public.paylink_get_payment_request_v2(uuid) from public, anon, authenticated;
revoke all on function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) from public, anon, authenticated;
grant execute on function public.paylink_get_payment_request_v2(uuid) to anon, authenticated;
grant execute on function public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer) to authenticated;
-- Function owner remains subject to RLS via the explicit dedicated-role policies above.
-- Do not grant membership in paylink_request_api to anon, authenticated, or application logins.
notify pgrst, 'reload schema';
commit;
