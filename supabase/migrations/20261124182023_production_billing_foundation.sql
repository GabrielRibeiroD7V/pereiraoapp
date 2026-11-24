-- PROPOSTA: não aplicar no remoto sem autorização própria. Não cria contrato ou cobrança.
begin;
create table private.production_billing_keys (
 id boolean primary key default true check(id), key_digest bytea not null check(octet_length(key_digest)=32)
);
create function private.production_key_is_distinct() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.sandbox_backend_keys where key_digest=new.key_digest) then raise exception 'Independent production proof required' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function private.production_key_is_distinct() from public,anon,authenticated;
create trigger production_key_is_distinct before insert or update on private.production_billing_keys for each row execute function private.production_key_is_distinct();
create table private.production_billing_nonces(id uuid primary key,created_at timestamptz not null default clock_timestamp());
create table private.production_billing_bindings (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete restrict,
 customer_id text not null check(customer_id ~ '^cus_[A-Za-z0-9_-]{1,150}$'),subscription_id text not null unique check(subscription_id ~ '^sub_[A-Za-z0-9_-]{1,150}$'),
 external_reference uuid not null unique,amount_cents integer not null check(amount_cents>0),method text not null check(method='CREDIT_CARD'),cycle text not null check(cycle='MONTHLY'),
 consent_at timestamptz not null,terms_version text not null check(char_length(terms_version) between 1 and 100),
 observed_status text check(observed_status in ('ACTIVE','INACTIVE','EXPIRED','DELETED')),lease_token uuid,lease_until timestamptz
);
-- Nenhum RPC desta migração insere vínculos. Consentimento/contratação são etapa futura.
create table private.production_billing_events (
 event_id text primary key check(char_length(event_id) between 3 and 200),notice jsonb not null,payload_digest bytea not null,
 state text not null default 'pending' check(state in ('pending','processing','processed')),attempts integer not null default 0,
 received_at timestamptz not null default clock_timestamp(),next_attempt_at timestamptz not null default clock_timestamp(),processed_at timestamptz,
 lease_token uuid,lease_until timestamptz,binding_id uuid references private.production_billing_bindings(id) on delete restrict,last_error text
);
create index production_billing_due on private.production_billing_events(next_attempt_at,received_at) where state<>'processed';
create table private.production_billing_payments (
 payment_id text primary key check(payment_id ~ '^pay_[A-Za-z0-9_-]{1,150}$'),binding_id uuid not null references private.production_billing_bindings(id) on delete restrict,
 amount_cents integer not null check(amount_cents>0),refunded_cents integer not null check(refunded_cents between 0 and amount_cents),
 status text not null,settled boolean not null,observed_at timestamptz not null default clock_timestamp()
);
create table private.production_billing_audit (
 event_id text primary key references private.production_billing_events(event_id) on delete restrict,
 binding_id uuid not null references private.production_billing_bindings(id) on delete restrict,observed_status text not null,recorded_at timestamptz not null default clock_timestamp()
);
alter table private.production_billing_keys enable row level security;
alter table private.production_billing_nonces enable row level security;
alter table private.production_billing_bindings enable row level security;
alter table private.production_billing_events enable row level security;
alter table private.production_billing_payments enable row level security;
alter table private.production_billing_audit enable row level security;
revoke all on private.production_billing_keys,private.production_billing_nonces,private.production_billing_bindings,private.production_billing_events,private.production_billing_payments,private.production_billing_audit from public,anon,authenticated;

