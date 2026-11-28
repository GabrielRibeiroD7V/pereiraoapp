begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000007801','oneoff-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000007802','oneoff-other@example.invalid',now()),
('00000000-0000-4000-8000-000000007803','oneoff-unconfirmed@example.invalid',null),
('00000000-0000-4000-8000-000000007804','oneoff-second-admin@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000007801'),('00000000-0000-4000-8000-000000007803'),('00000000-0000-4000-8000-000000007804');
insert into private.sandbox_backend_keys(key_digest) values(extensions.digest('ONEOFF-SANDBOX-LOCAL','sha256')) on conflict(id) do update set key_digest=excluded.key_digest;
insert into private.production_billing_keys(key_digest) values(extensions.digest('ONEOFF-PRODUCTION-LOCAL','sha256')) on conflict(id) do update set key_digest=excluded.key_digest;
create temp table oneoff_baseline as select (select count(*) from public.businesses) businesses,(select count(*) from public.business_subscriptions) subscriptions,(select count(*) from private.subscription_activations) activations,(select count(*) from private.billing_exempt_accounts) exemptions,(select count(*) from private.production_billing_bindings) bindings;
-- Somente fixture de assinatura no cluster descartável; nunca no remoto.
create function test.oneoff(cmd text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n uuid:=gen_random_uuid();t bigint:=extract(epoch from clock_timestamp())::bigint;k text;s text;
begin
 k:=case p->>'environment' when 'production' then 'ONEOFF-PRODUCTION-LOCAL' else 'ONEOFF-SANDBOX-LOCAL' end;
 s:=encode(extensions.hmac(convert_to('oneoff-v1'||E'\n'||cmd||E'\n'||n::text||E'\n'||t::text||E'\n'||p::text,'UTF8'),extensions.digest(k,'sha256'),'sha256'),'hex');
 return public.admin_oneoff_server(cmd,p::text,t,n,s);
end;$$;
grant execute on function test.oneoff(text,jsonb) to anon,authenticated;
set local role anon;
select test.expect_error('select * from private.admin_oneoff_requests','42501','oneoff: anon cannot read operations');
select test.expect_error($q$select public.admin_oneoff_server('status','{}',null,gen_random_uuid(),null)$q$,'42501','oneoff: null proof rejected');
select test.expect_error($q$select public.admin_oneoff_server('status','{"environment":"sandbox"}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'42501','oneoff: invalid HMAC rejected');
-- Replay assinado e separação de domínio do protocolo de assinaturas.
reset role;
select gen_random_uuid() as n,extract(epoch from clock_timestamp())::bigint as t \gset
select '{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801"}' as body \gset
select encode(extensions.hmac(convert_to('oneoff-v1'||E'\nstatus\n'||:'n'||E'\n'||:'t'||E'\n'||:'body','UTF8'),extensions.digest('ONEOFF-SANDBOX-LOCAL','sha256'),'sha256'),'hex') as sig \gset
select public.admin_oneoff_server('status',:'body',:'t',:'n',:'sig');
select test.expect_error(format('select public.admin_oneoff_server(''status'',%L,%L,%L,%L)',:'body',:'t',:'n',:'sig'),'23505','oneoff: nonce replay rejected');
select gen_random_uuid() as other_n \gset
select encode(extensions.hmac(convert_to('status'||E'\n'||:'other_n'||E'\n'||:'t'||E'\n'||:'body','UTF8'),extensions.digest('ONEOFF-SANDBOX-LOCAL','sha256'),'sha256'),'hex') as old_sig \gset
select test.expect_error(format('select public.admin_oneoff_server(''status'',%L,%L,%L,%L)',:'body',:'t',:'other_n',:'old_sig'),'42501','oneoff: other billing protocol signature rejected');
set local role authenticated;
select test.expect_error($q$select test.oneoff('status','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007802"}')$q$,'42501','oneoff: ordinary user denied');
select test.expect_error($q$select test.oneoff('status','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007803"}')$q$,'42501','oneoff: unconfirmed admin denied');
select test.assert_true(test.oneoff('status','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801"}')->'enabledUntil'='null'::jsonb,'oneoff: production starts disabled');
select test.expect_error($q$select test.oneoff('configure','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801","enabled":true,"reason":"Bloqueio local","confirmation":"CONFIRMAR TESTE AVULSO"}')$q$,'55000','oneoff: cannot enable production before both sandbox methods and webhook');
select test.expect_error($q$select test.oneoff('configure','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","enabled":true,"reason":"Teste local","confirmation":""}')$q$,'22023','oneoff: global confirmation required');
select test.oneoff('configure','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","enabled":true,"reason":"Teste local","confirmation":"CONFIRMAR TESTE AVULSO"}');
select test.assert_true(test.oneoff('status','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801"}')->'enabledUntil'='null'::jsonb,'oneoff: sandbox enablement cannot enable production');
select '{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811","method":"PIX","customerId":"cus_local","payerConsent":true,"confirmation":"AUTORIZO TESTE AVULSO 19,90"}' as consent \gset
select test.expect_error(format('select test.oneoff(''authorize'',%L::jsonb||''{"environment":"production"}''::jsonb)',:'consent'),'55000','oneoff: production database gate also required');
select test.expect_error(format('select test.oneoff(''authorize'',%L::jsonb||''{"payerConsent":false}''::jsonb)',:'consent'),'22023','oneoff: payer consent required');
select test.assert_true(test.oneoff('authorize',:'consent')->>'amount_cents'='1990','oneoff: fixed 19.90');
select test.assert_true(test.oneoff('authorize',:'consent')->>'id'='00000000-0000-4000-8000-000000007811','oneoff: idempotent authorization');
select test.oneoff('authorize',:'consent'::jsonb||'{"requestId":"00000000-0000-4000-8000-000000007812","method":"CREDIT_CARD"}'::jsonb);
select test.expect_error(format('select test.oneoff(''authorize'',%L::jsonb||''{"requestId":"00000000-0000-4000-8000-000000007813"}''::jsonb)',:'consent'),'23505','oneoff: one operation per method');
select test.expect_error('update private.admin_oneoff_requests set amount_cents=1','42501','oneoff: direct write denied');
select test.expect_error($q$select test.oneoff('start','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007804","requestId":"00000000-0000-4000-8000-000000007811","confirmation":"CRIAR CHECKOUT AVULSO 19,90"}')$q$,'42501','oneoff: another admin cannot reuse original creation consent');
select test.assert_true(test.oneoff('start','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811","confirmation":"CRIAR CHECKOUT AVULSO 19,90"}')->>'create'='true','oneoff: first creation claimed');
select test.assert_true(test.oneoff('start','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811","confirmation":"CRIAR CHECKOUT AVULSO 19,90"}')->>'create'='false','oneoff: second POST never authorized');
select test.oneoff('uncertain','{"environment":"sandbox","requestId":"00000000-0000-4000-8000-000000007811"}');
select test.assert_true(test.oneoff('start','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811","confirmation":"CRIAR CHECKOUT AVULSO 19,90"}')->>'create'='false','oneoff: uncertain result cannot create again');
select test.oneoff('save_checkout','{"environment":"sandbox","requestId":"00000000-0000-4000-8000-000000007811","checkoutId":"00000000-0000-4000-8000-000000007821"}');
select test.expect_error($q$select test.oneoff('save_checkout','{"environment":"sandbox","requestId":"00000000-0000-4000-8000-000000007811","checkoutId":"00000000-0000-4000-8000-000000007822"}')$q$,'23514','oneoff: checkout immutable');
select test.oneoff('claim','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811"}')->>'lease' as lease \gset
select jsonb_build_object('environment','sandbox','requestId','00000000-0000-4000-8000-000000007811','lease',:'lease','checkoutId','00000000-0000-4000-8000-000000007821','paymentId','pay_oneoff','amountCents',1990,'method','PIX','customerId','cus_local','currency','BRL','subscriptionId',null,'installmentId',null,'status','RECEIVED','netCents',1900,'refundedCents',0) as snapshot \gset
select test.expect_error(format('select test.oneoff(''snapshot'',%L::jsonb||''{"amountCents":1999}''::jsonb)',:'snapshot'),'23514','oneoff: wrong value rejected by database');
select test.expect_error(format('select test.oneoff(''snapshot'',%L::jsonb||''{"subscriptionId":"sub_forbidden"}''::jsonb)',:'snapshot'),'23514','oneoff: recurring payment rejected');
select test.oneoff('snapshot',:'snapshot');
select test.assert_true(not ((test.oneoff('status','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801"}')->'items'->0) ?| array['lease','lease_until','customer_id','actor_id']),'oneoff: status never exposes internal leases or payer identifiers');
select test.assert_true(test.oneoff('context','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811"}')->>'state'='paid','oneoff: reconciled payment persisted');
select test.expect_error($q$select test.oneoff('context','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811"}')$q$,'P0002','oneoff: environment isolation');
select test.assert_true(test.oneoff('enqueue','{"environment":"sandbox","eventId":"evt_foreign","eventType":"PAYMENT_RECEIVED","objectId":"pay_foreign","checkoutId":null,"reference":null}')->'requestId'='null'::jsonb,'oneoff: unrelated event ignored without binding');
reset role;
select test.assert_true((select state='ignored' and request_id is null from private.admin_oneoff_events where environment='sandbox' and event_id='evt_foreign'),'oneoff: direct Edge unbound notice is durably quarantined');
select test.assert_true(test.oneoff('claim_event','{"environment":"sandbox","eventId":"evt_foreign"}') is null,'oneoff: quarantined notification never enters reconciliation');
set local role anon;
select test.expect_error($q$insert into private.admin_oneoff_events(environment,event_id,notice,state) values('sandbox','evt_forbidden','{}','pending')$q$,'42501','oneoff: publishable key alone cannot write inbox');
select test.oneoff('enqueue','{"environment":"sandbox","eventId":"evt_known","eventType":"CHECKOUT_PAID","objectId":"00000000-0000-4000-8000-000000007821","checkoutId":"00000000-0000-4000-8000-000000007821","reference":null}');
select test.assert_true(test.oneoff('enqueue','{"environment":"sandbox","eventId":"evt_known","eventType":"CHECKOUT_PAID","objectId":"00000000-0000-4000-8000-000000007821","checkoutId":"00000000-0000-4000-8000-000000007821","reference":null}')->>'duplicate'='true','oneoff: repeated event deduplicated');
select test.expect_error($q$select test.oneoff('enqueue','{"environment":"sandbox","eventId":"evt_known","eventType":"CHECKOUT_EXPIRED","objectId":"00000000-0000-4000-8000-000000007821","checkoutId":"00000000-0000-4000-8000-000000007821","reference":null}')$q$,'23505','oneoff: conflicting event rejected');
reset role;
update private.admin_oneoff_requests set last_checked_at=null where id='00000000-0000-4000-8000-000000007811';
select test.oneoff('claim','{"environment":"sandbox","actorId":"00000000-0000-4000-8000-000000007801","requestId":"00000000-0000-4000-8000-000000007811"}')->>'lease' as new_lease \gset
select test.expect_error(format('select test.oneoff(''snapshot'',%L::jsonb||jsonb_build_object(''lease'',%L,''status'',''PENDING''))',:'snapshot',:'new_lease'),'23514','oneoff: old event cannot downgrade confirmed payment');
select test.oneoff('snapshot',:'snapshot'::jsonb||jsonb_build_object('lease',:'new_lease','status','REFUNDED','refundedCents',1990));
select test.assert_true((select state='refunded' from private.admin_oneoff_requests where id='00000000-0000-4000-8000-000000007811'),'oneoff: refund state persisted without deleting history');
select test.expect_error(format('select test.oneoff(''authorize'',%L::jsonb||''{"requestId":"00000000-0000-4000-8000-000000007813"}''::jsonb)',:'consent'),'23505','oneoff: refund does not free quota');
select test.assert_true((select sum(amount_cents) from private.admin_oneoff_requests where environment='sandbox')=3980,'oneoff: transactional lifetime cap 39.80');
select test.assert_true(exists(select 1 from private.admin_oneoff_audit where action='payment_reconciled'),'oneoff: financial audit durable');
select test.assert_true((select count(*) from public.businesses)=(select businesses from oneoff_baseline) and (select count(*) from public.business_subscriptions)=(select subscriptions from oneoff_baseline) and (select count(*) from private.subscription_activations)=(select activations from oneoff_baseline) and (select count(*) from private.billing_exempt_accounts)=(select exemptions from oneoff_baseline) and (select count(*) from private.production_billing_bindings)=(select bindings from oneoff_baseline),'oneoff: businesses contracts free phase and exemptions preserved');
-- Somente dados sintéticos locais: provar a dependência positiva de ambas as modalidades.
select test.assert_true(not private.admin_oneoff_sandbox_ready(),'oneoff: one method is not full sandbox validation');
update private.admin_oneoff_requests set state='paid',payment_id='pay_card_local',checkout_id='00000000-0000-4000-8000-000000007822' where id='00000000-0000-4000-8000-000000007812';
insert into private.admin_oneoff_events(environment,event_id,notice,request_id,state) values
('sandbox','evt_local_processed_pix','{"eventType":"PAYMENT_RECEIVED"}','00000000-0000-4000-8000-000000007811','processed'),
('sandbox','evt_local_processed_card','{"eventType":"PAYMENT_CONFIRMED"}','00000000-0000-4000-8000-000000007812','processed');
select test.assert_true(private.admin_oneoff_sandbox_ready(),'oneoff: both reconciled methods and delivered events required');
select test.oneoff('configure','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801","enabled":true,"reason":"Fixture local completa","confirmation":"CONFIRMAR TESTE AVULSO"}');
select test.assert_true((select count(*) from private.admin_oneoff_requests where environment='production')=0,'oneoff: enabling window never creates real operations');
select test.oneoff('configure','{"environment":"production","actorId":"00000000-0000-4000-8000-000000007801","enabled":false,"reason":"Contencao fixture local","confirmation":"CONFIRMAR TESTE AVULSO"}');
select test.assert_true(not exists(select 1 from pg_class where relnamespace='private'::regnamespace and relname like 'admin_oneoff_%' and relkind='r' and not relrowsecurity),'oneoff: all tables use RLS');
rollback;
