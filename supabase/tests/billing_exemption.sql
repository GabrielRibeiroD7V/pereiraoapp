-- Somente PostgreSQL isolado; nenhuma conta real é criada ou alterada.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000009101','exempt-owner@example.invalid',now()),
('00000000-0000-4000-8000-000000009102','ordinary-owner@example.invalid',now()),
('00000000-0000-4000-8000-000000009103','other-admin@example.invalid',now());
insert into private.platform_admins(user_id) values
('00000000-0000-4000-8000-000000009101'),
('00000000-0000-4000-8000-000000009103');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009101';
select public.create_business('Negócio isento','exempt-local-a','autonomo','mundo-novo-ms') as exempt_id \gset
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009102';
select public.create_business('Negócio comum','exempt-local-b','autonomo','mundo-novo-ms') as ordinary_id \gset
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009103';
select public.create_business('Outro administrador','exempt-local-c','autonomo','mundo-novo-ms') as other_admin_id \gset
reset role;
insert into private.billing_exempt_accounts(user_id,reason) values
('00000000-0000-4000-8000-000000009101','Conta proprietária da plataforma');
select test.assert_true(private.is_billing_exempt_business(:'exempt_id'),'isencao: negócio do dono');
select test.assert_true(not private.is_billing_exempt_business(:'ordinary_id'),'isencao: usuário comum não isento');
select test.assert_true(not private.is_billing_exempt_business(:'other_admin_id'),'isencao: outros administradores não isentos');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009101';
select test.assert_true(public.my_subscriptions(:'exempt_id')->'items'->0->>'state'='exempt','isencao: situação do negócio antes da ativação');
select test.expect_error('select * from private.billing_exempt_accounts','42501','isencao: lista privada');
select test.expect_error(format('select private.is_billing_exempt_business(%L)',:'exempt_id'),'42501','isencao: predicado privado');
reset role;
insert into public.business_subscriptions(business_id,trial_started_at,trial_original_ends_at,trial_ends_at)
values(:'exempt_id',now()-interval '2161 hours',now()-interval '1 hour',now()-interval '1 hour');
select test.assert_true(private.subscription_snapshot(:'exempt_id',now())->>'state'='exempt','isencao: expiração do prazo não retira isenção');
select test.expect_error(format($q$update public.business_subscriptions set status='active',contracted_at=now(),price_version_id=(select id from private.plan_price_versions limit 1),contracted_price_cents=1999,billing_cycle='monthly' where business_id=%L$q$,:'exempt_id'),'23514','isencao: contrato real recusado pelo banco');
select test.expect_error(format($q$insert into private.sandbox_contracts(request_id,business_id,user_id,method,consent_version,first_due_date) values(gen_random_uuid(),%L,'00000000-0000-4000-8000-000000009101','PIX','sandbox-v1',current_date)$q$,:'exempt_id'),'23514','isencao: reserva Sandbox recusada antes do provedor');
-- Transferir um negócio ativado por outra conta não pode gerar isenção indevida.
insert into public.business_subscriptions(business_id,trial_started_at,trial_original_ends_at,trial_ends_at)
values(:'ordinary_id',now(),now()+interval '2160 hours',now()+interval '2160 hours');
insert into private.subscription_activations(business_id,initial_owner_id,activated_by,activated_at)
values(:'ordinary_id','00000000-0000-4000-8000-000000009102','00000000-0000-4000-8000-000000009103',now());
update public.business_members set role='viewer' where business_id=:'ordinary_id' and role='owner';
insert into public.business_members(business_id,user_id,role) values(:'ordinary_id','00000000-0000-4000-8000-000000009101','owner');
select test.assert_true(not private.is_billing_exempt_business(:'ordinary_id'),'isencao: transferência após ativação não herda benefício');
select test.assert_true(private.subscription_snapshot(:'ordinary_id',now())->>'state'='trial_active','isencao: plano do dono original preservado');
rollback;
