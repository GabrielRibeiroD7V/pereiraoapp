-- PR: proposta de homologação. NÃO aplicar no remoto sem autorização específica.
-- Nunca altera business_subscriptions, status de publicação ou direitos reais.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table private.sandbox_backend_keys(id boolean primary key default true check(id),key_digest bytea not null check(octet_length(key_digest)=32));
-- Vazia por padrão. Provisionamento do digest HMAC exige autorização separada.
create table private.sandbox_server_nonces(id uuid primary key,created_at timestamptz not null default clock_timestamp());
create table private.sandbox_customers(business_id uuid primary key references public.businesses(id) on delete restrict,customer_id text not null unique check(customer_id~'^cus_[A-Za-z0-9_-]+$'),created_at timestamptz not null default now());
create table private.sandbox_contracts(
 request_id uuid primary key,business_id uuid not null references public.businesses(id) on delete restrict,user_id uuid not null references auth.users(id) on delete restrict,
 environment text not null default 'sandbox' check(environment='sandbox'),method text not null check(method in ('PIX','CREDIT_CARD')),
 amount_cents integer not null default 1999 check(amount_cents=1999),currency text not null default 'BRL' check(currency='BRL'),cycle text not null default 'MONTHLY' check(cycle='MONTHLY'),
 consent_version text not null check(consent_version='sandbox-v1'),accepted_at timestamptz not null default clock_timestamp(),
 first_due_date date not null,customer_id text references private.sandbox_customers(customer_id),subscription_id text unique,checkout_id text unique,invoice_url text,
 state text not null default 'prepared' check(state in ('prepared','customer_ready','subscription_pending','pending','active','overdue','cancelled','refunded','uncertain')),reconcile_lease uuid,reconcile_until timestamptz,
 provider_cancelled boolean not null default false,diagnostic_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(subscription_id is null or subscription_id~'^sub_[A-Za-z0-9_-]+$'),check(checkout_id is null or checkout_id~'^[0-9a-f-]{36}$'),
 check(invoice_url is null or invoice_url~'^https://sandbox[.]asaas[.]com/(i/|([0-9]{1,12}/)?checkoutSession/show)')
);
create unique index sandbox_one_open_contract on private.sandbox_contracts(business_id) where not provider_cancelled;
create index sandbox_contracts_user_idx on private.sandbox_contracts(user_id,business_id);
create table private.sandbox_payments(
 payment_id text primary key check(payment_id~'^pay_[A-Za-z0-9_-]+$'),request_id uuid not null references private.sandbox_contracts(request_id) on delete restrict,
 amount_cents integer not null check(amount_cents=1999),refunded_cents integer not null default 0 check(refunded_cents between 0 and amount_cents),
 status text not null check(status in ('PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','DELETED','PARTIALLY_REFUNDED','REFUND_REQUESTED','AWAITING_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED','REPROVED_BY_RISK_ANALYSIS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL')),
 due_date date not null,settled boolean not null default false,confirmed_at timestamptz,updated_at timestamptz not null default clock_timestamp()
);
create index sandbox_payments_contract_idx on private.sandbox_payments(request_id,due_date desc,payment_id);
create table private.sandbox_refund_requests(request_id uuid primary key,payment_id text not null unique references private.sandbox_payments(payment_id) on delete restrict,user_id uuid not null references auth.users(id),state text not null default 'requested' check(state in ('requested','uncertain','acknowledged')),created_at timestamptz not null default now());
create table private.sandbox_financial_audit(id uuid primary key default gen_random_uuid(),request_id uuid references private.sandbox_contracts(request_id),actor_id uuid references auth.users(id),action text not null,before_state text,after_state text,event_id text,created_at timestamptz not null default clock_timestamp());
alter table private.billing_event_inbox add column notice jsonb not null default '{}'::jsonb check(jsonb_typeof(notice)='object'),add column lease_token uuid,add column lease_until timestamptz;
create index sandbox_event_retry_idx on private.billing_event_inbox(state,received_at,event_id) where state in ('pending','reconcile_required');
alter table private.sandbox_backend_keys enable row level security;
alter table private.sandbox_server_nonces enable row level security;
alter table private.sandbox_customers enable row level security;
alter table private.sandbox_contracts enable row level security;
alter table private.sandbox_payments enable row level security;
alter table private.sandbox_refund_requests enable row level security;
alter table private.sandbox_financial_audit enable row level security;
revoke all on private.sandbox_backend_keys,private.sandbox_server_nonces,private.sandbox_customers,private.sandbox_contracts,private.sandbox_payments,private.sandbox_refund_requests,private.sandbox_financial_audit from public,anon,authenticated;

