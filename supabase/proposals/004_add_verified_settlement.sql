-- REVIEW ONLY. Do not execute against hosted staging or production without separate approval.
-- Additive settlement proposal for a database where migration 003 has already committed.
-- This file performs no blockchain verification; only a trusted scoped executor may attest a
-- settlement after the server completes SETTLEMENT_SPEC_V1.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.payment_requests in access exclusive mode;

do $$
begin
  if pg_catalog.to_regprocedure('public.paylink_create_payment_request_v2(uuid,text,text,text,text,timestamptz,text,integer)') is null
    or pg_catalog.to_regprocedure('public.paylink_get_payment_request_v2(uuid)') is null then
    raise exception 'STOP: migration 003 versioned functions are missing';
  end if;
  if pg_catalog.to_regrole('paylink_request_api') is null
    or not exists (select 1 from pg_catalog.pg_class
      where oid='public.payment_requests'::pg_catalog.regclass and relrowsecurity) then
    raise exception 'STOP: migration 003 role/RLS state is missing';
  end if;
  if (select count(*) from pg_catalog.pg_attribute
      where attrelid='public.payment_requests'::pg_catalog.regclass
        and attnum > 0 and not attisdropped) <> 15
    or not exists (select 1 from pg_catalog.pg_attribute
      where attrelid='public.payment_requests'::pg_catalog.regclass and attname='owner_id'
        and atttypid='uuid'::pg_catalog.regtype and attnotnull)
    or not exists (select 1 from pg_catalog.pg_attribute
      where attrelid='public.payment_requests'::pg_catalog.regclass and attname='client_request_id'
        and atttypid='uuid'::pg_catalog.regtype and attnotnull)
    or not exists (select 1 from pg_catalog.pg_attribute
      where attrelid='public.payment_requests'::pg_catalog.regclass and attname='recipient_name'
        and atttypid='text'::pg_catalog.regtype and attnotnull) then
    raise exception 'STOP: payment_requests does not match the reviewed migration 003 shape';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
      where conrelid='public.payment_requests'::pg_catalog.regclass
        and conname='paylink_owner_submission_v2' and contype='u')
    or not exists (select 1 from pg_catalog.pg_constraint
      where conrelid='public.payment_requests'::pg_catalog.regclass
        and conname='paylink_request_values_v2' and contype='c' and convalidated) then
    raise exception 'STOP: migration 003 constraints are missing';
  end if;
  if exists (select 1 from public.payment_requests
      where status <> 'pending' or transaction_hash is not null or paid_at is not null) then
    raise exception 'STOP: existing settlement state requires a separate backfill review';
  end if;
  if pg_catalog.to_regrole('paylink_settlement_api') is not null
    or pg_catalog.to_regrole('paylink_settlement_executor') is not null
    or pg_catalog.to_regprocedure('public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)') is not null
    or pg_catalog.to_regprocedure('public.paylink_get_payment_request_v3(uuid)') is not null then
    raise exception 'STOP: migration 004 object name already exists';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated')
      and (rolsuper or rolbypassrls)) then
    raise exception 'STOP: browser role can bypass RLS';
  end if;
end;
$$;

alter table public.payment_requests
  add column payer_wallet text null,
  add column settlement_chain_id integer null,
  add column settlement_block_number bigint null,
  add column settlement_block_hash text null,
  add column settlement_token_address text null,
  add column settlement_amount_atomic numeric(78,0) null,
  add column settlement_proof_scheme text null,
  add column settlement_proof_digest text null,
  add column settlement_proof_signature text null,
  add column settlement_verification_version smallint null,
  add column verified_at timestamptz null;

