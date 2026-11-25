begin;
-- Direct text conversations coexist with legacy business conversations. No operational rows changed.
create table private.account_conversations(
 id uuid primary key default gen_random_uuid(),
 member_a uuid not null references auth.users(id) on delete restrict,
 member_b uuid not null references auth.users(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(member_a<member_b),check(created_by in(member_a,member_b)),unique(member_a,member_b)
);
create index account_conversations_a on private.account_conversations(member_a,updated_at desc);
create index account_conversations_b on private.account_conversations(member_b,updated_at desc);
create index account_conversations_creator on private.account_conversations(created_by,created_at);
create table private.account_messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references private.account_conversations(id) on delete restrict,
 sender_id uuid not null references auth.users(id) on delete restrict,
 request_id uuid not null,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(),
 unique(sender_id,request_id)
);
create index account_messages_page on private.account_messages(conversation_id,created_at desc,id desc);
create index account_messages_sender on private.account_messages(sender_id,created_at);
alter table private.account_conversations enable row level security;
alter table private.account_messages enable row level security;
revoke all on private.account_conversations,private.account_messages from public,anon,authenticated;

create function private.account_conversation_actor(c private.account_conversations,u uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and u in(c.member_a,c.member_b) and private.account_enabled(u);
$$;
revoke all on function private.account_conversation_actor(private.account_conversations,uuid) from public,anon,authenticated;

create function private.add_account_message(target uuid,message_body text,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c private.account_conversations; found_message private.account_messages; result uuid;
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
 if (select count(*) from private.account_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'Daily message limit' using errcode='23514';end if;
 insert into private.account_messages(conversation_id,sender_id,request_id,body) values(target,actor,request_id,btrim(message_body)) returning id into result;
 update private.account_conversations set updated_at=clock_timestamp() where id=target;
 return result;
end;
$$;
revoke all on function private.add_account_message(uuid,text,uuid) from public,anon,authenticated;

create function public.open_account_conversation(message_body text,request_id uuid,target_author uuid default null,target_work uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); recipient uuid; cid uuid;
begin
 if not private.public_actor_enabled(actor) then raise exception 'Confirmed account required' using errcode='42501';end if;
 if (target_author is null)=(target_work is null) then raise exception 'Invalid target' using errcode='23514';end if;
 if target_work is not null then
  if not private.work_post_is_public(target_work) then raise exception 'Content unavailable' using errcode='42501';end if;
  select m.user_id into recipient from public.work_posts p join public.business_members m on m.business_id=p.business_id and m.role='owner' where p.id=target_work;
 else
  recipient:=target_author;
  if not exists(select 1 from public.personal_posts p where author_id=recipient and private.personal_post_public(p.id)) then raise exception 'Content unavailable' using errcode='42501';end if;
 end if;
 if recipient is null or recipient=actor or not private.public_actor_enabled(recipient) then raise exception 'Recipient unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,310));
 select id into cid from private.account_conversations where member_a=least(actor,recipient) and member_b=greatest(actor,recipient);
 if cid is null then
  if (select count(*) from private.account_conversations where created_by=actor and created_at>clock_timestamp()-interval '1 day')>=20 then raise exception 'Daily conversation limit' using errcode='23514';end if;
  insert into private.account_conversations(member_a,member_b,created_by) values(least(actor,recipient),greatest(actor,recipient),actor)
  on conflict(member_a,member_b) do update set updated_at=private.account_conversations.updated_at returning id into cid;
 end if;
 perform private.add_account_message(cid,message_body,request_id);
 return cid;
end;
$$;
revoke all on function public.open_account_conversation(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.open_account_conversation(text,uuid,uuid,uuid) to authenticated;

create function public.account_conversations_query()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'updatedAt')::timestamptz desc,item->>'id'),'[]'::jsonb) from (
 select jsonb_array_elements(public.my_conversations()) item
 union all
 select jsonb_build_object('id',c.id,'kind','account','businessId',null,'businessName',null,'businessSlug',null,'side','account',
 'peerId',case when c.member_a=auth.uid() then c.member_b else c.member_a end,
 'peerName',coalesce(nullif(p.display_name,''),'Conta PEREIRÃO'),'updatedAt',c.updated_at,
 'lastMessage',(select body from private.account_messages where conversation_id=c.id order by created_at desc,id desc limit 1))
 from private.account_conversations c left join public.profiles p on p.id=case when c.member_a=auth.uid() then c.member_b else c.member_a end
 where private.account_conversation_actor(c,auth.uid())
 ) x;
$$;
revoke all on function public.account_conversations_query() from public,anon,authenticated;
grant execute on function public.account_conversations_query() to authenticated;

create function public.account_conversation_messages(target_conversation uuid,before_message uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.account_conversations; cursor_time timestamptz; items jsonb;
begin
 select * into c from private.account_conversations where id=target_conversation;
 if not found then return public.my_conversation_messages(target_conversation,before_message);end if;
 if not private.account_conversation_actor(c,auth.uid()) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if before_message is not null then
  select created_at into cursor_time from private.account_messages where id=before_message and conversation_id=c.id;
  if not found then raise exception 'Invalid cursor' using errcode='23514';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'senderId',m.sender_id,'body',m.body,'createdAt',m.created_at) order by m.created_at,m.id),'[]') into items
 from (select * from private.account_messages where conversation_id=c.id and (before_message is null or (created_at,id)<(cursor_time,before_message)) order by created_at desc,id desc limit 51) m;
 return jsonb_build_object('items',(select coalesce(jsonb_agg(value order by n),'[]') from jsonb_array_elements(items) with ordinality t(value,n) where n>greatest(jsonb_array_length(items)-50,0)), 'hasMore',jsonb_array_length(items)>50,'customerId',c.member_a);
end;
$$;
revoke all on function public.account_conversation_messages(uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_conversation_messages(uuid,uuid) to authenticated;

create function public.send_account_conversation_message(target_conversation uuid,message_body text,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.account_conversations where id=target_conversation) then
  return private.add_account_message(target_conversation,message_body,request_id);
 end if;
 return public.send_conversation_message(target_conversation,message_body);
end;
$$;
revoke all on function public.send_account_conversation_message(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.send_account_conversation_message(uuid,text,uuid) to authenticated;
-- Dashboard counts both persisted channels, without exposing message contents.
alter function private.admin_query(text,jsonb) rename to admin_query_before_account_conversations;
revoke all on function private.admin_query_before_account_conversations(text,jsonb) from public,anon,authenticated;
create function private.admin_query(section text,filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 result:=private.admin_query_before_account_conversations(section,filters);
 if section='dashboard' then result:=result||jsonb_build_object('conversations',(select count(*) from private.conversations)+(select count(*) from private.account_conversations));end if;
 return result;
end;$$;
revoke all on function private.admin_query(text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_query(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
