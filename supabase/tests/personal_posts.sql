-- Local disposable PostgreSQL ONLY; never operational identities/files.
begin;
select count(*) as baseline_businesses from public.businesses \gset
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-00000000b001','person-a@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000b002','person-b@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000b003','moderator@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-00000000b003');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select public.personal_post_command('prepare','00000000-0000-4000-8000-00000000b010','{"photoId":"00000000-0000-4000-8000-00000000b011","bytes":100}');
select public.personal_post_command('prepare','00000000-0000-4000-8000-00000000b010','{"photoId":"00000000-0000-4000-8000-00000000b011","bytes":100}');
select test.assert_true((select count(*)=1 from public.personal_posts),'personal: prepare retry does not duplicate post');
select test.expect_error($q$select public.personal_post_command('finalize','00000000-0000-4000-8000-00000000b010','{"photoId":"00000000-0000-4000-8000-00000000b011"}')$q$,'23514','personal: upload must exist before finalize');
insert into storage.objects(bucket_id,name,metadata) select 'personal-posts',storage_path,'{"size":100,"mimetype":"image/webp"}'::jsonb from public.personal_post_images where post_id='00000000-0000-4000-8000-00000000b010';
select public.personal_post_command('finalize','00000000-0000-4000-8000-00000000b010','{"photoId":"00000000-0000-4000-8000-00000000b011"}');
select public.personal_post_command('save','00000000-0000-4000-8000-00000000b010','{"title":"Personal project","description":"Original caption","imageIds":["00000000-0000-4000-8000-00000000b011"]}');
select test.assert_true((public.personal_posts_query('mine')->'items'->0->>'description')='Original caption','personal: own draft persisted without business');
select test.expect_error($q$update public.personal_posts set status='published'$q$,'42501','personal: no direct status bypass');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=0 from public.personal_posts),'anon: draft rows hidden');
select test.assert_true((select count(*)=0 from storage.objects where bucket_id='personal-posts'),'anon: draft file hidden');
select test.assert_true(public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010') is null,'anon: draft URL/API hidden');
select test.assert_true(jsonb_array_length(public.publication_feed()->'items')=0,'anon: draft absent from unified feed');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b002';
select test.assert_true(public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010') is null,'user B: cannot read user A draft');
select test.expect_error($q$select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010')$q$,'42501','user B: cannot publish user A post');
select test.expect_error($q$select public.personal_post_command('save','00000000-0000-4000-8000-00000000b010','{"title":"Forged","imageIds":[]}'::jsonb)$q$,'42501','user B: cannot edit user A post');
select test.expect_error($q$select public.personal_post_command('delete','00000000-0000-4000-8000-00000000b010')$q$,'42501','user B: cannot delete user A post');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b003';
select test.assert_true(jsonb_array_length(public.admin_query('personal_posts')->'items')=0,'moderation: unpublished private drafts not in review');
reset role;update auth.users set email_confirmed_at=null where id='00000000-0000-4000-8000-00000000b001';
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select test.expect_error($q$select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010')$q$,'42501','personal: confirmed email required before public action');
reset role;update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-00000000b001';
set local role authenticated;
select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010');
-- Both kinds share one chronological feed even when the professional profile is draft.
savepoint mixed_feed;
select public.create_business('Mixed feed fixture','mixed-feed-fixture','autonomo','mundo-novo-ms') as mixed_business \gset
select public.portfolio_command('prepare',:'mixed_business','00000000-0000-4000-8000-00000000b021');
insert into storage.objects(bucket_id,name,metadata) select 'business-portfolio',storage_path,'{"size":100,"mimetype":"image/webp"}'::jsonb from public.portfolio_items where business_id=:'mixed_business';
select public.portfolio_command('finalize',:'mixed_business','00000000-0000-4000-8000-00000000b021');
select public.work_post_command('save',:'mixed_business','00000000-0000-4000-8000-00000000b022','Professional fixture','Mixed feed caption',array['00000000-0000-4000-8000-00000000b021']::uuid[]);
select public.work_post_command('publish',:'mixed_business','00000000-0000-4000-8000-00000000b022');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true(jsonb_array_length(public.publication_feed()->'items')=2,'feed: personal and professional in one query');
select public.publication_feed()->'items'->0 as first_post \gset
select test.assert_true(:'first_post'::jsonb->>'kind'='professional','feed: sorted by actual publication date');
select test.assert_true(jsonb_array_length(public.publication_feed((:'first_post'::jsonb->>'publishedAt')::timestamptz,(:'first_post'::jsonb->>'id')::uuid,:'first_post'::jsonb->>'kind')->'items')=1,'feed: cursor preserves date ID and kind');
rollback to mixed_feed;
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true(jsonb_array_length(public.publication_feed()->'items')=1,'personal: immediate unified feed, no admin approval');
select test.assert_true((select count(*)=1 from storage.objects where bucket_id='personal-posts'),'personal: selected published image readable');
select test.assert_true((public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010')->>'publishedAt') is not null,'personal: actual post publication date');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b002';
select public.report_content('personal_post','00000000-0000-4000-8000-00000000b010','Local reported issue only');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b003';
select public.moderate_personal_post('00000000-0000-4000-8000-00000000b010','withdraw','Local moderation decision');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select test.expect_error($q$select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010')$q$,'42501','personal: owner cannot override moderation');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true(jsonb_array_length(public.publication_feed()->'items')=0 and (select count(*)=0 from storage.objects where bucket_id='personal-posts'),'personal: moderation hides feed and blocks new image reads');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b003';
select public.moderate_personal_post('00000000-0000-4000-8000-00000000b010','release','Local release decision');
select test.assert_true((public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010')->>'status')='unpublished','moderation: release never republishes');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010');
select public.personal_post_command('save','00000000-0000-4000-8000-00000000b010','{"title":"Edited project","description":"Saved edit","imageIds":["00000000-0000-4000-8000-00000000b011"]}');
select test.assert_true((public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010')->>'status')='unpublished','personal: edit returns to private until explicit republish');
select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b003';
select public.admin_action('user','00000000-0000-4000-8000-00000000b001','suspend','Local suspended account','active');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select test.expect_error($q$select public.personal_post_command('publish','00000000-0000-4000-8000-00000000b010')$q$,'42501','personal: suspended account cannot publish');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b003';
select public.admin_action('user','00000000-0000-4000-8000-00000000b001','reactivate','Local reactivation','suspended');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b001';
select test.assert_true((public.personal_posts_query('detail','00000000-0000-4000-8000-00000000b010')->>'status')='unpublished','personal: reactivation never republishes');
select public.personal_post_command('delete','00000000-0000-4000-8000-00000000b010');
select test.expect_error($q$select public.personal_post_command('finish_delete','00000000-0000-4000-8000-00000000b010')$q$,'23514','personal: preserve metadata until Storage confirms removal');
-- Simulated Storage service deletion, not SQL deletion in operational storage.objects.
delete from storage.objects where bucket_id='personal-posts';
select public.personal_post_command('finish_delete','00000000-0000-4000-8000-00000000b010');
select test.assert_true((select count(*)=0 from public.personal_posts),'personal: deletion completes after bytes removed');
reset role;
select test.assert_true((select count(*)=:'baseline_businesses'::integer from public.businesses) and (select count(*)=0 from public.business_subscriptions) and (select count(*)=0 from private.subscription_activations),'personal: no fake business, subscription or trial');
rollback;
