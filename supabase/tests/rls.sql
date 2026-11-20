begin;
insert into auth.users(id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001', '{"display_name":"Pessoa A","role":"owner"}'),
 ('00000000-0000-0000-0000-000000000002', '{"display_name":"Pessoa B"}'),
 ('00000000-0000-0000-0000-000000000003', '{"display_name":"Leitor"}');
select test.assert_true((select count(*)=3 from profiles), 'trigger cria perfis');
select test.assert_true((select bool_and(relrowsecurity) from pg_class where oid in (
 'public.profiles'::regclass, 'public.cities'::regclass, 'public.categories'::regclass,
 'public.businesses'::regclass, 'public.business_members'::regclass, 'public.business_details'::regclass,
 'public.services'::regclass, 'public.portfolio_items'::regclass, 'public.business_service_areas'::regclass)), 'RLS habilitada em todas as nove tabelas');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.create_business('Negócio A', 'negocio-a', 'autonomo', 'mundo-novo-ms') as a_id \gset
select public.create_business('Rascunho A', 'rascunho-a', 'empresa', 'mundo-novo-ms') as draft_id \gset
select test.assert_true((select count(*)=1 from profiles), 'usuário consulta somente seu perfil');
update profiles set display_name='Pessoa A atualizada' where id=auth.uid();
select test.assert_true((select display_name='Pessoa A atualizada' from profiles), 'atualiza próprio perfil');
select test.expect_error($s$update profiles set id='00000000-0000-0000-0000-000000000002'$s$, '42501', 'não transfere perfil');
select test.expect_error($s$update businesses set status='published'$s$, '42501', 'owner não publica diretamente pela API');
select test.assert_true(not has_column_privilege('authenticated','public.businesses','status','UPDATE'), 'status sem privilégio UPDATE para authenticated');
-- Fixture publicada por operador confiável somente no PostgreSQL isolado.
reset role;
update businesses set status='published' where id=:'a_id';
set local role authenticated;
insert into services(business_id, category_id, name, pricing_type, price_amount_cents)
 values (:'a_id', 'eletrica', 'Serviço ativo', 'fixed', 15000) returning id as service_id \gset
insert into services(business_id, category_id, name, active) values
 (:'a_id', 'eletrica', 'Serviço inativo', false), (:'draft_id', 'pintura', 'Serviço rascunho', true);
insert into business_details(business_id, legal_name, tax_id) values (:'a_id', 'Razão privada', '12345678000199');
insert into portfolio_items(business_id, service_id, storage_path) values (:'a_id', :'service_id', :'a_id' || '/portfolio/teste.webp');
select test.assert_true((select count(*)=2 from business_members), 'criador é proprietário de múltiplos negócios');
update businesses set category_id='eletrica' where id=:'a_id';
select test.assert_true((select category_id='eletrica' from businesses where id=:'a_id'), 'owner define categoria principal');
update businesses set category_id='pintura', description='Descrição de teste', whatsapp='5567999991234', instagram='teste' where id=:'draft_id';
select test.assert_true((select status='draft' and category_id='pintura' and whatsapp='5567999991234' from businesses where id=:'draft_id'), 'cadastro completo permanece rascunho');
insert into business_service_areas(business_id,city_id) values (:'draft_id','mundo-novo-ms') on conflict (business_id,city_id) do nothing;
select test.assert_true((select count(*)=1 from business_service_areas where business_id=:'draft_id'), 'repetir área de atendimento não duplica vínculo');
select test.expect_error($s$update businesses set category_id='categoria-inexistente'$s$, '23503', 'categoria principal exige chave válida');
select test.expect_error($s$insert into business_members(business_id,user_id,role) select id, auth.uid(), 'admin' from businesses limit 1$s$, '42501', 'cliente não insere associação');
select test.expect_error($s$update business_members set role='admin'$s$, '42501', 'cliente não muda função');
select test.expect_error('delete from business_members', '42501', 'cliente não remove proprietário');
select test.expect_error($s$insert into businesses(name,slug,type,city_id) values ('Direto','direto','empresa','mundo-novo-ms')$s$, '42501', 'negócio só é criado por RPC transacional');
select test.expect_error($s$select public.create_business('Inválido','invalido','empresa','inexistente')$s$, '23514', 'RPC rejeita cidade inválida');
select test.expect_error($s$select public.create_business('Duplicado','negocio-a','empresa','mundo-novo-ms')$s$, '23505', 'RPC falha atomicamente com slug duplicado');
select test.assert_true((select count(*)=2 from business_members), 'falha não cria proprietário órfão');
select test.expect_error($s$insert into services(business_id,category_id,name,pricing_type) select id,'eletrica','Sem preço','fixed' from businesses limit 1$s$, '23514', 'preço fixo exige valor');
select test.expect_error($s$insert into services(business_id,category_id,name,price_amount_cents) select id,'eletrica','Orçamento com valor',1 from businesses limit 1$s$, '23514', 'orçamento não aceita valor');
select test.expect_error($s$insert into services(business_id,category_id,name,pricing_type,price_amount_cents) select id,'eletrica','Preço negativo','starting-at',-1 from businesses limit 1$s$, '23514', 'preço não pode ser negativo');

reset role;
insert into business_members(business_id,user_id,role) values (:'a_id','00000000-0000-0000-0000-000000000003','viewer');
update business_members set role='admin' where business_id=:'a_id' and user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select test.expect_error($s$update businesses set status='draft'$s$, '42501', 'admin não muda status diretamente');
update businesses set description='Edição permitida ao admin' where id=:'a_id';
select test.assert_true((select description='Edição permitida ao admin' from businesses where id=:'a_id'), 'admin continua editando campos comuns');
reset role;
update business_members set role='viewer' where business_id=:'a_id' and user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select public.create_business('Negócio B', 'negocio-b', 'empresa', 'mundo-novo-ms') as b_id \gset
select test.assert_true((select count(*)=2 from businesses), 'não membro não vê rascunhos de A');
update businesses set name='Invadido' where id=:'draft_id';
select test.assert_true((select count(*)=0 from businesses where name='Invadido'), 'não membro não edita rascunho');
update businesses set name='Invadido' where id=:'a_id';
select test.assert_true((select count(*)=0 from businesses where name='Invadido'), 'não membro não edita publicado');
update businesses set category_id='pintura' where id=:'a_id';
select test.assert_true((select category_id='eletrica' from businesses where id=:'a_id'), 'terceiro não altera categoria principal');
select test.assert_true((select count(*)=0 from business_details), 'dados empresariais isolados');
select test.assert_true((select count(*)=1 from profiles), 'conta B não lê perfil privado de A');
select test.expect_error($s$update services set business_id=gen_random_uuid()$s$, '42501', 'não transfere serviço entre negócios');
select test.expect_error(format('insert into services(business_id,category_id,name) values (%L,''eletrica'',''Ataque'')', :'a_id'), '42501', 'não insere serviço de outro negócio');
select test.expect_error(format('insert into portfolio_items(business_id,service_id,storage_path) values (%L,%L,%L)', :'b_id', :'service_id', :'b_id' || '/portfolio/teste.webp'), '23503', 'FK impede portfólio vinculado a serviço de outro negócio');
select test.expect_error(format('insert into portfolio_items(business_id,storage_path) values (%L,%L)', :'b_id', :'a_id' || '/portfolio/teste.webp'), '23514', 'caminho de portfólio pertence ao negócio');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select test.assert_true((select count(*)=2 from services), 'viewer vê serviços inativos do próprio negócio');
select test.assert_true((select count(*)=0 from business_details), 'viewer não vê dados sensíveis');
select test.expect_error(format('insert into services(business_id,category_id,name) values (%L,''eletrica'',''Viewer'')', :'a_id'), '42501', 'viewer não escreve serviços');
update businesses set name='Viewer editou' where id=:'a_id';
select test.assert_true((select count(*)=0 from businesses where name='Viewer editou'), 'viewer não edita negócio');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select test.assert_true((select count(*)=6 from categories), 'visitante lê seis categorias');
select test.assert_true((select count(*)=1 from cities), 'visitante lê cidade operacional');
select test.assert_true((select count(*)=1 from businesses), 'visitante só vê negócio publicado');
select test.assert_true((select count(*)=1 from services), 'visitante só vê serviço ativo de negócio publicado');
select test.assert_true((select count(*)=1 from portfolio_items), 'visitante lê metadados do portfólio publicado');
select test.expect_error('select * from profiles', '42501', 'visitante não lê perfis pessoais');
select test.expect_error('select * from business_members', '42501', 'visitante não lê membros');
select test.expect_error('select * from business_details', '42501', 'visitante não lê dados empresariais');
select test.expect_error($s$select public.create_business('Anon','anon','autonomo','mundo-novo-ms')$s$, '42501', 'visitante não cria negócio');
select test.expect_error($s$select private.create_business('Anon','anon','autonomo','mundo-novo-ms')$s$, '42501', 'visitante não executa função interna');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '';
select test.expect_error($s$select public.create_business('Sem uid','sem-uid','autonomo','mundo-novo-ms')$s$, '42501', 'RPC verifica uid mesmo com role authenticated');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select test.expect_error($s$update businesses set status='unpublished'$s$, '42501', 'owner não altera estado de publicação');
reset role;
update businesses set status='unpublished' where id=:'a_id';
set local role anon;
set local request.jwt.claim.sub = '';
select test.assert_true((select count(*)=0 from businesses), 'despublicação oculta negócio');
select test.assert_true((select count(*)=0 from services), 'despublicação oculta serviços');
select test.assert_true((select count(*)=0 from portfolio_items), 'despublicação oculta portfólio');
select test.assert_true((select count(*)=0 from business_service_areas), 'despublicação oculta áreas');
rollback;
