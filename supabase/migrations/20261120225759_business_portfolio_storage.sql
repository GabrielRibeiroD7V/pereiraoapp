-- PR #7: preparar para revisão; não aplicar no remoto sem autorização específica.
begin;
grant insert(id) on public.services to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('business-portfolio','business-portfolio',false,5242880,array['image/jpeg','image/png','image/webp']);

-- Linhas antigas são preservadas. Novos envios começam pendentes.
alter table public.portfolio_items add column media_state text not null default 'ready'
  check (media_state in ('pending','ready','deleting'));
alter table public.portfolio_items alter column media_state set default 'pending';
create unique index portfolio_storage_path_unique on public.portfolio_items(storage_path);
revoke update(storage_path,sort_order) on public.portfolio_items from authenticated;
revoke delete on public.portfolio_items from authenticated;
drop policy portfolio_public on public.portfolio_items;
create policy portfolio_public on public.portfolio_items for select to anon,authenticated using (
  media_state='ready' and exists(select 1 from public.businesses b where b.id=business_id and b.status='published')
);

-- Privilegiada somente para o ciclo de vida da mídia. Sempre verifica auth.uid + owner/admin.
-- Sem SQL dinâmico, proprietário/permissões/status do negócio como argumentos.
create function private.portfolio_command(command text,target_business uuid,target_item uuid default null,
  target_service uuid default null,item_caption text default null,ordered_items uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.portfolio_items; object_metadata jsonb; expected integer; distinct_count integer;
begin
  if (select auth.uid()) is null or not private.can_manage_business(target_business) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  perform 1 from public.businesses where id=target_business for update;
  if command='prepare' then
    if target_item is null then raise exception 'Missing operation ID' using errcode='22023'; end if;
    insert into public.portfolio_items(id,business_id,service_id,storage_path,caption,sort_order,media_state)
      values(target_item,target_business,target_service,target_business::text||'/portfolio/'||target_item::text||'.webp',nullif(btrim(item_caption),''),
        (select coalesce(max(sort_order),-1)+1 from public.portfolio_items where business_id=target_business),'pending')
      on conflict(id) do nothing;
    select * into item from public.portfolio_items where id=target_item and business_id=target_business;
    if not found then raise exception 'Not authorized' using errcode='42501'; end if;
    if item.media_state='deleting' then raise exception 'Deletion pending' using errcode='55000'; end if;
    update public.portfolio_items set service_id=target_service,caption=nullif(btrim(item_caption),'') where id=item.id returning * into item;
    return to_jsonb(item);
  elsif command='reorder' then
    select count(*),count(distinct x) into expected,distinct_count from unnest(ordered_items) x;
    if ordered_items is null or expected<>distinct_count or expected<>(select count(*) from public.portfolio_items where business_id=target_business and media_state='ready')
      or exists(select 1 from unnest(ordered_items) x where not exists(select 1 from public.portfolio_items p where p.id=x and p.business_id=target_business and p.media_state='ready')) then
      raise exception 'Portfolio changed; reload' using errcode='40001';
    end if;
    update public.portfolio_items p set sort_order=q.position-1 from unnest(ordered_items) with ordinality q(id,position)
      where p.id=q.id and p.business_id=target_business;
    return jsonb_build_object('ok',true);
  end if;
  select * into item from public.portfolio_items where id=target_item and business_id=target_business for update;
  if not found then
    if command in ('begin_delete','finish_delete') then return jsonb_build_object('deleted',true); end if;
    raise exception 'Item not found' using errcode='P0002';
  end if;
  if command='finalize' then
    if item.media_state='ready' then return to_jsonb(item); end if;
    if item.media_state<>'pending' then raise exception 'Deletion pending' using errcode='55000'; end if;
    select metadata into object_metadata from storage.objects where bucket_id='business-portfolio' and name=item.storage_path;
    if not found or coalesce(object_metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp')
      or coalesce(object_metadata->>'size','') !~ '^[0-9]+$' then
      raise exception 'Upload incomplete or unsupported' using errcode='22023';
    end if;
    if (object_metadata->>'size')::numeric not between 1 and 5242880 or not (
      (object_metadata->>'mimetype'='image/webp' and item.storage_path ~ '\.webp$') or
      (object_metadata->>'mimetype'='image/png' and item.storage_path ~ '\.png$') or
      (object_metadata->>'mimetype'='image/jpeg' and item.storage_path ~ '\.jpe?g$')) then
      raise exception 'Invalid image type or size' using errcode='22023';
    end if;
    update public.portfolio_items set media_state='ready' where id=item.id returning * into item;
  elsif command='begin_delete' then
    update public.portfolio_items set media_state='deleting' where id=item.id returning * into item;
  elsif command='finish_delete' then
    if item.media_state<>'deleting' or exists(select 1 from storage.objects where bucket_id='business-portfolio' and name=item.storage_path) then
      raise exception 'Remove object first' using errcode='55000';
    end if;
    delete from public.portfolio_items where id=item.id;
    return jsonb_build_object('deleted',true);
  else raise exception 'Unknown command' using errcode='22023';
  end if;
  return to_jsonb(item);
end;
$$;
revoke all on function private.portfolio_command(text,uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function private.portfolio_command(text,uuid,uuid,uuid,text,uuid[]) to authenticated;
create function public.portfolio_command(command text,target_business uuid,target_item uuid default null,
  target_service uuid default null,item_caption text default null,ordered_items uuid[] default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.portfolio_command(command,target_business,target_item,target_service,item_caption,ordered_items);
$$;
revoke all on function public.portfolio_command(text,uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.portfolio_command(text,uuid,uuid,uuid,text,uuid[]) to authenticated;

-- Excluir serviço mantém as fotos e remove a associação, na mesma transação.
create function public.delete_business_service(target_business uuid,target_service uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
  perform 1 from public.businesses where id=target_business for update;
  update public.portfolio_items set service_id=null where business_id=target_business and service_id=target_service;
  delete from public.services where id=target_service and business_id=target_business;
end;
$$;
revoke all on function public.delete_business_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_business_service(uuid,uuid) to authenticated;

-- Coordena o INSERT real do Storage com exclusões/finalizações concorrentes.
-- A RLS pode ser avaliada em um preflight separado pela API; o trigger mantém
-- a referência aos metadados também na transação que registra o objeto.
create function private.guard_portfolio_object() returns trigger
language plpgsql security definer set search_path='' as $$
declare target public.portfolio_items;
begin
  if new.bucket_id<>'business-portfolio' then return new; end if;
  select * into target from public.portfolio_items where storage_path=new.name for key share;
  if found and (select auth.uid()) is not null and not private.can_manage_business(target.business_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if target.id is null or target.media_state<>'pending' then
    raise exception 'Pending portfolio metadata required' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_portfolio_object() from public,anon,authenticated;
create trigger portfolio_object_metadata_guard before insert on storage.objects
for each row execute function private.guard_portfolio_object();

-- Bucket privado. SELECT segue a visibilidade dos metadados sob RLS.
-- Predicados restritivos protegem este bucket mesmo se outra policy permissiva for criada futuramente.
create policy portfolio_objects_read_anon on storage.objects for select to anon using (
 bucket_id='business-portfolio' and exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='ready'));
create policy portfolio_objects_read_auth on storage.objects for select to authenticated using (
 bucket_id='business-portfolio' and exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and (p.media_state='ready' or private.can_manage_business(p.business_id))));
create policy portfolio_objects_read_anon_guard on storage.objects as restrictive for select to anon using (
 bucket_id<>'business-portfolio' or exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='ready'));
create policy portfolio_objects_read_auth_guard on storage.objects as restrictive for select to authenticated using (
 bucket_id<>'business-portfolio' or exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and (p.media_state='ready' or private.can_manage_business(p.business_id))));
create policy portfolio_objects_insert on storage.objects for insert to authenticated with check (
 bucket_id='business-portfolio' and exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='pending' and private.can_manage_business(p.business_id)));
create policy portfolio_objects_insert_guard on storage.objects as restrictive for insert to authenticated with check (
 bucket_id<>'business-portfolio' or exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='pending' and private.can_manage_business(p.business_id)));
create policy portfolio_objects_delete on storage.objects for delete to authenticated using (
 bucket_id='business-portfolio' and exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='deleting' and private.can_manage_business(p.business_id)));
create policy portfolio_objects_delete_guard on storage.objects as restrictive for delete to authenticated using (
 bucket_id<>'business-portfolio' or exists(select 1 from public.portfolio_items p where p.storage_path=objects.name and p.media_state='deleting' and private.can_manage_business(p.business_id)));
create policy portfolio_objects_no_overwrite on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'business-portfolio') with check(bucket_id<>'business-portfolio');
commit;
