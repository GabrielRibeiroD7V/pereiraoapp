begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000091'),('00000000-0000-4000-8000-000000000092');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000091';
select public.create_business('Origem sintética','origem-tags','autonomo','mundo-novo-ms') as bid \gset
select public.create_business('Empresa sintética pública','empresa-tags-publica','empresa','mundo-novo-ms') as company \gset
select public.create_business('Empresa sintética privada','empresa-tags-privada','empresa','mundo-novo-ms') as hidden \gset
select gen_random_uuid() as pid \gset
select public.work_post_command('save',:'bid',:'pid','Teste de vínculo','',array[]::uuid[]);
select test.assert_true((select count(*)=0 from public.search_work_post_companies(:'bid','Empresa')),'draft companies hidden from picker');
select test.expect_error(format('select public.set_work_post_companies(%L,%L,array[%L]::uuid[])',:'bid',:'pid',:'hidden'),'23514','draft company cannot be tagged');
reset role;
alter table public.businesses disable trigger business_first_activation_trial;
update public.businesses set status='published' where id=:'company';
alter table public.businesses enable trigger business_first_activation_trial;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000091';
select test.assert_true((select count(*)=1 from public.search_work_post_companies(:'bid','Empresa')),'only published real company selectable');
select test.assert_true((select count(*)=0 from public.search_work_post_companies(:'bid','%%')),'search is literal not wildcard');
select public.set_work_post_companies(:'bid',:'pid',array[:'company']::uuid[]);
select public.set_work_post_companies(:'bid',:'pid',array[:'company']::uuid[]);
select test.assert_true((select count(*)=1 from public.work_post_business_tags),'same selection idempotent');
select test.expect_error(format('insert into public.work_post_business_tags(post_id,business_id,tagged_business_id,sort_order,created_by) values(%L,%L,%L,1,%L)',:'pid',:'bid',:'hidden','00000000-0000-4000-8000-000000000091'),'42501','direct writes denied');
select test.expect_error(format('select public.set_work_post_companies(%L,%L,array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()])',:'bid',:'pid'),'22023','six targets rejected');
select test.assert_true((select status='draft' from public.businesses where id=:'bid'),'tagging does not publish business');
select test.expect_error('select created_by from public.work_post_business_tags','42501','actor identifier not exposed');
select test.expect_error(format('select public.set_work_post_companies(%L,%L,array[%L,%L]::uuid[])',:'bid',:'pid',:'company',:'company'),'22023','duplicate tag blocked');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000092';
select test.assert_true((select count(*)=0 from public.work_post_business_tags),'third party cannot see draft links');
select test.expect_error(format('select public.search_work_post_companies(%L,%L)',:'bid','Empresa'),'42501','search checks origin ownership');
select test.expect_error(format('select public.set_work_post_companies(%L,%L,array[]::uuid[])',:'bid',:'pid'),'42501','third party cannot modify');
set local role anon;
set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=0 from public.work_post_business_tags),'anonymous cannot see draft tags');
select test.expect_error(format('select public.search_work_post_companies(%L,%L)',:'bid','Empresa'),'42501','anonymous search denied');
reset role;
-- Estado público apenas no cluster descartável, sem iniciar qualquer trial.
alter table public.businesses disable trigger business_first_activation_trial;
update public.businesses set status='published' where id=:'bid';
alter table public.businesses enable trigger business_first_activation_trial;
update public.work_posts set status='published',published_at=clock_timestamp() where id=:'pid';
-- A regra pública exige mídia pronta: sem foto o vínculo continua oculto.
set local role anon;
select test.assert_true((select count(*)=0 from public.work_post_business_tags),'public link requires complete public post');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000091';
select gen_random_uuid() as photo \gset
select public.prepare_work_post_photo(:'bid',:'pid',:'photo',123,'Teste de vínculo','') as ticket \gset
insert into storage.objects(bucket_id,name,metadata) values('business-posts',:'ticket'::jsonb->>'storage_path','{"size":123,"mimetype":"image/webp"}');
select public.finalize_work_post_photo(:'bid',:'photo');
select public.save_work_post_composition(:'bid',:'pid','Teste de vínculo','',jsonb_build_array(jsonb_build_object('id',:'photo','kind','post')));
select public.work_post_command('publish',:'bid',:'pid');
select public.set_work_post_companies(:'bid',:'pid',array[:'company']::uuid[]);
select test.assert_true((select status='published' from public.work_posts where id=:'pid'),'identical selection does not withdraw a post');
set local role anon;
set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=1 from public.work_post_business_tags),'complete public post shows reference to published company');
reset role;
update public.businesses set status='unpublished' where id=:'company';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000091';
select test.assert_true((select count(*)=0 from public.work_post_business_tags),'withdrawn target hidden even from ordinary draft UI');
select test.assert_true((select count(*)=0 from public.search_work_post_companies(:'bid','Empresa')),'withdrawn target not searchable');
select public.set_work_post_companies(:'bid',:'pid',array[]::uuid[]);
select test.assert_true((select status='unpublished' from public.work_posts where id=:'pid'),'changing published references withdraws post');
select test.assert_true((select selected from public.work_post_photos where id=:'photo'),'changing references preserves selected photographs');
rollback;