alter table public.payment_requests add constraint paylink_settlement_state_v1 check (
  (
    status in ('pending','failed')
    and transaction_hash is null and paid_at is null and payer_wallet is null
    and settlement_chain_id is null and settlement_block_number is null
    and settlement_block_hash is null and settlement_token_address is null
    and settlement_amount_atomic is null and settlement_proof_scheme is null
    and settlement_proof_digest is null and settlement_proof_signature is null
    and settlement_verification_version is null and verified_at is null
  ) or (
    status = 'paid'
    and transaction_hash ~ '^0x[0-9a-f]{64}$'
    and payer_wallet ~ '^0x[0-9a-f]{40}$'
    and payer_wallet <> '0x0000000000000000000000000000000000000000'
    and settlement_chain_id = 10143
    and settlement_block_number >= 0
    and settlement_block_hash ~ '^0x[0-9a-f]{64}$'
    and settlement_amount_atomic > 0
    and settlement_amount_atomic = amount *
      case token_symbol when 'USDC' then 1000000::numeric else 1000000000000000000::numeric end
    and settlement_proof_scheme = 'eip712_eoa'
    and settlement_proof_digest ~ '^0x[0-9a-f]{64}$'
    and settlement_proof_signature ~ '^0x([0-9a-f]{2})+$'
    and char_length(settlement_proof_signature) between 4 and 8194
    and settlement_verification_version = 1
    and isfinite(paid_at) and isfinite(verified_at) and paid_at <= verified_at
    and paid_at >= created_at and (expires_at is null or paid_at <= expires_at)
    and (
      (token_symbol = 'MON' and settlement_token_address is null)
      or (token_symbol = 'USDC' and settlement_token_address =
        '0x534b2f3a21130d7a60830c2df862319e593943a3')
    )
  )
);

create unique index paylink_transaction_hash_v1
  on public.payment_requests (lower(transaction_hash)) where transaction_hash is not null;
create index paylink_paid_at_v1 on public.payment_requests (paid_at desc) where status='paid';

create role paylink_settlement_api nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create role paylink_settlement_executor nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant paylink_settlement_api to postgres with inherit false;
grant paylink_settlement_api to postgres with set true;
grant usage on schema public to paylink_settlement_api, paylink_settlement_executor;
grant select on public.payment_requests to paylink_settlement_api;
grant update (
  status, transaction_hash, paid_at, payer_wallet, settlement_chain_id,
  settlement_block_number, settlement_block_hash, settlement_token_address,
  settlement_amount_atomic, settlement_proof_scheme, settlement_proof_digest,
  settlement_proof_signature, settlement_verification_version, verified_at
) on public.payment_requests to paylink_settlement_api;

create policy paylink_settlement_read_v1 on public.payment_requests
  for select to paylink_settlement_api using (true);
create policy paylink_settlement_update_v1 on public.payment_requests
  for update to paylink_settlement_api
  using (status in ('pending','paid'))
  with check (status = 'paid');

create function public.paylink_record_verified_settlement_v1(
  p_id uuid,
  p_transaction_hash text,
  p_payer_wallet text,
  p_chain_id integer,
  p_block_number bigint,
  p_block_hash text,
  p_block_time timestamptz,
  p_token_address text,
  p_amount_atomic numeric,
  p_proof_scheme text,
  p_proof_digest text,
  p_proof_signature text,
  p_verification_version smallint
)
returns table (
  id uuid, status text, transaction_hash text, payer_wallet text, paid_at timestamptz,
  settlement_chain_id integer, settlement_block_number bigint, settlement_block_hash text,
  settlement_token_address text, settlement_amount_atomic text,
  settlement_verification_version smallint, verified_at timestamptz
)
language plpgsql security definer set search_path='' as $$
declare
  saved public.payment_requests%rowtype;
  normalized_hash text := pg_catalog.lower(p_transaction_hash);
  normalized_payer text := pg_catalog.lower(p_payer_wallet);
  normalized_block_hash text := pg_catalog.lower(p_block_hash);
  normalized_token text := case when p_token_address is null then null
    else pg_catalog.lower(p_token_address) end;
  normalized_digest text := pg_catalog.lower(p_proof_digest);
  normalized_signature text := pg_catalog.lower(p_proof_signature);
  expected_atomic numeric;
  verification_time timestamptz;
