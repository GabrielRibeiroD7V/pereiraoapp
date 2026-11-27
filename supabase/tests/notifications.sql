begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-00000000d001','notify-a@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000d002','notify-b@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000d003','notify-c@example.invalid',now());
insert into private.account_conversations(id,member_a,member_b,created_by) values
 ('00000000-0000-4000-8000-00000000d010','00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d001');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000d001';
select public.send_account_conversation_message('00000000-0000-4000-8000-00000000d010','Local notification test','00000000-0000-4000-8000-00000000d020');
select test.assert_true(public.message_unread_count()=0,'sender does not count own message');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000d002';
select test.assert_true(public.message_unread_count()=1,'recipient count comes from persisted message');
select test.assert_true((public.account_conversations_query()->0->>'unreadCount')::int=1,'inbox and total agree');
set local "realtime.topic"='messages:user:00000000-0000-4000-8000-00000000d002';
-- O Realtime consulta a policy no contexto do canal; aqui testamos autorização
-- do tópico, não o transporte nem a distribuição física dos broadcasts.
select test.assert_true((select count(*)>0 from realtime.messages),'recipient may authorize own private channel');
set local "realtime.topic"='messages:user:00000000-0000-4000-8000-00000000d001';
select test.assert_true((select count(*)=0 from realtime.messages),'recipient cannot subscribe to another account topic');
select public.mark_conversation_read('00000000-0000-4000-8000-00000000d010');
select test.assert_true(public.message_unread_count()=0,'read marker clears persisted count');
select public.mark_conversation_read('00000000-0000-4000-8000-00000000d010');
select test.assert_true(public.message_unread_count()=0,'repeated mark is idempotent');
select test.expect_error('select public.message_push_config()','42501','client cannot read private push configuration');
select test.expect_error('select * from private.message_push_subscriptions','42501','client cannot list device endpoints');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000d003';
select test.assert_true(public.message_unread_count()=0,'third account has no leaked unread count');
select test.expect_error($q$select public.mark_conversation_read('00000000-0000-4000-8000-00000000d010')$q$,'42501','third account cannot mark another conversation');
select test.expect_error($q$select public.account_conversation_messages('00000000-0000-4000-8000-00000000d010')$q$,'42501','third account cannot read messages');
select test.expect_error($q$select public.send_account_conversation_message('00000000-0000-4000-8000-00000000d010','Forged','00000000-0000-4000-8000-00000000d021')$q$,'42501','third account cannot send messages');
set local role anon; set local request.jwt.claim.sub='';
select test.expect_error('select public.message_unread_count()','42501','anon cannot query unread count');
select test.expect_error($q$select public.mark_conversation_read('00000000-0000-4000-8000-00000000d010')$q$,'42501','anon cannot mark read');
rollback;
