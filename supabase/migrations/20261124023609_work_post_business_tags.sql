-- PROPOSTA independente: não aplicar sem revisão/autorização específica.
begin;
set local lock_timeout='5s';
create table public.work_post_business_tags (
 post_id uuid not null,
 business_id uuid not null,
 tagged_business_id uuid not null references public.businesses(id) on delete restrict,
 sort_order integer not null check(sort_order between 0 and 4),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(post_id,tagged_business_id),
 unique(post_id,sort_order),
 foreign key(post_id,business_id) references public.work_posts(id,business_id) on delete cascade,
 check(business_id<>tagged_business_id)
);
create index work_post_business_tags_origin on public.work_post_business_tags(business_id,post_id);
create index work_post_business_tags_target on public.work_post_business_tags(tagged_business_id);
alter table public.work_post_business_tags enable row level security;
revoke all on public.work_post_business_tags from public,anon,authenticated;
grant select(post_id,business_id,tagged_business_id,sort_order) on public.work_post_business_tags to anon,authenticated;
create function private.taggable_company(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.businesses b where b.id=target and b.type='empresa' and b.status='published'
 and not exists(select 1 from private.business_moderation m where m.business_id=b.id and m.suspended));
$$;
revoke all on function private.taggable_company(uuid) from public,anon,authenticated;
grant execute on function private.taggable_company(uuid) to anon,authenticated;
create policy work_post_tags_public on public.work_post_business_tags for select to anon,authenticated using(private.taggable_company(tagged_business_id) and private.work_post_is_public(post_id));
create policy work_post_tags_managers on public.work_post_business_tags for select to authenticated using(private.taggable_company(tagged_business_id) and (private.can_manage_business(business_id) or private.is_platform_admin()));
create function public.search_work_post_companies(target_business uuid,search_text text)
returns table(id uuid,name text,slug text) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
 if search_text is null or char_length(btrim(search_text)) not between 2 and 80 then raise exception 'Search requires 2 to 80 characters' using errcode='22023'; end if;
 return query select b.id,b.name,b.slug from public.businesses b where b.id<>target_business and private.taggable_company(b.id)
 -- Literal substring: '%' e '_' não ampliam a consulta como curingas.
 and strpos(lower(b.name),lower(btrim(search_text)))>0 order by lower(b.name),b.id limit 10;
end;$$;
create function public.set_work_post_companies(target_business uuid,target_post uuid,company_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare item public.work_posts; requested uuid[]; previous uuid[]; n integer;
begin
 if not private.can_manage_business(target_business) then raise exception 'Not authorized' using errcode='42501'; end if;
 company_ids:=coalesce(company_ids,'{}'::uuid[]);n:=cardinality(company_ids);
 if n>5 or n<>(select count(distinct x) from unnest(company_ids) x) then raise exception 'Choose up to five distinct companies' using errcode='22023'; end if;
 perform 1 from public.businesses where id=target_business for update;
 select * into item from public.work_posts where id=target_post and business_id=target_business for update;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 if exists(select 1 from unnest(company_ids) x where x=target_business or not private.taggable_company(x)) then raise exception 'Company unavailable' using errcode='23514'; end if;
 select coalesce(array_agg(t.tagged_business_id order by t.sort_order),'{}'::uuid[]) into previous from public.work_post_business_tags t where t.post_id=target_post;
 requested:=company_ids;
 if previous=requested then return; end if;
 -- Alterar conteúdo público nunca torna um novo vínculo público automaticamente.
 if item.status='published' then perform private.work_post_command('unpublish',target_business,target_post,null,null,null); end if;
 delete from public.work_post_business_tags where post_id=target_post;
 insert into public.work_post_business_tags(post_id,business_id,tagged_business_id,sort_order,created_by)
 select target_post,target_business,x.id,x.position-1,(select auth.uid()) from unnest(company_ids) with ordinality x(id,position);
end;$$;
revoke all on function public.search_work_post_companies(uuid,text),public.set_work_post_companies(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.search_work_post_companies(uuid,text),public.set_work_post_companies(uuid,uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
