begin;
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000071','{"display_name":"Cliente"}'),
 ('00000000-0000-0000-0000-000000000072','{"display_name":"Profissional"}'),
 ('00000000-0000-0000-0000-000000000073','{"display_name":"Terceiro"}');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select public.create_business('Atendimento teste','atendimento-teste','autonomo','mundo-novo-ms') as business_id \gset
reset role;
-- Publicação sintética apenas no cluster isolado, sem iniciar período gratuito.
alter table public.businesses disable trigger business_first_activation_trial;
update public.businesses set status='published' where id=:'business_id';
alter table public.businesses enable trigger business_first_activation_trial;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000071';
select public.open_conversation(:'business_id','Gostaria de um orçamento') as conversation_id \gset
select test.assert_true((select jsonb_array_length(public.my_conversations())=1),'cliente vê sua conversa');
select test.assert_true((public.my_conversation_messages(:'conversation_id')->'items'->0->>'body')='Gostaria de um orçamento','primeira mensagem persistida');
select test.expect_error(format('select public.open_conversation(%L,%L)',:'business_id','Outra mensagem imediata'),'23514','limite entre mensagens');
select test.expect_error(format('select public.open_conversation(%L,%L)',:'business_id','   '),'23514','mensagem vazia recusada');
select test.expect_error('select * from private.conversations','42501','tabelas privadas inacessíveis');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000073';
select test.assert_true(public.my_conversations()='[]'::jsonb,'terceiro não vê conversa');
select test.expect_error(format('select public.my_conversation_messages(%L)',:'conversation_id'),'42501','terceiro não lê mensagens');
select test.expect_error(format('select public.send_conversation_message(%L,%L)',:'conversation_id','Invasão'),'42501','terceiro não responde');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select test.assert_true((select jsonb_array_length(public.my_conversations())=1),'profissional vê conversa de seu negócio');
select test.expect_error(format('select public.open_conversation(%L,%L)',:'business_id','Autoconversa'),'23514','prestador não vira cliente de si mesmo');
select public.send_conversation_message(:'conversation_id','Olá, posso ajudar.') as reply_id \gset
select test.assert_true((select jsonb_array_length(public.my_conversation_messages(:'conversation_id')->'items')=2),'resposta visível');
reset role;
update public.businesses set status='unpublished' where id=:'business_id';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000071';
select test.assert_true((select jsonb_array_length(public.my_conversations())=1),'histórico preservado ao suspender perfil');
select test.expect_error(format('select public.send_conversation_message(%L,%L)',:'conversation_id','Depois da suspensão'),'23514','envio bloqueado em perfil suspenso');
set local role anon;
select test.expect_error('select public.my_conversations()','42501','visitante não acessa caixa');
rollback;
