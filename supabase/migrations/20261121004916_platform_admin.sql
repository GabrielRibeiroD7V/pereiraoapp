-- PROPOSTA. Sem concessão automática de administrador; ativação remota exige autorização.
begin;
create table private.platform_admins(user_id uuid primary key references auth.users(id) on delete restrict, created_at timestamptz not null default now());
create table private.account_restrictions(user_id uuid primary key references auth.users(id) on delete restrict, suspended boolean not null default true);
create table private.business_moderation(business_id uuid primary key references public.businesses(id) on delete cascade, suspended boolean not null default false);
create table private.post_moderation(post_id uuid primary key, blocked boolean not null default false);
create table private.admin_audit(id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete restrict,
  actor_source text not null default 'user' check(actor_source in ('user','bootstrap_sql')),check(actor_id is not null or actor_source='bootstrap_sql'),
  target_type text not null check(target_type in ('business','user','post','platform')),target_id uuid not null, action text not null,
  reason text not null check(char_length(btrim(reason)) between 5 and 500), before_state text, after_state text, created_at timestamptz not null default clock_timestamp());
create index admin_audit_target_idx on private.admin_audit(target_type,target_id,created_at desc,id desc);
create index admin_audit_recent_idx on private.admin_audit(created_at desc,id desc);
alter table private.platform_admins enable row level security;
alter table private.account_restrictions enable row level security;
alter table private.business_moderation enable row level security;
alter table private.post_moderation enable row level security;
alter table private.admin_audit enable row level security;
revoke all on private.platform_admins,private.account_restrictions,private.business_moderation,private.post_moderation,private.admin_audit from public,anon,authenticated;

