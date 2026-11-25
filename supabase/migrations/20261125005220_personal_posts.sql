-- PROPOSTA dependente de owner_publication. Não aplicar remotamente sem autorização.
begin;
set local lock_timeout='5s';
create table public.personal_posts(
 id uuid primary key,author_id uuid not null references auth.users(id) on delete restrict,
 title text not null default '' check(char_length(title)<=120),description text not null default '' check(char_length(description)<=3000),
 status text not null default 'draft' check(status in ('draft','published','unpublished')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),published_at timestamptz,deleted_at timestamptz,
 unique(id,author_id),check(status<>'published' or (published_at is not null and deleted_at is null))
);
create index personal_posts_author on public.personal_posts(author_id,created_at desc,id desc);
create index personal_posts_feed on public.personal_posts(published_at desc,id desc) where status='published' and deleted_at is null;
create table public.personal_post_images(
 id uuid primary key,post_id uuid not null,author_id uuid not null,storage_path text not null unique,
 expected_bytes bigint not null check(expected_bytes between 1 and 5242880),media_state text not null default 'pending' check(media_state in ('pending','ready','deleting')),
 selected boolean not null default false,sort_order integer check(sort_order between 0 and 5),created_at timestamptz not null default clock_timestamp(),
 foreign key(post_id,author_id) references public.personal_posts(id,author_id) on delete cascade,
 check(not selected or (media_state='ready' and sort_order is not null))
);
create index personal_post_images_parent on public.personal_post_images(post_id);
create unique index personal_post_image_order on public.personal_post_images(post_id,sort_order) where selected;
create table private.personal_post_moderation(post_id uuid primary key references public.personal_posts(id) on delete cascade,blocked boolean not null default true);
alter table public.personal_posts enable row level security;
alter table public.personal_post_images enable row level security;
alter table private.personal_post_moderation enable row level security;
revoke all on public.personal_posts,public.personal_post_images,private.personal_post_moderation from public,anon,authenticated;
grant select on public.personal_posts,public.personal_post_images to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('personal-posts','personal-posts',false,5242880,array['image/webp']);
create function private.personal_media_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.personal_post_images where post_id=target and selected)
 and not exists(select 1 from public.personal_post_images i where post_id=target and selected and (media_state<>'ready' or not exists(select 1 from storage.objects o where bucket_id='personal-posts' and name=i.storage_path and metadata->>'mimetype'='image/webp' and case when coalesce(metadata->>'size','')~'^[0-9]+$' then (metadata->>'size')::numeric=i.expected_bytes else false end)));
