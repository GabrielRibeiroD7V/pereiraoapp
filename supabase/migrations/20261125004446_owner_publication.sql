-- PROPOSTA: publicação pelo titular; sem alterações de estado de registros existentes.
begin;
set local lock_timeout='5s';
alter table public.businesses add column deleted_at timestamptz;
create table private.publication_actions(id bigint generated always as identity primary key,actor_id uuid not null references auth.users(id),target_type text not null,target_id uuid not null,action text not null,created_at timestamptz not null default clock_timestamp());
create index publication_actions_rate on private.publication_actions(actor_id,created_at);
alter table private.publication_actions enable row level security;
revoke all on private.publication_actions from public,anon,authenticated;
create function private.public_actor_enabled(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled(target) and exists(select 1 from auth.users where id=target and email_confirmed_at is not null);
$$;
revoke all on function private.public_actor_enabled(uuid) from public,anon,authenticated;
create or replace function private.can_manage_business(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled(auth.uid()) and exists(select 1 from public.businesses b join public.business_members m on m.business_id=b.id where b.id=target and b.deleted_at is null and m.user_id=auth.uid() and m.role='owner') and not exists(select 1 from private.business_moderation where business_id=target and suspended);
$$;
create or replace function private.is_business_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled(auth.uid()) and exists(select 1 from public.business_members where business_id=target and user_id=auth.uid() and role='owner');
$$;
create function private.publication_rate(target_type text,target_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.public_actor_enabled(auth.uid()) then raise exception 'EMAIL_CONFIRMATION_REQUIRED' using errcode='42501';end if;
 if (select count(*) from private.publication_actions where actor_id=auth.uid() and action='publish' and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'PUBLICATION_RATE_LIMIT' using errcode='54000';end if;
 insert into private.publication_actions(actor_id,target_type,target_id,action) values(auth.uid(),target_type,target_id,'publish');
end;$$;
revoke all on function private.publication_rate(text,uuid) from public,anon,authenticated;
create function public.owner_business_command(target_business uuid,command text,expected_state text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.businesses;next_state text;
begin
 perform pg_advisory_xact_lock(9142026);
 if not private.can_manage_business(target_business) then raise exception 'Owner required' using errcode='42501';end if;
 select * into b from public.businesses where id=target_business for update;
 if b.status is distinct from expected_state then raise exception 'Reload changed profile' using errcode='40001';end if;
 if command='publish' then
  if not private.public_actor_enabled(auth.uid()) then raise exception 'EMAIL_CONFIRMATION_REQUIRED' using errcode='42501';end if;
  if b.category_id is null or char_length(btrim(coalesce(b.description,'')))<2 or coalesce(b.whatsapp,'')!~'^[0-9]{10,15}$'
   or not exists(select 1 from public.categories where id=b.category_id and active)
   or not exists(select 1 from public.cities where id=b.city_id and active)
   or not exists(select 1 from public.business_service_areas where business_id=b.id)
   or exists(select 1 from public.business_service_areas a join public.cities c on c.id=a.city_id where a.business_id=b.id and not c.active)
   or exists(select 1 from public.business_categories a join public.categories c on c.id=a.category_id where a.business_id=b.id and not c.active)
   then raise exception 'PROFILE_INCOMPLETE' using errcode='23514';end if;
  if b.status<>'published' then perform private.publication_rate('business',b.id);end if;next_state:='published';
 elsif command in ('unpublish','delete') then
  next_state:='unpublished';
 else raise exception 'Invalid command' using errcode='22023';end if;
 update public.businesses set status=next_state,deleted_at=case when command='delete' then clock_timestamp() else deleted_at end where id=b.id;
 if command in ('unpublish','delete') then update public.work_posts set status='unpublished',updated_at=clock_timestamp() where business_id=b.id and status='published';end if;
 if command<>'publish' then insert into private.publication_actions(actor_id,target_type,target_id,action) values(auth.uid(),'business',b.id,command);end if;
 return jsonb_build_object('status',next_state,'deleted',command='delete');
end;$$;
revoke all on function public.owner_business_command(uuid,text,text) from public,anon,authenticated;
grant execute on function public.owner_business_command(uuid,text,text) to authenticated;
-- Defesa nas leituras públicas mesmo com sessão anônima e relacionamentos internos.
create function private.business_is_public(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.businesses b join public.business_members m on m.business_id=b.id and m.role='owner' where b.id=target and b.status='published' and b.deleted_at is null and private.public_actor_enabled(m.user_id) and not exists(select 1 from private.business_moderation where business_id=b.id and suspended));
$$;
revoke all on function private.business_is_public(uuid) from public,anon,authenticated;
grant execute on function private.business_is_public(uuid) to anon,authenticated;
drop policy businesses_public on public.businesses;
create policy businesses_public on public.businesses for select to anon,authenticated using(private.business_is_public(id));
create or replace function private.work_post_command(command text,target_business uuid,target_post uuid,
  post_title text default null,post_description text default null,photo_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.work_posts; business_state text; total integer; unique_total integer;
begin
  perform pg_advisory_xact_lock(9142026);
  if (select auth.uid()) is null or not private.can_manage_business(target_business) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  -- Mesma ordem de locks do ciclo de vida de mídia existente: negócio primeiro.
  select status into business_state from public.businesses where id=target_business for update;
  if target_post is null then raise exception 'Missing operation ID' using errcode='22023'; end if;
  if command='save' then
    if post_title is null or char_length(btrim(post_title)) not between 2 and 120 or char_length(coalesce(post_description,''))>3000 then
      raise exception 'Invalid title or description' using errcode='22023';
    end if;
    photo_ids:=coalesce(photo_ids,'{}'::uuid[]);
    select count(*),count(distinct x) into total,unique_total from unnest(photo_ids) x;
    if total>6 or total<>unique_total then raise exception 'Invalid image selection' using errcode='22023'; end if;
    perform 1 from public.portfolio_items where id=any(photo_ids) and business_id=target_business order by id for key share;
    if total<>(select count(*) from public.portfolio_items p where p.id=any(photo_ids) and p.business_id=target_business and p.media_state='ready'
      and exists(select 1 from storage.objects o where o.bucket_id='business-portfolio' and o.name=p.storage_path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))) then
      raise exception 'Images unavailable' using errcode='23514';
    end if;
    insert into public.work_posts(id,business_id,title,description)
      values(target_post,target_business,btrim(post_title),coalesce(post_description,'')) on conflict(id) do nothing;
    select * into item from public.work_posts where id=target_post and business_id=target_business for update;
    if not found then raise exception 'Not authorized' using errcode='42501'; end if;
    -- Editar conteúdo publicado exige nova ação explícita de publicação.
    update public.work_posts set title=btrim(post_title),description=coalesce(post_description,''),
      status=case when status='published' then 'unpublished' else status end,updated_at=now() where id=item.id returning * into item;
    delete from public.work_post_images where post_id=item.id;
    insert into public.work_post_images(post_id,business_id,portfolio_item_id,sort_order)
      select item.id,target_business,x.id,x.position-1 from unnest(photo_ids) with ordinality x(id,position);
  else
    select * into item from public.work_posts where id=target_post and business_id=target_business for update;
    if not found then
      if command='delete' then return jsonb_build_object('id',target_post,'deleted',true); end if;
      raise exception 'Not authorized' using errcode='42501';
    end if;
    if command='publish' then
      if not private.public_actor_enabled(auth.uid()) then raise exception 'EMAIL_CONFIRMATION_REQUIRED' using errcode='42501';end if;
      perform 1 from public.portfolio_items p join public.work_post_images i on i.portfolio_item_id=p.id
        where i.post_id=item.id order by p.id for key share of p;
      if not private.business_is_public(target_business) or not private.work_post_images_ready(item.id) then
        raise exception 'Business or images not publishable' using errcode='23514';
      end if;
      if item.status<>'published' then
        perform private.publication_rate('post',item.id);
        update public.work_posts set status='published',published_at=coalesce(published_at,clock_timestamp()),updated_at=now() where id=item.id returning * into item;
      end if;
    elsif command='unpublish' then
      update public.work_posts set status='unpublished',updated_at=now() where id=item.id returning * into item;
    elsif command='delete' then
      delete from public.work_posts where id=item.id;
      return jsonb_build_object('id',item.id,'deleted',true);
    else raise exception 'Unknown command' using errcode='22023'; end if;
  end if;
  return jsonb_build_object('id',item.id,'status',item.status);
end;
$$;
revoke all on function private.work_post_command(text,uuid,uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.work_post_command(text,uuid,uuid,text,text,uuid[]) to authenticated;
create or replace function public.work_post_command(command text,target_business uuid,target_post uuid,
  post_title text default null,post_description text default null,photo_ids uuid[] default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.work_post_command(command,target_business,target_post,post_title,post_description,photo_ids);
$$;
revoke all on function public.work_post_command(text,uuid,uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.work_post_command(text,uuid,uuid,text,text,uuid[]) to authenticated;

create or replace function private.work_post_is_public(target_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_posts w where w.id=target_post and w.status='published' and private.business_is_public(w.business_id) and private.work_post_images_ready(w.id) and not exists(select 1 from private.post_moderation m where m.post_id=w.id and blocked));
$$;
create or replace function private.admin_action(kind text,target uuid,command text,reason text,expected_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous text; next_state text; b public.businesses; affected uuid; audit_id uuid;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if kind='business' and command='publish' then raise exception 'Publication belongs to owner' using errcode='42501';end if;
 if target is null or reason is null or char_length(btrim(reason)) not between 5 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 -- Serializa decisões e evita suspensão de usuário competir com publicação de seus negócios.
 perform pg_catalog.pg_advisory_xact_lock(9142026);
 if kind='business' then
   select * into b from public.businesses where id=target for update;
   if not found then raise exception 'Not found' using errcode='P0002'; end if;
   previous:=case when exists(select 1 from private.business_moderation where business_id=target and suspended) then 'suspended' else b.status end;
   if expected_state is distinct from previous then raise exception 'State changed; reload' using errcode='40001'; end if;
   if command in ('publish','reactivate') then
     if (command='reactivate' and previous<>'suspended') or (command='publish' and previous not in ('draft','unpublished')) then raise exception 'Invalid transition' using errcode='23514'; end if;
     if b.category_id is null or b.whatsapp is null or char_length(btrim(coalesce(b.description,'')))<2
       or not exists(select 1 from public.categories where id=b.category_id and active)
       or not exists(select 1 from public.cities where id=b.city_id and active)
       or not exists(select 1 from public.business_service_areas where business_id=target)
       or not exists(select 1 from public.business_members where business_id=target and role='owner' and private.account_enabled(user_id)) then
       raise exception 'Profile incomplete or owner suspended' using errcode='23514'; end if;
     next_state:='unpublished';
     insert into private.business_moderation values(target,false) on conflict(business_id) do update set suspended=false;
     update public.businesses set status='unpublished' where id=target;
   elsif command='suspend' and previous<>'suspended' then
     next_state:='suspended'; insert into private.business_moderation values(target,true) on conflict(business_id) do update set suspended=true;
     update public.businesses set status='unpublished' where id=target;
   else raise exception 'Invalid transition' using errcode='23514'; end if;
 elsif kind='user' then
   if command not in ('suspend','reactivate') then raise exception 'Invalid command' using errcode='22023'; end if;
   perform 1 from auth.users where id=target for update;
   if not found then raise exception 'Not found' using errcode='P0002'; end if;
   if exists(select 1 from private.platform_admins where user_id=target) then raise exception 'Administrator protected' using errcode='42501'; end if;
   previous:=case when not private.account_enabled(target) then 'suspended' else 'active' end;
   if previous is distinct from expected_state then raise exception 'State changed; reload' using errcode='40001'; end if;
   next_state:=case when command='suspend' then 'suspended' else 'active' end;
   if next_state=previous then raise exception 'Invalid transition' using errcode='23514'; end if;
   insert into private.account_restrictions values(target,command='suspend') on conflict(user_id) do update set suspended=excluded.suspended;
   if command='suspend' then
     for affected in select business_id from public.business_members where user_id=target and role='owner' order by business_id loop
       insert into private.admin_audit(actor_id,target_type,target_id,action,reason,before_state,after_state)
       select auth.uid(),'business',id,'owner_suspended',btrim(reason),status,'suspended' from public.businesses where id=affected;
       insert into private.business_moderation values(affected,true) on conflict(business_id) do update set suspended=true;
       update public.businesses set status='unpublished' where id=affected;
     end loop;
   end if;
 elsif kind='post' then
   if to_regclass('public.work_posts') is null or not exists(select 1 from pg_catalog.pg_trigger where tgname='work_posts_moderation_guard' and not tgisinternal) then
     raise exception 'Post moderation not activated' using errcode='55000'; end if;
   if command not in ('withdraw','release') then raise exception 'Invalid command' using errcode='22023'; end if;
   execute 'select business_id from public.work_posts where id=$1' into affected using target;
   if affected is null then raise exception 'Not found' using errcode='P0002'; end if;
   perform 1 from public.businesses where id=affected for update;
   execute 'select status from public.work_posts where id=$1 for update' into previous using target;
   if exists(select 1 from private.post_moderation where post_id=target and blocked) then previous:='blocked'; end if;
   if previous is distinct from expected_state then raise exception 'State changed; reload' using errcode='40001'; end if;
   if (command='withdraw' and previous='blocked') or (command='release' and previous<>'blocked') then raise exception 'Invalid transition' using errcode='23514'; end if;
   insert into private.post_moderation values(target,command='withdraw') on conflict(post_id) do update set blocked=excluded.blocked;
   execute 'update public.work_posts set status=''unpublished'',updated_at=now() where id=$1' using target;
   next_state:=case when command='withdraw' then 'blocked' else 'unpublished' end;
 else raise exception 'Unknown target' using errcode='22023'; end if;
 insert into private.admin_audit(actor_id,target_type,target_id,action,reason,before_state,after_state)
 values(auth.uid(),kind,target,command,btrim(reason),previous,next_state) returning id into audit_id;
 return jsonb_build_object('id',target,'state',next_state,'auditId',audit_id);
end;$$;
revoke all on function private.admin_action(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.admin_action(text,uuid,text,text,text) to authenticated;
create or replace function public.admin_action(kind text,target uuid,command text,reason text,expected_state text) returns jsonb language sql security invoker set search_path='' as $$select private.admin_action(kind,target,command,reason,expected_state);$$;
revoke all on function public.admin_action(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_action(text,uuid,text,text,text) to authenticated;
create table private.content_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id),
 target_type text not null check(target_type in ('business','post','personal_post')),target_id uuid not null,
 reason text not null check(char_length(btrim(reason)) between 10 and 1000),created_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz,unique(reporter_id,target_type,target_id)
);
create index content_reports_recent on private.content_reports(created_at desc,id);
alter table private.content_reports enable row level security;
revoke all on private.content_reports from public,anon,authenticated;
create function private.reportable_content(kind text,target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when kind='business' then private.business_is_public(target) when kind='post' then private.work_post_is_public(target) else false end;
$$;
revoke all on function private.reportable_content(text,uuid) from public,anon,authenticated;
create function public.report_content(kind text,target uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(9142026);
 if not private.public_actor_enabled(auth.uid()) then raise exception 'Confirmed account required' using errcode='42501';end if;
 if not private.reportable_content(kind,target) then raise exception 'Content unavailable' using errcode='42501';end if;
 if (select count(*) from private.content_reports where reporter_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=5 then raise exception 'Report limit' using errcode='54000';end if;
 insert into private.content_reports(reporter_id,target_type,target_id,reason) values(auth.uid(),kind,target,btrim(reason)) on conflict(reporter_id,target_type,target_id) do nothing;
end;$$;
revoke all on function public.report_content(text,uuid,text) from public,anon,authenticated;
grant execute on function public.report_content(text,uuid,text) to authenticated;
alter function private.admin_query(text,jsonb) rename to admin_query_before_owner_publication;
revoke all on function private.admin_query_before_owner_publication(text,jsonb) from public,anon,authenticated;
create function private.admin_query(section text,filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;pg integer:=coalesce((filters->>'page')::integer,1);
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if pg not between 1 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
 if section='reports' then
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x)),'[]'),'hasNext',count(*)>20) into result from
   (select id,target_type,target_id,reason,created_at,resolved_at from private.content_reports order by created_at desc,id desc limit 21 offset (pg-1)*20)x;
  return jsonb_set(result,'{items}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'items') with ordinality e(v,n) where n<=20),'[]'));
 end if;
 if section='posts' and nullif(filters->>'id','') is not null then
  return jsonb_build_object('available',true,'moderationAvailable',true,'hasNext',false,'items',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'business_id',w.business_id,'title',w.title,'business_name',b.name,'status',w.status,'created_at',w.created_at,'blocked',coalesce(m.blocked,false))) from public.work_posts w join public.businesses b on b.id=w.business_id left join private.post_moderation m on m.post_id=w.id where w.id=(filters->>'id')::uuid),'[]'));
 end if;
 result:=private.admin_query_before_owner_publication(section,filters);
 if section='dashboard' then result:=result||jsonb_build_object('conversations',(select count(*) from private.conversations),'subscriptions',(select count(*) from public.business_subscriptions),'openReports',(select count(*) from private.content_reports where resolved_at is null));end if;
 return result;
end;$$;
revoke all on function private.admin_query(text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_query(text,jsonb) to authenticated;
create function public.resolve_content_report(target uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if reason is null or char_length(btrim(reason)) not between 5 and 500 then raise exception 'Reason required' using errcode='22023';end if;
 update private.content_reports set resolved_at=clock_timestamp() where id=target and resolved_at is null;
 if found then insert into private.admin_audit(actor_id,target_type,target_id,action,reason) values(auth.uid(),'platform',target,'resolve_report',btrim(reason));end if;
end;$$;
revoke all on function public.resolve_content_report(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_content_report(uuid,text) to authenticated;

create or replace function public.search_public_businesses(
  p_query text default '', p_category text default '', p_city text default '', p_type text default '', p_page integer default 1
) returns table(id uuid,slug text,name text,type text,description text,city_id text,category_id text,
  whatsapp text,instagram text,avatar_path text,city jsonb,category jsonb,additional_categories jsonb)
language sql stable security invoker set search_path='' as $$
  with terms as (
    select btrim(left(coalesce(p_query,''),200)) as term
  ), patterns as (
    select '%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%' as pattern,
      term from terms
  ), normalized as (
    select *,translate(lower(pattern),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') as folded from patterns
  )
  select b.id,b.slug,b.name,b.type,b.description,b.city_id,b.category_id,b.whatsapp,b.instagram,b.avatar_path,
    case when ci.id is null then null else jsonb_build_object('id',ci.id,'name',ci.name,'state_code',ci.state_code) end,
    case when ca.id is null then null else jsonb_build_object('id',ca.id,'name',ca.name) end,
    coalesce((select jsonb_agg(jsonb_build_object('category',jsonb_build_object('id',c.id,'name',c.name)) order by c.name,c.id)
      from public.business_categories bc join public.categories c on c.id=bc.category_id and c.active
      where bc.business_id=b.id),'[]'::jsonb)
  from public.businesses b
  left join public.cities ci on ci.id=b.city_id
  left join public.categories ca on ca.id=b.category_id and ca.active
  cross join normalized t
  where private.business_is_public(b.id)
    and (coalesce(p_type,'')='' or b.type=p_type)
    and (coalesce(p_city,'')='' or exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id=p_city))
    and (coalesce(p_category,'')='' or ca.id=p_category or exists(
      select 1 from public.business_categories bc join public.categories c on c.id=bc.category_id and c.active
      where bc.business_id=b.id and c.id=p_category))
    and (t.term='' or b.name ilike t.pattern or b.description ilike t.pattern
      or ca.name ilike t.pattern or ca.id like t.folded
      or exists(select 1 from public.business_categories bc join public.categories c on c.id=bc.category_id and c.active
        where bc.business_id=b.id and (c.name ilike t.pattern or c.id like t.folded))
      or exists(select 1 from public.services s where s.business_id=b.id and s.active and (s.name ilike t.pattern or s.description ilike t.pattern)))
  order by b.name,b.id
  offset (greatest(1,least(1000,coalesce(p_page,1)))-1)*20 limit 21;
$$;
revoke all on function public.search_public_businesses(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.search_public_businesses(text,text,text,text,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
