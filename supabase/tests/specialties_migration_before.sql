-- Pré-aplicação: dados exclusivamente do cluster nativo descartável, nunca remoto.
begin;
insert into auth.users(id,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000911','{}');
insert into public.categories(id,name,active) values ('legada-inativa','Categoria legada inativa',false);
insert into public.businesses(id,name,slug,type,city_id,category_id,description,updated_at) values
 ('00000000-0000-4000-8000-000000000911','Legado incompleto','legado-especialidades-incompleto','autonomo','mundo-novo-ms',null,'Preservar rascunho incompleto','2026-01-01Z'),
 ('00000000-0000-4000-8000-000000000912','Legado ativo','legado-especialidades-ativo','empresa','mundo-novo-ms','construcao','Preservar empresa e contatos','2026-01-01Z'),
 ('00000000-0000-4000-8000-000000000913','Legado inativo','legado-especialidades-inativo','autonomo','mundo-novo-ms','legada-inativa','Não reclassificar silenciosamente','2026-01-01Z');
insert into public.business_members(business_id,user_id,role)
 select id,'00000000-0000-4000-8000-000000000911','owner' from public.businesses;
insert into public.business_service_areas(business_id,city_id) select id,city_id from public.businesses;
insert into public.business_details(business_id,legal_name) values ('00000000-0000-4000-8000-000000000912','Empresa técnica privada');
insert into public.services(business_id,category_id,name) values ('00000000-0000-4000-8000-000000000912','pintura','Serviço legado de pintura');
insert into public.portfolio_items(id,business_id,storage_path,media_state) values
 ('00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000912/portfolio/00000000-0000-4000-8000-000000000911.webp','ready');
insert into public.work_posts(id,business_id,title) values ('00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000912','Publicação legada técnica');
insert into public.work_post_images(post_id,business_id,portfolio_item_id,sort_order) values ('00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000911',0);
create function test.specialty_data_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
  'businesses',(select jsonb_agg(to_jsonb(b) order by id) from public.businesses b),
  'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'members',(select jsonb_agg(to_jsonb(m) order by id) from public.business_members m),
  'services',(select jsonb_agg(to_jsonb(s) order by id) from public.services s),
  'portfolio',(select jsonb_agg(to_jsonb(p) order by id) from public.portfolio_items p),
  'posts',(select jsonb_agg(to_jsonb(p) order by id) from public.work_posts p),
  'images',(select jsonb_agg(to_jsonb(i) order by post_id,portfolio_item_id) from public.work_post_images i),
  'areas',(select jsonb_agg(to_jsonb(a) order by business_id,city_id) from public.business_service_areas a),
  'details',(select jsonb_agg(to_jsonb(d) order by business_id) from public.business_details d),
  'categories',(select jsonb_agg(to_jsonb(c) order by id) from public.categories c),
  'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where tablename<>'business_categories')
 );
$$;
create table test.specialty_migration_snapshot as select test.specialty_data_snapshot() as data;
commit;