create function private.sandbox_same_bytes(a bytea,b bytea) returns boolean language plpgsql immutable set search_path='' as $$
declare result integer:=0;i integer;begin
 if a is null or b is null or octet_length(a)<>32 or octet_length(b)<>32 then return false;end if;
 for i in 0..31 loop result:=result | (get_byte(a,i)#get_byte(b,i));end loop;return result=0;
end;$$;
revoke all on function private.sandbox_same_bytes(bytea,bytea) from public,anon,authenticated;
create function private.sandbox_authorized_user(uid uuid,bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select uid is not null and private.account_enabled(uid) and exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
 and not exists(select 1 from private.business_moderation where business_id=bid and suspended)
 and exists(select 1 from public.business_members where business_id=bid and user_id=uid and role in ('owner','admin'));
$$;
revoke all on function private.sandbox_authorized_user(uuid,uuid) from public,anon,authenticated;
create function private.refresh_sandbox_state(target uuid) returns void language plpgsql set search_path='' as $$
declare next_state text;before_state text;begin
 select state into before_state from private.sandbox_contracts where request_id=target for update;
 select case when provider_cancelled then 'cancelled'
 when exists(select 1 from private.sandbox_payments p where p.request_id=target and p.status in ('CONFIRMED','RECEIVED') and p.refunded_cents=0 and p.due_date<=current_date and p.due_date+interval '1 month'>current_date) then 'active'
 when exists(select 1 from private.sandbox_payments p where p.request_id=target and p.status='OVERDUE') then 'overdue'
 when exists(select 1 from private.sandbox_payments p where p.request_id=target and p.status='REFUNDED') then 'refunded' else 'pending' end into next_state
 from private.sandbox_contracts where request_id=target;
 if next_state is distinct from before_state then update private.sandbox_contracts set state=next_state,updated_at=clock_timestamp() where request_id=target;
 insert into private.sandbox_financial_audit(request_id,action,before_state,after_state) values(target,'reconciled',before_state,next_state);end if;
end;$$;
revoke all on function private.refresh_sandbox_state(uuid) from public,anon,authenticated;

-- Credencial de servidor restrita a Sandbox; não usa nem aceita identidade JWT simulada.
-- HMAC liga comando, nonce, horário e bytes exatos do JSON. O digest armazenado é segredo de assinatura.
create function private.sandbox_billing_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare key_bytes bytea;p jsonb;uid uuid;bid uuid;rid uuid;c private.sandbox_contracts;old_event private.billing_event_inbox;event private.billing_event_inbox;
 claimed boolean:=false;pay private.sandbox_payments;found_refund private.sandbox_refund_requests;previous text;changed boolean;result jsonb;
begin
 if command is null or nonce is null or issued_at is null or raw_payload is null or signature is null or signature!~'^[a-f0-9]{64}$' or octet_length(raw_payload)>32768 or abs(extract(epoch from clock_timestamp())-issued_at)>90 then raise exception 'Invalid server proof' using errcode='42501';end if;
 select key_digest into key_bytes from private.sandbox_backend_keys where id;
 if key_bytes is null then raise exception 'Sandbox server not provisioned' using errcode='55000';end if;
 if not private.sandbox_same_bytes(extensions.hmac(convert_to(command||E'\n'||nonce::text||E'\n'||issued_at::text||E'\n'||raw_payload,'UTF8'),key_bytes,'sha256'),decode(signature,'hex')) then raise exception 'Invalid server proof' using errcode='42501';end if;
 insert into private.sandbox_server_nonces(id) values(nonce);
 p:=raw_payload::jsonb;if jsonb_typeof(p)<>'object' then raise exception 'Invalid input' using errcode='22023';end if;
 uid:=nullif(p->>'userId','')::uuid;bid:=nullif(p->>'businessId','')::uuid;rid:=nullif(p->>'requestId','')::uuid;
 if command in ('reserve','owner_overview') and not private.sandbox_authorized_user(uid,bid) then raise exception 'Not authorized' using errcode='42501';end if;
 if command in ('admin_overview','claim_refund','retry_events') and not exists(select 1 from private.platform_admins where user_id=uid and private.account_enabled(uid)) then raise exception 'Administrator required' using errcode='42501';end if;
 if command='reserve' then
  if rid is null or p->'accepted' is distinct from 'true'::jsonb or p->>'termsVersion' is distinct from 'sandbox-v1' or (p->>'amountCents')::int is distinct from 1999 or coalesce(p->>'method','') not in ('PIX','CREDIT_CARD') then raise exception 'Explicit test consent required' using errcode='22023';end if;
  perform 1 from public.businesses where id=bid for update;
  select * into c from private.sandbox_contracts where request_id=rid;
  if found then if c.business_id<>bid or c.user_id<>uid or c.method<>p->>'method' then raise exception 'Operation conflict' using errcode='23505';end if;
  else
   if exists(select 1 from private.sandbox_contracts where business_id=bid and not provider_cancelled) then raise exception 'Existing test contract' using errcode='23505';end if;
   insert into private.sandbox_contracts(request_id,business_id,user_id,method,consent_version,first_due_date,customer_id)
    values(rid,bid,uid,p->>'method','sandbox-v1',greatest(current_date,coalesce((select (trial_ends_at at time zone 'America/Sao_Paulo')::date+1 from public.business_subscriptions where business_id=bid),current_date)),(select customer_id from private.sandbox_customers where business_id=bid)) returning * into c;
   insert into private.sandbox_financial_audit(request_id,actor_id,action,after_state) values(rid,uid,'test_consent','prepared');claimed:=true;
  end if;return jsonb_build_object('claimed',claimed,'contract',to_jsonb(c));
 elsif command='owner_overview' then
  return jsonb_build_object('contracts',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from(select * from private.sandbox_contracts where business_id=bid order by created_at desc limit 20)x),'[]'),'payments',coalesce((select jsonb_agg(to_jsonb(x) order by due_date desc,payment_id) from(select p.* from private.sandbox_payments p join private.sandbox_contracts c on c.request_id=p.request_id where c.business_id=bid order by p.due_date desc,p.payment_id limit 100)x),'[]'),'environment','sandbox','realRevenueAvailable',false);
 elsif command='admin_overview' then
  return jsonb_build_object('contracts',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from(select * from private.sandbox_contracts order by created_at desc limit 20)x),'[]'),'payments',coalesce((select jsonb_agg(to_jsonb(x) order by due_date desc,payment_id) from(select * from private.sandbox_payments order by due_date desc,payment_id limit 100)x),'[]'),
   'summary',jsonb_build_object('testContracts',(select count(*) from private.sandbox_contracts),'active',(select count(*) from private.sandbox_contracts where state='active'),'pending',(select count(*) from private.sandbox_contracts where state in ('prepared','customer_ready','subscription_pending','pending','uncertain')),'overdue',(select count(*) from private.sandbox_contracts where state='overdue'),'cancelled',(select count(*) from private.sandbox_contracts where state='cancelled'),'refunded',(select count(*) from private.sandbox_contracts where state='refunded'),'confirmedPayments',(select count(*) from private.sandbox_payments where status in ('CONFIRMED','RECEIVED')),'receivedCents',(select coalesce(sum(amount_cents-refunded_cents),0) from private.sandbox_payments where settled),'eventsPending',(select count(*) from private.billing_event_inbox where state in ('pending','reconcile_required'))),'environment','sandbox','realRevenueAvailable',false);
 elsif command in ('customer_saved','subscription_started','save_provider','uncertain','context','cancel_context','cancelled','claim_contract','release_contract') then
  select * into c from private.sandbox_contracts where request_id=rid for update;if not found then raise exception 'Unknown test contract' using errcode='P0002';end if;
  if command='claim_contract' then
   if c.reconcile_until is not null and c.reconcile_until>clock_timestamp() then return null;end if;
   update private.sandbox_contracts set reconcile_lease=gen_random_uuid(),reconcile_until=clock_timestamp()+interval '60 seconds' where request_id=rid returning * into c;return jsonb_build_object('contract',to_jsonb(c),'leaseToken',c.reconcile_lease);
  elsif command='release_contract' then
   update private.sandbox_contracts set reconcile_until=null,reconcile_lease=null where request_id=rid and reconcile_lease=(p->>'leaseToken')::uuid;return jsonb_build_object('ok',found);
  elsif command in ('cancel_context','context') then
   if uid is not null and not private.sandbox_authorized_user(uid,c.business_id) then raise exception 'Not authorized' using errcode='42501';end if;
   return to_jsonb(c);
  elsif command='customer_saved' then
   if coalesce(p->>'customerId','')!~'^cus_[A-Za-z0-9_-]+$' then raise exception 'Invalid customer' using errcode='22023';end if;
   insert into private.sandbox_customers values(c.business_id,p->>'customerId',now()) on conflict(business_id) do nothing;
   if not exists(select 1 from private.sandbox_customers where business_id=c.business_id and customer_id=p->>'customerId') then raise exception 'Customer conflict' using errcode='23505';end if;
   if c.customer_id is not null and c.customer_id<>p->>'customerId' then raise exception 'Customer immutable' using errcode='23514';end if;
   update private.sandbox_contracts set customer_id=p->>'customerId',state='customer_ready',updated_at=clock_timestamp() where request_id=rid;
  elsif command='subscription_started' then
   if c.customer_id is null or c.state not in ('prepared','customer_ready') then raise exception 'Creation already attempted' using errcode='23505';end if;
   update private.sandbox_contracts set state='subscription_pending',updated_at=clock_timestamp() where request_id=rid;
  elsif command='save_provider' then
   if c.customer_id is null then raise exception 'Customer required' using errcode='23514';end if;
   if p->>'subscriptionId' is not null and p->>'subscriptionId'!~'^sub_[A-Za-z0-9_-]+$' or p->>'checkoutId' is not null and p->>'checkoutId'!~'^[0-9a-f-]{36}$' then raise exception 'Invalid provider ID' using errcode='22023';end if;
   if c.subscription_id is not null and p->>'subscriptionId' is not null and c.subscription_id<>p->>'subscriptionId' or c.checkout_id is not null and p->>'checkoutId' is not null and c.checkout_id<>p->>'checkoutId' then raise exception 'Provider identity immutable' using errcode='23514';end if;
   update private.sandbox_contracts set subscription_id=coalesce(subscription_id,p->>'subscriptionId'),checkout_id=coalesce(checkout_id,p->>'checkoutId'),invoice_url=coalesce(p->>'invoiceUrl',invoice_url),state=case when state in ('active','cancelled','refunded','overdue') then state else 'pending' end,updated_at=clock_timestamp() where request_id=rid;
  elsif command='uncertain' then
   update private.sandbox_contracts set state=case when state in ('cancelled','refunded') then state else 'uncertain' end,diagnostic_code='provider_reconciliation_required',updated_at=clock_timestamp() where request_id=rid;
  elsif command='cancelled' then
   update private.sandbox_contracts set provider_cancelled=true,state='cancelled',updated_at=clock_timestamp() where request_id=rid;
   if c.state<>'cancelled' then insert into private.sandbox_financial_audit(request_id,actor_id,action,before_state,after_state) values(rid,uid,'cancelled',c.state,'cancelled');end if;
  end if;return (select to_jsonb(x) from private.sandbox_contracts x where request_id=rid);
 elsif command='known_payments' then
  return coalesce((select jsonb_agg(payment_id) from private.sandbox_payments where request_id=rid),'[]'::jsonb);
 elsif command='find_contract' then
  select * into c from private.sandbox_contracts where (p->>'subscriptionId' is not null and subscription_id=p->>'subscriptionId') or (p->>'checkoutId' is not null and checkout_id=p->>'checkoutId') or (p->>'externalReference' is not null and request_id::text=p->>'externalReference');return to_jsonb(c);
 elsif command='enqueue' then
  if coalesce(p->>'eventId','')!~'^[A-Za-z0-9_&-]{3,200}$' or coalesce(p->>'objectId','')!~'^[A-Za-z0-9_-]{3,160}$' or coalesce(p->>'eventType','')!~'^(PAYMENT|SUBSCRIPTION|CHECKOUT)_[A-Z_]+$' then raise exception 'Invalid notice' using errcode='22023';end if;
  select * into old_event from private.billing_event_inbox where event_id=p->>'eventId';
  if found then if old_event.notice<>p then raise exception 'Event ID conflict' using errcode='23505';end if;return jsonb_build_object('duplicate',true);end if;
  insert into private.billing_event_inbox(event_id,event_type,provider_object_id,notice) values(p->>'eventId',p->>'eventType',p->>'objectId',p) on conflict(event_id) do nothing;
  claimed:=found;select * into old_event from private.billing_event_inbox where event_id=p->>'eventId';
  if old_event.notice<>p then raise exception 'Event ID conflict' using errcode='23505';end if;
  return jsonb_build_object('duplicate',not claimed);
 elsif command in ('claim_event','retry_events') then
  if command='retry_events' then return jsonb_build_object('eventIds',coalesce((select jsonb_agg(event_id) from(select event_id from private.billing_event_inbox where state in ('pending','reconcile_required') and (lease_until is null or lease_until<clock_timestamp()) order by received_at,event_id limit 10)x),'[]'));end if;
  select * into event from private.billing_event_inbox where event_id=p->>'eventId' and state in ('pending','reconcile_required') and (lease_until is null or lease_until<clock_timestamp()) for update skip locked;
  if not found then return null;end if;
  update private.billing_event_inbox set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 where event_id=event.event_id returning * into event;
  return jsonb_build_object('eventId',event.event_id,'notice',event.notice,'leaseToken',event.lease_token);
 elsif command='event_done' then
  update private.billing_event_inbox set state=case when p->>'outcome'='processed' then 'processed' when p->>'outcome'='ignored' then 'ignored' else 'reconcile_required' end,processed_at=case when p->>'outcome' in ('processed','ignored') then clock_timestamp() else null end,diagnostic_code=case when p->>'outcome' in ('processed','ignored') then null else 'reconciliation_required' end,lease_until=null,lease_token=null where event_id=p->>'eventId' and lease_token=(p->>'leaseToken')::uuid;
  return jsonb_build_object('ok',found);
 elsif command='apply_payment' then
  select * into c from private.sandbox_contracts where request_id=rid for update;if not found or c.subscription_id is null or c.customer_id is null or c.subscription_id is distinct from p->>'subscriptionId' or c.customer_id is distinct from p->>'customerId' or (p->>'amountCents')::int is distinct from c.amount_cents or p->>'method' is distinct from c.method or c.reconcile_lease is distinct from (p->>'leaseToken')::uuid or c.reconcile_until is null or c.reconcile_until<=clock_timestamp() then raise exception 'Reconciliation mismatch' using errcode='23514';end if;
  select * into pay from private.sandbox_payments where payment_id=p->>'paymentId';
  if found and pay.request_id<>rid then raise exception 'Payment relation immutable' using errcode='23514';end if;
  changed:=not found or pay.status is distinct from p->>'status' or pay.refunded_cents is distinct from (p->>'refundedCents')::int or pay.due_date is distinct from (p->>'dueDate')::date;
  insert into private.sandbox_payments(payment_id,request_id,amount_cents,refunded_cents,status,due_date,settled,confirmed_at)
   values(p->>'paymentId',rid,c.amount_cents,(p->>'refundedCents')::int,p->>'status',(p->>'dueDate')::date,(p->>'settled')::boolean,nullif(p->>'confirmedAt','')::timestamptz)
   on conflict(payment_id) do update set refunded_cents=excluded.refunded_cents,status=excluded.status,due_date=excluded.due_date,settled=excluded.settled,confirmed_at=excluded.confirmed_at,updated_at=clock_timestamp();
  if changed then insert into private.sandbox_financial_audit(request_id,action,before_state,after_state,event_id) values(rid,'payment_reconciled',pay.status,p->>'status',p->>'eventId');end if;
  perform private.refresh_sandbox_state(rid);return jsonb_build_object('ok',true);
 elsif command='claim_refund' then
  select * into pay from private.sandbox_payments where payment_id=p->>'paymentId' for update;if not found then raise exception 'Payment missing' using errcode='P0002';end if;
  select * into found_refund from private.sandbox_refund_requests where payment_id=pay.payment_id;
  if found then return jsonb_build_object('claimed',false,'requestId',found_refund.request_id);end if;
  if rid is null or pay.status not in ('CONFIRMED','RECEIVED') then raise exception 'Payment not refundable' using errcode='23514';end if;
  insert into private.sandbox_refund_requests(request_id,payment_id,user_id) values(rid,pay.payment_id,uid);
  insert into private.sandbox_financial_audit(request_id,actor_id,action) values(pay.request_id,uid,'refund_requested');return jsonb_build_object('claimed',true,'requestId',rid);
 elsif command='refund_result' then
  update private.sandbox_refund_requests set state=case when p->>'state'='acknowledged' then 'acknowledged' else 'uncertain' end where request_id=rid;return jsonb_build_object('ok',found);
 else raise exception 'Unknown command' using errcode='22023';end if;
end;$$;
revoke all on function private.sandbox_billing_server(text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function private.sandbox_billing_server(text,text,bigint,uuid,text) to anon,authenticated;
create function public.sandbox_billing_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text) returns jsonb language sql security invoker set search_path='' as $$select private.sandbox_billing_server(command,raw_payload,issued_at,nonce,signature);$$;
revoke all on function public.sandbox_billing_server(text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.sandbox_billing_server(text,text,bigint,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
