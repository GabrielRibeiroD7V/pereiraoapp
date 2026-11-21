-- Último teste no cluster descartável. Não contém IDs/e-mails de contas operacionais.
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000009999','bootstrap@example.invalid',now());
select set_config('pereirao.bootstrap_user_id','00000000-0000-4000-8000-000000009999',false);
select set_config('pereirao.bootstrap_expected_email','bootstrap@example.invalid',false);
\ir ../admin/bootstrap_platform_admin.sql
\ir ../admin/bootstrap_platform_admin.sql
select test.assert_true((select count(*)=1 from private.platform_admins),'bootstrap: concessão por UUID sem criar conta');
select test.assert_true((select count(*)=1 from private.admin_audit),'bootstrap: repetição não duplica auditoria');
select test.assert_true((select actor_id is null and actor_source='bootstrap_sql' from private.admin_audit),'bootstrap: origem SQL identificada sem atribuir ação ao usuário');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000009999';
select test.assert_true(public.admin_access(),'bootstrap: papel consultado no banco');
select test.assert_true((public.admin_query('audit')->'items'->0->>'action')='bootstrap_admin','bootstrap: concessão visível no histórico administrativo');
reset role;
