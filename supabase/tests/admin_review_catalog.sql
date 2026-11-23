-- APENAS PostgreSQL isolado; sem gravação de dados operacionais.
begin;
select count(*) as audit_before from private.admin_audit \gset
insert into auth.users(id) values('00000000-0000-4000-8000-000000008001'),('00000000-0000-4000-8000-000000008002');
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000008001');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000008002';
select public.create_business('Revisão isolada A','revisao-isolada-a','autonomo','guaira-pr') as a \gset
select public.create_business('Revisão isolada B','revisao-isolada-b','empresa','mundo-novo-ms') as b \gset
select public.set_business_specialties(:'a','climatizacao',array['pintura','eletrica'],null,array[]::text[]);
-- Fixture local inclui catálogo inativo/ID legado sem ampliar RLS operacional.
reset role;
insert into public.business_service_areas(business_id,city_id) select :'a',id from public.cities where (name,state_code) in (('Mundo Novo','MS'),('Naviraí','MS'),('Itaquiraí','MS'),('Eldorado','MS'),('Iguatemi','MS'),('Guaíra','PR'),('Terra Roxa','PR')) on conflict do nothing;
set local role authenticated;
delete from public.business_service_areas where business_id=:'b';
select test.expect_error(format('select public.admin_review_catalog(%L)',:'a'),'42501','review: responsável comum não obtém poderes administrativos');
reset role;
update public.categories set active=false where id='eletrica';
set local role anon;
select test.expect_error(format('select public.admin_review_catalog(%L)',:'a'),'42501','review: anônimo sem EXECUTE');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000008001';
select test.assert_true((public.admin_review_catalog(:'a')->'primaryCategory'->>'id')='climatizacao','review: categoria principal correta');
select test.assert_true(jsonb_array_length(public.admin_review_catalog(:'a')->'additionalSpecialties')=2,'review: todas as especialidades');
select test.assert_true(public.admin_review_catalog(:'a')->'additionalSpecialties' @> '[{"id":"eletrica","active":false}]','review: item inativo permanece na revisão');
select test.assert_true(jsonb_array_length(public.admin_review_catalog(:'a')->'serviceCities')=7,'review: todas as sete cidades sem truncamento');
select test.assert_true(public.admin_review_catalog(:'a')->'originCity'->>'stateCode'='PR','review: UF da cidade de origem');
select test.assert_true(public.admin_review_catalog(:'a')->'serviceCities' @> '[{"id":"mundo-novo-ms","stateCode":"MS"}]','review: cidades atendidas MS');
select test.assert_true(public.admin_review_catalog(:'a')->'serviceCities' @> '[{"id":"guaira-pr","stateCode":"PR"}]','review: cidades atendidas PR');
select test.assert_true(public.admin_review_catalog(:'b')->'primaryCategory'='null'::jsonb,'review: principal ausente é null');
select test.assert_true(public.admin_review_catalog(:'b')->'additionalSpecialties'='[]'::jsonb,'review: lista adicional vazia explícita');
select test.assert_true(jsonb_array_length(public.admin_review_catalog(:'b')->'serviceCities')=0,'review: listas de negócios não se misturam');
select test.assert_true((select count(*)=0 from public.business_service_areas where business_id=:'a'),'review: RPC não amplia leitura direta de rascunhos');
select test.expect_error('select public.admin_review_catalog(gen_random_uuid())','P0002','review: inexistente sinalizado ao admin');
select test.assert_true(not has_column_privilege('authenticated','public.businesses','status','UPDATE'),'review: publicação direta continua negada');
select test.assert_true((select provolatile='s' and prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.admin_review_catalog(uuid)'::regprocedure),'review: função STABLE com search_path fixo');
reset role;
select test.assert_true((select count(*)=2 from public.businesses where slug like 'revisao-isolada-%' and status='draft'),'review: dados e status preservados');
select test.assert_true((select count(*)=0 from public.business_subscriptions),'review: nenhuma gratuidade iniciada');
select test.assert_true((select count(*)=:'audit_before'::bigint from private.admin_audit),'review: leitura não inventa revisão ou aprovação auditada');
insert into private.account_restrictions(user_id,suspended) values('00000000-0000-4000-8000-000000008001',true);
set local role authenticated;
select test.expect_error(format('select public.admin_review_catalog(%L)',:'a'),'42501','review: administrador suspenso bloqueado');
rollback;
