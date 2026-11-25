begin;

alter table private.conversations
  add column customer_read_at timestamptz,
  add column business_read_at timestamptz;
alter table private.account_conversations
  add column member_a_read_at timestamptz,
  add column member_b_read_at timestamptz;

create table private.message_push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check(char_length(endpoint) between 20 and 2048),
  p256dh text not null check(char_length(p256dh) between 20 and 512),
  auth text not null check(char_length(auth) between 8 and 256),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index message_push_subscriptions_user on private.message_push_subscriptions(user_id);
alter table private.message_push_subscriptions enable row level security;
revoke all on private.message_push_subscriptions from public,anon,authenticated;

create or replace function private.add_conversation_message(target uuid,message_body text,actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare convo private.conversations; previous_at timestamptz; result uuid; normalized text:=btrim(message_body); sent_at timestamptz;
begin
 if actor is null or not private.account_enabled(actor) then raise exception 'Authentication required' using errcode='42501';end if;
 if normalized is null or char_length(normalized) not between 1 and 2000 then raise exception 'Invalid message' using errcode='23514';end if;
 select * into convo from private.conversations where id=target for update;
 if not found or not private.conversation_actor(convo,actor) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.businesses where id=convo.business_id and status='published') then raise exception 'Profile unavailable' using errcode='23514';end if;
 select max(created_at) into previous_at from private.conversation_messages where conversation_id=target and sender_id=actor;
 if previous_at>clock_timestamp()-interval '3 seconds' then raise exception 'Wait before sending again' using errcode='23514';end if;
 if(select count(*) from private.conversation_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'Daily message limit' using errcode='23514';end if;
 insert into private.conversation_messages(conversation_id,sender_id,body) values(target,actor,normalized) returning id,created_at into result,sent_at;
 update private.conversations set updated_at=sent_at,
   customer_read_at=case when customer_id=actor then sent_at else customer_read_at end,
   business_read_at=case when customer_id<>actor then sent_at else business_read_at end
 where id=target;
 return result;
end;$$;
revoke all on function private.add_conversation_message(uuid,text,uuid) from public,anon,authenticated;

create or replace function private.add_account_message(target uuid,message_body text,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();c private.account_conversations;found_message private.account_messages;result uuid;sent_at timestamptz;
begin
 if not private.public_actor_enabled(actor) then raise exception 'Confirmed account required' using errcode='42501';end if;
 if request_id is null or message_body is null or char_length(btrim(message_body)) not between 1 and 2000 then raise exception 'Invalid message' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,310));
 select * into c from private.account_conversations where id=target for update;
 if not found or not private.account_conversation_actor(c,actor) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if not private.public_actor_enabled(c.member_a) or not private.public_actor_enabled(c.member_b) then raise exception 'Recipient unavailable' using errcode='42501';end if;
 select * into found_message from private.account_messages m where m.sender_id=actor and m.request_id=add_account_message.request_id;
 if found then
  if found_message.conversation_id<>target or found_message.body<>btrim(message_body) then raise exception 'Request conflict' using errcode='23514';end if;
  return found_message.id;
 end if;
 if exists(select 1 from private.account_messages where sender_id=actor and created_at>clock_timestamp()-interval '3 seconds') then raise exception 'Wait before sending' using errcode='23514';end if;
 if(select count(*) from private.account_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'Daily message limit' using errcode='23514';end if;
 insert into private.account_messages(conversation_id,sender_id,request_id,body) values(target,actor,request_id,btrim(message_body)) returning id,created_at into result,sent_at;
 update private.account_conversations set updated_at=sent_at,
   member_a_read_at=case when member_a=actor then sent_at else member_a_read_at end,
   member_b_read_at=case when member_b=actor then sent_at else member_b_read_at end
 where id=target;
 return result;
end;$$;
revoke all on function private.add_account_message(uuid,text,uuid) from public,anon,authenticated;

create or replace function public.my_conversations()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'kind','business','businessId',c.business_id,'businessName',b.name,'businessSlug',b.slug,
  'businessAvatarPath',b.profile_avatar_path,'customerName',coalesce(nullif(p.display_name,''),'Cliente'),'customerAvatarUrl',p.avatar_url,
  'side',case when c.customer_id=(select auth.uid()) then 'customer' else 'professional' end,
  'updatedAt',c.updated_at,'lastMessage',(select body from private.conversation_messages where conversation_id=c.id order by created_at desc,id desc limit 1),
  'unreadCount',(select count(*) from private.conversation_messages m where m.conversation_id=c.id and m.sender_id<>(select auth.uid()) and m.created_at>coalesce(case when c.customer_id=(select auth.uid()) then c.customer_read_at else c.business_read_at end,'epoch'::timestamptz))
 ) order by c.updated_at desc,c.id desc),'[]'::jsonb)
 from private.conversations c join public.businesses b on b.id=c.business_id left join public.profiles p on p.id=c.customer_id
 where private.conversation_actor(c,(select auth.uid()));
