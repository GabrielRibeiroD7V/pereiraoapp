-- PROPOSTA. Expansão aditiva; não publica nem copia conteúdo existente.
begin;
set local lock_timeout='5s';
create table public.offer_areas(id text primary key,name text not null,active boolean not null default true);
create table public.offer_activities(id text primary key,name text not null,terms text not null default '',kind text not null default 'service' check(kind in ('service','product','both')),active boolean not null default true);
create table public.offer_activity_areas(activity_id text references public.offer_activities(id),area_id text references public.offer_areas(id),primary key(activity_id,area_id));
insert into public.offer_areas(id,name) values
 ('eletrica','Elétrica'),('seguranca-eletronica','Segurança eletrônica'),('energia-solar','Energia solar'),('construcao','Construção e reformas'),('pintura','Pintura'),('hidraulica','Hidráulica'),('climatizacao','Climatização'),('marcenaria','Marcenaria'),('limpeza','Limpeza e conservação'),('eventos-decoracao','Eventos e decoração'),('materiais-ferramentas','Materiais e ferramentas'),('tecnologia','Tecnologia');
-- Mantém nomes e IDs das seis categorias existentes; acrescenta apenas as ausentes.
insert into public.categories(id,name) select id,name from public.offer_areas on conflict(id) do nothing;
insert into public.offer_activities(id,name,terms) values
 ('instalacao-eletrica','Instalação elétrica','instalações elétricas'),('manutencao-eletrica','Manutenção elétrica','reparos elétricos'),('quadros','Quadros elétricos','painéis elétricos'),('iluminacao','Iluminação','luminárias lâmpadas'),
 ('cameras','Instalação e manutenção de câmeras','câmera cftv monitoramento'),('cerca-eletrica','Cerca elétrica','cercas eletrificadas'),('alarmes','Alarmes','alarme'),('controle-acesso','Controle de acesso','portaria interfone'),
 ('instalacao-solar','Instalação solar','energia fotovoltaica'),('reformas','Construção e reformas','alvenaria obra'),('pintura-servico','Serviço de pintura','pintor paredes'),('encanamento','Instalação e manutenção hidráulica','encanador vazamentos'),
 ('ar-condicionado','Instalação e manutenção de ar-condicionado','climatização refrigeração'),('moveis','Móveis e trabalho em madeira','marceneiro móveis planejados'),
 ('limpeza-vidros','Limpeza de vidros','janelas'),('limpeza-telhados','Limpeza de telhados','telhado cobertura lavagem'),('limpeza-pos-obra','Limpeza pós-obra','obra'),('limpeza-residencial','Limpeza residencial','residências faxina'),('limpeza-empresas','Limpeza de empresas','comercial escritórios'),
 ('decoracao','Decoração e estruturas de eventos','natalina festas'),('tintas','Tintas','tinta acrílica esmalte'),('rolos-pinceis','Rolos, pincéis e acessórios','rolo pincel pintura'),('ferramentas','Ferramentas e materiais','ferramenta material'),('cameras-produto','Venda de câmeras e equipamentos','câmera cftv'),('software','Software e suporte de tecnologia','sistemas sites computadores');
update public.offer_activities set kind='product' where id in ('tintas','rolos-pinceis','ferramentas','cameras-produto');
insert into public.offer_activity_areas(activity_id,area_id) select id,case
 when id in ('instalacao-eletrica','manutencao-eletrica','quadros','iluminacao') then 'eletrica'
 when id in ('cameras','cerca-eletrica','alarmes','controle-acesso','cameras-produto') then 'seguranca-eletronica'
 when id='instalacao-solar' then 'energia-solar' when id='reformas' then 'construcao' when id in ('pintura-servico','tintas','rolos-pinceis') then 'pintura'
 when id='encanamento' then 'hidraulica' when id='ar-condicionado' then 'climatizacao' when id='moveis' then 'marcenaria'
 when id like 'limpeza-%' then 'limpeza' when id='decoracao' then 'eventos-decoracao' when id='software' then 'tecnologia' else 'materiais-ferramentas' end from public.offer_activities;
