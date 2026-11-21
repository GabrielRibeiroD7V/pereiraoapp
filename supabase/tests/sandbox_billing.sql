-- Exclusivamente cluster temporário; nenhuma sessão/remoto é simulada.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000009001','sandbox-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000009002','sandbox-owner@example.invalid',now()),
('00000000-0000-4000-8000-000000009003','sandbox-other@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000009001');
select test.expect_error($q$select public.sandbox_billing_server('admin_overview','{}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'55000','sandbox: não provisionado falha fechado');
insert into private.sandbox_backend_keys(key_digest) values(extensions.digest('FIXTURE-LOCAL-SEM-VALOR-REMOTO','sha256'));
-- Assinador disponível SOMENTE na fixture revertida; nunca vai para migrações.
create function test.sandbox(cmd text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n uuid:=gen_random_uuid();t bigint:=extract(epoch from clock_timestamp())::bigint;s text;
begin
 s:=encode(extensions.hmac(convert_to(cmd||E'\n'||n::text||E'\n'||t::text||E'\n'||p::text,'UTF8'),extensions.digest('FIXTURE-LOCAL-SEM-VALOR-REMOTO','sha256'),'sha256'),'hex');
 return public.sandbox_billing_server(cmd,p::text,t,n,s);
end;$$;
grant execute on function test.sandbox(text,jsonb) to anon,authenticated;
select test.expect_error($q$select public.sandbox_billing_server('admin_overview','{}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'42501','sandbox: assinatura inválida');
select test.expect_error($q$select public.sandbox_billing_server('admin_overview','{}',1,gen_random_uuid(),repeat('0',64))$q$,'42501','sandbox: prova expirada');
select gen_random_uuid() as replay_nonce,extract(epoch from clock_timestamp())::bigint as replay_time \gset
select encode(extensions.hmac(convert_to('admin_overview'||E'\n'||:'replay_nonce'||E'\n'||:'replay_time'||E'\n'||'{"userId":"00000000-0000-4000-8000-000000009001"}','UTF8'),extensions.digest('FIXTURE-LOCAL-SEM-VALOR-REMOTO','sha256'),'sha256'),'hex') as replay_sig \gset
select public.sandbox_billing_server('admin_overview','{"userId":"00000000-0000-4000-8000-000000009001"}',:'replay_time',:'replay_nonce',:'replay_sig');
select test.expect_error(format('select public.sandbox_billing_server(''admin_overview'',''{"userId":"00000000-0000-4000-8000-000000009001"}'',%L,%L,%L)',:'replay_time',:'replay_nonce',:'replay_sig'),'23505','sandbox: nonce não reutilizável');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009002';
select public.create_business('Sandbox local','sandbox-local','autonomo','mundo-novo-ms') as biz \gset
select test.assert_true(jsonb_array_length(test.sandbox('owner_overview',jsonb_build_object('userId','00000000-0000-4000-8000-000000009002','businessId',:'biz'))->'payments')=0,'sandbox: consulta do proprietário funciona sem pagamentos');
select jsonb_build_object('userId','00000000-0000-4000-8000-000000009002','businessId',:'biz','requestId','00000000-0000-4000-8000-000000009900','method','PIX','accepted',true,'termsVersion','sandbox-v1','amountCents',1999) as consent \gset
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb-''accepted'')',:'consent'),'22023','sandbox: consentimento ausente');
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb||''{"accepted":null}'')',:'consent'),'22023','sandbox: consentimento null');
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb||''{"amountCents":1}'')',:'consent'),'22023','sandbox: valor adulterado');
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb||''{"userId":"00000000-0000-4000-8000-000000009003"}'')',:'consent'),'42501','sandbox: terceiro não contrata');
select test.assert_true((test.sandbox('reserve',:'consent')->>'claimed')::boolean,'sandbox: reserva única');
select test.assert_true(not (test.sandbox('reserve',:'consent')->>'claimed')::boolean,'sandbox: replay não cria');
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb||jsonb_build_object(''requestId'',gen_random_uuid()))',:'consent'),'23505','sandbox: clique com novo UUID não duplica');
select test.expect_error('select * from private.sandbox_contracts','42501','sandbox: contratos privados');
select test.expect_error('select * from private.sandbox_backend_keys','42501','sandbox: credencial de assinatura privada');
select test.expect_error('update private.sandbox_payments set status=''RECEIVED''','42501','sandbox: pagamento não editável pelo cliente');
select test.expect_error($q$select test.sandbox('admin_overview','{"userId":"00000000-0000-4000-8000-000000009002"}')$q$,'42501','sandbox: dono não é admin financeiro');
select test.sandbox('customer_saved','{"requestId":"00000000-0000-4000-8000-000000009900","customerId":"cus_local"}');
select test.sandbox('subscription_started','{"requestId":"00000000-0000-4000-8000-000000009900"}');
select test.expect_error($q$select test.sandbox('subscription_started','{"requestId":"00000000-0000-4000-8000-000000009900"}')$q$,'23505','sandbox: POST incerto nunca repetido');
select test.sandbox('save_provider','{"requestId":"00000000-0000-4000-8000-000000009900","subscriptionId":"sub_local"}');
select test.assert_true(test.sandbox('save_provider','{"requestId":"00000000-0000-4000-8000-000000009900","invoiceUrl":"https://sandbox.asaas.com/000/checkoutSession/show/00000000-0000-4000-8000-000000009900"}')->>'invoice_url' like 'https://sandbox.asaas.com/000/%','sandbox: prefixo numérico oficial aceito');
select test.expect_error($q$select test.sandbox('save_provider','{"requestId":"00000000-0000-4000-8000-000000009900","invoiceUrl":"https://www.asaas.com/i/real"}')$q$,'23514','sandbox: URL financeira de produção rejeitada');
select test.expect_error($q$select test.sandbox('save_provider','{"requestId":"00000000-0000-4000-8000-000000009900","subscriptionId":"sub_changed"}')$q$,'23514','sandbox: assinatura imutável');
select test.expect_error($q$select test.sandbox('context','{"requestId":"00000000-0000-4000-8000-000000009900","userId":"00000000-0000-4000-8000-000000009003"}')$q$,'42501','sandbox: conciliação isolada');
select test.sandbox('claim_contract','{"requestId":"00000000-0000-4000-8000-000000009900"}')->>'leaseToken' as lease \gset
select test.assert_true(test.sandbox('claim_contract','{"requestId":"00000000-0000-4000-8000-000000009900"}') is null,'sandbox: conciliação exclusiva');
select jsonb_build_object('requestId','00000000-0000-4000-8000-000000009900','paymentId','pay_local','subscriptionId','sub_local','customerId','cus_local','amountCents',1999,'refundedCents',0,'method','PIX','dueDate',current_date,'status','CONFIRMED','settled',false,'leaseToken',:'lease') as payment \gset
select test.expect_error(format('select test.sandbox(''apply_payment'',%L::jsonb||jsonb_build_object(''leaseToken'',gen_random_uuid()))',:'payment'),'23514','sandbox: worker sem lease não aplica');
select test.expect_error(format('select test.sandbox(''apply_payment'',%L::jsonb||''{"customerId":"cus_outro"}'')',:'payment'),'23514','sandbox: cliente divergente');
select test.expect_error(format('select test.sandbox(''apply_payment'',%L::jsonb||''{"amountCents":2000}'')',:'payment'),'23514','sandbox: conciliação valida preço');
select test.sandbox('apply_payment',:'payment');
select test.assert_true((test.sandbox('admin_overview','{"userId":"00000000-0000-4000-8000-000000009001"}')->'summary'->>'receivedCents')::int=0,'sandbox: confirmado não é receita recebida');
select test.sandbox('apply_payment',:'payment'::jsonb||'{"status":"RECEIVED","settled":true}');
select test.assert_true((test.sandbox('admin_overview','{"userId":"00000000-0000-4000-8000-000000009001"}')->'summary'->>'receivedCents')::int=1999,'sandbox: recebido conciliado conta receita de teste');
select test.assert_true(jsonb_array_length(test.sandbox('owner_overview',jsonb_build_object('userId','00000000-0000-4000-8000-000000009002','businessId',:'biz'))->'payments')=1,'sandbox: consulta do proprietário retorna pagamento conciliado');
select test.assert_true(test.sandbox('context','{"requestId":"00000000-0000-4000-8000-000000009900"}')->>'state'='active','sandbox: ativo somente após snapshot reconciliado');
select test.assert_true((test.sandbox('claim_refund','{"requestId":"00000000-0000-4000-8000-000000009901","paymentId":"pay_local","userId":"00000000-0000-4000-8000-000000009001"}')->>'claimed')::boolean,'sandbox: estorno reservado');
select test.assert_true(not (test.sandbox('claim_refund','{"requestId":"00000000-0000-4000-8000-000000009902","paymentId":"pay_local","userId":"00000000-0000-4000-8000-000000009001"}')->>'claimed')::boolean,'sandbox: estorno não duplica');
select test.sandbox('apply_payment',:'payment'::jsonb||'{"status":"REFUNDED","refundedCents":1999,"settled":true}');
select test.assert_true((test.sandbox('admin_overview','{"userId":"00000000-0000-4000-8000-000000009001"}')->'summary'->>'receivedCents')::int=0,'sandbox: receita líquida após estorno');
select test.expect_error(format('select test.sandbox(''reserve'',%L::jsonb||jsonb_build_object(''requestId'',gen_random_uuid()))',:'consent'),'23505','sandbox: estorno não cancela recorrência nem permite duplicação');
select test.sandbox('apply_payment',:'payment'::jsonb||'{"paymentId":"pay_overdue","status":"OVERDUE"}');
select test.assert_true(test.sandbox('context','{"requestId":"00000000-0000-4000-8000-000000009900"}')->>'state'='overdue','sandbox: inadimplência conciliada');
select test.sandbox('cancelled','{"requestId":"00000000-0000-4000-8000-000000009900"}');
select test.sandbox('apply_payment',:'payment'::jsonb||'{"status":"RECEIVED","settled":true}');
select test.assert_true(test.sandbox('context','{"requestId":"00000000-0000-4000-8000-000000009900"}')->>'state'='cancelled','sandbox: pagamento tardio não reativa contrato cancelado');
select test.assert_true(not (test.sandbox('enqueue','{"eventId":"evt_local_001","eventType":"PAYMENT_RECEIVED","objectId":"pay_local","requiresReconciliation":true}')->>'duplicate')::boolean,'sandbox: inbox durável');
select test.assert_true((test.sandbox('enqueue','{"eventId":"evt_local_001","eventType":"PAYMENT_RECEIVED","objectId":"pay_local","requiresReconciliation":true}')->>'duplicate')::boolean,'sandbox: webhook duplicado');
select test.expect_error($q$select test.sandbox('enqueue','{"eventId":"evt_local_001","eventType":"PAYMENT_RECEIVED","objectId":"pay_outro","requiresReconciliation":true}')$q$,'23505','sandbox: evento reutilizado com outro objeto');
select test.sandbox('claim_event','{"eventId":"evt_local_001"}')->>'leaseToken' as evtlease \gset
select test.assert_true(test.sandbox('claim_event','{"eventId":"evt_local_001"}') is null,'sandbox: processamento exclusivo');
select test.assert_true(not (test.sandbox('event_done',jsonb_build_object('eventId','evt_local_001','leaseToken',gen_random_uuid(),'outcome','processed'))->>'ok')::boolean,'sandbox: worker antigo não confirma evento');
select test.sandbox('event_done',jsonb_build_object('eventId','evt_local_001','leaseToken',:'evtlease','outcome','reconcile_required'));
select test.sandbox('claim_event','{"eventId":"evt_local_001"}')->>'leaseToken' as expired_event_lease \gset
reset role;
update private.billing_event_inbox set lease_until=clock_timestamp()-interval '1 second' where event_id='evt_local_001';
set local role authenticated;
select test.assert_true(not (test.sandbox('event_done',jsonb_build_object('eventId','evt_local_001','leaseToken',:'expired_event_lease','outcome','processed'))->>'ok')::boolean,'sandbox: lease expirado não conclui evento');
select test.assert_true(jsonb_array_length(test.sandbox('retry_events','{"userId":"00000000-0000-4000-8000-000000009001"}')->'eventIds')=1,'sandbox: falha fica disponível para recuperação');
reset role;
select test.assert_true((select count(*)=0 from public.business_subscriptions),'sandbox: não inicia gratuidade ou direitos reais');
select test.assert_true((select status='draft' from public.businesses where id=:'biz'),'sandbox: não publica negócio');
select test.assert_true((select count(*)>=5 from private.sandbox_financial_audit),'sandbox: mudanças auditadas');
select test.assert_true(exists(select 1 from private.sandbox_financial_audit where action='payment_reconciled' and before_snapshot->>'refundedCents'='0' and after_snapshot->>'refundedCents'='1999'),'sandbox: auditoria preserva valores anteriores e posteriores do estorno');
update private.sandbox_contracts set reconcile_until=clock_timestamp()-interval '1 second' where request_id='00000000-0000-4000-8000-000000009900';
select test.expect_error(format('select test.sandbox(''save_provider'',jsonb_build_object(''requestId'',''00000000-0000-4000-8000-000000009900'',''leaseToken'',%L,''invoiceUrl'',''https://sandbox.asaas.com/i/stale''))',:'lease'),'23514','sandbox: worker expirado não modifica metadados');
select test.expect_error(format('select test.sandbox(''uncertain'',jsonb_build_object(''requestId'',''00000000-0000-4000-8000-000000009900'',''leaseToken'',%L))',:'lease'),'23514','sandbox: worker expirado não sobrescreve estado atual');
select test.assert_true((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'sandbox_%' and c.relkind='r'),'sandbox: todas tabelas RLS');
select test.assert_true((select bool_and(not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'sandbox_%' and c.relkind='r'),'sandbox: nenhum acesso direto às sete tabelas privadas');
set local role anon;
select test.expect_error('select * from private.sandbox_payments','42501','sandbox: dados financeiros não públicos');
select test.expect_error($q$select public.sandbox_billing_server('context','{}',extract(epoch from now())::bigint,gen_random_uuid(),repeat('0',64))$q$,'42501','sandbox: wrapper público não contorna prova');
reset role;
-- Primeiro vencimento nunca antecipa o prazo individual (data no fuso brasileiro).
insert into public.business_subscriptions(business_id,trial_started_at,trial_original_ends_at,trial_ends_at)
 values(:'biz',now(),now()+interval '2160 hours',now()+interval '2160 hours');
select test.assert_true((test.sandbox('reserve',:'consent'::jsonb||jsonb_build_object('requestId',gen_random_uuid()))->'contract'->>'first_due_date')::date>(select (trial_ends_at at time zone 'America/Sao_Paulo')::date from public.business_subscriptions where business_id=:'biz'),'sandbox: primeiro vencimento após o fim integral dos 90 dias');
select request_id as next_request from private.sandbox_contracts where not provider_cancelled \gset
select test.sandbox('save_provider',jsonb_build_object('requestId',:'next_request','subscriptionId','sub_second'));
select test.expect_error(format('select test.sandbox(''find_contract'',jsonb_build_object(''subscriptionId'',''sub_local'',''externalReference'',%L))',:'next_request'),'23514','sandbox: identificadores que apontam a contratos diferentes são recusados');
select test.sandbox('claim_contract',jsonb_build_object('requestId',:'next_request'))->>'leaseToken' as next_lease \gset
select test.expect_error(format('select test.sandbox(''apply_payment'',%L::jsonb||jsonb_build_object(''requestId'',%L,''subscriptionId'',''sub_second'',''leaseToken'',%L))',:'payment',:'next_request',:'next_lease'),'23514','sandbox: pagamento permanece vinculado ao contrato original');
rollback;