begin
  if p_id is null or normalized_hash !~ '^0x[0-9a-f]{64}$'
    or normalized_payer !~ '^0x[0-9a-f]{40}$'
    or normalized_payer = '0x0000000000000000000000000000000000000000'
    or p_chain_id is distinct from 10143 or p_block_number is null or p_block_number < 0
    or normalized_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_time is null or not pg_catalog.isfinite(p_block_time)
    or p_amount_atomic is null or p_amount_atomic <= 0 or p_amount_atomic <> pg_catalog.trunc(p_amount_atomic)
    or p_proof_scheme is distinct from 'eip712_eoa'
    or normalized_digest !~ '^0x[0-9a-f]{64}$'
    or normalized_signature !~ '^0x([0-9a-f]{2})+$'
    or pg_catalog.char_length(normalized_signature) not between 4 and 8194
    or p_verification_version is distinct from 1 then
    raise sqlstate 'PT400' using message='Invalid verified settlement evidence';
  end if;

  select * into saved from public.payment_requests r where r.id=p_id for update;
  if not found then raise sqlstate 'PT404' using message='Payment request not found'; end if;

  expected_atomic := saved.amount * case saved.token_symbol
    when 'USDC' then 1000000::numeric else 1000000000000000000::numeric end;
  if p_amount_atomic is distinct from expected_atomic
    or (saved.token_symbol='MON' and normalized_token is not null)
    or (saved.token_symbol='USDC' and normalized_token is distinct from
      '0x534b2f3a21130d7a60830c2df862319e593943a3')
    or p_block_time < saved.created_at
    or (saved.expires_at is not null and p_block_time > saved.expires_at)
    or p_block_time > pg_catalog.clock_timestamp() + interval '5 minutes' then
    raise sqlstate 'PT409' using message='Settlement does not match payment request';
  end if;

  if saved.status='paid' then
    if saved.transaction_hash=normalized_hash and saved.payer_wallet=normalized_payer
      and saved.settlement_chain_id=p_chain_id and saved.settlement_block_number=p_block_number
      and saved.settlement_block_hash=normalized_block_hash
      and saved.settlement_token_address is not distinct from normalized_token
      and saved.settlement_amount_atomic=p_amount_atomic
      and saved.settlement_proof_scheme=p_proof_scheme
      and saved.settlement_proof_digest=normalized_digest
      and saved.settlement_proof_signature=normalized_signature
      and saved.settlement_verification_version=p_verification_version
      and saved.paid_at=p_block_time then
      return query select saved.id,saved.status,saved.transaction_hash,saved.payer_wallet,saved.paid_at,
        saved.settlement_chain_id,saved.settlement_block_number,saved.settlement_block_hash,
        saved.settlement_token_address,saved.settlement_amount_atomic::text,
        saved.settlement_verification_version,saved.verified_at;
      return;
    end if;
    raise sqlstate 'PT409' using message='Payment request already settled differently';
  end if;
  if saved.status <> 'pending' then
    raise sqlstate 'PT409' using message='Payment request is not payable';
  end if;

  verification_time := pg_catalog.clock_timestamp();
  begin
    update public.payment_requests r set
      status='paid', transaction_hash=normalized_hash, payer_wallet=normalized_payer,
      paid_at=p_block_time, settlement_chain_id=p_chain_id,
      settlement_block_number=p_block_number, settlement_block_hash=normalized_block_hash,
      settlement_token_address=normalized_token, settlement_amount_atomic=p_amount_atomic,
      settlement_proof_scheme=p_proof_scheme, settlement_proof_digest=normalized_digest,
      settlement_proof_signature=normalized_signature,
      settlement_verification_version=p_verification_version, verified_at=verification_time
    where r.id=p_id
    returning * into saved;
  exception when unique_violation then
    raise sqlstate 'PT409' using message='Transaction hash already used';
  end;

  return query select saved.id,saved.status,saved.transaction_hash,saved.payer_wallet,saved.paid_at,
    saved.settlement_chain_id,saved.settlement_block_number,saved.settlement_block_hash,
    saved.settlement_token_address,saved.settlement_amount_atomic::text,
    saved.settlement_verification_version,saved.verified_at;
