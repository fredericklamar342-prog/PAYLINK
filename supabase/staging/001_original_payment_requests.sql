-- STAGING SETUP ONLY. Run only in the disposable paylink-staging Supabase project.
-- This creates no users and copies no production data. It does not run migration 003.
-- The transaction refuses an existing table, wrong PostgreSQL patch version, or unexpected role.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if current_setting('server_version_num')::integer <> 170011 then
    raise exception 'STOP: rehearsal requires PostgreSQL 17.11; found %',
      current_setting('server_version');
  end if;
  if current_user <> 'postgres'
    or not (select rolcreaterole from pg_catalog.pg_roles where rolname = current_user)
    or (select rolsuper from pg_catalog.pg_roles where rolname = current_user) then
    raise exception 'STOP: expected non-superuser postgres SQL Editor role with CREATEROLE';
  end if;
  if pg_catalog.to_regclass('public.payment_requests') is not null then
    raise exception 'STOP: public.payment_requests already exists; nothing was changed';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon')
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    raise exception 'STOP: expected Supabase anon and authenticated roles';
  end if;
  if pg_catalog.to_regrole('paylink_request_api') is not null
    or pg_catalog.to_regprocedure(
      'public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)'
    ) is not null
    or pg_catalog.to_regprocedure('public.paylink_get_payment_request_v2(uuid)') is not null then
    raise exception 'STOP: migration 003 objects already exist';
  end if;
end;
$$;

create table public.payment_requests (
  id uuid not null default pg_catalog.gen_random_uuid(),
  creator_wallet text null,
  recipient_wallet text not null,
  amount numeric not null,
  token_symbol text not null default 'USDC'::text,
  description text null,
  network text not null default 'Monad Testnet'::text,
  status text not null default 'pending'::text,
  transaction_hash text null,
  expires_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone null,
  constraint payment_requests_pkey primary key (id),
  constraint payment_requests_amount_check check (amount > 0),
  constraint payment_requests_status_check check (status = any (array[
    'pending'::text, 'paid'::text, 'failed'::text
  ]))
);

create index payment_requests_status_idx
  on public.payment_requests using btree (status);
create index payment_requests_created_at_idx
  on public.payment_requests using btree (created_at);

alter table public.payment_requests enable row level security;

-- Reproduce the confirmed broad direct browser-role grants, including TRUNCATE and MAINTAIN
-- on PostgreSQL 17. No PUBLIC or speculative column ACL is added without production evidence.
grant all privileges on table public.payment_requests to anon, authenticated;

do $$
begin
  if (select count(*) from pg_catalog.pg_attribute
      where attrelid = 'public.payment_requests'::regclass
        and attnum > 0 and not attisdropped) <> 12
    or exists (select 1 from public.payment_requests)
    or not (select relrowsecurity from pg_catalog.pg_class
      where oid = 'public.payment_requests'::regclass)
    or exists (select 1 from pg_catalog.pg_policy
      where polrelid = 'public.payment_requests'::regclass) then
    raise exception 'STOP: staging fixture verification failed; transaction rolled back';
  end if;
end;
$$;

commit;
