-- PostgreSQL local descartável: nenhuma conta ou publicação operacional.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000009801','phase-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000009802','phase-owner@example.invalid',now()),
('00000000-0000-4000-8000-000000009803','phase-other@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000009801');
set local role anon;
select test.assert_true(public.platform_access_status()->>'phase'='initial_free','free: fase pública sem dados privados');
select test.expect_error('select * from private.platform_access_policy','42501','free: política privada não legível');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009802';
select public.create_business('Fase grátis local','free-phase-local','autonomo','mundo-novo-ms') as a \gset
select public.create_business('Incompleto local','free-incomplete-local','empresa','mundo-novo-ms') as b \gset
update public.businesses set category_id='climatizacao',description='Descrição completa local',whatsapp='67999999999' where id=:'a';
select test.expect_error(format('update public.businesses set status=''published'' where id=%L',:'a'),'42501','free: não permite autopublicação');
select test.assert_true(public.my_subscriptions(:'a')->'items'->0->>'state'='initial_free','free: dono lê fase sem contratar');
select test.assert_true(public.my_subscriptions(:'a')->'items'->0->'trialStartedAt'='null'::jsonb,'free: nenhum relógio inventado');
select test.expect_error('update private.platform_access_policy set phase=''paid''','42501','free: dono não altera política');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009803';
select test.expect_error(format('select public.my_subscriptions(%L)',:'a'),'42501','free: terceiro não lê dados privados');
select test.expect_error(format('select public.admin_action(''business'',%L,''publish'',''Revisão completa local'',''draft'')',:'a'),'42501','free: aprovação exige admin');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009801';
select test.expect_error(format('select public.admin_action(''business'',%L,''publish'',''Revisão completa local'',''draft'')',:'b'),'23514','free: perfil incompleto continua bloqueado');
select public.admin_action('business',:'a','publish','Revisão completa apenas local','draft');
select public.admin_action('business',:'a','suspend','Suspensão apenas local','published');
select public.admin_action('business',:'a','reactivate','Reativação apenas local','suspended');
reset role;
select test.assert_true((select status='published' from public.businesses where id=:'a'),'free: aprovação local ainda funciona');
select test.assert_true((select count(*)=0 from public.business_subscriptions),'free: publicação e reativação não iniciam 90 dias');
select test.assert_true((select count(*)=0 from private.subscription_activations),'free: não cria ativação financeira');
select test.assert_true((select count(*)=0 from private.subscription_history),'free: não cria contrato ou histórico financeiro');
select test.assert_true((select count(*)=3 from private.admin_audit where target_id=:'a'),'free: mantém auditoria das decisões');
select test.expect_error(format('insert into public.business_subscriptions(business_id,trial_started_at,trial_original_ends_at,trial_ends_at) values(%L,now(),now()+interval ''2160 hours'',now()+interval ''2160 hours'')',:'a'),'55000','free: banco rejeita até criação interna de trial');
insert into private.billing_exempt_accounts(user_id,reason) values('00000000-0000-4000-8000-000000009802','Isenção local preservada');
select test.assert_true(private.subscription_snapshot(:'a',now())->>'state'='exempt','free: isenção continua distinta');
select test.assert_true(private.subscription_snapshot(:'a',now()+interval '1000 days')->>'trialStartedAt' is null,'free: passagem de tempo não cria prazo');
select test.assert_true((select not checkout_enabled and not enforcement_enabled from private.subscription_settings),'free: sem checkout ou bloqueio');
select test.assert_true((select count(*)>0 from pg_policies where tablename='businesses'),'free: políticas de negócios intactas');
select test.expect_error('update private.platform_access_policy set phase=''paid''','23514','free: encerramento exige nova migração revisada');
delete from private.platform_access_policy;
select test.assert_true(public.platform_access_status() is null and private.subscription_snapshot(:'a',now()) is null,'free: configuração ausente não fabrica estado gratuito');
rollback;
