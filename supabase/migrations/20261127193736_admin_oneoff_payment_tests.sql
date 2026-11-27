-- PROPOSTA #98. Não habilita receptor/testes nem altera monetização ou negócios.
begin;
set local lock_timeout='5s';
create table private.admin_oneoff_policy (
 environment text primary key check(environment in ('sandbox','production')),
 enabled_until timestamptz,
 changed_at timestamptz not null default clock_timestamp()
);
insert into private.admin_oneoff_policy(environment) values('sandbox'),('production');
create table private.admin_oneoff_requests (
 id uuid primary key,
 environment text not null references private.admin_oneoff_policy(environment),
 method text not null check(method in ('PIX','CREDIT_CARD')),
 amount_cents integer not null default 1990 check(amount_cents=1990),
 currency text not null default 'BRL' check(currency='BRL'),
 actor_id uuid not null references auth.users(id) on delete restrict,
 customer_id text not null check(customer_id ~ '^cus_[A-Za-z0-9_-]{1,150}$'),
 consent_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '1 hour'),
 state text not null default 'authorized' check(state in ('authorized','creating','uncertain','pending','paid','refused','overdue','refunded','partially_refunded','cancelled','expired','disputed','refund_pending')),
 checkout_id uuid,
 payment_id text check(payment_id is null or payment_id ~ '^pay_[A-Za-z0-9_-]{1,150}$'),
 provider_status text,
 net_cents integer check(net_cents is null or net_cents between 0 and 1990),
 refunded_cents integer not null default 0 check(refunded_cents between 0 and 1990),
 diagnostic text check(diagnostic in ('creation_uncertain','reconciliation_required','mismatch')),
 lease uuid, lease_until timestamptz, last_checked_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 unique(environment,method), -- duas operações por ambiente, sem reciclar cota após cancelamento/estorno
 unique(environment,checkout_id),unique(environment,payment_id)
);
create table private.admin_oneoff_events (
 environment text not null references private.admin_oneoff_policy(environment),
 event_id text not null check(event_id ~ '^[A-Za-z0-9_&-]{3,200}$'),
 notice jsonb not null,
 request_id uuid references private.admin_oneoff_requests(id) on delete restrict,
 state text not null check(state in ('pending','processing','processed','ignored','retry')),
 attempts integer not null default 0,
 lease uuid,lease_until timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),
 received_at timestamptz not null default clock_timestamp(),
 primary key(environment,event_id)
);
create index admin_oneoff_events_retry on private.admin_oneoff_events(environment,next_attempt_at) where state in ('pending','retry','processing');
create table private.admin_oneoff_nonces (environment text not null,id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(environment,id));
create table private.admin_oneoff_audit (
 id bigint generated always as identity primary key,
 environment text not null,actor_id uuid references auth.users(id) on delete restrict,
 request_id uuid references private.admin_oneoff_requests(id) on delete restrict,
 action text not null,reason text,created_at timestamptz not null default clock_timestamp()
);
alter table private.admin_oneoff_policy enable row level security;
alter table private.admin_oneoff_requests enable row level security;
alter table private.admin_oneoff_events enable row level security;
alter table private.admin_oneoff_nonces enable row level security;
alter table private.admin_oneoff_audit enable row level security;
revoke all on private.admin_oneoff_policy,private.admin_oneoff_requests,private.admin_oneoff_events,private.admin_oneoff_nonces,private.admin_oneoff_audit from public,anon,authenticated;

-- Production só pode abrir janela após ambos os meios avulsos no Sandbox,
-- com pagamento conciliado e pelo menos uma entrega de webhook processada.
create function private.admin_oneoff_sandbox_ready() returns boolean language sql stable security definer set search_path='' as $$
 select count(*)=2 from private.admin_oneoff_requests r where r.environment='sandbox' and r.payment_id is not null and r.state in ('paid','refunded','partially_refunded') and exists(select 1 from private.admin_oneoff_events e where e.environment='sandbox' and e.request_id=r.id and e.state='processed' and e.notice->>'eventType' in ('CHECKOUT_PAID','PAYMENT_CONFIRMED','PAYMENT_RECEIVED'));
$$;
revoke all on function private.admin_oneoff_sandbox_ready() from public,anon,authenticated;

