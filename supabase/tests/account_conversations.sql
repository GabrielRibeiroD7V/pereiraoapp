begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-00000000c001','chat-a@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000c002','chat-b@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000c003','chat-c@example.invalid',now());
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c001';
select public.personal_post_command('prepare','00000000-0000-4000-8000-00000000c010','{"photoId":"00000000-0000-4000-8000-00000000c011","bytes":100}');
insert into storage.objects(bucket_id,name,metadata) select 'personal-posts',storage_path,'{"size":100,"mimetype":"image/webp"}'::jsonb from public.personal_post_images where post_id='00000000-0000-4000-8000-00000000c010';
select public.personal_post_command('finalize','00000000-0000-4000-8000-00000000c010','{"photoId":"00000000-0000-4000-8000-00000000c011"}');
select public.personal_post_command('save','00000000-0000-4000-8000-00000000c010','{"title":"Local project","imageIds":["00000000-0000-4000-8000-00000000c011"]}');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c002';
select test.expect_error($q$select public.open_account_conversation('Hello','00000000-0000-4000-8000-00000000c020','00000000-0000-4000-8000-00000000c001')$q$,'42501','cannot contact hidden draft author');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c001';
select public.personal_post_command('publish','00000000-0000-4000-8000-00000000c010');
select test.expect_error($q$select public.open_account_conversation('Self','00000000-0000-4000-8000-00000000c020','00000000-0000-4000-8000-00000000c001')$q$,'42501','no self contact');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c002';
select public.open_account_conversation('Hello','00000000-0000-4000-8000-00000000c020','00000000-0000-4000-8000-00000000c001') as convo \gset
select public.open_account_conversation('Hello','00000000-0000-4000-8000-00000000c020','00000000-0000-4000-8000-00000000c001');
select test.assert_true(jsonb_array_length(public.account_conversations_query())=1,'conversation retry no duplicate');
select test.assert_true(jsonb_array_length(public.account_conversation_messages(:'convo')->'items')=1,'lost response retry no duplicate message');
select test.expect_error(format('select public.send_account_conversation_message(%L,%L,%L)',:'convo','Spam','00000000-0000-4000-8000-00000000c021'),'23514','rate limit');
select test.expect_error('select * from private.account_messages','42501','no direct table access');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c001';
select public.send_account_conversation_message(:'convo','Reply','00000000-0000-4000-8000-00000000c022');
select test.assert_true(jsonb_array_length(public.account_conversation_messages(:'convo')->'items')=2,'two accounts text persisted both directions');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c003';
select test.assert_true(jsonb_array_length(public.account_conversations_query())=0,'third cannot list');
select test.expect_error(format('select public.account_conversation_messages(%L)',:'convo'),'42501','third cannot read');
select test.expect_error(format('select public.send_account_conversation_message(%L,%L,%L)',:'convo','Forged','00000000-0000-4000-8000-00000000c023'),'42501','third cannot write');
set local role anon;set local request.jwt.claim.sub='';
select test.expect_error('select public.account_conversations_query()','42501','anon no inbox');
reset role;
insert into private.account_restrictions(user_id,suspended) values('00000000-0000-4000-8000-00000000c001',true);
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000c002';
select test.expect_error(format('select public.send_account_conversation_message(%L,%L,%L)',:'convo','Suspended target','00000000-0000-4000-8000-00000000c024'),'42501','suspension blocks delivery');
rollback;
