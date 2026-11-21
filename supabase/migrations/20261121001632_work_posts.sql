-- PR #9: proposta para revisão. Não aplicar no remoto sem autorização específica.
begin;
alter table public.portfolio_items add constraint portfolio_item_business_unique unique(id,business_id);
create table public.work_posts (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 2 and 120),
  description text not null default '' check(char_length(description)<=3000),
  status text not null default 'draft' check(status in ('draft','published','unpublished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique(id,business_id),
  check(status<>'published' or published_at is not null)
);
create table public.work_post_images (
  post_id uuid not null,
  business_id uuid not null,
  portfolio_item_id uuid not null,
  sort_order integer not null check(sort_order between 0 and 5),
  primary key(post_id,portfolio_item_id),
  unique(post_id,sort_order),
  constraint work_post_images_post_fkey foreign key(post_id,business_id) references public.work_posts(id,business_id) on delete cascade,
  constraint work_post_images_portfolio_fkey foreign key(portfolio_item_id,business_id) references public.portfolio_items(id,business_id) on delete cascade
);
create index work_posts_recent_idx on public.work_posts(published_at desc,id desc) where status='published';
create index work_posts_business_idx on public.work_posts(business_id,updated_at desc,id desc);
create index work_post_images_photo_idx on public.work_post_images(portfolio_item_id);
alter table public.work_posts enable row level security;
alter table public.work_post_images enable row level security;
revoke all on public.work_posts,public.work_post_images from public,anon,authenticated;
grant select on public.work_posts,public.work_post_images to anon,authenticated;

-- Consulta interna sem recursão nas policies; não retorna dados privados.
create function private.work_post_images_ready(target_post uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.work_post_images where post_id=target_post)
    and not exists(select 1 from public.work_post_images i left join public.portfolio_items p
      on p.id=i.portfolio_item_id and p.business_id=i.business_id
      where i.post_id=target_post and (p.id is null or p.media_state<>'ready' or not exists(
        select 1 from storage.objects o where o.bucket_id='business-portfolio' and o.name=p.storage_path
          and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))));
$$;
revoke all on function private.work_post_images_ready(uuid) from public,anon,authenticated;
create function private.work_post_is_public(target_post uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.work_posts w join public.businesses b on b.id=w.business_id
    where w.id=target_post and w.status='published' and b.status='published' and private.work_post_images_ready(w.id));
$$;
revoke all on function private.work_post_is_public(uuid) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.work_post_is_public(uuid) to anon,authenticated;
create policy work_posts_public on public.work_posts for select to anon,authenticated using(private.work_post_is_public(id));
create policy work_posts_managers on public.work_posts for select to authenticated using(private.can_manage_business(business_id));
create policy work_images_public on public.work_post_images for select to anon,authenticated using(private.work_post_is_public(post_id));
create policy work_images_managers on public.work_post_images for select to authenticated using(private.can_manage_business(business_id));

create function private.work_post_command(command text,target_business uuid,target_post uuid,
  post_title text default null,post_description text default null,photo_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.work_posts; business_state text; total integer; unique_total integer;
begin
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
      perform 1 from public.portfolio_items p join public.work_post_images i on i.portfolio_item_id=p.id
        where i.post_id=item.id order by p.id for key share of p;
      if business_state<>'published' or not private.work_post_images_ready(item.id) then
        raise exception 'Business or images not publishable' using errcode='23514';
      end if;
      if item.status<>'published' then
        update public.work_posts set status='published',published_at=clock_timestamp(),updated_at=now() where id=item.id returning * into item;
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
create function public.work_post_command(command text,target_business uuid,target_post uuid,
  post_title text default null,post_description text default null,photo_ids uuid[] default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.work_post_command(command,target_business,target_post,post_title,post_description,photo_ids);
$$;
revoke all on function public.work_post_command(text,uuid,uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.work_post_command(text,uuid,uuid,text,text,uuid[]) to authenticated;

-- Executa ANTES do DELETE para encontrar vínculos ainda não removidos pelo CASCADE.
-- begin_delete da RPC atual já muda media_state antes de remover bytes via Storage API.
create function private.withdraw_posts_for_portfolio_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or new.media_state is distinct from old.media_state or new.storage_path is distinct from old.storage_path or new.business_id is distinct from old.business_id then
    update public.work_posts w set status='unpublished',updated_at=now()
      where w.status='published' and exists(select 1 from public.work_post_images i where i.post_id=w.id and i.portfolio_item_id=old.id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.withdraw_posts_for_portfolio_change() from public,anon,authenticated;
create trigger withdraw_posts_before_portfolio_change before update of media_state,storage_path,business_id or delete on public.portfolio_items
for each row execute function private.withdraw_posts_for_portfolio_change();
notify pgrst,'reload schema';
commit;
