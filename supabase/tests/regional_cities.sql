-- Exclusivo do cluster PostgreSQL temporário do runner; nunca executar em produção.
select test.assert_true((select count(*)=7 from public.cities where active), 'regional: sete municípios ativos após aplicação inicial');
select test.assert_true((select count(*)=5 from public.cities where state_code='MS'), 'regional: cinco municípios de MS');
select test.assert_true((select count(*)=2 from public.cities where state_code='PR'), 'regional: dois municípios de PR');

-- Simula catálogo prévio com outro ID e cidade desativada: não renomear nem reativar.
delete from public.cities where id='navirai-ms';
insert into public.cities (id,name,state_code,slug,active) values ('navirai-legado','Naviraí','MS','navirai-legado',false);

begin;
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000501','{}'),
 ('00000000-0000-4000-8000-000000000502','{}'),
 ('00000000-0000-4000-8000-000000000503','{}');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000501';
select public.create_business('Autônomo regional técnico','autonomo-regional-tecnico','autonomo','mundo-novo-ms') as regional_a \gset
select public.create_business('Empresa regional técnica','empresa-regional-tecnica','empresa','terra-roxa-pr') as regional_b \gset
insert into public.business_service_areas(business_id,city_id) values
 (:'regional_a','guaira-pr'),(:'regional_a','eldorado-ms'),(:'regional_b','guaira-pr');
insert into public.business_service_areas(business_id,city_id) values (:'regional_a','guaira-pr') on conflict do nothing;
select test.assert_true((select count(*)=3 from public.business_service_areas where business_id=:'regional_a'), 'regional: origem e múltiplas áreas sem duplicação');
select test.assert_true((select city_id='mundo-novo-ms' and status='draft' from public.businesses where id=:'regional_a'), 'regional: áreas adicionais não alteram origem nem status');
select test.assert_true((select city_id='terra-roxa-pr' and type='empresa' from public.businesses where id=:'regional_b'), 'regional: empresa com origem no PR usa a mesma conta');
select test.assert_true((select count(*)=2 from public.business_members where user_id=auth.uid() and role='owner'), 'regional: dois negócios vinculados ao proprietário válido');
select test.expect_error($s$update public.businesses set status='published'$s$, '42501', 'regional: cadastro não permite autopublicação');
reset role;
insert into public.business_members(business_id,user_id,role) values (:'regional_a','00000000-0000-4000-8000-000000000502','admin');
create temp table regional_before as select
 (select md5(string_agg(to_jsonb(b)::text,'' order by id)) from public.businesses b) as businesses,
 (select md5(string_agg(to_jsonb(a)::text,'' order by business_id,city_id)) from public.business_service_areas a) as areas,
 (select md5(string_agg(to_jsonb(m)::text,'' order by id)) from public.business_members m) as members,
 (select to_jsonb(c) from public.cities c where id='mundo-novo-ms') as mundo,
 (select md5(string_agg(to_jsonb(p)::text,'' order by schemaname,tablename,policyname)) from pg_policies p) as policies;
commit;

-- Aplica o arquivo real duas vezes, sem copiar sua implementação para o teste.
\ir ../migrations/20261121190525_regional_service_cities.sql
\ir ../migrations/20261121190525_regional_service_cities.sql
select test.assert_true((select count(*)=7 from public.cities), 'regional: migração idempotente e sem duplicata por nome/UF');
select test.assert_true((select not active and id='navirai-legado' from public.cities where name='Naviraí' and state_code='MS'), 'regional: preserva ID legado e inatividade');
select test.assert_true((select businesses=(select md5(string_agg(to_jsonb(b)::text,'' order by id)) from public.businesses b) from regional_before), 'regional: negócios existentes integralmente preservados');
select test.assert_true((select areas=(select md5(string_agg(to_jsonb(a)::text,'' order by business_id,city_id)) from public.business_service_areas a) from regional_before), 'regional: vínculos de atendimento preservados');
select test.assert_true((select members=(select md5(string_agg(to_jsonb(m)::text,'' order by id)) from public.business_members m) from regional_before), 'regional: proprietários e membros preservados');
select test.assert_true((select mundo=(select to_jsonb(c) from public.cities c where id='mundo-novo-ms') from regional_before), 'regional: Mundo Novo original intacta');
select test.assert_true((select policies=(select md5(string_agg(to_jsonb(p)::text,'' order by schemaname,tablename,policyname)) from pg_policies p) from regional_before), 'regional: nenhuma política RLS alterada');

begin;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000502';
insert into public.business_service_areas(business_id,city_id) values (:'regional_a','itaquirai-ms');
select test.assert_true((select count(*)=4 from public.business_service_areas where business_id=:'regional_a'), 'regional: administrador do negócio gerencia áreas');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000503';
select test.assert_true((select count(*)=0 from public.business_service_areas), 'regional: terceiro não lê áreas de rascunhos');
select test.expect_error(format('insert into public.business_service_areas(business_id,city_id) values (%L,%L)', :'regional_a','iguatemi-ms'), '42501', 'regional: terceiro não cadastra áreas em outro negócio');
with removed as (delete from public.business_service_areas where business_id=:'regional_a' returning *) select test.assert_true((select count(*)=0 from removed), 'regional: terceiro não exclui áreas');
reset role;
-- Publicação SOMENTE no cluster descartável para testar leitura do marketplace.
update public.businesses set status='published' where id in (:'regional_a',:'regional_b');
set local role anon;
set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=2 from public.businesses b where exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id='guaira-pr')), 'regional: busca em Guaíra encontra sedes em Mundo Novo e Terra Roxa');
select test.assert_true((select count(*)=1 from public.businesses b where exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id='eldorado-ms')), 'regional: busca em Eldorado encontra somente o negócio que atende a cidade');
select test.assert_true((select count(*)=6 from public.cities), 'regional: cidade inativa não vaza no catálogo público');
select test.expect_error(format('insert into public.business_service_areas(business_id,city_id) values (%L,%L)', :'regional_a','iguatemi-ms'), '42501', 'regional: visitante não altera áreas');
select test.expect_error($s$insert into public.cities(id,name,state_code,slug) values ('indevida','Indevida','MS','indevida')$s$, '42501', 'regional: visitante não escreve catálogo');
reset role;
update public.businesses set status='draft' where id=:'regional_a';
set local role anon;
select test.assert_true((select count(*)=1 from public.businesses b where exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id='guaira-pr')), 'regional: rascunho não aparece em nenhuma cidade atendida');
reset role;
select test.assert_true((select count(*)=0 from public.business_subscriptions), 'regional: ensaio não inicia gratuidade');
rollback;
