-- PROPOSTA: somente aplicar remotamente após revisão e autorização específica.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cities (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active boolean not null default true
);

create table public.categories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  active boolean not null default true
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('autonomo', 'empresa')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  description text check (char_length(description) <= 3000),
  city_id text not null references public.cities(id),
  whatsapp text check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  avatar_path text check (avatar_path like id::text || '/%'),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create unique index business_one_owner on public.business_members(business_id) where role = 'owner';
create index business_members_user_idx on public.business_members(user_id, business_id);
create index businesses_city_status_idx on public.businesses(city_id, status);

-- Dados empresariais privados ficam separados da representação pública.
create table public.business_details (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  legal_name text check (char_length(legal_name) <= 200),
  tax_id text check (tax_id ~ '^[0-9]{14}$'),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id text not null references public.categories(id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (char_length(description) <= 2000),
  pricing_type text not null default 'quote' check (pricing_type in ('fixed', 'starting-at', 'quote')),
  price_amount_cents bigint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  constraint services_valid_price check (
    (pricing_type = 'quote' and price_amount_cents is null) or
    (pricing_type in ('fixed', 'starting-at') and price_amount_cents is not null
      and price_amount_cents between 0 and 999999999)
  )
);
create index services_business_category_idx on public.services(business_id, category_id);
create index services_category_idx on public.services(category_id);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid,
  storage_path text not null check (storage_path like business_id::text || '/portfolio/%'),
  caption text check (char_length(caption) <= 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (service_id, business_id) references public.services(id, business_id)
);
create index portfolio_business_order_idx on public.portfolio_items(business_id, sort_order);
create index portfolio_service_idx on public.portfolio_items(service_id, business_id);

create table public.business_service_areas (
  business_id uuid not null references public.businesses(id) on delete cascade,
  city_id text not null references public.cities(id),
  primary key (business_id, city_id)
);
create index business_service_areas_city_idx on public.business_service_areas(city_id);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger businesses_updated before update on public.businesses for each row execute function private.touch_updated_at();
create trigger services_updated before update on public.services for each row execute function private.touch_updated_at();
create trigger business_details_updated before update on public.business_details for each row execute function private.touch_updated_at();

-- Privilegiada apenas para criar o perfil da conta inserida por Auth.
-- Metadados são usados exclusivamente para apresentação, nunca autorização.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 100));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 100) from auth.users
on conflict (id) do nothing;

-- Evitam recursão de RLS e não recebem user_id controlável pelo chamador.
create function private.is_business_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.business_members where business_id = target and user_id = (select auth.uid())
  );
$$;
create function private.can_manage_business(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.business_members where business_id = target
      and user_id = (select auth.uid()) and role in ('owner', 'admin')
  );
$$;
revoke all on function private.is_business_member(uuid), private.can_manage_business(uuid) from public, anon, authenticated;
grant execute on function private.is_business_member(uuid), private.can_manage_business(uuid) to authenticated;

-- Única entrada para criação + propriedade. Não aceita proprietário, status ou role.
create function private.create_business(business_name text, business_slug text, business_type text, initial_city_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.cities where id = initial_city_id and active) then
    raise exception 'City not available' using errcode = '23514';
  end if;
  insert into public.businesses(name, slug, type, city_id)
  values (btrim(business_name), business_slug, business_type, initial_city_id) returning id into new_id;
  insert into public.business_members(business_id, user_id, role) values (new_id, caller, 'owner');
  insert into public.business_service_areas(business_id, city_id) values (new_id, initial_city_id);
  return new_id;
end;
$$;
revoke all on function private.create_business(text, text, text, text) from public, anon, authenticated;
grant execute on function private.create_business(text, text, text, text) to authenticated;

