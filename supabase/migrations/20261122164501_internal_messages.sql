begin;

create table private.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (business_id, customer_id)
);
create index conversations_customer_recent on private.conversations(customer_id, updated_at desc);
create index conversations_business_recent on private.conversations(business_id, updated_at desc);

create table private.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.conversations(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index conversation_messages_recent on private.conversation_messages(conversation_id, created_at desc, id desc);
alter table private.conversations enable row level security;
alter table private.conversation_messages enable row level security;
revoke all on private.conversations, private.conversation_messages from public, anon, authenticated;

-- Apenas RPCs autenticadas acessam as tabelas. O cliente não pode escolher remetente,
-- destinatário, status ou atualizar/apagar o histórico diretamente.
create function private.conversation_actor(target private.conversations, actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select actor is not null and (
    target.customer_id = actor or exists (
      select 1 from public.business_members m
      where m.business_id = target.business_id and m.user_id = actor and m.role in ('owner','admin')
    )
  ) and private.account_enabled(actor);
$$;
revoke all on function private.conversation_actor(private.conversations,uuid) from public, anon, authenticated;

create function private.add_conversation_message(target uuid, message_body text, actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare convo private.conversations; previous_at timestamptz; result uuid; normalized text := btrim(message_body);
begin
  if actor is null or not private.account_enabled(actor) then raise exception 'Authentication required' using errcode='42501'; end if;
  if normalized is null or char_length(normalized) not between 1 and 2000 then raise exception 'Invalid message' using errcode='23514'; end if;
  select * into convo from private.conversations where id=target for update;
  if not found or not private.conversation_actor(convo,actor) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.businesses where id=convo.business_id and status='published') then raise exception 'Profile unavailable' using errcode='23514'; end if;
  select max(created_at) into previous_at from private.conversation_messages where conversation_id=target and sender_id=actor;
  if previous_at > clock_timestamp()-interval '3 seconds' then raise exception 'Wait before sending again' using errcode='23514'; end if;
  if (select count(*) from private.conversation_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'Daily message limit' using errcode='23514'; end if;
  insert into private.conversation_messages(conversation_id,sender_id,body) values(target,actor,normalized) returning id into result;
  update private.conversations set updated_at=clock_timestamp() where id=target;
  return result;
end;
$$;
revoke all on function private.add_conversation_message(uuid,text,uuid) from public, anon, authenticated;

create function public.open_conversation(target_business uuid, message_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); convo_id uuid;
begin
  if actor is null or not private.account_enabled(actor) then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.businesses where id=target_business and status='published') then raise exception 'Profile unavailable' using errcode='23514'; end if;
  if exists(select 1 from public.business_members where business_id=target_business and user_id=actor) then raise exception 'Own business' using errcode='23514'; end if;
  select id into convo_id from private.conversations where business_id=target_business and customer_id=actor;
  if convo_id is null then
    if (select count(*) from private.conversations where customer_id=actor and created_at>clock_timestamp()-interval '1 day')>=20 then raise exception 'Daily conversation limit' using errcode='23514'; end if;
    insert into private.conversations(business_id,customer_id) values(target_business,actor)
      on conflict(business_id,customer_id) do update set customer_id=excluded.customer_id
      returning id into convo_id;
  end if;
  perform private.add_conversation_message(convo_id,message_body,actor);
  return convo_id;
end;
$$;
revoke all on function public.open_conversation(uuid,text) from public, anon, authenticated;
grant execute on function public.open_conversation(uuid,text) to authenticated;

create function public.send_conversation_message(target_conversation uuid, message_body text)
returns uuid language sql volatile security definer set search_path = '' as $$
  select private.add_conversation_message(target_conversation,message_body,(select auth.uid()));
$$;
revoke all on function public.send_conversation_message(uuid,text) from public, anon, authenticated;
grant execute on function public.send_conversation_message(uuid,text) to authenticated;

create function public.my_conversations()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'businessId',c.business_id,'businessName',b.name,'businessSlug',b.slug,
    'customerName',coalesce(nullif(p.display_name,''),'Cliente'),
    'side',case when c.customer_id=(select auth.uid()) then 'customer' else 'professional' end,
    'updatedAt',c.updated_at,
    'lastMessage',(select body from private.conversation_messages where conversation_id=c.id order by created_at desc,id desc limit 1)
  ) order by c.updated_at desc,c.id desc),'[]'::jsonb)
  from private.conversations c join public.businesses b on b.id=c.business_id
  left join public.profiles p on p.id=c.customer_id
  where private.conversation_actor(c,(select auth.uid()));
$$;
revoke all on function public.my_conversations() from public, anon, authenticated;
grant execute on function public.my_conversations() to authenticated;

create function public.my_conversation_messages(target_conversation uuid, before_message uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare convo private.conversations; cursor_time timestamptz; result jsonb;
begin
  select * into convo from private.conversations where id=target_conversation;
  if not found or not private.conversation_actor(convo,(select auth.uid())) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  if before_message is not null then
    select created_at into cursor_time from private.conversation_messages where id=before_message and conversation_id=target_conversation;
    if not found then raise exception 'Invalid cursor' using errcode='23514'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'senderId',x.sender_id,'createdAt',x.created_at) order by x.created_at,x.id),'[]'::jsonb)
  into result from (select m.* from private.conversation_messages m where m.conversation_id=target_conversation
    and (before_message is null or (m.created_at,m.id)<(cursor_time,before_message))
    order by m.created_at desc,m.id desc limit 51) x;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) from jsonb_array_elements(result) with ordinality as t(value,ordinal) where ordinal>greatest(jsonb_array_length(result)-50,0)),
    'hasMore',jsonb_array_length(result)>50,'customerId',convo.customer_id);
end;
$$;
revoke all on function public.my_conversation_messages(uuid,uuid) from public, anon, authenticated;
grant execute on function public.my_conversation_messages(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
