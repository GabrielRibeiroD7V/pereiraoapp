-- Exclusivamente no PostgreSQL temporário. Não contém publicação operacional.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.cities(id,name,state_code,slug,active) values ('cidade-ensaio-ms','Cidade de ensaio','MS','cidade-ensaio-ms',true);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select public.create_business('Profissional público simulado','market-public','autonomo','mundo-novo-ms') as published_id \gset
select public.create_business('Profissional privado simulado','market-draft','empresa','mundo-novo-ms') as draft_id \gset
insert into public.business_service_areas(business_id,city_id) values (:'published_id','cidade-ensaio-ms');
insert into public.services(id,business_id,category_id,name,active) values
 ('00000000-0000-4000-8000-000000000101',:'published_id','climatizacao','Instalação especial',true),
 ('00000000-0000-4000-8000-000000000102',:'published_id','climatizacao','Instalação especial adicional',true),
 ('00000000-0000-4000-8000-000000000103',:'published_id','climatizacao','Termo inativo exclusivo',false),
 ('00000000-0000-4000-8000-000000000104',:'draft_id','climatizacao','Termo privado exclusivo',true);
reset role;
update public.businesses set status='published',category_id='climatizacao' where id=:'published_id';
insert into public.portfolio_items(id,business_id,storage_path,media_state) values
 ('00000000-0000-4000-8000-000000000201',:'published_id',:'published_id'||'/portfolio/00000000-0000-4000-8000-000000000201.webp','ready'),
 ('00000000-0000-4000-8000-000000000202',:'published_id',:'published_id'||'/portfolio/00000000-0000-4000-8000-000000000202.webp','pending'),
 ('00000000-0000-4000-8000-000000000203',:'published_id',:'published_id'||'/portfolio/00000000-0000-4000-8000-000000000203.webp','deleting');
set local role anon;
set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=1 from public.businesses where status='published'),'marketplace: anônimo lê somente negócio publicado');
select test.assert_true((select count(*)=1 from public.businesses b where b.status='published' and exists(select 1 from public.services s where s.business_id=b.id and s.active and s.name ilike '%instalação especial%')),'marketplace: busca por serviço não duplica prestador com dois serviços');
select test.assert_true((select count(*)=0 from public.businesses b where b.status='published' and exists(select 1 from public.services s where s.business_id=b.id and s.active and s.name ilike '%inativo exclusivo%')),'marketplace: serviço inativo não participa da busca');
select test.assert_true((select count(*)=0 from public.businesses b where exists(select 1 from public.services s where s.business_id=b.id and s.name ilike '%privado exclusivo%')),'marketplace: serviço de rascunho não revela negócio');
select test.assert_true((select count(*)=1 from public.businesses b where b.status='published' and exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id='cidade-ensaio-ms')),'marketplace: filtro usa cidade atendida além da sede');
select test.assert_true((select count(*)=1 from public.portfolio_items where business_id=:'published_id' and media_state='ready'),'marketplace: somente fotografia ready disponível');
select test.assert_true((select count(*)=0 from public.portfolio_items where media_state in ('pending','deleting')),'marketplace: pending e deleting invisíveis');
select test.assert_true(not has_table_privilege('anon','public.business_details','SELECT'),'marketplace: dados empresariais privados inacessíveis');
select test.assert_true(not has_column_privilege('authenticated','public.businesses','status','UPDATE'),'marketplace: leitura pública não libera publicação');
reset role;
update public.businesses set status='unpublished' where id=:'published_id';
set local role anon;
select test.assert_true((select count(*)=0 from public.services),'marketplace: despublicar retira serviços da leitura pública');
select test.assert_true((select count(*)=0 from public.portfolio_items),'marketplace: despublicar retira galeria da leitura pública');
rollback;
