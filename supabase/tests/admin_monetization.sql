begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000008901','monetization-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000008902','monetization-owner@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000008901');
create temp table preserved_monetization as select
 (select count(*) from public.business_subscriptions) subscriptions,
 (select count(*) from private.subscription_activations) activations,
 (select count(*) from private.production_billing_bindings) bindings,
 (select count(*) from private.admin_audit) audit;
set local role anon;
select test.expect_error('select public.admin_monetization_status()','42501','monetization: anon denied');
select test.expect_error('select * from private.monetization_policy','42501','monetization: no public policy table');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000008902';
select test.expect_error('select public.admin_monetization_status()','42501','monetization: ordinary account denied');
select test.expect_error($q$select public.admin_set_new_contracts(true,0,'CONFIRMAR NOVAS CONTRATACOES','Tentativa externa')$q$,'42501','monetization: ordinary account cannot activate');
select test.expect_error('update private.monetization_policy set monthly_cents=1','42501','monetization: price protected');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000008901';
select test.assert_true(public.admin_monetization_status()->>'monthlyCents'='1990','monetization: reference price 19.90');
select test.assert_true(public.admin_monetization_status()->>'initialFree'='true','monetization: indefinite free phase');
select test.assert_true(public.admin_monetization_status()->>'newContractsEnabled'='false','monetization: contracting off');
select test.expect_error($q$select public.admin_set_new_contracts(true,0,'CONFIRMAR NOVAS CONTRATACOES','Ativacao prematura')$q$,'55000','monetization: free phase cannot activate');
select test.expect_error($q$select public.admin_set_new_contracts(false,0,'','Sem confirmacao')$q$,'22023','monetization: explicit confirmation required');
select test.expect_error($q$select public.admin_set_new_contracts(false,1,'CONFIRMAR NOVAS CONTRATACOES','Pagina desatualizada')$q$,'40001','monetization: concurrent revision rejected');
select test.assert_true(public.admin_set_new_contracts(false,0,'CONFIRMAR NOVAS CONTRATACOES','Manter desligado')->>'revision'='0','monetization: disabling twice is idempotent');
reset role;
-- Simula política previamente habilitada em banco isolado. Não altera a fase.
update private.monetization_policy set contracting_ready=true,new_contracts_enabled=true;
set local role authenticated;
select test.assert_true(public.admin_set_new_contracts(false,0,'CONFIRMAR NOVAS CONTRATACOES','Contencao administrativa')->>'newContractsEnabled'='false','monetization: shutdown allowed independently of free phase');
reset role;
select test.assert_true((select count(*) from private.admin_audit)=(select audit+1 from preserved_monetization),'monetization: one durable audit for actual change');
select test.assert_true(exists(select 1 from private.admin_audit where action='new_contracts_policy' and before_state='true' and after_state='false' and actor_id='00000000-0000-4000-8000-000000008901'),'monetization: actor and states audited');
select test.assert_true((select count(*) from public.business_subscriptions)=(select subscriptions from preserved_monetization) and (select count(*) from private.production_billing_bindings)=(select bindings from preserved_monetization) and (select count(*) from private.subscription_activations)=(select activations from preserved_monetization),'monetization: no contracts, trials or bindings changed');
select test.assert_true((select relrowsecurity from pg_class where oid='private.monetization_policy'::regclass),'monetization: RLS enabled');
update private.account_restrictions set suspended=true where user_id='00000000-0000-4000-8000-000000008901';
insert into private.account_restrictions(user_id,suspended) values('00000000-0000-4000-8000-000000008901',true) on conflict(user_id) do update set suspended=true;
set local role authenticated;
select test.expect_error('select public.admin_monetization_status()','42501','monetization: suspended admin denied');
rollback;