$$;
revoke all on function public.my_conversations() from public,anon,authenticated;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.account_conversations_query()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by(item->>'updatedAt')::timestamptz desc,item->>'id'),'[]'::jsonb) from(
  select jsonb_array_elements(public.my_conversations()) item
  union all
  select jsonb_build_object('id',c.id,'kind','account','businessId',null,'businessName',null,'businessSlug',null,'side','account',
   'peerId',case when c.member_a=(select auth.uid()) then c.member_b else c.member_a end,
   'peerName',coalesce(nullif(p.display_name,''),'Conta PEREIRÃO'),'peerAvatarUrl',p.avatar_url,'updatedAt',c.updated_at,
   'lastMessage',(select body from private.account_messages where conversation_id=c.id order by created_at desc,id desc limit 1),
   'unreadCount',(select count(*) from private.account_messages m where m.conversation_id=c.id and m.sender_id<>(select auth.uid()) and m.created_at>coalesce(case when c.member_a=(select auth.uid()) then c.member_a_read_at else c.member_b_read_at end,'epoch'::timestamptz)))
  from private.account_conversations c left join public.profiles p on p.id=case when c.member_a=(select auth.uid()) then c.member_b else c.member_a end
  where private.account_conversation_actor(c,(select auth.uid()))
 )x;
$$;
revoke all on function public.account_conversations_query() from public,anon,authenticated;
grant execute on function public.account_conversations_query() to authenticated;