$$;
create function private.personal_post_public(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.personal_posts p where id=target and status='published' and deleted_at is null and private.public_actor_enabled(author_id) and not exists(select 1 from private.personal_post_moderation m where m.post_id=p.id and blocked) and private.personal_media_ready(p.id));
$$;
revoke all on function private.personal_media_ready(uuid),private.personal_post_public(uuid) from public,anon,authenticated;
grant execute on function private.personal_post_public(uuid) to anon,authenticated;
create policy personal_posts_read on public.personal_posts for select to anon,authenticated using(private.personal_post_public(id));
create policy personal_posts_owner on public.personal_posts for select to authenticated using(author_id=auth.uid() and private.account_enabled(auth.uid()));
create policy personal_images_read on public.personal_post_images for select to anon,authenticated using(selected and media_state='ready' and private.personal_post_public(post_id));
create policy personal_images_owner on public.personal_post_images for select to authenticated using(author_id=auth.uid() and private.account_enabled(auth.uid()));
-- Metadata mutation only through owner RPCs. No direct write privileges.
create function public.personal_post_command(command text,target_post uuid,data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();p public.personal_posts;im public.personal_post_images;ids uuid[];photo uuid;bytes bigint;meta jsonb;ord integer;entry uuid;
begin
 if actor is null or not private.account_enabled(actor) then raise exception 'Owner required' using errcode='42501';end if;
 if jsonb_typeof(data) is distinct from 'object' or target_post is null then raise exception 'Invalid input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(9142026);
 if command='prepare' and not exists(select 1 from public.personal_posts where id=target_post) then
  if (select count(*) from private.publication_actions where actor_id=actor and action='create_personal_draft' and created_at>clock_timestamp()-interval '1 day')>=30 then raise exception 'Daily draft limit' using errcode='54000';end if;
  insert into public.personal_posts(id,author_id) values(target_post,actor);
  insert into private.publication_actions(actor_id,target_type,target_id,action) values(actor,'personal_post',target_post,'create_personal_draft');
 end if;
 select * into p from public.personal_posts where id=target_post for update;
 if not found or p.author_id<>actor then raise exception 'Owner required' using errcode='42501';end if;
 if p.deleted_at is not null and command not in ('delete','finish_delete') then raise exception 'Deleted post' using errcode='42501';end if;
 if exists(select 1 from private.personal_post_moderation where post_id=p.id and blocked) and command not in ('delete','finish_delete','unpublish') then raise exception 'Post blocked' using errcode='42501';end if;
 if command='prepare' then
  photo:=(data->>'photoId')::uuid;bytes:=(data->>'bytes')::bigint;
  if photo is null or bytes is null or bytes not between 1 and 5242880 then raise exception 'Invalid image' using errcode='22023';end if;
  select * into im from public.personal_post_images where id=photo;
  if found then
   if im.post_id<>p.id or im.author_id<>actor or im.expected_bytes<>bytes then raise exception 'Image mismatch' using errcode='42501';end if;
  else
   if (select count(*) from public.personal_post_images where post_id=p.id)>=12 then raise exception 'Staged image limit' using errcode='54000';end if;
   insert into public.personal_post_images(id,post_id,author_id,storage_path,expected_bytes) values(photo,p.id,actor,actor::text||'/posts/'||photo::text||'.webp',bytes) returning * into im;
  end if;
  return jsonb_build_object('id',im.id,'path',im.storage_path,'mediaState',im.media_state);
 elsif command='finalize' then
  select * into im from public.personal_post_images where id=(data->>'photoId')::uuid and post_id=p.id for update;
  if not found then raise exception 'Image unavailable' using errcode='42501';end if;
  select metadata into meta from storage.objects where bucket_id='personal-posts' and name=im.storage_path;
  if not found then raise exception 'Upload incomplete' using errcode='23514';end if;
  if meta->>'mimetype' is distinct from 'image/webp' or coalesce(meta->>'size','')!~'^[0-9]+$' then raise exception 'Invalid object' using errcode='23514';end if;
  if (meta->>'size')::numeric<>im.expected_bytes then raise exception 'Size mismatch' using errcode='23514';end if;
  update public.personal_post_images set media_state='ready' where id=im.id;return '{"ready":true}';
 elsif command='save' then
  if jsonb_typeof(data->'imageIds') is distinct from 'array' or char_length(coalesce(data->>'title',''))>120 or char_length(coalesce(data->>'description',''))>3000 then raise exception 'Invalid composition' using errcode='22023';end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(data->'imageIds');
  if coalesce(cardinality(ids),0) not between 1 and 6 or (select count(distinct x) from unnest(ids)x)<>cardinality(ids) then raise exception 'Choose 1 to 6 different images' using errcode='22023';end if;
  if (select count(*) from public.personal_post_images i where id=any(ids) and post_id=p.id and media_state='ready' and exists(select 1 from storage.objects where bucket_id='personal-posts' and name=i.storage_path))<>cardinality(ids) then raise exception 'Image unavailable' using errcode='23514';end if;
  update public.personal_post_images set selected=false,sort_order=null where post_id=p.id;
  for entry,ord in select value,ordinality::integer-1 from unnest(ids) with ordinality t(value,ordinality) loop update public.personal_post_images set selected=true,sort_order=ord where id=entry;end loop;
  update public.personal_posts set title=btrim(coalesce(data->>'title','')),description=coalesce(data->>'description',''),status=case when status='published' then 'unpublished' else status end,updated_at=clock_timestamp() where id=p.id;
 elsif command='publish' then
  if not private.public_actor_enabled(actor) then raise exception 'EMAIL_CONFIRMATION_REQUIRED' using errcode='42501';end if;
  if not private.personal_media_ready(p.id) then raise exception 'Image unavailable' using errcode='23514';end if;
  if p.status<>'published' then perform private.publication_rate('personal_post',p.id);end if;
  update public.personal_posts set status='published',published_at=coalesce(published_at,clock_timestamp()),updated_at=clock_timestamp() where id=p.id;
 elsif command='unpublish' then update public.personal_posts set status='unpublished',updated_at=clock_timestamp() where id=p.id;
 elsif command='delete' then
  update public.personal_post_images set selected=false,media_state='deleting',sort_order=null where post_id=p.id;
  update public.personal_posts set status='unpublished',deleted_at=coalesce(deleted_at,clock_timestamp()),updated_at=clock_timestamp() where id=p.id;
  return jsonb_build_object('paths',coalesce((select jsonb_agg(storage_path) from public.personal_post_images where post_id=p.id),'[]'));
 elsif command='finish_delete' then
  if p.deleted_at is null or exists(select 1 from public.personal_post_images i join storage.objects o on o.bucket_id='personal-posts' and o.name=i.storage_path where i.post_id=p.id) then raise exception 'Finish deleting files first' using errcode='23514';end if;
  delete from public.personal_posts where id=p.id;return '{"deleted":true}';
 else raise exception 'Invalid command' using errcode='22023';end if;
 return jsonb_build_object('id',p.id,'status',(select status from public.personal_posts where id=p.id));
end;$$;
revoke all on function public.personal_post_command(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.personal_post_command(text,uuid,jsonb) to authenticated;
-- Storage validates prepared metadata/identity, independent of filename/content supplied by client.
create function private.personal_object_access(path text,operation text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.personal_post_images i join public.personal_posts p on p.id=i.post_id where i.storage_path=path and case operation
 when 'insert' then i.author_id=auth.uid() and private.account_enabled(auth.uid()) and i.media_state='pending' and p.deleted_at is null and not exists(select 1 from private.personal_post_moderation where post_id=p.id and blocked)
 when 'delete' then i.author_id=auth.uid() and private.account_enabled(auth.uid()) and i.media_state='deleting' and p.deleted_at is not null
 else (i.author_id=auth.uid() and private.account_enabled(auth.uid())) or (private.is_platform_admin() and p.published_at is not null and i.media_state='ready') or (i.selected and i.media_state='ready' and private.personal_post_public(p.id)) end);
$$;
revoke all on function private.personal_object_access(text,text) from public,anon,authenticated;
grant execute on function private.personal_object_access(text,text) to anon,authenticated;
create function private.guard_personal_object() returns trigger language plpgsql security definer set search_path='' as $$
declare im public.personal_post_images;actor uuid:=auth.uid();owner_text text;effective_role text;
begin
 if new.bucket_id<>'personal-posts' then return new;end if;
 select * into im from public.personal_post_images where storage_path=new.name for key share;
 if not found or im.media_state<>'pending' then raise exception 'Prepared image required' using errcode='23514';end if;
 if actor is null then
  effective_role:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  if session_user::text<>'supabase_storage_admin' or effective_role not in ('service_role','supabase_storage_admin') then raise exception 'Not authorized' using errcode='42501';end if;
  owner_text:=coalesce(nullif(to_jsonb(new)->>'owner_id',''),nullif(to_jsonb(new)->>'owner',''));
  if owner_text is null or owner_text!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'Upload owner required' using errcode='42501';end if;
  actor:=owner_text::uuid;
 end if;
 if actor<>im.author_id or not private.account_enabled(actor) or exists(select 1 from private.personal_post_moderation where post_id=im.post_id and blocked) then raise exception 'Not authorized' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function private.guard_personal_object() from public,anon,authenticated;
create trigger personal_object_guard before insert on storage.objects for each row execute function private.guard_personal_object();
create policy personal_objects_read on storage.objects for select to anon,authenticated using(bucket_id='personal-posts' and private.personal_object_access(name,'read'));
create policy personal_objects_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'personal-posts' or private.personal_object_access(name,'read'));
create policy personal_objects_insert on storage.objects for insert to authenticated with check(bucket_id='personal-posts' and private.personal_object_access(name,'insert'));
create policy personal_objects_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'personal-posts' or private.personal_object_access(name,'insert'));
create policy personal_objects_delete on storage.objects for delete to authenticated using(bucket_id='personal-posts' and private.personal_object_access(name,'delete'));
create policy personal_objects_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'personal-posts' or private.personal_object_access(name,'delete'));
create policy personal_objects_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'personal-posts') with check(bucket_id<>'personal-posts');
create function private.personal_payload(p public.personal_posts) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind','personal','authorId',p.author_id,'author',coalesce((select display_name from public.profiles where id=p.author_id),'Conta PEREIRÃO'),'title',p.title,'description',p.description,'status',p.status,'createdAt',p.created_at,'publishedAt',p.published_at,'deleting',p.deleted_at is not null,'profileUrl','/pessoas/'||p.author_id::text,'images',coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'bucket','personal-posts') order by sort_order) from public.personal_post_images where post_id=p.id and (selected or (p.status='draft' and p.author_id=auth.uid())) and media_state='ready'),'[]'));
$$;
revoke all on function private.personal_payload(public.personal_posts) from public,anon,authenticated;
create function public.personal_posts_query(scope text,target uuid default null,page_number integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if page_number not between 1 and 100000 or scope not in ('mine','public','detail') then raise exception 'Invalid query' using errcode='22023';end if;
 if scope='mine' and (auth.uid() is null or not private.account_enabled(auth.uid())) then raise exception 'Authentication required' using errcode='42501';end if;
 if scope='detail' then select private.personal_payload(p) into result from public.personal_posts p where id=target and (private.personal_post_public(id) or (author_id=auth.uid() and private.account_enabled(auth.uid())) or (private.is_platform_admin() and p.published_at is not null));return result;end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id desc),'[]'),'hasNext',count(*)>10) into result from
 (select p.id,p.created_at,private.personal_payload(p) payload from public.personal_posts p where case when scope='mine' then p.author_id=auth.uid() else private.personal_post_public(p.id) and (target is null or p.author_id=target) end order by p.created_at desc,p.id desc limit 11 offset (page_number-1)*10)x;
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'items') with ordinality t(v,n) where n<=10),'[]'));
end;$$;
revoke all on function public.personal_posts_query(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.personal_posts_query(text,uuid,integer) to anon,authenticated;
-- Unified server-filtered keyset feed; no private data from a draft business.
create function public.publication_feed(before_time timestamptz default null,before_id uuid default null,before_kind text default null,author_filter uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 with all_posts as (
 select p.id,p.published_at,'personal'::text kind,private.personal_payload(p) payload from public.personal_posts p where p.status='published' and p.deleted_at is null and private.personal_post_public(p.id) and (author_filter is null or p.author_id=author_filter)
 union all
 select w.id,w.published_at,'professional',jsonb_build_object('id',w.id,'kind','professional','authorId',null,'author',b.name,'title',w.title,'description',w.description,'status',w.status,'createdAt',w.created_at,'publishedAt',w.published_at,'profileUrl',case when private.business_is_public(b.id) then '/prestadores/'||b.slug else null end,'businessId',b.id,'images',coalesce((select jsonb_agg(j.photo order by j.ord) from (
 select i.sort_order ord,jsonb_build_object('id',p.id,'path',p.storage_path,'bucket','business-portfolio') photo from public.work_post_images i join public.portfolio_items p on p.id=i.portfolio_item_id where i.post_id=w.id
 union all select p.sort_order,jsonb_build_object('id',p.id,'path',p.storage_path,'bucket','business-posts') from public.work_post_photos p where p.post_id=w.id and p.selected and p.media_state='ready')j),'[]'))
 from public.work_posts w join public.businesses b on b.id=w.business_id where w.status='published' and private.work_post_is_public(w.id) and (author_filter is null or exists(select 1 from public.business_members where business_id=b.id and role='owner' and user_id=author_filter))
 ), page as(select * from all_posts where before_time is null or (published_at,id,kind)<(before_time,before_id,before_kind) order by published_at desc,id desc,kind desc limit 11)
 select jsonb_build_object('items',coalesce((select jsonb_agg(payload order by published_at desc,id desc,kind desc) from(select * from page order by published_at desc,id desc,kind desc limit 10)x),'[]'),'hasNext',(select count(*)>10 from page));
$$;
revoke all on function public.publication_feed(timestamptz,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.publication_feed(timestamptz,uuid,text,uuid) to anon,authenticated;
create function public.moderate_personal_post(target uuid,command text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if command not in ('withdraw','release') or reason is null or char_length(btrim(reason)) not between 5 and 500 then raise exception 'Invalid moderation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(9142026);
 select status into previous from public.personal_posts where id=target for update;
 if not found then raise exception 'Unavailable' using errcode='42501';end if;
 insert into private.personal_post_moderation values(target,command='withdraw') on conflict(post_id) do update set blocked=excluded.blocked;
 update public.personal_posts set status='unpublished',updated_at=clock_timestamp() where id=target;
 insert into private.admin_audit(actor_id,target_type,target_id,action,reason,before_state,after_state) values(auth.uid(),'platform',target,'personal_'||command,btrim(reason),previous,case when command='withdraw' then 'blocked' else 'unpublished' end);
end;$$;
revoke all on function public.moderate_personal_post(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_personal_post(uuid,text,text) to authenticated;
create function private.withdraw_personal_on_suspension() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.suspended then update public.personal_posts set status='unpublished',updated_at=clock_timestamp() where author_id=new.user_id and status='published';end if;return new;
end;$$;
revoke all on function private.withdraw_personal_on_suspension() from public,anon,authenticated;
create trigger personal_account_suspension after insert or update of suspended on private.account_restrictions for each row execute function private.withdraw_personal_on_suspension();
create or replace function private.reportable_content(kind text,target uuid) returns boolean language sql stable security definer set search_path='' as $$select case when kind='personal_post' then private.personal_post_public(target) when kind='post' then private.work_post_is_public(target) when kind='business' then private.business_is_public(target) else false end;$$;
alter function private.admin_query(text,jsonb) rename to admin_query_before_personal_posts;
revoke all on function private.admin_query_before_personal_posts(text,jsonb) from public,anon,authenticated;
create function private.admin_query(section text,filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;pg integer:=coalesce((filters->>'page')::integer,1);
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if pg not between 1 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
 if section='personal_posts' then
  select jsonb_build_object('items',coalesce(jsonb_agg(x.payload),'[]'),'hasNext',count(*)>20) into result from (
  select private.personal_payload(p)||jsonb_build_object('blocked',coalesce(m.blocked,false)) payload from public.personal_posts p left join private.personal_post_moderation m on m.post_id=p.id where p.published_at is not null and (coalesce(filters->>'q','')='' or position(lower(left(filters->>'q',80)) in lower(p.title||' '||p.description))>0) and (coalesce(filters->>'status','')='' or p.status=filters->>'status') and (nullif(filters->>'id','') is null or p.id=(filters->>'id')::uuid) order by p.created_at desc,p.id desc limit 21 offset (pg-1)*20)x;
  return jsonb_set(result,'{items}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'items') with ordinality t(v,n) where n<=20),'[]'));
 end if;
 result:=private.admin_query_before_personal_posts(section,filters);
 if section='dashboard' then result:=result||jsonb_build_object('posts',(select count(*) from public.work_posts)+(select count(*) from public.personal_posts where deleted_at is null));end if;return result;
end;$$;
revoke all on function private.admin_query(text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_query(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
