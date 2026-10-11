-- DISPOSABLE DATABASE ONLY. Column schema matches the owner's supplied 12-column schema.
-- Confirmed production checks: amount > 0; status in ('pending','paid','failed').
-- Never run this fixture against production.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated;
create table public.payment_requests (
  id uuid not null default gen_random_uuid(),
  creator_wallet text,
  recipient_wallet text not null,
  amount numeric not null,
  token_symbol text not null default 'USDC',
  description text,
  network text not null default 'Monad Testnet',
  status text not null default 'pending',
  transaction_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payment_requests_pkey primary key (id),
  constraint payment_requests_amount_check check (amount > 0),
  constraint payment_requests_status_check check (status in ('pending','paid','failed'))
);
create index payment_requests_status_idx on public.payment_requests(status);
create index payment_requests_created_at_idx on public.payment_requests(created_at);
alter table public.payment_requests enable row level security;
-- Deliberately seed broad table and column grants to verify their complete removal.
grant all on public.payment_requests to anon, authenticated;
grant update(status, transaction_hash), insert(amount), select(creator_wallet) on public.payment_requests to public;
insert into auth.users values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