insert into public.offer_activity_areas values('tintas','materiais-ferramentas'),('rolos-pinceis','materiais-ferramentas'),('cerca-eletrica','eletrica'),('iluminacao','eventos-decoracao'),('cameras-produto','materiais-ferramentas');
alter table public.offer_areas enable row level security;
alter table public.offer_activities enable row level security;
alter table public.offer_activity_areas enable row level security;
revoke all on public.offer_areas,public.offer_activities,public.offer_activity_areas from public,anon,authenticated;
grant select on public.offer_areas,public.offer_activities,public.offer_activity_areas to anon,authenticated;
create policy areas_read on public.offer_areas for select to anon,authenticated using(active);
create policy activities_read on public.offer_activities for select to anon,authenticated using(active);
create policy activity_areas_read on public.offer_activity_areas for select to anon,authenticated using(exists(select 1 from public.offer_areas where id=area_id and active) and exists(select 1 from public.offer_activities where id=activity_id and active));

create table public.business_offers(
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),kind text not null check(kind in ('service','product')),
 name text not null check(char_length(btrim(name)) between 2 and 120),description text not null default '' check(char_length(description)<=2000),
 area_id text not null references public.offer_areas(id),activity_ids text[] not null default '{}' check(cardinality(activity_ids)<=10),
 pricing_type text not null default 'quote' check(pricing_type in ('fixed','starting-at','quote')),price_amount_cents bigint,
 active boolean not null default false,featured boolean not null default false,deleted_at timestamptz,
 image_id uuid,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((pricing_type='quote' and price_amount_cents is null) or (pricing_type<>'quote' and price_amount_cents is not null and price_amount_cents between 1 and 999999999)),
 check(not featured or kind='product')
);
create index offers_business on public.business_offers(business_id,kind) where deleted_at is null;
create table public.offer_images(id uuid primary key,offer_id uuid not null references public.business_offers(id),storage_path text not null unique,media_state text not null default 'pending' check(media_state in ('pending','ready')),created_at timestamptz not null default clock_timestamp());
alter table public.business_offers add constraint offer_image_fk foreign key(image_id) references public.offer_images(id);
create table private.offer_moderation(offer_id uuid primary key references public.business_offers(id),blocked boolean not null default false);
create table private.offer_audit(id bigint generated always as identity primary key,offer_id uuid not null references public.business_offers(id),actor_id uuid not null references auth.users(id),action text not null,reason text,created_at timestamptz not null default clock_timestamp());
alter table private.offer_moderation enable row level security;
alter table private.offer_audit enable row level security;
revoke all on private.offer_moderation,private.offer_audit from public,anon,authenticated;
create function public.moderate_offer(target_offer uuid,blocked boolean,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if char_length(btrim(coalesce(reason,''))) not between 10 and 1000 then raise exception 'Reason required' using errcode='22023';end if;
 perform 1 from public.business_offers where id=target_offer for update;
 if not found then raise exception 'Unavailable' using errcode='22023';end if;
 insert into private.offer_moderation values(target_offer,blocked) on conflict(offer_id) do update set blocked=excluded.blocked;
 if blocked then update public.business_offers set active=false where id=target_offer;end if;
 insert into private.offer_audit(offer_id,actor_id,action,reason) values(target_offer,auth.uid(),case when blocked then 'block' else 'unblock' end,btrim(reason));
end;$$;
revoke all on function public.moderate_offer(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.moderate_offer(uuid,boolean,text) to authenticated;
create function private.offer_public(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.business_offers o where id=target and o.active and o.deleted_at is null and private.business_is_public(o.business_id) and not exists(select 1 from private.offer_moderation m where m.offer_id=o.id and m.blocked));
$$;
revoke all on function private.offer_public(uuid) from public,anon,authenticated;
grant execute on function private.offer_public(uuid) to anon,authenticated;
alter table public.business_offers enable row level security;
alter table public.offer_images enable row level security;
revoke all on public.business_offers,public.offer_images from public,anon,authenticated;
grant select on public.business_offers,public.offer_images to anon,authenticated;
create policy offer_public_read on public.business_offers for select to anon,authenticated using(private.offer_public(id));
create policy offer_owner_read on public.business_offers for select to authenticated using(private.can_manage_business(business_id));
create policy image_public_read on public.offer_images for select to anon,authenticated using(media_state='ready' and exists(select 1 from public.business_offers o where o.id=offer_id and o.image_id=offer_images.id and private.offer_public(o.id)));
create policy image_owner_read on public.offer_images for select to authenticated using(exists(select 1 from public.business_offers o where o.id=offer_id and private.can_manage_business(o.business_id)));

create function public.offer_command(target_business uuid,target_offer uuid,command text,data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.business_offers;im public.offer_images;meta jsonb;activity text;amount bigint;
begin
 if not private.can_manage_business(target_business) then raise exception 'Owner required' using errcode='42501';end if;
 -- Serializa quotas e destaques inclusive entre abas concorrentes.
 perform 1 from public.businesses where id=target_business for update;
 select * into o from public.business_offers where id=target_offer for update;
 if found and (o.business_id<>target_business or o.deleted_at is not null) then raise exception 'Unavailable' using errcode='42501';end if;
 if command='save' then
  if not exists(select 1 from public.offer_areas where id=data->>'areaId' and active) or jsonb_typeof(data->'activityIds') is distinct from 'array' or jsonb_array_length(data->'activityIds')>10 then raise exception 'Invalid classification' using errcode='22023';end if;
  for activity in select jsonb_array_elements_text(data->'activityIds') loop
   if not exists(select 1 from public.offer_activities a join public.offer_activity_areas aa on aa.activity_id=a.id where a.id=activity and a.active and a.kind in ('both',data->>'kind') and aa.area_id=data->>'areaId') then raise exception 'Invalid activity' using errcode='22023';end if;
  end loop;
  if o.id is null and (select count(*) from public.business_offers where business_id=target_business and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'Offer rate limit' using errcode='54000';end if;
  if o.id is null and (select count(*) from public.business_offers where business_id=target_business and deleted_at is null)>=100 then raise exception 'Offer limit' using errcode='54000';end if;
  if o.id is not null and o.updated_at is distinct from (data->>'expectedUpdatedAt')::timestamptz then raise exception 'Reload changed offer' using errcode='40001';end if;
  if o.id is not null and o.kind is distinct from data->>'kind' then raise exception 'Cannot change offer type' using errcode='22023';end if;
  if coalesce((data->>'active')::boolean,false) and not private.public_actor_enabled(auth.uid()) then raise exception 'Confirm email' using errcode='42501';end if;
  if coalesce((data->>'featured')::boolean,false) and (select count(*) from public.business_offers where business_id=target_business and kind='product' and featured and deleted_at is null and id<>target_offer)>=5 then raise exception 'Only five featured products' using errcode='54000';end if;
  if coalesce((data->>'active')::boolean,false) and exists(select 1 from private.offer_moderation where offer_id=target_offer and blocked) then raise exception 'Offer blocked by moderation' using errcode='42501';end if;
  amount:=case when data->>'pricingType'='quote' then null else (data->>'priceCents')::bigint end;
  insert into public.business_offers(id,business_id,kind,name,description,area_id,activity_ids,pricing_type,price_amount_cents,active,featured)
   values(target_offer,target_business,data->>'kind',btrim(data->>'name'),coalesce(data->>'description',''),data->>'areaId',array(select distinct jsonb_array_elements_text(data->'activityIds')),data->>'pricingType',amount,coalesce((data->>'active')::boolean,false),coalesce((data->>'featured')::boolean,false))
   on conflict(id) do update set name=excluded.name,description=excluded.description,area_id=excluded.area_id,activity_ids=excluded.activity_ids,pricing_type=excluded.pricing_type,price_amount_cents=excluded.price_amount_cents,active=excluded.active,featured=excluded.featured,updated_at=clock_timestamp() where public.business_offers.business_id=target_business and public.business_offers.deleted_at is null returning * into o;
  if not found then raise exception 'Owner required' using errcode='42501';end if;
 elsif o.id is null then raise exception 'Unavailable' using errcode='42501';
 elsif command='delete' then update public.business_offers set active=false,featured=false,deleted_at=clock_timestamp(),updated_at=clock_timestamp() where id=o.id returning * into o;
 elsif command='prepare_image' then
  if (select count(*) from public.offer_images where offer_id=o.id)>=20 and not exists(select 1 from public.offer_images where id=(data->>'imageId')::uuid and offer_id=o.id) then raise exception 'Image limit' using errcode='54000';end if;
  insert into public.offer_images(id,offer_id,storage_path) values((data->>'imageId')::uuid,o.id,o.business_id::text||'/'||o.id::text||'/'||(data->>'imageId')||'.webp') on conflict(id) do nothing;
  select * into im from public.offer_images where id=(data->>'imageId')::uuid and offer_id=o.id;
  if not found then raise exception 'Unavailable' using errcode='42501';end if;return to_jsonb(im);
 elsif command='finalize_image' then
  select * into im from public.offer_images where id=(data->>'imageId')::uuid and offer_id=o.id for update;
  if not found then raise exception 'Unavailable' using errcode='42501';end if;
  select metadata into meta from storage.objects where bucket_id='business-offers' and name=im.storage_path;
  if not found or meta->>'mimetype' is distinct from 'image/webp' or coalesce(meta->>'size','')!~'^[0-9]+$' then raise exception 'Upload incomplete' using errcode='22023';end if;
  if (meta->>'size')::numeric not between 1 and 5242880 then raise exception 'Invalid image size' using errcode='22023';end if;
  update public.offer_images set media_state='ready' where id=im.id;
  update public.business_offers set image_id=im.id,updated_at=clock_timestamp() where id=o.id returning * into o;
 elsif command='clear_image' then update public.business_offers set image_id=null,updated_at=clock_timestamp() where id=o.id returning * into o;
 else raise exception 'Invalid command' using errcode='22023';end if;
 insert into private.offer_audit(offer_id,actor_id,action) values(o.id,auth.uid(),command);
 return to_jsonb(o);
end;$$;
revoke all on function public.offer_command(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.offer_command(uuid,uuid,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-offers','business-offers',false,5242880,array['image/webp']);
create function private.offer_object(path text,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.offer_images i join public.business_offers o on o.id=i.offer_id where i.storage_path=path and case when writing then i.media_state='pending' and o.deleted_at is null and private.can_manage_business(o.business_id) else (i.media_state='ready' and o.image_id=i.id and private.offer_public(o.id)) or private.can_manage_business(o.business_id) end);
$$;
revoke all on function private.offer_object(text,boolean) from public,anon,authenticated;
grant execute on function private.offer_object(text,boolean) to authenticated;
create policy offer_storage_read on storage.objects for select to authenticated using(bucket_id='business-offers' and private.offer_object(name,false));
create policy offer_storage_insert on storage.objects for insert to authenticated with check(bucket_id='business-offers' and private.offer_object(name,true));
-- Visitantes precisam de SELECT para URLs assinadas públicas, sempre condicionado ao estado atual.
grant execute on function private.offer_object(text,boolean) to anon;
create policy offer_storage_public on storage.objects for select to anon using(bucket_id='business-offers' and private.offer_object(name,false));
-- Sem UPDATE/DELETE de objetos pelo navegador: arquivos anteriores são preservados.

create function private.offer_normalize(value text) returns text language sql immutable set search_path='' as $$
 select translate(lower(coalesce(value,'')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc');
$$;
create function private.offer_score(term text,name text,activities text,description text) returns integer language sql immutable set search_path='' as $$
 select case when btrim(term)='' then 1
 when position(private.offer_normalize(term) in private.offer_normalize(name))>0 then 100
 when to_tsvector('pg_catalog.portuguese',private.offer_normalize(name)) @@ plainto_tsquery('pg_catalog.portuguese',private.offer_normalize(term)) then 80
 when to_tsvector('pg_catalog.portuguese',private.offer_normalize(activities)) @@ plainto_tsquery('pg_catalog.portuguese',private.offer_normalize(term)) then 60
 when to_tsvector('pg_catalog.portuguese',private.offer_normalize(description)) @@ plainto_tsquery('pg_catalog.portuguese',private.offer_normalize(term)) then 30 else 0 end;
$$;
revoke all on function private.offer_normalize(text),private.offer_score(text,text,text,text) from public,anon,authenticated;
-- Projeção comum: ofertas novas e serviços antigos sem backfill, cópia ou alteração de IDs.
create function private.offer_rows() returns table(id uuid,source text,business_id uuid,kind text,name text,description text,area_id text,activity_ids text[],pricing_type text,price_amount_cents bigint,active boolean,featured boolean,image_id uuid,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path='' as $$
 select o.id,'offer',o.business_id,o.kind,o.name,o.description,o.area_id,o.activity_ids,o.pricing_type,o.price_amount_cents,o.active,o.featured,o.image_id,o.created_at,o.updated_at from public.business_offers o where deleted_at is null
 union all select s.id,'legacy',s.business_id,'service',s.name,coalesce(s.description,''),s.category_id,'{}'::text[],s.pricing_type,s.price_amount_cents,s.active,false,null::uuid,s.created_at,s.updated_at from public.services s;
$$;
revoke all on function private.offer_rows() from public,anon,authenticated;
create function public.offers_query(target_business uuid default null,target_offer uuid default null,include_private boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if include_private and (target_business is null or not private.can_manage_business(target_business)) then raise exception 'Owner required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at,q.id) from (
 select o.*,b.name author,b.slug,case when i.media_state='ready' then i.storage_path else null end image_path
 from private.offer_rows() o join public.businesses b on b.id=o.business_id left join public.offer_images i on i.id=o.image_id
 where (target_business is null or o.business_id=target_business) and (target_offer is null or o.id=target_offer)
 and (include_private or (o.active and private.business_is_public(o.business_id) and (o.source='legacy' or private.offer_public(o.id)))) limit 200) q),'[]'::jsonb);
end;$$;
revoke all on function public.offers_query(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.offers_query(uuid,uuid,boolean) to anon,authenticated;

create function public.search_unified(p_query text default '',p_city text default '',p_area text default '',p_kind text default '',p_page integer default 1,p_provider_type text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if char_length(p_query)>200 or p_page not between 1 and 1000 or p_kind not in ('','service','product','provider','project') or p_provider_type not in ('','autonomo','empresa') then raise exception 'Invalid filters' using errcode='22023';end if;
 return coalesce((with eligible as (
 select b.* from public.businesses b where private.business_is_public(b.id) and (p_provider_type='' or b.type=p_provider_type)
 and (p_city in ('','todas') or exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id=p_city))
 ), offers as (
 select o.*,b.name author,b.slug,coalesce(a.terms,'') activity_terms,private.offer_score(p_query,o.name,a.terms,o.description) score
 from private.offer_rows() o join eligible b on b.id=o.business_id
 left join lateral(select string_agg(x.name||' '||x.terms,' ') terms from public.offer_activities x where x.id=any(o.activity_ids) and x.active)a on true
 where o.active and (o.source='legacy' or private.offer_public(o.id)) and (p_area='' or o.area_id=p_area or exists(select 1 from public.offer_activity_areas aa where aa.activity_id=any(o.activity_ids) and aa.area_id=p_area))
 ), results as (
 select o.id,o.kind,o.name title,o.description,o.author,'/ofertas/'||o.source||'/'||o.id::text url,o.business_id,o.pricing_type,o.price_amount_cents,o.score from offers o where o.score>0
 union all
 select b.id,'provider',b.name,coalesce(b.description,''),b.name,'/prestadores/'||b.slug,b.id,null,null,greatest(private.offer_score(p_query,b.name,coalesce(bp.profession,''),''),coalesce((select max(score)-1 from offers where business_id=b.id),0))
 from eligible b left join public.business_presentations bp on bp.business_id=b.id where (p_area='' or exists(select 1 from offers where business_id=b.id))
 union all
 select w.id,'project',w.title,w.description,b.name,'/trabalhos/'||w.id::text,case when private.business_is_public(b.id) then b.id else null end,null,null,private.offer_score(p_query,w.title,'',w.description)
 from public.work_posts w join public.businesses b on b.id=w.business_id where private.work_post_is_public(w.id)
 and (p_provider_type='' or b.type=p_provider_type) and (p_city in ('','todas') or exists(select 1 from eligible where id=b.id)) and (p_area='' or exists(select 1 from offers where business_id=b.id))
 union all
 select p.id,'project',p.title,p.description,coalesce(nullif(pr.display_name,''),'Pessoa no PEREIRÃO'),'/publicacoes/'||p.id::text,null::uuid,null,null,private.offer_score(p_query,p.title,'',p.description)
 from public.personal_posts p left join public.profiles pr on pr.id=p.author_id where private.personal_post_public(p.id) and p_city in ('','todas') and p_area='' and p_provider_type=''
 ) select jsonb_agg(to_jsonb(x) order by score desc,title,id,kind) from (select * from results where score>0 and (p_kind='' or kind=p_kind) order by score desc,title,id,kind limit 21 offset (p_page-1)*20)x),'[]'::jsonb);
end;$$;
revoke all on function public.search_unified(text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.search_unified(text,text,text,text,integer,text) to anon,authenticated;
create function public.offers_catalog() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('areas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.offer_areas where active),'[]'),'activities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind) order by name) from public.offer_activities where active),'[]'),'links',coalesce((select jsonb_agg(to_jsonb(a)) from public.offer_activity_areas a),'[]'));
$$;
revoke all on function public.offers_catalog() from public,anon,authenticated;
grant execute on function public.offers_catalog() to anon,authenticated;
-- Vínculo opcional; não altera publicação nem duplica mídia.
create table public.post_offer_links(
 work_post_id uuid unique references public.work_posts(id) on delete cascade,personal_post_id uuid unique references public.personal_posts(id) on delete cascade,
 offer_id uuid references public.business_offers(id),service_id uuid references public.services(id) on delete cascade,
 check(num_nonnulls(work_post_id,personal_post_id)=1),check(num_nonnulls(offer_id,service_id)=1)
);
alter table public.post_offer_links enable row level security;
revoke all on public.post_offer_links from public,anon,authenticated;
create function private.post_offer_owner(kind text,target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when kind='professional' then exists(select 1 from public.work_posts where id=target and private.can_manage_business(business_id)) when kind='personal' then exists(select 1 from public.personal_posts where id=target and author_id=auth.uid() and deleted_at is null and private.account_enabled(auth.uid())) else false end;
$$;
revoke all on function private.post_offer_owner(text,uuid) from public,anon,authenticated;
create function public.set_post_offer(post_kind text,target_post uuid,target_offer uuid default null,offer_source text default 'offer') returns void language plpgsql security definer set search_path='' as $$
declare o record;
begin
 if not private.post_offer_owner(post_kind,target_post) then raise exception 'Author required' using errcode='42501';end if;
 if post_kind='professional' then perform 1 from public.work_posts where id=target_post for update;else perform 1 from public.personal_posts where id=target_post for update;end if;
 if target_offer is not null then
  select * into o from private.offer_rows() where id=target_offer and source=offer_source;
  if not found then raise exception 'Offer unavailable' using errcode='22023';end if;
  if not private.can_manage_business(o.business_id) or (post_kind='professional' and not exists(select 1 from public.work_posts where id=target_post and business_id=o.business_id)) then raise exception 'Same owner required' using errcode='42501';end if;
 end if;
 delete from public.post_offer_links where (post_kind='professional' and work_post_id=target_post) or (post_kind='personal' and personal_post_id=target_post);
 if target_offer is not null then insert into public.post_offer_links values(case when post_kind='professional' then target_post end,case when post_kind='personal' then target_post end,case when offer_source='offer' then target_offer end,case when offer_source='legacy' then target_offer end);end if;
end;$$;
create function public.get_post_offer(post_kind text,target_post uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o) from public.post_offer_links l join private.offer_rows() o on (o.source='offer' and o.id=l.offer_id) or (o.source='legacy' and o.id=l.service_id)
 where ((post_kind='professional' and l.work_post_id=target_post) or (post_kind='personal' and l.personal_post_id=target_post))
 and (private.post_offer_owner(post_kind,target_post) or (o.active and private.business_is_public(o.business_id) and (o.source='legacy' or private.offer_public(o.id)) and case when post_kind='professional' then private.work_post_is_public(target_post) else private.personal_post_public(target_post) end)) limit 1;
$$;
revoke all on function public.set_post_offer(text,uuid,uuid,text),public.get_post_offer(text,uuid) from public,anon,authenticated;
grant execute on function public.set_post_offer(text,uuid,uuid,text) to authenticated;
grant execute on function public.get_post_offer(text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
