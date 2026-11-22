-- PROPOSTA: aplicar somente após revisão e autorização específica.
-- Nenhuma foto existente é copiada, movida ou apagada. Retratos não são portfólio.
begin;
create table public.business_profile_images (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  storage_path text not null unique,
  media_state text not null default 'pending' check(media_state in ('pending','ready')),
  expected_avatar_path text,
  created_at timestamptz not null default clock_timestamp(),
  check(storage_path=business_id::text||'/profile/'||id::text||'.webp')
);
create index profile_images_business_idx on public.business_profile_images(business_id);
alter table public.business_profile_images enable row level security;
revoke all on public.business_profile_images from public,anon,authenticated;
grant select(id,business_id,storage_path,media_state,created_at) on public.business_profile_images to anon,authenticated;
create policy profile_images_managers on public.business_profile_images for select to authenticated
using(private.can_manage_business(business_id));
create policy profile_images_admin on public.business_profile_images for select to authenticated
using(media_state='ready' and private.is_platform_admin());
create policy profile_images_public on public.business_profile_images for select to anon,authenticated
using(media_state='ready' and exists(select 1 from public.businesses b where b.id=business_id and b.status='published' and b.avatar_path=storage_path));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-profile','business-profile',false,5242880,array['image/webp']);
-- O ponteiro só muda por RPC, com validação de objeto e comparação otimista.
revoke update(avatar_path) on public.businesses from authenticated;

create function private.profile_photo_command(command text,target_business uuid,target_photo uuid default null,expected_avatar_path text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.businesses; item public.business_profile_images; meta jsonb;
begin
  if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into b from public.businesses where id=target_business for update;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  if command='remove' then
    if b.avatar_path is distinct from expected_avatar_path then raise exception 'Photo changed; reload' using errcode='40001'; end if;
    update public.businesses set avatar_path=null where id=target_business;
    return jsonb_build_object('storage_path',null);
  end if;
  if target_photo is null then raise exception 'Photo required' using errcode='22023'; end if;
  if command='prepare' then
    select * into item from public.business_profile_images where id=target_photo;
    if found then
      if item.business_id<>target_business or item.expected_avatar_path is distinct from profile_photo_command.expected_avatar_path then
        raise exception 'Photo mismatch' using errcode='42501'; end if;
      return to_jsonb(item);
    end if;
    if b.avatar_path is distinct from expected_avatar_path then raise exception 'Photo changed; reload' using errcode='40001'; end if;
    insert into public.business_profile_images(id,business_id,storage_path,expected_avatar_path)
    values(target_photo,target_business,target_business::text||'/profile/'||target_photo::text||'.webp',expected_avatar_path)
    returning * into item;
  elsif command='finalize' then
    select * into item from public.business_profile_images where id=target_photo and business_id=target_business for update;
    if not found then raise exception 'Photo unavailable' using errcode='42501'; end if;
    if item.media_state='ready' then
      if b.avatar_path is distinct from item.storage_path then raise exception 'Photo replaced; reload' using errcode='40001'; end if;
      return to_jsonb(item);
    end if;
    if b.avatar_path is distinct from item.expected_avatar_path then raise exception 'Photo changed; reload' using errcode='40001'; end if;
    select metadata into meta from storage.objects where bucket_id='business-profile' and name=item.storage_path;
    if not found or coalesce(meta->>'mimetype','')<>'image/webp' or coalesce(meta->>'size','') !~ '^[0-9]+$' then
      raise exception 'Upload incomplete' using errcode='22023'; end if;
    if (meta->>'size')::numeric not between 1 and 5242880 then raise exception 'Invalid size' using errcode='22023'; end if;
    update public.business_profile_images set media_state='ready' where id=item.id returning * into item;
    update public.businesses set avatar_path=item.storage_path where id=target_business;
  else raise exception 'Unknown command' using errcode='22023'; end if;
  return to_jsonb(item);
end;$$;
revoke all on function private.profile_photo_command(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.profile_photo_command(text,uuid,uuid,text) to authenticated;
create function public.profile_photo_command(command text,target_business uuid,target_photo uuid default null,expected_avatar_path text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.profile_photo_command(command,target_business,target_photo,expected_avatar_path);
$$;
revoke all on function public.profile_photo_command(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.profile_photo_command(text,uuid,uuid,text) to authenticated;

-- Coordena upload/finalização; não referencia colunas específicas de owner do Storage.
create function private.guard_profile_image_object() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.business_profile_images;
begin
 if new.bucket_id<>'business-profile' then return new; end if;
 select * into item from public.business_profile_images where storage_path=new.name for key share;
 if not found or item.media_state<>'pending' then raise exception 'Pending profile metadata required' using errcode='23503'; end if;
 if not private.can_manage_business(item.business_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function private.guard_profile_image_object() from public,anon,authenticated;
create trigger profile_image_object_guard before insert on storage.objects for each row execute function private.guard_profile_image_object();
create policy profile_objects_read on storage.objects for select to anon,authenticated using(
 bucket_id='business-profile' and exists(select 1 from public.business_profile_images p where p.storage_path=objects.name));
create policy profile_objects_read_guard on storage.objects as restrictive for select to anon,authenticated using(
 bucket_id<>'business-profile' or exists(select 1 from public.business_profile_images p where p.storage_path=objects.name));
create policy profile_objects_insert on storage.objects for insert to authenticated with check(
 bucket_id='business-profile' and exists(select 1 from public.business_profile_images p where p.storage_path=objects.name and p.media_state='pending' and private.can_manage_business(p.business_id)));
create policy profile_objects_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(
 bucket_id<>'business-profile' or exists(select 1 from public.business_profile_images p where p.storage_path=objects.name and p.media_state='pending' and private.can_manage_business(p.business_id)));
-- Objetos imutáveis; não há overwrite ou exclusão cliente que invalide a foto atual.
create policy profile_objects_no_overwrite on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'business-profile') with check(bucket_id<>'business-profile');
create policy profile_objects_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'business-profile');
-- Revisão do retrato não o coloca na coleção de fotografias de trabalhos.
create function private.admin_profile_photo(target_business uuid) returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return (select avatar_path from public.businesses where id=target_business);
end;$$;
revoke all on function private.admin_profile_photo(uuid) from public,anon,authenticated;
grant execute on function private.admin_profile_photo(uuid) to authenticated;
create function public.admin_profile_photo(target_business uuid) returns text language sql stable security invoker set search_path='' as $$
 select private.admin_profile_photo(target_business);
$$;
revoke all on function public.admin_profile_photo(uuid) from public,anon,authenticated;
grant execute on function public.admin_profile_photo(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
