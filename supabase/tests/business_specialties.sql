-- Somente PostgreSQL temporário do runner. Nenhum teste usa dados operacionais.
begin;
select test.assert_true((select relrowsecurity from pg_class where oid='public.business_categories'::regclass),'especialidades: RLS habilitada');
select test.assert_true(not has_table_privilege('authenticated','public.business_categories','INSERT,UPDATE,DELETE'),'especialidades: escrita direta não é concedida');
select test.assert_true(not has_function_privilege('anon','public.set_business_specialties(uuid,text,text[],text,text[])','EXECUTE'),'especialidades: visitante não executa gravação');
select test.assert_true((select not prosecdef and provolatile='s' from pg_proc where oid='public.search_public_businesses(text,text,text,text,integer)'::regprocedure),'especialidades: busca pública é invoker e somente leitura');
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000701','{}'),('00000000-0000-4000-8000-000000000702','{}'),('00000000-0000-4000-8000-000000000703','{}');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000701';
select public.create_business('Carlos técnico','carlos-tecnico-especialidades','autonomo','mundo-novo-ms') as specialty_a \gset
select public.create_business('Empresa técnica','empresa-tecnica-especialidades','empresa','terra-roxa-pr') as specialty_b \gset
select public.set_business_specialties(:'specialty_a','construcao',array['pintura','eletrica'],null,'{}');
select public.set_business_specialties(:'specialty_b','pintura','{}',null,'{}');
select test.assert_true((select category_id='construcao' and status='draft' from public.businesses where id=:'specialty_a'),'especialidades: principal preservada no negócio em draft');
select test.assert_true((select count(*)=2 from public.business_categories where business_id=:'specialty_a'),'especialidades: duas adicionais sem duplicar principal');
insert into public.services(business_id,category_id,name) values (:'specialty_a','pintura','Pintura residencial técnica') returning id as specialty_service \gset
reset role;
insert into public.portfolio_items(id,business_id,storage_path,media_state) values
 ('00000000-0000-4000-8000-000000000799',:'specialty_a',:'specialty_a'||'/portfolio/00000000-0000-4000-8000-000000000799.webp','ready');
insert into public.work_posts(id,business_id,title) values ('00000000-0000-4000-8000-000000000798',:'specialty_a','Trabalho técnico local');
insert into public.work_post_images(post_id,business_id,portfolio_item_id,sort_order) values ('00000000-0000-4000-8000-000000000798',:'specialty_a','00000000-0000-4000-8000-000000000799',0);
set local role authenticated;
insert into public.business_service_areas(business_id,city_id) values (:'specialty_a','guaira-pr');
select public.set_business_specialties(:'specialty_a','construcao',array['pintura','eletrica'],null,'{}');
select test.assert_true((select count(*)=2 from public.business_categories where business_id=:'specialty_a'),'especialidades: repetição após resposta perdida é idempotente');
select test.expect_error(format('select public.set_business_specialties(%L,%L,array[%L,%L],%L,array[%L,%L])',:'specialty_a','construcao','pintura','pintura','construcao','eletrica','pintura'),'23505','especialidades: duplicata rejeitada');
select test.expect_error(format('select public.set_business_specialties(%L,%L,array[%L],%L,array[%L,%L])',:'specialty_a','construcao','construcao','construcao','eletrica','pintura'),'23514','especialidades: principal não pode ser adicional');
select test.expect_error(format('select public.set_business_specialties(%L,%L,array[%L],%L,array[%L,%L])',:'specialty_a','construcao','inexistente','construcao','eletrica','pintura'),'23514','especialidades: categoria inexistente rejeitada');
select test.expect_error(format('select public.set_business_specialties(%L,%L,array[%L],%L,array[%L])',:'specialty_a','construcao','limpeza','construcao','pintura'),'40001','especialidades: estado esperado antigo não sobrescreve edição');
select test.assert_true((select array_agg(category_id order by category_id)=array['eletrica','pintura'] from public.business_categories where business_id=:'specialty_a'),'especialidades: falhas preservam o conjunto anterior');
select test.expect_error(format('insert into public.business_categories values (%L,%L)',:'specialty_a','limpeza'),'42501','especialidades: proprietário usa RPC em vez de DML direto');
select test.expect_error($s$update public.businesses set status='published'$s$,'42501','especialidades: aprovação continua protegida');
reset role;
insert into public.business_members(business_id,user_id,role) values
 (:'specialty_a','00000000-0000-4000-8000-000000000702','admin'),(:'specialty_a','00000000-0000-4000-8000-000000000703','viewer');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000702';