-- Wrapper exposto sem SECURITY DEFINER. A função privilegiada fica em schema não exposto.
create function public.create_business(business_name text, business_slug text, business_type text, initial_city_id text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_business(business_name, business_slug, business_type, initial_city_id);
$$;
revoke all on function public.create_business(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_business(text, text, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_details enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.business_service_areas enable row level security;

-- Remover inclusive privilégios possivelmente herdados dos defaults do Supabase.
revoke all on public.profiles, public.cities, public.categories, public.businesses,
  public.business_members, public.business_details, public.services, public.portfolio_items,
  public.business_service_areas from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.cities, public.categories, public.businesses, public.services,
  public.portfolio_items, public.business_service_areas to anon, authenticated;
grant select on public.profiles, public.business_members, public.business_details to authenticated;
grant update(display_name, avatar_url) on public.profiles to authenticated;
grant update(name, slug, type, description, city_id, whatsapp, instagram, avatar_path, status)
  on public.businesses to authenticated;
grant delete on public.services, public.portfolio_items, public.business_service_areas, public.business_details to authenticated;
grant insert(business_id, category_id, name, description, pricing_type, price_amount_cents, active) on public.services to authenticated;
grant insert(business_id, service_id, storage_path, caption, sort_order) on public.portfolio_items to authenticated;
grant insert(business_id, city_id) on public.business_service_areas to authenticated;
grant insert(business_id, legal_name, tax_id) on public.business_details to authenticated;
grant update(name, description, category_id, pricing_type, price_amount_cents, active) on public.services to authenticated;
grant update(service_id, storage_path, caption, sort_order) on public.portfolio_items to authenticated;
grant update(legal_name, tax_id) on public.business_details to authenticated;

create policy profiles_own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy cities_public on public.cities for select to anon, authenticated using (active);
create policy categories_public on public.categories for select to anon, authenticated using (active);
create policy businesses_public on public.businesses for select to anon, authenticated using (status = 'published');
create policy businesses_members on public.businesses for select to authenticated using ((select private.is_business_member(id)));
create policy businesses_manage on public.businesses for update to authenticated
  using ((select private.can_manage_business(id))) with check ((select private.can_manage_business(id)));
create policy members_own_select on public.business_members for select to authenticated using (user_id = (select auth.uid()));
create policy details_read on public.business_details for select to authenticated using ((select private.can_manage_business(business_id)));
create policy details_insert on public.business_details for insert to authenticated with check ((select private.can_manage_business(business_id)));
create policy details_update on public.business_details for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy details_delete on public.business_details for delete to authenticated using ((select private.can_manage_business(business_id)));

create policy services_public on public.services for select to anon, authenticated using (
  active and exists(select 1 from public.businesses b where b.id = business_id and b.status = 'published')
);
create policy services_members on public.services for select to authenticated using ((select private.is_business_member(business_id)));
create policy services_insert on public.services for insert to authenticated with check ((select private.can_manage_business(business_id)));
create policy services_update on public.services for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy services_delete on public.services for delete to authenticated using ((select private.can_manage_business(business_id)));

create policy portfolio_public on public.portfolio_items for select to anon, authenticated using (
  exists(select 1 from public.businesses b where b.id = business_id and b.status = 'published')
);
create policy portfolio_members on public.portfolio_items for select to authenticated using ((select private.is_business_member(business_id)));
create policy portfolio_insert on public.portfolio_items for insert to authenticated with check ((select private.can_manage_business(business_id)));
create policy portfolio_update on public.portfolio_items for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy portfolio_delete on public.portfolio_items for delete to authenticated using ((select private.can_manage_business(business_id)));

create policy areas_public on public.business_service_areas for select to anon, authenticated using (
  exists(select 1 from public.businesses b where b.id = business_id and b.status = 'published')
);
create policy areas_members on public.business_service_areas for select to authenticated using ((select private.is_business_member(business_id)));
create policy areas_insert on public.business_service_areas for insert to authenticated with check ((select private.can_manage_business(business_id)));
create policy areas_delete on public.business_service_areas for delete to authenticated using ((select private.can_manage_business(business_id)));

insert into public.cities(id, name, state_code, slug) values ('mundo-novo-ms', 'Mundo Novo', 'MS', 'mundo-novo-ms');
insert into public.categories(id, name) values
  ('climatizacao', 'Climatização'), ('pintura', 'Pintura'), ('construcao', 'Construção'),
  ('eletrica', 'Elétrica'), ('marcenaria', 'Marcenaria'), ('limpeza', 'Limpeza');
commit;
