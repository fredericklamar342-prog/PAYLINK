-- SUPERSEDED for this project: payment_requests already exists. DO NOT RUN THIS FILE.
-- Historical new-table proposal retained for context. Review 003_adapt_verified_payment_requests.sql instead.
-- This is for a NEW table. If any object already exists, STOP and adapt a migration
-- to the actual schema/policies. Do not drop existing data or replace policies blindly.
-- Entire change is transactional; CREATE deliberately fails on name collisions.
begin;

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  client_request_id uuid not null,
  amount text not null check (
    amount ~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,18})?$' and amount::numeric > 0
  ),
  recipient text not null check (
    recipient ~ '^0x[0-9a-fA-F]{40}$' and lower(recipient) <> '0x0000000000000000000000000000000000000000'
  ),
  recipient_name text not null default '' check (char_length(recipient_name) <= 50),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  token text not null default 'MON' check (token = 'MON'),
  network integer not null default 10143 check (network = 10143),
  status text not null default 'unpaid' check (status = 'unpaid'),
  created_at timestamptz not null default now(),
  expires_at timestamptz check (expires_at > created_at),
  unique (owner_id, client_request_id)
);
create index payment_requests_owner_created_idx on public.payment_requests (owner_id, created_at desc);
alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from public, anon, authenticated;
grant select on public.payment_requests to authenticated;
create policy "Creators can read their own requests" on public.payment_requests
  for select to authenticated using ((select auth.uid()) = owner_id);
-- No public table read/list, no direct INSERT, UPDATE or DELETE permission.
-- No way for a client to set paid status. Ownership comes only from auth.uid().

create function public.create_payment_request(
  p_client_request_id uuid, p_amount text, p_recipient text,
  p_recipient_name text, p_description text, p_expires_at timestamptz
)
returns table (
  id uuid, amount text, recipient text, recipient_name text, description text,
  token text, network integer, status text, created_at timestamptz, expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  creator uuid := auth.uid();
  saved public.payment_requests%rowtype;
begin
  if creator is null then raise sqlstate 'PT403' using message = 'Authentication required'; end if;
  if p_client_request_id is null then raise sqlstate 'PT400' using message = 'Submission identifier required'; end if;
  -- Serializes same-user creation/retries across processes. Also makes the quota atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(creator::text, 0));
  select * into saved from public.payment_requests r
    where r.owner_id = creator and r.client_request_id = p_client_request_id;
  if found then
    if saved.amount is distinct from p_amount or saved.recipient is distinct from p_recipient
       or saved.recipient_name is distinct from p_recipient_name
       or saved.description is distinct from p_description
       or saved.expires_at is distinct from p_expires_at then
      raise sqlstate 'PT409' using message = 'Submission already used with different details';
    end if;
  else
    if (select count(*) from public.payment_requests r
        where r.owner_id = creator and r.created_at > now() - interval '1 hour') >= 30 then
      raise sqlstate 'PT429' using message = 'Creation limit reached';
    end if;
    if p_expires_at is not null and (not pg_catalog.isfinite(p_expires_at) or p_expires_at <= now()) then
      raise sqlstate 'PT400' using message = 'Expiry must be in the future';
    end if;
    insert into public.payment_requests (owner_id, client_request_id, amount, recipient, recipient_name, description, expires_at)
      values (creator, p_client_request_id, p_amount, p_recipient, p_recipient_name, p_description, p_expires_at)
      returning * into saved;
  end if;
  return query select r.id, r.amount, r.recipient, r.recipient_name, r.description,
    r.token, r.network, r.status, r.created_at, r.expires_at
    from public.payment_requests r where r.id = saved.id;
end;
$$;
revoke all on function public.create_payment_request(uuid, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_payment_request(uuid, text, text, text, text, timestamptz) to authenticated;

-- A UUID is the share capability. There is no list/search endpoint or public SELECT policy.
-- Only recipient-facing columns are returned. Never add owner/contact/session fields here.
create function public.get_payment_request(p_id uuid)
returns table (
  id uuid, amount text, recipient text, recipient_name text, description text,
  token text, network integer, status text, created_at timestamptz, expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.amount, r.recipient, r.recipient_name, r.description,
    r.token, r.network, r.status, r.created_at, r.expires_at
  from public.payment_requests r where r.id = p_id;
$$;
revoke all on function public.get_payment_request(uuid) from public;
grant execute on function public.get_payment_request(uuid) to anon, authenticated;

commit;