create function private.account_enabled(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select target is not null and not exists(select 1 from private.account_restrictions where user_id=target and suspended);
$$;
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and private.account_enabled((select auth.uid())) and exists(select 1 from private.platform_admins where user_id=(select auth.uid()));
$$;
revoke all on function private.account_enabled(uuid),private.is_platform_admin() from public,anon,authenticated;
grant execute on function private.account_enabled(uuid),private.is_platform_admin() to authenticated;
create function public.admin_access() returns boolean language sql stable security invoker set search_path='' as $$select private.is_platform_admin();$$;
revoke all on function public.admin_access() from public,anon,authenticated;
grant execute on function public.admin_access() to authenticated;

-- Suspensão da plataforma bloqueia operações profissionais mesmo com JWT ainda válido.
create or replace function private.is_business_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled((select auth.uid())) and exists(select 1 from public.business_members where business_id=target and user_id=(select auth.uid()));
$$;
create or replace function private.can_manage_business(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled((select auth.uid())) and not exists(select 1 from private.business_moderation where business_id=target and suspended)
 and exists(select 1 from public.business_members where business_id=target and user_id=(select auth.uid()) and role in ('owner','admin'));
$$;
create function private.require_enabled_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is not null and not private.account_enabled((select auth.uid())) then raise exception 'Account suspended' using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function private.require_enabled_account() from public,anon,authenticated;
create trigger business_enabled_account before insert on public.businesses for each row execute function private.require_enabled_account();
create policy profiles_enabled_update on public.profiles as restrictive for update to authenticated
 using(private.account_enabled((select auth.uid()))) with check(private.account_enabled((select auth.uid())));

-- Leitura de fotos privadas para análise, sem conceder mutações de Storage ao administrador.
create policy portfolio_admin_review on public.portfolio_items for select to authenticated using((select private.is_platform_admin()));
create policy storage_admin_review on storage.objects for select to authenticated using(
 bucket_id='business-portfolio' and (select private.is_platform_admin()) and exists(select 1 from public.portfolio_items p where p.storage_path=name and p.media_state='ready'));

create function private.admin_query(section text, filters jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; q text:=left(btrim(coalesce(filters->>'q','')),80); st text:=coalesce(filters->>'status','');
 page_no integer:=coalesce((filters->>'page')::integer,1); off integer; days integer:=coalesce((filters->>'days')::integer,30);
 target uuid:=nullif(filters->>'id','')::uuid; since timestamptz; post_total bigint; pending boolean; moderation_ready boolean;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if page_no not between 1 and 100000 or days not in (0,7,30,90) then raise exception 'Invalid pagination or period' using errcode='22023'; end if;
 off:=(page_no-1)*20; since:=case when days=0 then '-infinity'::timestamptz else now()-make_interval(days=>days) end; pending:=to_regclass('public.work_posts') is null;
 moderation_ready:=exists(select 1 from pg_catalog.pg_trigger where tgname='work_posts_moderation_guard' and not tgisinternal);
 if section='dashboard' then
   if not pending then execute 'select count(*) from public.work_posts' into post_total; end if;
   return jsonb_build_object('users',(select count(*) from auth.users),'newUsers',(select count(*) from auth.users where created_at>=since),
    'autonomos',(select count(*) from public.businesses where type='autonomo'),'empresas',(select count(*) from public.businesses where type='empresa'),
    'published',(select count(*) from public.businesses where status='published'),
    'drafts',(select count(*) from public.businesses b where status='draft' and not exists(select 1 from private.business_moderation m where m.business_id=b.id and m.suspended)),
    'suspended',(select count(*) from private.business_moderation where suspended),'posts',post_total,'postsAvailable',not pending,
    'active7',null,'active30',null,'days',days);
 elsif section='users' then
   select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'),'hasNext',count(*)>20) into result
    from (select u.id,u.email,p.display_name,u.created_at,u.email_confirmed_at is not null as confirmed,
      coalesce(r.suspended,false) as suspended from auth.users u left join public.profiles p on p.id=u.id left join private.account_restrictions r on r.user_id=u.id
      where (q='' or position(lower(q) in lower(coalesce(u.email,'')||' '||coalesce(p.display_name,'')))>0)
       and u.created_at>=since and (st='' or (st='suspended')=coalesce(r.suspended,false)) order by u.created_at desc,u.id desc limit 21 offset off) x;
 elsif section='businesses' then
   select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'),'hasNext',count(*)>20) into result
    from(select b.id,b.name,b.type,b.status,b.created_at,c.name as category,ct.name as city,coalesce(m.suspended,false) as suspended
      from public.businesses b left join public.categories c on c.id=b.category_id left join public.cities ct on ct.id=b.city_id left join private.business_moderation m on m.business_id=b.id
      where(q='' or position(lower(q) in lower(b.name))>0) and (st='' or (st='suspended' and coalesce(m.suspended,false)) or (st=b.status and not coalesce(m.suspended,false)))
      order by b.created_at desc,b.id desc limit 21 offset off)x;
 elsif section='detail' then
   select jsonb_build_object('business',jsonb_build_object('id',b.id,'name',b.name,'type',b.type,'status',b.status,'description',b.description,'category',c.name,'city',ct.name,'whatsapp',b.whatsapp,'suspended',coalesce(m.suspended,false)),
     'services',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,name,description,active,pricing_type,price_amount_cents from public.services where business_id=b.id order by name,id limit 21 offset off)s),'[]'),
     'photos',coalesce((select jsonb_agg(to_jsonb(p)) from (select id,storage_path,caption,media_state from public.portfolio_items where business_id=b.id order by sort_order,id limit 21 offset off)p),'[]'),
     'history',coalesce((select jsonb_agg(to_jsonb(a)) from (select id,action,reason,before_state,after_state,created_at,actor_id from private.admin_audit where target_type='business' and target_id=b.id order by created_at desc,id desc limit 20)a),'[]')) into result
    from public.businesses b left join public.categories c on c.id=b.category_id left join public.cities ct on ct.id=b.city_id left join private.business_moderation m on m.business_id=b.id where b.id=target;
   if result is null then raise exception 'Not found' using errcode='P0002'; end if;
   result:=result||jsonb_build_object('servicesHasNext',jsonb_array_length(result->'services')>20,'photosHasNext',jsonb_array_length(result->'photos')>20);
   result:=jsonb_set(result,'{services}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'services') with ordinality e(v,n) where n<=20),'[]'));
   return jsonb_set(result,'{photos}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'photos') with ordinality e(v,n) where n<=20),'[]'));
 elsif section='posts' then
   if pending then return jsonb_build_object('available',false,'items','[]'::jsonb,'hasNext',false,'moderationAvailable',false); end if;
   execute $q$select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'),'hasNext',count(*)>20) from
    (select w.id,w.business_id,w.title,w.status,w.created_at,b.name as business_name,coalesce(m.blocked,false) as blocked
      from public.work_posts w join public.businesses b on b.id=w.business_id left join private.post_moderation m on m.post_id=w.id
      where ($1='' or position(lower($1) in lower(w.title||' '||b.name))>0) and ($2='' or w.status=$2)
      order by w.created_at desc,w.id desc limit 21 offset $3)x$q$ into result using q,st,off;
   result:=result||jsonb_build_object('available',true,'moderationAvailable',moderation_ready);
 elsif section='audit' then
   select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'),'hasNext',count(*)>20) into result
    from(select id,actor_id,target_type,target_id,action,reason,before_state,after_state,created_at from private.admin_audit
     where(target is null or target_id=target) order by created_at desc,id desc limit 21 offset off)x;
 else raise exception 'Unknown section' using errcode='22023'; end if;
 -- A linha sentinela determina a próxima página, mas nunca entra no contrato.
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'items') with ordinality e(v,n) where n<=20),'[]'));
end;$$;
revoke all on function private.admin_query(text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_query(text,jsonb) to authenticated;
create function public.admin_query(section text,filters jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.admin_query(section,filters);$$;
revoke all on function public.admin_query(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_query(text,jsonb) to authenticated;

create function private.admin_action(kind text,target uuid,command text,reason text,expected_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous text; next_state text; b public.businesses; affected uuid; audit_id uuid;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
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
     next_state:='published';
     insert into private.business_moderation values(target,false) on conflict(business_id) do update set suspended=false;
     update public.businesses set status='published' where id=target;
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
create function public.admin_action(kind text,target uuid,command text,reason text,expected_state text) returns jsonb language sql security invoker set search_path='' as $$select private.admin_action(kind,target,command,reason,expected_state);$$;
revoke all on function public.admin_action(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_action(text,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