-- Prova com os digests já provisionados, domínio independente do protocolo de assinaturas.
create function public.admin_oneoff_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;e text;key_bytes bytea;actor uuid;rid uuid;r private.admin_oneoff_requests;ev private.admin_oneoff_events;l uuid;changed boolean;s text;
begin
 if raw_payload is null or command is null or issued_at is null or signature is null or octet_length(raw_payload)>8192 or abs(extract(epoch from clock_timestamp())-issued_at)>120 or signature !~ '^[0-9a-f]{64}$' or nonce is null then raise exception 'Invalid proof' using errcode='42501';end if;
 p:=raw_payload::jsonb;e:=p->>'environment';
 if e is null or e not in ('sandbox','production') or jsonb_typeof(p)<>'object' then raise exception 'Invalid environment' using errcode='22023';end if;
 if e='production' then select key_digest into key_bytes from private.production_billing_keys where id;
 else select key_digest into key_bytes from private.sandbox_backend_keys where id;end if;
 if key_bytes is null then raise exception 'Server not provisioned' using errcode='55000';end if;
 if not private.sandbox_same_bytes(extensions.hmac(convert_to('oneoff-v1'||E'\n'||command||E'\n'||nonce::text||E'\n'||issued_at::text||E'\n'||raw_payload,'UTF8'),key_bytes,'sha256'),decode(signature,'hex')) then raise exception 'Invalid server proof' using errcode='42501';end if;
 insert into private.admin_oneoff_nonces(environment,id) values(e,nonce);
 actor:=nullif(p->>'actorId','')::uuid;rid:=nullif(p->>'requestId','')::uuid;
 if command in ('status','configure','authorize','start','context','claim','retry') then
  if not exists(select 1 from private.platform_admins a join auth.users u on u.id=a.user_id where a.user_id=actor and u.email_confirmed_at is not null and private.account_enabled(actor)) then raise exception 'Confirmed administrator required' using errcode='42501';end if;
 end if;
 if command='status' then
  return jsonb_build_object('environment',e,'enabledUntil',(select enabled_until from private.admin_oneoff_policy where environment=e),'items',coalesce((select jsonb_agg((to_jsonb(x)-array['actor_id','customer_id','lease','lease_until']) order by created_at) from private.admin_oneoff_requests x where environment=e),'[]'::jsonb),'sandboxReady',private.admin_oneoff_sandbox_ready(),'maxTotalCents',3980,'maxPerMethod',1,'eventsPending',(select count(*) from private.admin_oneoff_events where environment=e and state in ('pending','processing','retry')),'eventsIgnored',(select count(*) from private.admin_oneoff_events where environment=e and state='ignored'),'lastEventReceivedAt',(select max(received_at) from private.admin_oneoff_events where environment=e));
 elsif command='configure' then
  if p->>'confirmation' is distinct from 'CONFIRMAR TESTE AVULSO' or char_length(btrim(coalesce(p->>'reason',''))) not between 5 and 500 or jsonb_typeof(p->'enabled') is distinct from 'boolean' then raise exception 'Explicit confirmation required' using errcode='22023';end if;
  if e='production' and p->'enabled'='true'::jsonb and not private.admin_oneoff_sandbox_ready() then raise exception 'Sandbox validation required' using errcode='55000';end if;
  perform 1 from private.admin_oneoff_policy where environment=e for update;
  update private.admin_oneoff_policy set enabled_until=case when (p->>'enabled')::boolean then clock_timestamp()+interval '1 hour' else null end,changed_at=clock_timestamp() where environment=e;
  insert into private.admin_oneoff_audit(environment,actor_id,action,reason) values(e,actor,'configure',p->>'reason');return jsonb_build_object('ok',true);
 elsif command='authorize' then
  if e='production' and not private.admin_oneoff_sandbox_ready() then raise exception 'Sandbox validation required' using errcode='55000';end if;
  perform 1 from private.admin_oneoff_policy where environment=e and enabled_until>clock_timestamp() for update;
  if not found then raise exception 'Test disabled' using errcode='55000';end if;
  if rid is null or p->>'confirmation' is distinct from 'AUTORIZO TESTE AVULSO 19,90' or p->'payerConsent' is distinct from 'true'::jsonb or coalesce(p->>'customerId','') !~ '^cus_[A-Za-z0-9_-]{1,150}$' or coalesce(p->>'method','') not in ('PIX','CREDIT_CARD') then raise exception 'Explicit payer consent required' using errcode='22023';end if;
  select * into r from private.admin_oneoff_requests where id=rid;
  if found then
   if r.environment<>e or r.actor_id<>actor or r.customer_id<>p->>'customerId' or r.method<>p->>'method' then raise exception 'Idempotency conflict' using errcode='23505';end if;
   return to_jsonb(r);
  end if;
  insert into private.admin_oneoff_requests(id,environment,method,actor_id,customer_id) values(rid,e,p->>'method',actor,p->>'customerId') returning * into r;
  insert into private.admin_oneoff_audit(environment,actor_id,request_id,action) values(e,actor,rid,'authorized');return to_jsonb(r);
 elsif command in ('context','event_context','start','claim','save_checkout','uncertain','snapshot','observe_checkout','reconciliation_failed') then
  select * into r from private.admin_oneoff_requests where id=rid and environment=e for update;
  if not found then raise exception 'Request missing' using errcode='P0002';end if;
  if command in ('context','event_context') then return to_jsonb(r);end if;
  if command='start' then
   if e='production' and not private.admin_oneoff_sandbox_ready() then raise exception 'Sandbox validation required' using errcode='55000';end if;
   if r.actor_id<>actor or p->>'confirmation' is distinct from 'CRIAR CHECKOUT AVULSO 19,90' then raise exception 'Creation consent required' using errcode='42501';end if;
   if not exists(select 1 from private.admin_oneoff_policy where environment=e and enabled_until>clock_timestamp()) or r.expires_at<=clock_timestamp() then raise exception 'Test disabled or expired' using errcode='55000';end if;
   if r.state<>'authorized' then return jsonb_build_object('create',false,'request',to_jsonb(r));end if;
   update private.admin_oneoff_requests set state='creating' where id=rid returning * into r;
   insert into private.admin_oneoff_audit(environment,actor_id,request_id,action) values(e,actor,rid,'creation_claimed');return jsonb_build_object('create',true,'request',to_jsonb(r));
  elsif command='save_checkout' then
   if r.checkout_id is not null and r.checkout_id<>(p->>'checkoutId')::uuid then raise exception 'Checkout immutable' using errcode='23514';end if;
   update private.admin_oneoff_requests set checkout_id=(p->>'checkoutId')::uuid,state=case when state in ('creating','uncertain','authorized') then 'pending' else state end,diagnostic=null where id=rid returning * into r;return to_jsonb(r);
  elsif command='uncertain' then
   update private.admin_oneoff_requests set state=case when state='creating' then 'uncertain' else state end,diagnostic='creation_uncertain' where id=rid;return jsonb_build_object('ok',true);
  elsif command='claim' then
   if r.lease_until>clock_timestamp() or r.last_checked_at>clock_timestamp()-interval '10 seconds' then return null;end if;
   l:=gen_random_uuid();update private.admin_oneoff_requests set lease=l,lease_until=clock_timestamp()+interval '60 seconds',last_checked_at=clock_timestamp() where id=rid;
   return jsonb_build_object('request',to_jsonb(r),'lease',l);
  end if;
  if r.lease is distinct from (p->>'lease')::uuid or r.lease_until<=clock_timestamp() then raise exception 'Lease expired' using errcode='40001';end if;
  if command='reconciliation_failed' then
   update private.admin_oneoff_requests set diagnostic=case when p->>'diagnostic'='mismatch' then 'mismatch' else 'reconciliation_required' end,lease=null,lease_until=null where id=rid;
   insert into private.admin_oneoff_audit(environment,request_id,action) values(e,rid,'reconciliation_failed');return jsonb_build_object('ok',true);
  end if;
  if command='observe_checkout' then
   update private.admin_oneoff_requests set state=case when checkout_id is not null and payment_id is null and state not in ('paid','refunded','partially_refunded') and p->>'state' in ('pending','cancelled','expired') then p->>'state' else state end,lease=null,lease_until=null where id=rid;return jsonb_build_object('ok',true);
  end if;
  if r.checkout_id is null or (p->>'amountCents')::integer is distinct from r.amount_cents or p->>'method' is distinct from r.method or p->>'customerId' is distinct from r.customer_id or p->>'currency' is distinct from 'BRL' or coalesce(p->>'subscriptionId','')<>'' or coalesce(p->>'installmentId','')<>'' or (p->>'checkoutId')::uuid is distinct from r.checkout_id or coalesce(p->>'paymentId','') !~ '^pay_[A-Za-z0-9_-]{1,150}$' then raise exception 'Payment mismatch' using errcode='23514';end if;
  s:=case p->>'status' when 'CONFIRMED' then 'paid' when 'RECEIVED' then 'paid' when 'PENDING' then 'pending' when 'OVERDUE' then 'overdue' when 'CREDIT_CARD_CAPTURE_REFUSED' then 'refused' when 'REPROVED_BY_RISK_ANALYSIS' then 'refused' when 'REFUNDED' then 'refunded' when 'PARTIALLY_REFUNDED' then 'partially_refunded' when 'DELETED' then 'cancelled' when 'REFUND_REQUESTED' then 'refund_pending' when 'CHARGEBACK_REQUESTED' then 'disputed' when 'CHARGEBACK_DISPUTE' then 'disputed' when 'AWAITING_CHARGEBACK_REVERSAL' then 'disputed' else 'pending' end;
  if r.payment_id is not null and r.payment_id<>p->>'paymentId' or r.refunded_cents>(p->>'refundedCents')::integer or r.state='refunded' and s<>'refunded' or r.state='paid' and s in ('pending','overdue','refused') then raise exception 'Regression requires review' using errcode='23514';end if;
  changed:=r.state is distinct from s or r.provider_status is distinct from p->>'status' or r.refunded_cents is distinct from (p->>'refundedCents')::integer;
  update private.admin_oneoff_requests set state=s,payment_id=p->>'paymentId',provider_status=p->>'status',net_cents=(p->>'netCents')::integer,refunded_cents=(p->>'refundedCents')::integer,diagnostic=null,lease=null,lease_until=null where id=rid;
  if changed then insert into private.admin_oneoff_audit(environment,request_id,action) values(e,rid,'payment_reconciled');end if;return jsonb_build_object('ok',true);
 elsif command='enqueue' then
  if coalesce(p->>'eventId','') !~ '^[A-Za-z0-9_&-]{3,200}$' or coalesce(p->>'objectId','') !~ '^[A-Za-z0-9_-]{3,160}$' or coalesce(p->>'eventType','') !~ '^(CHECKOUT|PAYMENT)_[A-Z_]{1,80}$' or (p-array['environment','eventId','objectId','eventType','checkoutId','reference'])<>'{}'::jsonb then raise exception 'Invalid notice' using errcode='22023';end if;
  select * into ev from private.admin_oneoff_events where environment=e and event_id=p->>'eventId';
  if found then if ev.notice<>p then raise exception 'Event conflict' using errcode='23505';end if;return jsonb_build_object('duplicate',true,'requestId',ev.request_id);end if;
  if (select count(*) from private.admin_oneoff_requests where environment=e and ((p->>'checkoutId' is not null and checkout_id::text=p->>'checkoutId') or (p->>'reference' is not null and id::text=p->>'reference')))>1 then raise exception 'Ambiguous scope' using errcode='23514';end if;
  select * into r from private.admin_oneoff_requests where environment=e and ((p->>'checkoutId' is not null and checkout_id::text=p->>'checkoutId') or (p->>'reference' is not null and id::text=p->>'reference'));
  insert into private.admin_oneoff_events(environment,event_id,notice,request_id,state) values(e,p->>'eventId',p,case when r.id is not null then r.id else null end,case when r.id is null then 'ignored' else 'pending' end) on conflict(environment,event_id) do nothing;
  changed:=found;
  select * into ev from private.admin_oneoff_events where environment=e and event_id=p->>'eventId';
  if ev.notice<>p then raise exception 'Event conflict' using errcode='23505';end if;
  return jsonb_build_object('duplicate',not changed,'requestId',ev.request_id);
 elsif command='claim_event' then
  select * into ev from private.admin_oneoff_events where environment=e and event_id=p->>'eventId' and state in ('pending','retry','processing') and (lease_until is null or lease_until<clock_timestamp()) for update skip locked;
  if not found then return null;end if;l:=gen_random_uuid();
  update private.admin_oneoff_events set state='processing',lease=l,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 where environment=e and event_id=ev.event_id;
  return jsonb_build_object('requestId',ev.request_id,'notice',ev.notice,'lease',l);
 elsif command='finish_event' then
  update private.admin_oneoff_events set state=case when p->'ok'='true'::jsonb then 'processed' else 'retry' end,next_attempt_at=clock_timestamp()+interval '1 minute',lease=null,lease_until=null where environment=e and event_id=p->>'eventId' and lease=(p->>'lease')::uuid and lease_until>clock_timestamp();return jsonb_build_object('ok',found);
 elsif command='retry' then
  return coalesce((select jsonb_agg(event_id) from(select event_id from private.admin_oneoff_events where environment=e and state in ('pending','retry','processing') and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by received_at limit 10)x),'[]'::jsonb);
 end if;
 raise exception 'Invalid command' using errcode='22023';
end;$$;
revoke all on function public.admin_oneoff_server(text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_oneoff_server(text,text,bigint,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