create function public.mark_conversation_read(target_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c private.account_conversations; legacy private.conversations; now_at timestamptz:=clock_timestamp();
begin
 select * into c from private.account_conversations where id=target_conversation;
 if found then
  if not private.account_conversation_actor(c,actor) then raise exception 'Conversation unavailable' using errcode='42501';end if;
  update private.account_conversations set member_a_read_at=case when member_a=actor then now_at else member_a_read_at end,member_b_read_at=case when member_b=actor then now_at else member_b_read_at end where id=target_conversation;
  return;
 end if;
 select * into legacy from private.conversations where id=target_conversation;
 if not found or not private.conversation_actor(legacy,actor) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 update private.conversations set customer_read_at=case when customer_id=actor then now_at else customer_read_at end,business_read_at=case when customer_id<>actor then now_at else business_read_at end where id=target_conversation;
end;$$;
revoke all on function public.mark_conversation_read(uuid) from public,anon,authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create function public.message_unread_count()
returns integer language sql stable security definer set search_path='' as $$
 select coalesce((select sum((item->>'unreadCount')::int) from jsonb_array_elements(public.account_conversations_query()) item),0)::integer;
$$;
revoke all on function public.message_unread_count() from public,anon,authenticated;
grant execute on function public.message_unread_count() to authenticated;

create function public.message_business_target(target_business uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'businessAvatarPath',b.profile_avatar_path,'kind','business')
 from public.businesses b where b.id=target_business and b.status='published' and auth.uid() is not null;
$$;
revoke all on function public.message_business_target(uuid) from public,anon,authenticated;
grant execute on function public.message_business_target(uuid) to authenticated;

create function public.message_account_target(target_author uuid default null,target_work uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare recipient uuid; result jsonb;
begin
 if(target_author is null)=(target_work is null) then raise exception 'Invalid target' using errcode='23514';end if;
 if target_work is not null then
  if not private.work_post_is_public(target_work) then raise exception 'Content unavailable' using errcode='42501';end if;
  select m.user_id into recipient from public.work_posts p join public.business_members m on m.business_id=p.business_id and m.role='owner' where p.id=target_work;
 else
  recipient:=target_author;
  if not exists(select 1 from public.personal_posts p where author_id=recipient and private.personal_post_public(p.id)) then raise exception 'Content unavailable' using errcode='42501';end if;
 end if;
 select jsonb_build_object('id',p.id,'name',coalesce(nullif(p.display_name,''),'Conta PEREIRÃO'),'avatarUrl',p.avatar_url,'kind','account') into result from public.profiles p where p.id=recipient;
 return result;
end;$$;
revoke all on function public.message_account_target(uuid,uuid) from public,anon,authenticated;
grant execute on function public.message_account_target(uuid,uuid) to authenticated;

create function public.save_message_push_subscription(push_endpoint text,push_p256dh text,push_auth text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not private.account_enabled(actor) then raise exception 'Authentication required' using errcode='42501';end if;
 if push_endpoint is null or push_p256dh is null or push_auth is null then raise exception 'Invalid subscription' using errcode='23514';end if;
 insert into private.message_push_subscriptions(user_id,endpoint,p256dh,auth) values(actor,push_endpoint,push_p256dh,push_auth)
 on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=clock_timestamp();
end;$$;
revoke all on function public.save_message_push_subscription(text,text,text) from public,anon,authenticated;
grant execute on function public.save_message_push_subscription(text,text,text) to authenticated;

create function public.remove_message_push_subscription(push_endpoint text)
returns void language sql security definer set search_path='' as $$
 delete from private.message_push_subscriptions where user_id=(select auth.uid()) and endpoint=push_endpoint;
$$;
revoke all on function public.remove_message_push_subscription(text) from public,anon,authenticated;
grant execute on function public.remove_message_push_subscription(text) to authenticated;

create function public.message_push_public_key()
returns text language sql stable security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='pereirao_message_vapid_public' limit 1;
$$;
revoke all on function public.message_push_public_key() from public,anon,authenticated;
grant execute on function public.message_push_public_key() to authenticated;

create function public.message_push_config()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publicKey',max(decrypted_secret) filter(where name='pereirao_message_vapid_public'),'privateKey',max(decrypted_secret) filter(where name='pereirao_message_vapid_private'),'webhookSecret',max(decrypted_secret) filter(where name='pereirao_message_push_webhook')) from vault.decrypted_secrets where name in('pereirao_message_vapid_public','pereirao_message_vapid_private','pereirao_message_push_webhook');
$$;
revoke all on function public.message_push_config() from public,anon,authenticated;
grant execute on function public.message_push_config() to service_role;

create function public.message_push_targets(target_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('endpoint',endpoint,'p256dh',p256dh,'auth',auth)),'[]'::jsonb) from private.message_push_subscriptions where user_id=target_user;
$$;
revoke all on function public.message_push_targets(uuid) from public,anon,authenticated;
grant execute on function public.message_push_targets(uuid) to service_role;

create function public.remove_expired_message_push_endpoint(push_endpoint text)
returns void language sql security definer set search_path='' as $$delete from private.message_push_subscriptions where endpoint=push_endpoint;$$;
revoke all on function public.remove_expired_message_push_endpoint(text) from public,anon,authenticated;
grant execute on function public.remove_expired_message_push_endpoint(text) to service_role;

create extension if not exists pg_net with schema extensions;

create function private.queue_message_push(recipient uuid,sender uuid,conversation uuid,sender_name text,message_body text)
returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if recipient=sender or not exists(select 1 from private.message_push_subscriptions where user_id=recipient) then return;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='pereirao_message_push_webhook' limit 1;
 if secret is null then return;end if;
 perform net.http_post(
  url:='https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/message-push',
  headers:=jsonb_build_object('content-type','application/json','x-pereirao-push-secret',secret),
  body:=jsonb_build_object('recipientId',recipient,'conversationId',conversation,'senderId',sender,'senderName',sender_name,'body',left(message_body,160))
 );
exception when others then return;
end;$$;
revoke all on function private.queue_message_push(uuid,uuid,uuid,text,text) from public,anon,authenticated;

create function private.deliver_message_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;sender_name text;convo private.conversations;account_convo private.account_conversations;
begin
 if tg_table_name='account_messages' then
  select * into account_convo from private.account_conversations where id=new.conversation_id;
  select coalesce(nullif(display_name,''),'Conta PEREIRÃO') into sender_name from public.profiles where id=new.sender_id;
  foreach recipient in array array[account_convo.member_a,account_convo.member_b] loop
   perform realtime.send(jsonb_build_object('conversationId',new.conversation_id,'messageId',new.id,'senderId',new.sender_id,'senderName',sender_name,'body',left(new.body,160),'createdAt',new.created_at),'message_created','messages:user:'||recipient::text,true);
   perform private.queue_message_push(recipient,new.sender_id,new.conversation_id,sender_name,new.body);
  end loop;
 else
  select * into convo from private.conversations where id=new.conversation_id;
  if new.sender_id=convo.customer_id then select coalesce(nullif(display_name,''),'Cliente') into sender_name from public.profiles where id=new.sender_id;
  else select name into sender_name from public.businesses where id=convo.business_id;end if;
  for recipient in select distinct user_id from(
   select convo.customer_id user_id union all select m.user_id from public.business_members m where m.business_id=convo.business_id and m.role in('owner','admin')
  )participants loop
   perform realtime.send(jsonb_build_object('conversationId',new.conversation_id,'messageId',new.id,'senderId',new.sender_id,'senderName',sender_name,'body',left(new.body,160),'createdAt',new.created_at),'message_created','messages:user:'||recipient::text,true);
   perform private.queue_message_push(recipient,new.sender_id,new.conversation_id,sender_name,new.body);
  end loop;
 end if;
 return new;
end;$$;
revoke all on function private.deliver_message_event() from public,anon,authenticated;

create trigger account_messages_delivery after insert on private.account_messages for each row execute function private.deliver_message_event();
create trigger business_messages_delivery after insert on private.conversation_messages for each row execute function private.deliver_message_event();

create policy "message recipients receive private broadcasts" on realtime.messages for select to authenticated using(
 realtime.messages.extension='broadcast' and (select realtime.topic())='messages:user:'||(select auth.uid())::text
);

notify pgrst,'reload schema';
commit;