end;
$$;

create function public.paylink_get_payment_request_v3(p_id uuid)
returns table (
  id uuid, amount text, recipient_wallet text, recipient_name text, description text,
  token_symbol text, network text, status text, created_at timestamptz, expires_at timestamptz,
  transaction_hash text, verified_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select r.id,pg_catalog.trim_scale(r.amount)::text,r.recipient_wallet,r.recipient_name,
    r.description,r.token_symbol,r.network,r.status,r.created_at,r.expires_at,
    r.transaction_hash,r.verified_at
  from public.payment_requests r
  where r.id=p_id and r.network='Monad Testnet' and r.token_symbol in ('MON','USDC')
    and r.status in ('pending','paid')
    and ((r.status='pending' and r.transaction_hash is null and r.paid_at is null)
      or (r.status='paid' and r.transaction_hash is not null and r.paid_at is not null));
$$;

revoke all on function public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)
  from public,anon,authenticated,paylink_request_api,paylink_settlement_executor;
grant execute on function public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)
  to paylink_settlement_executor;
revoke all on function public.paylink_get_payment_request_v3(uuid) from public,anon,authenticated,paylink_settlement_executor;
grant execute on function public.paylink_get_payment_request_v3(uuid) to anon,authenticated;

grant create on schema public to paylink_settlement_api;
alter function public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)
  owner to paylink_settlement_api;
revoke create on schema public from paylink_settlement_api;
grant create on schema public to paylink_request_api;
alter function public.paylink_get_payment_request_v3(uuid) owner to paylink_request_api;
revoke create on schema public from paylink_request_api;

do $$
begin
  if pg_catalog.has_schema_privilege('paylink_settlement_api','public','CREATE')
    or pg_catalog.has_schema_privilege('paylink_settlement_executor','public','CREATE') then
    raise exception 'STOP: settlement roles retain schema CREATE';
  end if;
  if pg_catalog.pg_has_role('anon','paylink_settlement_api','MEMBER')
    or pg_catalog.pg_has_role('authenticated','paylink_settlement_api','MEMBER')
    or pg_catalog.pg_has_role('anon','paylink_settlement_executor','MEMBER')
    or pg_catalog.pg_has_role('authenticated','paylink_settlement_executor','MEMBER') then
    raise exception 'STOP: browser role can assume a settlement role';
  end if;
  if pg_catalog.has_table_privilege('paylink_settlement_executor','public.payment_requests',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or pg_catalog.has_any_column_privilege('paylink_settlement_executor','public.payment_requests',
      'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'STOP: executor has direct payment_requests privileges';
  end if;
  if pg_catalog.has_table_privilege('anon','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or pg_catalog.has_table_privilege('authenticated','public.payment_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or pg_catalog.has_any_column_privilege('anon','public.payment_requests','INSERT,UPDATE,REFERENCES')
    or pg_catalog.has_any_column_privilege('authenticated','public.payment_requests','INSERT,UPDATE,REFERENCES') then
    raise exception 'STOP: browser write privilege was introduced';
  end if;
  if not pg_catalog.has_function_privilege('paylink_settlement_executor',
      'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE')
    or pg_catalog.has_function_privilege('anon',
      'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',
      'public.paylink_record_verified_settlement_v1(uuid,text,text,integer,bigint,text,timestamptz,text,numeric,text,text,text,smallint)','EXECUTE') then
    raise exception 'STOP: settlement function execute matrix differs';
  end if;
  if not pg_catalog.has_function_privilege('anon','public.paylink_get_payment_request_v3(uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated','public.paylink_get_payment_request_v3(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('paylink_settlement_executor','public.paylink_get_payment_request_v3(uuid)','EXECUTE') then
    raise exception 'STOP: public read function execute matrix differs';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
      where rolname='paylink_settlement_executor' and (rolcanlogin or rolsuper or rolcreaterole
        or rolcreatedb or rolinherit or rolbypassrls)) then
    raise exception 'STOP: executor must remain disabled NOLOGIN until separate approval';
  end if;
end;
$$;
commit;
