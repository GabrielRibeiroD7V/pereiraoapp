begin;
set local lock_timeout = '5s';
-- Additive optional public presentation; no account/legal/financial fields.
create table public.business_presentations (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 headline text not null default '' check(char_length(headline)<=120),
 experience text not null default '' check(char_length(experience)<=3000),
 education text not null default '' check(char_length(education)<=3000),
 certifications text not null default '' check(char_length(certifications)<=2000),
 professional_registration text not null default '' check(char_length(professional_registration)<=200)
);
alter table public.business_presentations enable row level security;
revoke all on public.business_presentations from public,anon,authenticated;
grant select on public.business_presentations to anon,authenticated;
grant insert on public.business_presentations to authenticated;
grant update(headline,experience,education,certifications,professional_registration) on public.business_presentations to authenticated;
create policy presentation_public on public.business_presentations for select to anon,authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.status='published'));
create policy presentation_manage_read on public.business_presentations for select to authenticated
 using((select private.can_manage_business(business_id)) or (select private.is_platform_admin()));
create policy presentation_insert on public.business_presentations for insert to authenticated
 with check((select private.can_manage_business(business_id)));
create policy presentation_update on public.business_presentations for update to authenticated
 using((select private.can_manage_business(business_id))) with check((select private.can_manage_business(business_id)));
-- Invoker: no privilege escalation, business pointer cannot be updated by the caller.
create function public.save_business_presentation(target_business uuid, p_headline text, p_experience text, p_education text, p_certifications text, p_registration text)
returns void language sql security invoker set search_path='' as $$
 insert into public.business_presentations(business_id,headline,experience,education,certifications,professional_registration)
 values(target_business,btrim(p_headline),btrim(p_experience),btrim(p_education),btrim(p_certifications),btrim(p_registration))
 on conflict(business_id) do update set headline=excluded.headline,experience=excluded.experience,education=excluded.education,certifications=excluded.certifications,professional_registration=excluded.professional_registration;
$$;
revoke all on function public.save_business_presentation(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_business_presentation(uuid,text,text,text,text,text) to authenticated;
commit;