select public.set_business_specialties(:'specialty_a','eletrica',array['construcao','pintura'],'construcao',array['eletrica','pintura']);
select test.assert_true((select category_id='eletrica' from public.businesses where id=:'specialty_a'),'especialidades: administrador pode promover uma adicional');
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_b','eletrica','{}','pintura','{}'),'42501','especialidades: administrador não gerencia outro negócio');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000703';
select test.assert_true((select count(*)=2 from public.business_categories where business_id=:'specialty_a'),'especialidades: viewer lê as categorias do próprio negócio');
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_a','pintura','{}','eletrica','{}'),'42501','especialidades: viewer não altera categorias');
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_b','pintura','{}','pintura','{}'),'42501','especialidades: usuário comum não altera outro negócio');
reset role;
insert into private.business_moderation(business_id,suspended) values (:'specialty_a',true);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000701';
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_a','pintura','{}','eletrica','{}'),'42501','especialidades: suspensão administrativa do negócio é respeitada');
reset role;
delete from private.business_moderation where business_id=:'specialty_a';
insert into private.account_restrictions(user_id,suspended) values ('00000000-0000-4000-8000-000000000701',true);
set local role authenticated;
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_a','pintura','{}','eletrica','{}'),'42501','especialidades: suspensão da conta é respeitada');
reset role;
delete from private.account_restrictions where user_id='00000000-0000-4000-8000-000000000701';
set local role anon;
set local request.jwt.claim.sub='';
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',:'specialty_a','pintura','{}','eletrica','{}'),'42501','especialidades: visitante não grava pela RPC');
select test.assert_true((select count(*)=0 from public.business_categories),'especialidades: visitante não lê categorias de rascunhos');
select test.assert_true((select count(*)=0 from public.search_public_businesses()),'especialidades: RPC não revela rascunhos');
reset role;
-- Publicação apenas nos dados descartáveis, sem ator administrativo nem trial.
update public.businesses set status='published' where id in (:'specialty_a',:'specialty_b');
set local role anon;
select test.assert_true((select count(*)=1 from public.search_public_businesses('','construcao','guaira-pr','autonomo',1)),'especialidades: adicional combina com cidade atendida e tipo');
select test.assert_true((select count(*)=1 from public.search_public_businesses('','eletrica','guaira-pr','autonomo',1)),'especialidades: principal combina com cidade de outra UF');
select test.assert_true((select count(*)=2 from public.search_public_businesses('','pintura','','',1)),'especialidades: principal e adicional encontram dois negócios');
select test.assert_true((select count(*)=1 from public.search_public_businesses('Pintura residencial','pintura','guaira-pr','autonomo',1)),'especialidades: termo, categoria, tipo e cidade são combinados');
select test.assert_true((select count(*)=1 from public.search_public_businesses('construcao','','','',1)),'especialidades: busca textual inclui adicionais sem acentos');
select test.assert_true((select count(*)=0 from public.search_public_businesses('','construcao','terra-roxa-pr','empresa',1)),'especialidades: filtros não são trocados por OR irrestrito');
select test.assert_true((select jsonb_array_length(additional_categories)=2 from public.search_public_businesses('Carlos','','','',1)),'especialidades: projeção pública inclui as adicionais');
select test.assert_true(not (select to_jsonb(r)?|array['owner_id','tax_id','legal_name'] from public.search_public_businesses('Carlos','','','',1) r),'especialidades: busca não expõe dados privados');
select test.assert_true((select count(*)=0 from public.search_public_businesses('%','','','',1)),'especialidades: curingas são tratados como texto literal');
reset role;
update public.categories set active=false where id='pintura';
set local role anon;
select test.assert_true((select count(*)=0 from public.search_public_businesses('','pintura','','',1)),'especialidades: categoria inativa não participa dos filtros');
select test.assert_true((select jsonb_array_length(additional_categories)=1 from public.search_public_businesses('Carlos','','','',1)),'especialidades: adicional inativa não aparece no perfil público');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000701';
select test.expect_error(format('select public.set_business_specialties(%L,%L,array[%L,%L],%L,array[%L,%L])',:'specialty_a','eletrica','construcao','pintura','eletrica','construcao','pintura'),'23514','especialidades: categoria inativa é recusada mesmo em repetição');
select public.set_business_specialties(:'specialty_a','eletrica',array['construcao'],'eletrica',array['construcao','pintura']);
select test.assert_true((select category_id='pintura' from public.services where id=:'specialty_service'),'especialidades: remoção não exclui nem reclassifica serviço');
select test.assert_true((select count(*)=1 from public.portfolio_items where business_id=:'specialty_a'),'especialidades: remoção preserva fotografia');
select test.assert_true((select count(*)=1 from public.work_posts where business_id=:'specialty_a'),'especialidades: remoção preserva publicação');
select test.assert_true((select count(*)=1 from public.work_post_images where business_id=:'specialty_a'),'especialidades: remoção preserva vínculo da fotografia na publicação');
select test.expect_error(format('update public.businesses set category_id=%L where id=%L','pintura',:'specialty_a'),'23514','especialidades: API anterior não atribui principal inativa');
update public.businesses set category_id='construcao' where id=:'specialty_a';
select test.assert_true((select count(*)=0 from public.business_categories where business_id=:'specialty_a' and category_id='construcao'),'especialidades: API anterior mantém principal fora das adicionais');
reset role;
update public.categories set active=true where id='pintura';
-- Massa local para provar limite/ordem sem coletar todos os negócios no frontend.
insert into public.businesses(name,slug,type,city_id,category_id,status)
select 'ZZZ técnico '||lpad(n::text,2,'0'),'zzz-tecnico-especialidades-'||n,'autonomo','mundo-novo-ms','climatizacao','published' from generate_series(1,25) n;
set local role anon;
select test.assert_true((select count(*)=21 from public.search_public_businesses('','climatizacao','','',1)),'especialidades: primeira página tem no máximo 21 linhas');
select test.assert_true((select count(*)=5 from public.search_public_businesses('','climatizacao','','',2)),'especialidades: segunda página usa offset 20');
select test.assert_true((select count(*)=0 from public.search_public_businesses('','climatizacao','','',1000)),'especialidades: página final vazia');
reset role;
select test.assert_true((select count(*)=0 from public.business_subscriptions),'especialidades: nenhum período gratuito iniciado');
rollback;
