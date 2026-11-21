-- PROPOSTA: requer revisão e autorização específica antes de aplicar remotamente.
-- A principal continua em businesses.category_id; esta relação guarda somente adicionais.
begin;
create table public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id text not null references public.categories(id),
  primary key (business_id, category_id)
);
create index business_categories_category_business_idx on public.business_categories(category_id, business_id);
alter table public.business_categories enable row level security;
revoke all on public.business_categories from public, anon, authenticated;
grant select on public.business_categories to anon, authenticated;
create policy business_categories_public on public.business_categories for select to anon, authenticated
using (exists(select 1 from public.businesses b where b.id=business_id and b.status='published')
  and exists(select 1 from public.categories c where c.id=category_id and c.active));
create policy business_categories_members on public.business_categories for select to authenticated
using ((select private.is_business_member(business_id)));

-- Mesmo ordem de locks na RPC e nos triggers: negócio, categorias em ordem estável.
create function private.validate_business_specialty() returns trigger
language plpgsql security definer set search_path='' as $$
declare main_id text;
begin
  select b.category_id into main_id from public.businesses b where b.id=new.business_id for update;
  if not found then raise exception 'Business not found' using errcode='23503'; end if;
  if main_id is null or main_id=new.category_id then
    raise exception 'Additional category must differ from primary' using errcode='23514';
  end if;
  perform 1 from public.categories c where c.id=new.category_id and c.active for share;
  if not found then raise exception 'Category not available' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.validate_business_specialty() from public,anon,authenticated;
create trigger validate_business_specialty before insert or update on public.business_categories
for each row execute function private.validate_business_specialty();

-- Preserva clientes anteriores que atualizam a principal diretamente, sem permitir
-- atribuir categoria inativa, apagar uma principal ou duplicá-la nas adicionais.
create function private.validate_primary_category() returns trigger
language plpgsql security definer set search_path='' as $$
declare available boolean;
begin
  if new.category_id is not distinct from old.category_id then return new; end if;
  if new.category_id is null then raise exception 'Primary category required' using errcode='23514'; end if;
  select c.active into available from public.categories c where c.id=new.category_id for share;
  if not found then raise exception 'Category not found' using errcode='23503'; end if;
  if not available then raise exception 'Category not available' using errcode='23514'; end if;
  return new;
end;
$$;
create function private.sync_primary_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.business_categories bc where bc.business_id=new.id and bc.category_id=new.category_id;
  return new;
end;
$$;
revoke all on function private.validate_primary_category(), private.sync_primary_category() from public,anon,authenticated;
create trigger validate_primary_category before update of category_id on public.businesses
for each row execute function private.validate_primary_category();
create trigger sync_primary_category after update of category_id on public.businesses
for each row when (new.category_id is distinct from old.category_id) execute function private.sync_primary_category();

create function private.set_business_specialties(
  target_business_id uuid, primary_category_id text, additional_category_ids text[],
  expected_primary_category_id text, expected_additional_category_ids text[]
) returns void language plpgsql security definer set search_path='' as $$
declare actual_primary text; actual_additional text[]; wanted text[]; expected text[];
begin
  if (select auth.uid()) is null or not private.can_manage_business(target_business_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select b.category_id into actual_primary from public.businesses b where b.id=target_business_id for update;
  if not found then raise exception 'Not authorized' using errcode='42501'; end if;
  -- Bloqueia também o vínculo de permissão, evitando revogação durante a operação.
  perform 1 from public.business_members m where m.business_id=target_business_id
    and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
    and private.can_manage_business(target_business_id) for share;
  if not found then raise exception 'Not authorized' using errcode='42501'; end if;
  if primary_category_id is null or additional_category_ids is null
    or array_position(additional_category_ids,null) is not null
    or primary_category_id=any(additional_category_ids) then
    raise exception 'Invalid categories' using errcode='23514';
  end if;
  if cardinality(additional_category_ids)<>(select count(distinct v) from unnest(additional_category_ids) v) then
    raise exception 'Duplicate category' using errcode='23505';
  end if;
  select coalesce(array_agg(v order by v),'{}'::text[]) into wanted from unnest(additional_category_ids) v;
  -- FOR SHARE serializa a validação com uma desativação administrativa concorrente.
  perform c.id from public.categories c where c.id=any(array_prepend(primary_category_id,wanted)) and c.active order by c.id for share;
  if (select count(*) from public.categories c where c.id=any(array_prepend(primary_category_id,wanted)) and c.active)<>cardinality(wanted)+1 then
    raise exception 'Category not available' using errcode='23514';
  end if;
  select coalesce(array_agg(bc.category_id order by bc.category_id),'{}'::text[]) into actual_additional
    from public.business_categories bc where bc.business_id=target_business_id;
  if actual_primary=primary_category_id and actual_additional=wanted then return; end if;
  select coalesce(array_agg(v order by v),'{}'::text[]) into expected from unnest(coalesce(expected_additional_category_ids,'{}'::text[])) v;
  if actual_primary is distinct from expected_primary_category_id or actual_additional<>expected then
    raise exception 'Specialties changed; reload before saving' using errcode='40001';
  end if;
  update public.businesses b set category_id=primary_category_id where b.id=target_business_id;
  delete from public.business_categories bc where bc.business_id=target_business_id and not(bc.category_id=any(wanted));
  insert into public.business_categories(business_id,category_id)
    select target_business_id,v from unnest(wanted) v on conflict do nothing;
end;
$$;
revoke all on function private.set_business_specialties(uuid,text,text[],text,text[]) from public,anon,authenticated;
grant execute on function private.set_business_specialties(uuid,text,text[],text,text[]) to authenticated;
create function public.set_business_specialties(
  target_business_id uuid, primary_category_id text, additional_category_ids text[],
  expected_primary_category_id text, expected_additional_category_ids text[]
) returns void language sql security invoker set search_path='' as $$
  select private.set_business_specialties(target_business_id,primary_category_id,additional_category_ids,expected_primary_category_id,expected_additional_category_ids);
$$;
revoke all on function public.set_business_specialties(uuid,text,text[],text,text[]) from public,anon,authenticated;
grant execute on function public.set_business_specialties(uuid,text,text[],text,text[]) to authenticated;

-- Leitura pública com RLS, projeção explícita, EXISTS sem duplicar negócios e limite fixo.
create function public.search_public_businesses(
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
  where b.status='published'
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
