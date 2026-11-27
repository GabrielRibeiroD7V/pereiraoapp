-- PROPOSTA #102. Expansão aditiva; não publica nem altera negócios existentes.
begin;
set local lock_timeout='5s';
create table public.business_locations (
 business_id uuid primary key references public.businesses(id) on delete restrict,
 mode text not null default 'home' check(mode in ('physical','home','both')),
 postal_code text not null default '' check(postal_code='' or postal_code ~ '^[0-9]{8}$'),
 street text not null default '' check(length(street)<=160),
 number text not null default '' check(length(number)<=20),
 neighborhood text not null default '' check(length(neighborhood)<=100),
 complement text not null default '' check(length(complement)<=120),
 city_id text references public.cities(id) on delete restrict,
 public_address boolean not null default false,
 version integer not null default 1,
 confirmed_by uuid references auth.users(id),confirmed_at timestamptz,
 check(not public_address or (mode<>'home' and street<>'' and number<>'' and neighborhood<>'' and postal_code<>'' and city_id is not null and confirmed_at is not null))
);
create index location_city_idx on public.business_locations(city_id);
create index location_confirmer_idx on public.business_locations(confirmed_by);
create table public.business_team_members (
 id uuid primary key,business_id uuid not null references public.businesses(id) on delete restrict,
 name text not null check(length(btrim(name)) between 2 and 100),
 profession text not null default '' check(length(profession)<=100),
 specialties text[] not null default '{}' check(cardinality(specialties)<=12),
 whatsapp text not null default '' check(whatsapp='' or whatsapp ~ '^[0-9]{10,15}$'),
 bio text not null default '' check(length(bio)<=600),
 position integer not null default 0 check(position between 0 and 10000),
 active boolean not null default true,deleted_at timestamptz,
 photo_path text,version integer not null default 1,
 consent_version text not null check(consent_version='team-public-v1'),
 consent_by uuid not null references auth.users(id),consent_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index team_consent_actor_idx on public.business_team_members(consent_by);
create index team_business_position on public.business_team_members(business_id,position,id) where deleted_at is null;
create table private.team_images (
 id uuid primary key,member_id uuid not null references public.business_team_members(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict,
 path text not null unique,ready boolean not null default false,expected_path text,
 created_at timestamptz not null default clock_timestamp(),
 check(path=business_id::text||'/'||member_id::text||'/'||id::text||'.webp')
);
create index team_images_business_created on private.team_images(business_id,created_at);
create index team_images_member on private.team_images(member_id);
create table private.team_location_audit (
 id bigint generated always as identity primary key,business_id uuid not null references public.businesses(id),
 actor_id uuid not null references auth.users(id),target_id uuid,action text not null,
 consent_version text,created_at timestamptz not null default clock_timestamp()
);
create index team_location_audit_business on private.team_location_audit(business_id,created_at);
create index team_location_audit_actor on private.team_location_audit(actor_id);
alter table public.business_locations enable row level security;
alter table public.business_team_members enable row level security;
alter table private.team_images enable row level security;
alter table private.team_location_audit enable row level security;
revoke all on public.business_locations,public.business_team_members,private.team_images,private.team_location_audit from public,anon,authenticated;
grant select on public.business_locations,public.business_team_members to authenticated;
create policy location_owner_read on public.business_locations for select to authenticated using(private.can_manage_business(business_id));
create policy team_owner_read on public.business_team_members for select to authenticated using(private.can_manage_business(business_id));
-- Public projection never includes private addresses, consent metadata or unselected portraits.
create function private.team_location_read(target_business uuid,owner_view boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare loc jsonb;members jsonb;company boolean;
begin
 if owner_view then
  if not private.can_manage_business(target_business) then raise exception 'Owner required' using errcode='42501';end if;
 elsif not private.business_is_public(target_business) then return jsonb_build_object('location',null,'members','[]'::jsonb);end if;
 select type='empresa' into company from public.businesses where id=target_business;
 select case when owner_view then (to_jsonb(l)-'confirmed_by'-'confirmed_at')||jsonb_build_object('city',c.name,'state',c.state_code)
  else jsonb_build_object('mode',l.mode,'public_address',l.public_address) || case when l.public_address then jsonb_build_object('postal_code',l.postal_code,'street',l.street,'number',l.number,'neighborhood',l.neighborhood,'complement',l.complement,'city_id',l.city_id,'city',c.name,'state',c.state_code) else '{}'::jsonb end end
 into loc from public.business_locations l left join public.cities c on c.id=l.city_id where l.business_id=target_business;
 select coalesce(jsonb_agg(to_jsonb(m)-'consent_by'-'consent_at'-'deleted_at'-'created_at'-'updated_at' order by m.position,m.id),'[]') into members
 from public.business_team_members m where m.business_id=target_business and company and m.deleted_at is null and (owner_view or m.active);
 return jsonb_build_object('location',loc,'members',members);
end;$$;
create function public.business_team_location(target_business uuid,owner_view boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$select private.team_location_read(target_business,owner_view);$$;
-- Writes serialize per business, enforce owner, email, suspension, consent, limits and optimistic versions.
create function private.team_location_command(target_business uuid,command text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.businesses;m public.business_team_members;l public.business_locations;pid uuid;img private.team_images;meta jsonb;ids uuid[];texts text[];
begin
 if not private.can_manage_business(target_business) or not private.public_actor_enabled(auth.uid()) then raise exception 'Confirmed owner required' using errcode='42501';end if;
 select * into b from public.businesses where id=target_business for update;
 if not private.can_manage_business(target_business) then raise exception 'Owner changed while waiting' using errcode='42501';end if;
 if pg_column_size(payload)>20000 then raise exception 'Payload too large' using errcode='22023';end if;
 if command='location' then
  select * into l from public.business_locations where business_id=b.id;
  if coalesce(l.version,0)<>coalesce((payload->>'version')::integer,0) then raise exception 'Reload changed address' using errcode='40001';end if;
  if payload->>'city_id' is not null and payload->>'city_id'<>'' and not exists(select 1 from public.cities where id=payload->>'city_id' and active) then raise exception 'Active city required' using errcode='23514';end if;
  insert into public.business_locations(business_id,mode,postal_code,street,number,neighborhood,complement,city_id,public_address,version,confirmed_by,confirmed_at)
  values(b.id,payload->>'mode',btrim(coalesce(payload->>'postal_code','')),btrim(coalesce(payload->>'street','')),btrim(coalesce(payload->>'number','')),btrim(coalesce(payload->>'neighborhood','')),btrim(coalesce(payload->>'complement','')),nullif(payload->>'city_id',''),coalesce((payload->>'public_address')::boolean,false),coalesce(l.version,0)+1,case when payload->>'public_address'='true' then auth.uid() end,case when payload->>'public_address'='true' then clock_timestamp() end)
  on conflict(business_id) do update set mode=excluded.mode,postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,neighborhood=excluded.neighborhood,complement=excluded.complement,city_id=excluded.city_id,public_address=excluded.public_address,version=excluded.version,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at;
 else
  if b.type<>'empresa' then raise exception 'Company required' using errcode='23514';end if;
  if command='reorder' then
   select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
   if coalesce(cardinality(ids),0)<>(select count(*) from public.business_team_members where business_id=b.id and deleted_at is null)
    or cardinality(ids)<>(select count(distinct x) from unnest(ids)x)
    or exists(select 1 from unnest(ids)x where not exists(select 1 from public.business_team_members where id=x and business_id=b.id and deleted_at is null)) then raise exception 'Exact own team required' using errcode='23514';end if;
   -- Versions guard against concurrent removal/edit/reorder.
   if exists(select 1 from public.business_team_members where business_id=b.id and deleted_at is null and version<>coalesce((payload->'versions'->>id::text)::integer,0)) then raise exception 'Reload changed team' using errcode='40001';end if;
   update public.business_team_members set position=array_position(ids,id)-1,version=version+1,updated_at=clock_timestamp() where business_id=b.id and deleted_at is null;
  else
   pid:=(payload->>'id')::uuid;
   if pid is null then raise exception 'Member required' using errcode='22023';end if;
   select * into m from public.business_team_members where id=pid;
   if found and (m.business_id<>b.id or m.deleted_at is not null) then raise exception 'Own member required' using errcode='42501';end if;
   if command in ('save','remove','photo_clear') and coalesce(m.version,0)<>coalesce((payload->>'version')::integer,0) then raise exception 'Reload changed member' using errcode='40001';end if;
   if command='save' then
    if payload->>'consent_version' is distinct from 'team-public-v1' then raise exception 'Member authorization required' using errcode='23514';end if;
    if m.id is null and (select count(*) from public.business_team_members where business_id=b.id and deleted_at is null)>=10 then raise exception 'Team limit 10' using errcode='54000';end if;
    select coalesce(array_agg(btrim(value)),'{}') into texts from jsonb_array_elements_text(coalesce(payload->'specialties','[]'));
    if exists(select 1 from unnest(texts)x where length(x) not between 1 and 80) then raise exception 'Invalid specialty' using errcode='23514';end if;
    insert into public.business_team_members(id,business_id,name,profession,specialties,whatsapp,bio,position,active,consent_version,consent_by,consent_at)
    values(pid,b.id,btrim(payload->>'name'),btrim(coalesce(payload->>'profession','')),texts,coalesce(payload->>'whatsapp',''),btrim(coalesce(payload->>'bio','')),coalesce(m.position,(select coalesce(max(position)+1,0) from public.business_team_members where business_id=b.id and deleted_at is null)),coalesce((payload->>'active')::boolean,true),'team-public-v1',auth.uid(),clock_timestamp())
    on conflict(id) do update set name=excluded.name,profession=excluded.profession,specialties=excluded.specialties,whatsapp=excluded.whatsapp,bio=excluded.bio,active=excluded.active,consent_by=excluded.consent_by,consent_at=excluded.consent_at,version=public.business_team_members.version+1,updated_at=clock_timestamp();
   elsif command='remove' then
    if m.id is null then raise exception 'Member unavailable' using errcode='P0002';end if;
    update public.business_team_members set deleted_at=clock_timestamp(),active=false,photo_path=null,whatsapp='',version=version+1 where id=m.id;
   elsif command='photo_clear' then
    if m.id is null then raise exception 'Member unavailable' using errcode='P0002';end if;
    update public.business_team_members set photo_path=null,version=version+1 where id=m.id;
   elsif command in ('photo_prepare','photo_finish') then
    if m.id is null or payload->>'consent_version' is distinct from 'team-public-v1' then raise exception 'Member and photo authorization required' using errcode='23514';end if;
    if (payload->>'photo_id') is null then raise exception 'Photo required' using errcode='22023';end if;
    select * into img from private.team_images where id=(payload->>'photo_id')::uuid;
    if found and (img.member_id<>pid or img.business_id<>b.id) then raise exception 'Own photo required' using errcode='42501';end if;
    if command='photo_prepare' then
     if img.id is null then
      if (select count(*) from private.team_images where business_id=b.id and created_at>clock_timestamp()-interval '1 day')>=200 then raise exception 'Daily photo limit' using errcode='54000';end if;
      if m.version<>coalesce((payload->>'version')::integer,0) then raise exception 'Reload changed member' using errcode='40001';end if;
      insert into private.team_images(id,member_id,business_id,path,expected_path) values((payload->>'photo_id')::uuid,pid,b.id,b.id::text||'/'||pid::text||'/'||(payload->>'photo_id')::uuid::text||'.webp',m.photo_path) returning * into img;
     end if;
     return jsonb_build_object('path',img.path,'ready',img.ready);
    end if;
    if img.id is null then raise exception 'Prepare photo first' using errcode='23514';end if;
    if img.ready then
     if m.photo_path is distinct from img.path then raise exception 'Photo replaced' using errcode='40001';end if;
     return jsonb_build_object('path',img.path,'ready',true);
    end if;
    if m.photo_path is distinct from img.expected_path then raise exception 'Photo replaced' using errcode='40001';end if;
    select metadata into meta from storage.objects where bucket_id='business-team' and name=img.path;
    if coalesce(meta->>'mimetype','')<>'image/webp' or coalesce(meta->>'size','')!~'^[0-9]+$' then raise exception 'Upload incomplete' using errcode='23514';end if;
    if (meta->>'size')::numeric not between 1 and 5242880 then raise exception 'Invalid image size' using errcode='23514';end if;
    update private.team_images set ready=true where id=img.id;
    update public.business_team_members set photo_path=img.path,version=version+1,consent_at=clock_timestamp(),consent_by=auth.uid() where id=pid;
   else raise exception 'Unknown command' using errcode='22023';end if;
  end if;
 end if;
 insert into private.team_location_audit(business_id,actor_id,target_id,action,consent_version) values(b.id,auth.uid(),pid,command,case when command in ('save','photo_finish') then 'team-public-v1' when command='location' and payload->>'public_address'='true' then 'address-public-v1' end);
 return private.team_location_read(b.id,true);
end;$$;
create function public.business_team_location_command(target_business uuid,command text,payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.team_location_command(target_business,command,payload);$$;
create function private.team_object(path text,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.team_images i join public.business_team_members m on m.id=i.member_id join public.businesses b on b.id=m.business_id where i.path=team_object.path and i.business_id=m.business_id and m.deleted_at is null and b.type='empresa' and
 case when writing then not i.ready and private.can_manage_business(m.business_id) and private.public_actor_enabled(auth.uid())
 else private.can_manage_business(m.business_id) or (i.ready and m.photo_path=i.path and m.active and private.business_is_public(m.business_id)) end);
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-team','business-team',false,5242880,array['image/webp']);
create policy team_storage_read on storage.objects for select to anon,authenticated using(bucket_id='business-team' and private.team_object(name,false));
create policy team_storage_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'business-team' or private.team_object(name,false));
create policy team_storage_insert on storage.objects for insert to authenticated with check(bucket_id='business-team' and private.team_object(name,true));
create policy team_storage_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'business-team' or private.team_object(name,true));
create policy team_storage_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'business-team') with check(bucket_id<>'business-team');
create policy team_storage_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'business-team');
revoke all on function private.team_location_read(uuid,boolean),private.team_location_command(uuid,text,jsonb),private.team_object(text,boolean),public.business_team_location(uuid,boolean),public.business_team_location_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.team_location_read(uuid,boolean),private.team_object(text,boolean),public.business_team_location(uuid,boolean) to anon,authenticated;
grant execute on function private.team_location_command(uuid,text,jsonb),public.business_team_location_command(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