create function private.production_proof_equal(a bytea,b bytea) returns boolean language plpgsql immutable set search_path='' as $$
declare result integer:=0;i integer;
begin
 if a is null or b is null or octet_length(a)<>32 or octet_length(b)<>32 then return false;end if;
 for i in 0..31 loop result:=result | (get_byte(a,i) # get_byte(b,i));end loop;return result=0;
end;$$;
revoke all on function private.production_proof_equal(bytea,bytea) from public,anon,authenticated;

create function private.production_billing_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare key_bytes bytea;p jsonb;e private.production_billing_events;b private.production_billing_bindings;hash bytea;token uuid;pay jsonb;changed integer;rows jsonb;
begin
 if command is null or nonce is null or issued_at is null or raw_payload is null or signature is null or signature!~'^[a-f0-9]{64}$' or octet_length(raw_payload)>8192 or abs(extract(epoch from clock_timestamp())-issued_at)>90 then raise exception 'Invalid proof' using errcode='42501';end if;
 select key_digest into key_bytes from private.production_billing_keys where id;
 if key_bytes is null then raise exception 'Production persistence not provisioned' using errcode='55000';end if;
 if not private.production_proof_equal(extensions.hmac(convert_to(command||E'\n'||nonce::text||E'\n'||issued_at::text||E'\n'||raw_payload,'UTF8'),key_bytes,'sha256'),decode(signature,'hex')) then raise exception 'Invalid proof' using errcode='42501';end if;
 insert into private.production_billing_nonces(id) values(nonce);
 delete from private.production_billing_nonces where created_at<clock_timestamp()-interval '5 minutes';
 p:=raw_payload::jsonb;if jsonb_typeof(p)<>'object' then raise exception 'Invalid input' using errcode='22023';end if;
 if command='enqueue' then
  if (p->>'environment') is distinct from 'production' or coalesce(p->>'eventId','')!~'^[A-Za-z0-9_&-]{3,200}$' or coalesce(p->>'eventType','')!~'^(PAYMENT|SUBSCRIPTION)_[A-Z_]{1,80}$' or coalesce(p->>'objectId','')!~'^(pay|sub)_[A-Za-z0-9_-]{1,150}$' or (p-array['eventId','eventType','objectId','subscriptionId','environment'])<>'{}'::jsonb then raise exception 'Invalid notice' using errcode='22023';end if;
  hash:=extensions.digest(convert_to(p::text,'UTF8'),'sha256');
  insert into private.production_billing_events(event_id,notice,payload_digest) values(p->>'eventId',p,hash) on conflict do nothing;
  get diagnostics changed=row_count;
  select * into e from private.production_billing_events where event_id=p->>'eventId';
  if e.payload_digest<>hash then raise exception 'Event conflict' using errcode='23505';end if;
  return jsonb_build_object('duplicate',changed=0,'retryable',e.state<>'processed');
 elsif command='due' then
  select coalesce(jsonb_agg(event_id),'[]'::jsonb) into rows from(select event_id from private.production_billing_events where state<>'processed' and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by received_at,event_id limit 2) x;
  return jsonb_build_object('eventIds',rows);
 elsif command='claim' then
  token:=gen_random_uuid();
  update private.production_billing_events set state='processing',attempts=attempts+1,lease_token=token,lease_until=clock_timestamp()+interval '45 seconds'
   where event_id=p->>'eventId' and state<>'processed' and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) returning * into e;
  if not found then return '{"claimed":false}'::jsonb;end if;
  return jsonb_build_object('claimed',true,'notice',e.notice,'leaseToken',token);
 elsif command in ('binding','complete','fail') then
  select * into e from private.production_billing_events where event_id=p->>'eventId' for update;
  if not found or e.state<>'processing' or e.lease_token is distinct from (p->>'leaseToken')::uuid or e.lease_until<clock_timestamp() then raise exception 'Stale lease' using errcode='40001';end if;
  if command='binding' then
   select * into b from private.production_billing_bindings where subscription_id=p->>'subscriptionId' for update;
   if not found then return null;end if;
   if b.lease_until>clock_timestamp() and b.lease_token is distinct from e.lease_token then raise exception 'Binding busy' using errcode='40001';end if;
   update private.production_billing_bindings set lease_token=e.lease_token,lease_until=e.lease_until where id=b.id;
   update private.production_billing_events set binding_id=b.id where event_id=e.event_id;
   return to_jsonb(b)-array['consent_at','terms_version','lease_token','lease_until','observed_status'];
  elsif command='fail' then
   if coalesce(p->>'code','') not in ('DISABLED','SETUP_REQUIRED','AUTH_REQUIRED','INVALID_INPUT','CONFLICT','UNAVAILABLE','RECONCILIATION_REQUIRED') then raise exception 'Invalid failure' using errcode='22023';end if;
   update private.production_billing_events set state='pending',last_error=p->>'code',next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,15*power(2,least(attempts,8)))::integer),lease_token=null,lease_until=null where event_id=e.event_id;
   update private.production_billing_bindings set lease_token=null,lease_until=null where id=e.binding_id and lease_token=e.lease_token;
   return '{"pending":true}'::jsonb;
  end if;
  select * into b from private.production_billing_bindings where id=e.binding_id for update;
  if not found or b.id is distinct from (p->>'bindingId')::uuid or b.lease_token is distinct from e.lease_token or b.lease_until<clock_timestamp() then raise exception 'Stale binding lease' using errcode='40001';end if;
  if coalesce(p->>'subscriptionStatus','') not in ('ACTIVE','INACTIVE','EXPIRED','DELETED') then raise exception 'Invalid observation' using errcode='22023';end if;
  if b.observed_status='DELETED' and p->>'subscriptionStatus'<>'DELETED' then raise exception 'Subscription requires review' using errcode='22023';end if;
  pay:=p->'payment';
  if pay is not null and pay<>'null'::jsonb then
   if coalesce(pay->>'paymentId','')!~'^pay_[A-Za-z0-9_-]{1,150}$' or pay->>'subscriptionId' is distinct from b.subscription_id or pay->>'customerId' is distinct from b.customer_id or (pay->>'amountCents')::integer is distinct from b.amount_cents or coalesce(pay->>'status','') not in ('PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','DELETED','PARTIALLY_REFUNDED','REFUND_REQUESTED','AWAITING_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED','REPROVED_BY_RISK_ANALYSIS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL') or jsonb_typeof(pay->'settled') is distinct from 'boolean' then raise exception 'Invalid payment' using errcode='22023';end if;
   if (e.notice->>'objectId') is distinct from (pay->>'paymentId') or e.notice->>'eventType' not like 'PAYMENT_%' then raise exception 'Wrong payment' using errcode='22023';end if;
   if exists(select 1 from private.production_billing_payments old where old.payment_id=pay->>'paymentId' and (old.refunded_cents>(pay->>'refundedCents')::integer or (old.status='REFUNDED' and pay->>'status'<>'REFUNDED') or (old.status='DELETED' and pay->>'status'<>'DELETED' and e.notice->>'eventType'<>'PAYMENT_RESTORED') or (old.status='RECEIVED' and pay->>'status' in ('PENDING','CONFIRMED','OVERDUE')))) then raise exception 'Payment requires review' using errcode='22023';end if;
   insert into private.production_billing_payments(payment_id,binding_id,amount_cents,refunded_cents,status,settled) values(pay->>'paymentId',b.id,b.amount_cents,(pay->>'refundedCents')::integer,pay->>'status',(pay->>'settled')::boolean)
    on conflict(payment_id) do update set refunded_cents=excluded.refunded_cents,status=excluded.status,settled=excluded.settled,observed_at=clock_timestamp() where private.production_billing_payments.binding_id=excluded.binding_id;
   get diagnostics changed=row_count;if changed<>1 then raise exception 'Payment conflict' using errcode='23505';end if;
  elsif e.notice->>'eventType' like 'PAYMENT_%' then raise exception 'Payment required' using errcode='22023';
  elsif e.notice->>'objectId' is distinct from b.subscription_id then raise exception 'Wrong subscription' using errcode='22023';end if;
  update private.production_billing_bindings set observed_status=p->>'subscriptionStatus',lease_token=null,lease_until=null where id=b.id;
  insert into private.production_billing_audit(event_id,binding_id,observed_status) values(e.event_id,b.id,p->>'subscriptionStatus');
  update private.production_billing_events set state='processed',processed_at=clock_timestamp(),last_error=null,lease_token=null,lease_until=null where event_id=e.event_id;
  return '{"processed":true,"rightsChanged":false}'::jsonb;
 end if;
 raise exception 'Unsupported command' using errcode='22023';
end;$$;
revoke all on function private.production_billing_server(text,text,bigint,uuid,text) from public,anon,authenticated;
-- Ponte de máquina: prova HMAC obrigatória, sem JWT de usuário simulado ou service_role.
create function public.production_billing_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text) returns jsonb language sql security definer set search_path='' as $$select private.production_billing_server(command,raw_payload,issued_at,nonce,signature);$$;
revoke all on function public.production_billing_server(text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.production_billing_server(text,text,bigint,uuid,text) to anon,authenticated;
commit;
