-- Somente PostgreSQL descartável: prova de máquina não equivale a sessão humana.
begin;
select test.expect_error($q$select public.production_billing_server('due','{}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'55000','production: sem chave não aceita evento');
insert into private.production_billing_keys(key_digest) values(extensions.digest('LOCAL-PRODUCTION-TEST-KEY-ONLY','sha256'));
create function test.production_call(cmd text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare raw text:=p::text;t bigint:=extract(epoch from clock_timestamp())::bigint;n uuid:=gen_random_uuid();sig text;
begin
 sig:=encode(extensions.hmac(convert_to(cmd||E'\n'||n::text||E'\n'||t::text||E'\n'||raw,'UTF8'),extensions.digest('LOCAL-PRODUCTION-TEST-KEY-ONLY','sha256'),'sha256'),'hex');
 return public.production_billing_server(cmd,raw,t,n,sig);
end;$$;
set local role anon;
select test.expect_error('select * from private.production_billing_events','42501','production: anon não lê inbox');
select test.expect_error($q$select public.production_billing_server('due','{}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'42501','production: anon sem prova negado');
set local role authenticated;
select test.expect_error('insert into private.production_billing_bindings default values','42501','production: usuário não cria vínculo financeiro');
select test.expect_error('select * from private.production_billing_keys','42501','production: segredo privado');
reset role;
select gen_random_uuid() as replay_nonce,extract(epoch from clock_timestamp())::bigint as proof_time \gset
select encode(extensions.hmac(convert_to('due'||E'\n'||:'replay_nonce'||E'\n'||:'proof_time'||E'\n'||'{}','UTF8'),extensions.digest('LOCAL-PRODUCTION-TEST-KEY-ONLY','sha256'),'sha256'),'hex') as proof \gset
select public.production_billing_server('due','{}',:'proof_time',:'replay_nonce',:'proof');
select test.expect_error(format('select public.production_billing_server(''due'',''{}'',%L,%L,%L)',:'proof_time',:'replay_nonce',:'proof'),'23505','production: nonce não reutilizável');
select test.expect_error($q$select test.production_call('create_subscription','{}')$q$,'22023','production: nenhuma criação financeira');
select test.expect_error($q$select test.production_call('enqueue','{"eventId":"evt_test","eventType":"PAYMENT_RECEIVED","objectId":"pay_test","environment":"sandbox"}')$q$,'22023','production: Sandbox isolado');
insert into auth.users(id,email) values('00000000-0000-4000-8000-00000000f101','production-owner-local@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000f101';
select public.create_business('Fixture técnica local','production-local-only','autonomo','mundo-novo-ms') as bid \gset
reset role;
insert into private.production_billing_bindings(business_id,customer_id,subscription_id,external_reference,amount_cents,method,cycle,consent_at,terms_version) values(:'bid','cus_local','sub_local','00000000-0000-4000-8000-00000000f102',1234,'CREDIT_CARD','MONTHLY',now(),'LOCAL-NOT-A-PLAN') returning id as binding \gset
select test.assert_true(not (test.production_call('enqueue','{"eventId":"evt_local_a","eventType":"PAYMENT_RECEIVED","objectId":"pay_local","subscriptionId":"sub_local","environment":"production"}')->>'duplicate')::boolean,'production: inbox durável');
select test.assert_true((test.production_call('enqueue','{"eventId":"evt_local_a","eventType":"PAYMENT_RECEIVED","objectId":"pay_local","subscriptionId":"sub_local","environment":"production"}')->>'duplicate')::boolean,'production: deduplicação');
select test.expect_error($q$select test.production_call('enqueue','{"eventId":"evt_local_a","eventType":"PAYMENT_RECEIVED","objectId":"pay_other","subscriptionId":"sub_local","environment":"production"}')$q$,'23505','production: conflito não recebe ACK');
select test.production_call('claim','{"eventId":"evt_local_a"}')->>'leaseToken' as lease \gset
select test.assert_true(not (test.production_call('claim','{"eventId":"evt_local_a"}')->>'claimed')::boolean,'production: lease de evento exclusivo');
select test.production_call('binding',jsonb_build_object('eventId','evt_local_a','leaseToken',:'lease','subscriptionId','sub_local'));
select jsonb_build_object('eventId','evt_local_a','leaseToken',:'lease','bindingId',:'binding','subscriptionStatus','ACTIVE','payment',jsonb_build_object('paymentId','pay_local','subscriptionId','sub_local','customerId','cus_local','amountCents',1234,'refundedCents',0,'status','RECEIVED','settled',true)) as snapshot \gset
select test.expect_error(format('select test.production_call(''complete'',%L::jsonb||jsonb_build_object(''leaseToken'',gen_random_uuid()))',:'snapshot'),'40001','production: lease incorreto não grava');
select test.expect_error(format('select test.production_call(''complete'',jsonb_set(%L::jsonb,''{payment,customerId}'',''"cus_foreign"''))',:'snapshot'),'22023','production: cliente estrangeiro recusado');
select test.production_call('complete',:'snapshot');
select test.assert_true((select count(*)=1 from private.production_billing_payments),'production: uma observação');
select test.assert_true((select count(*)=1 from private.production_billing_audit),'production: auditoria única');
select test.assert_true(not (test.production_call('enqueue','{"eventId":"evt_local_a","eventType":"PAYMENT_RECEIVED","objectId":"pay_local","subscriptionId":"sub_local","environment":"production"}')->>'retryable')::boolean,'production: repetido processado sem efeito');
select test.assert_true((select status='draft' from public.businesses where id=:'bid'),'production: negócio não publicado');
select test.assert_true((select count(*)=0 from public.business_subscriptions),'production: não cria assinatura nem direitos');
select test.assert_true((select count(*)=0 from private.subscription_activations),'production: não inicia prazo');
select test.assert_true(public.platform_access_status()->>'phase'='initial_free','production: fase preservada');
select test.production_call('enqueue','{"eventId":"evt_local_b","eventType":"PAYMENT_CONFIRMED","objectId":"pay_local","subscriptionId":"sub_local","environment":"production"}');
select test.production_call('claim','{"eventId":"evt_local_b"}')->>'leaseToken' as lease2 \gset
select test.production_call('binding',jsonb_build_object('eventId','evt_local_b','leaseToken',:'lease2','subscriptionId','sub_local'));
select test.production_call('complete',jsonb_set(jsonb_set(jsonb_set(:'snapshot'::jsonb,'{eventId}','"evt_local_b"'),'{leaseToken}',to_jsonb(:'lease2'::text)),'{payment}',jsonb_build_object('paymentId','pay_local','subscriptionId','sub_local','customerId','cus_local','amountCents',1234,'refundedCents',1234,'status','REFUNDED','settled',false)));
select test.assert_true((select status='REFUNDED' and refunded_cents=1234 from private.production_billing_payments where payment_id='pay_local'),'production: evento antigo usa fotografia conciliada atual');
select test.production_call('enqueue','{"eventId":"evt_local_stale","eventType":"PAYMENT_CONFIRMED","objectId":"pay_local","subscriptionId":"sub_local","environment":"production"}');
select test.production_call('claim','{"eventId":"evt_local_stale"}')->>'leaseToken' as stale_paid \gset
select test.production_call('binding',jsonb_build_object('eventId','evt_local_stale','leaseToken',:'stale_paid','subscriptionId','sub_local'));
select test.expect_error(format('select test.production_call(''complete'',%L::jsonb||jsonb_build_object(''eventId'',''evt_local_stale'',''leaseToken'',%L))',:'snapshot',:'stale_paid'),'22023','production: API atrasada não desfaz estorno');
select test.production_call('fail',jsonb_build_object('eventId','evt_local_stale','leaseToken',:'stale_paid','code','RECONCILIATION_REQUIRED'));

select test.production_call('enqueue','{"eventId":"evt_local_c","eventType":"SUBSCRIPTION_UPDATED","objectId":"sub_local","subscriptionId":"sub_local","environment":"production"}');
select test.production_call('claim','{"eventId":"evt_local_c"}')->>'leaseToken' as stale \gset
update private.production_billing_events set lease_until=clock_timestamp()-interval '1 second' where event_id='evt_local_c';
select test.production_call('claim','{"eventId":"evt_local_c"}')->>'leaseToken' as fresh \gset
select test.expect_error(format('select test.production_call(''binding'',jsonb_build_object(''eventId'',''evt_local_c'',''leaseToken'',%L,''subscriptionId'',''sub_local''))',:'stale'),'40001','production: recuperação não aceita worker antigo');
select test.production_call('fail',jsonb_build_object('eventId','evt_local_c','leaseToken',:'fresh','code','UNAVAILABLE'));
select test.assert_true((select state='pending' and attempts=2 and next_attempt_at>clock_timestamp() and last_error='UNAVAILABLE' from private.production_billing_events where event_id='evt_local_c'),'production: falha durável com backoff');
select test.assert_true((select count(*)=1 from private.production_billing_bindings),'production: não cria vínculo a partir do evento');
rollback;
