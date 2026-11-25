-- PROPOSTA: exige autorização própria antes de qualquer aplicação remota.
-- Acrescenta auditoria privada de revisão manual. Não altera credenciais ou dados comerciais.
-- processed + IGNORED_* registra conclusão sem conciliação; não escreve auditoria financeira.
begin;
create table private.production_billing_scope_reviews (
 id uuid primary key default gen_random_uuid(),
 event_id text not null unique references private.production_billing_events(event_id) on delete restrict,
 binding_id uuid not null references private.production_billing_bindings(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(char_length(btrim(reason)) between 10 and 500),
 original_disposition text not null check(original_disposition in ('IGNORED_UNBOUND','IGNORED_NO_SUBSCRIPTION_LINK')),
 ignored_at timestamptz not null,
 reviewed_at timestamptz not null default clock_timestamp()
);
alter table private.production_billing_scope_reviews enable row level security;
revoke all on private.production_billing_scope_reviews from public,anon,authenticated;
create or replace function private.production_billing_server(command text,raw_payload text,issued_at bigint,nonce uuid,signature text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 elsif command in ('scope_target','scope_requeue') then
  -- HMAC alone never stands in for an enabled administrator at the API boundary.
  if not exists(select 1 from private.platform_admins where user_id=(p->>'reviewerId')::uuid)
   or not private.account_enabled((p->>'reviewerId')::uuid) then
   raise exception 'Administrator required' using errcode='42501';
  end if;
  if coalesce(char_length(btrim(p->>'reason')),0) not between 10 and 500 then
   raise exception 'Review reason required' using errcode='22023';
  end if;
  select * into e from private.production_billing_events where event_id=p->>'eventId' for update;
  if not found or e.state<>'processed' or coalesce(e.last_error,'') not in ('IGNORED_UNBOUND','IGNORED_NO_SUBSCRIPTION_LINK')
   or e.binding_id is not null or exists(select 1 from private.production_billing_scope_reviews where event_id=e.event_id) then
   raise exception 'Event not reviewable' using errcode='22023';
  end if;
  select * into b from private.production_billing_bindings where subscription_id=p->>'subscriptionId' for update;
  if not found then raise exception 'Existing consented binding required' using errcode='22023';end if;
  if e.notice->>'subscriptionId' is not null and e.notice->>'subscriptionId' is distinct from b.subscription_id then
   raise exception 'Wrong notice subscription' using errcode='22023';
  end if;
  if command='scope_target' then
   return jsonb_build_object('notice',e.notice,'binding',to_jsonb(b)-array['consent_at','terms_version','lease_token','lease_until','observed_status']);
  end if;
  insert into private.production_billing_scope_reviews(event_id,binding_id,reviewer_id,reason,original_disposition,ignored_at)
   values(e.event_id,b.id,(p->>'reviewerId')::uuid,btrim(p->>'reason'),e.last_error,e.processed_at);
  update private.production_billing_events set state='pending',processed_at=null,last_error=null,
   next_attempt_at=clock_timestamp(),binding_id=b.id,lease_token=null,lease_until=null where event_id=e.event_id;
  return '{"requeued":true,"rightsChanged":false}'::jsonb;
 elsif command='claim' then
  token:=gen_random_uuid();
  update private.production_billing_events set state='processing',attempts=attempts+1,lease_token=token,lease_until=clock_timestamp()+interval '45 seconds'
   where event_id=p->>'eventId' and state<>'processed' and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) returning * into e;
  if not found then return '{"claimed":false}'::jsonb;end if;
  return jsonb_build_object('claimed',true,'notice',case when e.notice->>'subscriptionId' is null and e.binding_id is not null then e.notice||jsonb_build_object('subscriptionId',(select subscription_id from private.production_billing_bindings where id=e.binding_id)) else e.notice end,'leaseToken',token);
 elsif command in ('binding','complete','fail','ignore_unbound') then
  select * into e from private.production_billing_events where event_id=p->>'eventId' for update;
  if not found or e.state<>'processing' or e.lease_token is distinct from (p->>'leaseToken')::uuid or e.lease_until<clock_timestamp() then raise exception 'Stale lease' using errcode='40001';end if;
  if command='ignore_unbound' then
   -- Serialize the negative scope check against any future consent provisioning.
   -- An event that has ever acquired a binding cannot be discarded as unrelated.
   lock table private.production_billing_bindings in share mode;
   if e.binding_id is not null or exists(
    select 1 from private.production_billing_bindings
    where subscription_id=e.notice->>'subscriptionId'
   ) then raise exception 'Bound event requires reconciliation' using errcode='22023';end if;
   update private.production_billing_events set state='processed',processed_at=clock_timestamp(),
    last_error=case when e.notice->>'subscriptionId' is null then 'IGNORED_NO_SUBSCRIPTION_LINK' else 'IGNORED_UNBOUND' end,
    lease_token=null,lease_until=null where event_id=e.event_id;
   return '{"ignored":true,"rightsChanged":false}'::jsonb;
  elsif command='binding' then
   if p->>'subscriptionId' is distinct from coalesce(e.notice->>'subscriptionId',(select subscription_id from private.production_billing_bindings where id=e.binding_id)) then
    raise exception 'Wrong notice subscription' using errcode='22023';
   end if;
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
commit;
