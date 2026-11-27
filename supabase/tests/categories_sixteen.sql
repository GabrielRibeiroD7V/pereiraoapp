begin;
select test.assert_true((select count(*)=16 from public.categories),'16 categories after replay');
select test.assert_true((select count(*)=16 from public.offer_areas),'16 matching offer areas');
select test.assert_true((select bool_and(to_jsonb(c)=b.value) from test.categories_baseline s cross join lateral jsonb_each(s.categories) b join public.categories c on c.id=b.key),'all 12 original categories unchanged');
select test.assert_true((select businesses=(select md5(coalesce(jsonb_agg(to_jsonb(b) order by id)::text,'[]')) from public.businesses b) and services=(select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) from public.services s) and specialties=(select md5(coalesce(jsonb_agg(to_jsonb(bc) order by business_id,category_id)::text,'[]')) from public.business_categories bc) from test.categories_baseline),'businesses services and specialties preserved');
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-00000000e001','categories-a@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000e002','categories-b@example.invalid',now());
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000e001';
select public.create_business('Categoria local','categoria-local','empresa','mundo-novo-ms') as bid \gset
select set_config('test.category_business',:'bid',true);
do $$
declare c record; b uuid:=current_setting('test.category_business')::uuid; old_primary text; old_extra text[]; extra text;
begin
 for c in select id from public.categories where active order by id loop
  select category_id into old_primary from public.businesses where id=b;
  select coalesce(array_agg(category_id order by category_id),'{}') into old_extra from public.business_categories where business_id=b;
  extra:=case when c.id='eletrica' then 'pintura' else 'eletrica' end;
  perform public.set_business_specialties(b,c.id,array[extra],old_primary,old_extra);
  perform test.assert_true((select category_id=c.id and status='draft' from public.businesses where id=b),'owner selects primary '||c.id);
  perform test.assert_true(exists(select 1 from public.business_categories where business_id=b and category_id=extra),'additional specialty persisted');
 end loop;
 for c in select id from public.categories where active order by id loop
  select category_id into old_primary from public.businesses where id=b;
  select coalesce(array_agg(category_id order by category_id),'{}') into old_extra from public.business_categories where business_id=b;
  extra:=case when c.id='climatizacao' then 'pintura' else 'climatizacao' end;
  perform public.set_business_specialties(b,extra,array[c.id],old_primary,old_extra);
  perform test.assert_true(exists(select 1 from public.business_categories where business_id=b and category_id=c.id),'owner selects additional '||c.id);
 end loop;
end;$$;
-- O último loop não fixa a profissão nem inventa um serviço. Classificação explícita para busca.
select public.set_business_specialties(:'bid','serralheria-metalurgica',array['beleza-estetica'],(select category_id from public.businesses where id=:'bid'),array(select category_id from public.business_categories where business_id=:'bid' order by category_id));
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000e002';
select test.expect_error(format('select public.set_business_specialties(%L,%L,%L,null,null)',:'bid','pintura','{}'),'42501','another user cannot change categories');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=16 from public.categories),'anon sees active catalog');
select test.assert_true(jsonb_array_length(public.search_unified('','','serralheria-metalurgica','provider'))=0,'draft never searchable by new category');
select test.expect_error($q$insert into public.categories(id,name) values('forged','Forged')$q$,'42501','anon cannot modify catalog');
reset role;
-- Fixture local publicada somente neste banco descartável, sem chamadas remotas.
update public.businesses set status='published',description='Fixture SQL local',whatsapp='67999999999' where id=:'bid';
set local role anon;
select test.assert_true(jsonb_array_length(public.search_unified('','','serralheria-metalurgica','provider'))=1,'primary category works without any offer');
select test.assert_true(jsonb_array_length(public.search_unified('','','beleza-estetica','provider'))=1,'additional category works without any offer');
select test.assert_true(jsonb_array_length(public.search_unified('Metalúrgica','','','provider'))=1,'category name searched with accent');
select test.assert_true(jsonb_array_length(public.search_unified('metalurgica','','','provider'))=1,'category name searched without accent');
select test.assert_true(jsonb_array_length(public.search_unified('Estética','','','provider'))=1,'additional name searchable');
select test.assert_true(jsonb_array_length(public.search_unified('','','mecanica-automotivo','provider'))=0,'undeclared category excluded');
select test.assert_true(jsonb_array_length(public.search_unified('','guaira-pr','beleza-estetica','provider'))=0,'regional filter retained');
select test.assert_true(jsonb_array_length(public.search_unified('','','beleza-estetica','service'))=0,'classification never fabricates services');
select test.assert_true(jsonb_array_length(public.search_unified('','','beleza-estetica','product'))=0,'classification never fabricates products');
select test.assert_true(jsonb_array_length(public.search_unified('','','beleza-estetica','provider',2))=0,'pagination retains filter');
select test.assert_true((select count(*)=1 from public.search_public_businesses_profile('','beleza-estetica','','',1)),'legacy specialty search remains compatible');
reset role;
update public.categories set active=false where id='beleza-estetica';
set local role anon;
select test.assert_true((select count(*)=15 from public.categories),'inactive category omitted');
select test.assert_true(jsonb_array_length(public.search_unified('','','beleza-estetica','provider'))=0,'inactive declared category does not match');
reset role;
insert into private.business_moderation(business_id,suspended) values(:'bid',true);
set local role anon;
select test.assert_true(jsonb_array_length(public.search_unified('','','serralheria-metalurgica','provider'))=0,'suspended profile remains hidden');
rollback;
