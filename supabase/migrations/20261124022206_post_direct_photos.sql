-- PROPOSTA: não aplicar remotamente sem autorização específica.
begin;
set local lock_timeout='5s';
create table public.work_post_photos(
 id uuid primary key, business_id uuid not null, post_id uuid not null,
 storage_path text not null unique, expected_bytes bigint not null check(expected_bytes between 1 and 5242880),
 media_state text not null default 'pending' check(media_state in ('pending','ready')),
 selected boolean not null default false, staged boolean not null default true,
 sort_order integer check(sort_order between 0 and 5), created_at timestamptz not null default clock_timestamp(),
 constraint work_post_photos_post_fkey foreign key(post_id,business_id) references public.work_posts(id,business_id) on delete cascade,
 check(not selected or (media_state='ready' and sort_order is not null))
);
create unique index work_post_photos_order on public.work_post_photos(post_id,sort_order) where selected;
create index work_post_photos_business on public.work_post_photos(business_id,post_id);
alter table public.work_post_photos enable row level security;
revoke all on public.work_post_photos from public,anon,authenticated;
grant select on public.work_post_photos to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-posts','business-posts',false,5242880,array['image/webp']);
create or replace function private.work_post_images_ready(target_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (exists(select 1 from public.work_post_images where post_id=target_post) or exists(select 1 from public.work_post_photos where post_id=target_post and selected))
 and not exists(select 1 from public.work_post_images i left join public.portfolio_items p on p.id=i.portfolio_item_id and p.business_id=i.business_id
 where i.post_id=target_post and (p.id is null or p.media_state<>'ready' or not exists(select 1 from storage.objects o where o.bucket_id='business-portfolio' and o.name=p.storage_path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))))
 and not exists(select 1 from public.work_post_photos p where p.post_id=target_post and p.selected and (p.media_state<>'ready' or not exists(select 1 from storage.objects o where o.bucket_id='business-posts' and o.name=p.storage_path and o.metadata->>'mimetype'='image/webp' and case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$' then (o.metadata->>'size')::numeric=p.expected_bytes else false end)));
$$;
create policy post_photos_managers on public.work_post_photos for select to authenticated using(private.can_manage_business(business_id) or private.is_platform_admin());
create policy post_photos_public on public.work_post_photos for select to anon,authenticated using(selected and media_state='ready' and private.work_post_is_public(post_id));

create function public.prepare_work_post_photo(target_business uuid,target_post uuid,target_photo uuid,image_bytes bigint,draft_title text,draft_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.work_post_photos; p public.work_posts;
begin
 if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
 if image_bytes is null or image_bytes not between 1 and 5242880 or target_photo is null then raise exception 'Invalid image' using errcode='22023'; end if;
 perform 1 from public.businesses where id=target_business for update;
 select * into p from public.work_posts where id=target_post;
 if not found then perform private.work_post_command('save',target_business,target_post,draft_title,draft_description,'{}');
 elsif p.business_id<>target_business then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into item from public.work_post_photos where id=target_photo;
 if found then
  if item.business_id<>target_business or item.post_id<>target_post or item.expected_bytes<>image_bytes then raise exception 'Request mismatch' using errcode='42501'; end if;
 else
  if (select count(*) from public.work_post_photos where post_id=target_post and staged)>=12 then raise exception 'Too many staged photos' using errcode='23514'; end if;
  insert into public.work_post_photos(id,business_id,post_id,storage_path,expected_bytes) values(target_photo,target_business,target_post,target_business::text||'/posts/'||target_photo::text||'.webp',image_bytes) returning * into item;
 end if;
 return to_jsonb(item);
end;$$;
create function public.finalize_work_post_photo(target_business uuid,target_photo uuid) returns void language plpgsql security definer set search_path='' as $$
declare item public.work_post_photos; meta jsonb;
begin
 if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into item from public.work_post_photos where id=target_photo and business_id=target_business for update;
 if not found then raise exception 'Unavailable' using errcode='42501'; end if;
 if item.media_state='ready' then return; end if;
 select metadata into meta from storage.objects where bucket_id='business-posts' and name=item.storage_path;
 if not found then raise exception 'Upload incomplete' using errcode='22023'; end if;
 if coalesce(meta->>'size','') !~ '^[0-9]+$' or meta->>'mimetype' is distinct from 'image/webp' then raise exception 'Invalid image' using errcode='23514'; end if;
 if (meta->>'size')::numeric<>item.expected_bytes then raise exception 'Size mismatch' using errcode='23514'; end if;
 update public.work_post_photos set media_state='ready' where id=item.id;
end;$$;
create function public.save_work_post_composition(target_business uuid,target_post uuid,post_title text,post_description text,image_refs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare entry jsonb; ord bigint; pid uuid; kind text; count_images integer;
begin
 if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
 if jsonb_typeof(image_refs) is distinct from 'array' then raise exception 'Invalid image list' using errcode='22023'; end if;
 count_images:=jsonb_array_length(image_refs);
 if count_images<1 or count_images>6 or (select count(distinct value->>'id') from jsonb_array_elements(image_refs))<>count_images then raise exception 'Choose 1 to 6 images' using errcode='22023'; end if;
 perform 1 from public.businesses where id=target_business for update;
 for entry in select value from jsonb_array_elements(image_refs) loop
  pid:=(entry->>'id')::uuid;kind:=entry->>'kind';
  if kind='post' then
   if not exists(select 1 from public.work_post_photos p where id=pid and business_id=target_business and post_id=target_post and media_state='ready' and exists(select 1 from storage.objects o where o.bucket_id='business-posts' and o.name=p.storage_path)) then raise exception 'Image unavailable' using errcode='23514'; end if;
  elsif kind='portfolio' then
   if not exists(select 1 from public.portfolio_items p where id=pid and business_id=target_business and media_state='ready' and exists(select 1 from storage.objects o where o.bucket_id='business-portfolio' and o.name=p.storage_path)) then raise exception 'Image unavailable' using errcode='23514'; end if;
  else raise exception 'Invalid image kind' using errcode='22023'; end if;
 end loop;
 -- Existing command preserves administrative publication rules and legacy clients.
 perform private.work_post_command('save',target_business,target_post,post_title,post_description,'{}');
 update public.work_post_photos set selected=false,staged=false,sort_order=null where post_id=target_post;
 for entry,ord in select value,ordinality from jsonb_array_elements(image_refs) with ordinality loop
  if entry->>'kind'='post' then update public.work_post_photos set selected=true,sort_order=ord-1 where id=(entry->>'id')::uuid;
  else insert into public.work_post_images(post_id,business_id,portfolio_item_id,sort_order) values(target_post,target_business,(entry->>'id')::uuid,ord-1); end if;
 end loop;
end;$$;
-- Legacy editing cannot leave old direct-upload selections accidentally published.
create function private.clear_direct_photo_selection() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.work_post_photos set selected=false,sort_order=null where post_id=new.id;
 return new;
end;$$;
revoke all on function private.clear_direct_photo_selection() from public,anon,authenticated;
create trigger clear_direct_photos_on_edit before update of title,description on public.work_posts for each row execute function private.clear_direct_photo_selection();

create function private.post_photo_object_access(path text,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_post_photos p where storage_path=path and case when writing then media_state='pending' and private.can_manage_business(business_id)
 else media_state='ready' and (private.can_manage_business(business_id) or private.is_platform_admin() or (selected and private.work_post_is_public(post_id))) end);
$$;
revoke all on function private.post_photo_object_access(text,boolean) from public,anon,authenticated;
grant execute on function private.post_photo_object_access(text,boolean) to anon,authenticated;
create function private.guard_direct_post_object() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.work_post_photos; actor uuid:=(select auth.uid()); owner_text text; effective_role text;
begin
 if new.bucket_id<>'business-posts' then return new; end if;
 select * into p from public.work_post_photos where storage_path=new.name for key share;
 if not found or p.media_state<>'pending' then raise exception 'Pending metadata required' using errcode='23503'; end if;
 if actor is null then
  effective_role:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  if session_user::text<>'supabase_storage_admin' or effective_role not in ('service_role','supabase_storage_admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  owner_text:=coalesce(nullif(to_jsonb(new)->>'owner_id',''),nullif(to_jsonb(new)->>'owner',''));
  if owner_text is null or owner_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Upload owner required' using errcode='42501'; end if;
  actor:=owner_text::uuid;
 end if;
 if not private.account_enabled(actor) or exists(select 1 from private.business_moderation where business_id=p.business_id and suspended) or not exists(select 1 from public.business_members where business_id=p.business_id and user_id=actor and role in ('owner','admin')) then raise exception 'Not authorized' using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function private.guard_direct_post_object() from public,anon,authenticated;
create trigger direct_post_object_guard before insert on storage.objects for each row execute function private.guard_direct_post_object();
create policy direct_post_object_read on storage.objects for select to anon,authenticated using(bucket_id='business-posts' and private.post_photo_object_access(name,false));
create policy direct_post_object_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'business-posts' or private.post_photo_object_access(name,false));
create policy direct_post_object_insert on storage.objects for insert to authenticated with check(bucket_id='business-posts' and private.post_photo_object_access(name,true));
create policy direct_post_object_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'business-posts' or private.post_photo_object_access(name,true));
create policy direct_post_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'business-posts') with check(bucket_id<>'business-posts');
create policy direct_post_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'business-posts');
revoke all on function public.prepare_work_post_photo(uuid,uuid,uuid,bigint,text,text),public.finalize_work_post_photo(uuid,uuid),public.save_work_post_composition(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_work_post_photo(uuid,uuid,uuid,bigint,text,text),public.finalize_work_post_photo(uuid,uuid),public.save_work_post_composition(uuid,uuid,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
