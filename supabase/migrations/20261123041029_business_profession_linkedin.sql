-- PROPOSTA: não aplicar no remoto sem autorização específica.
begin;
set local lock_timeout = '5s';
alter table public.business_presentations
 add column profession text not null default '' check(char_length(profession)<=100),
 add column linkedin_url text not null default '' check(char_length(linkedin_url)<=300 and
   (linkedin_url='' or linkedin_url ~ '^https://(www[.])?linkedin[.]com/(in|company)/[A-Za-z0-9_-]+/?$'));
grant update(profession,linkedin_url) on public.business_presentations to authenticated;
-- SECURITY INVOKER: existing owner/admin-business RLS remains authoritative.
-- Legacy RPC remains unchanged and cannot erase these new fields.
create function public.save_business_presentation_identity(target_business uuid, p_profession text, p_linkedin_url text,
 p_headline text, p_experience text, p_education text, p_certifications text, p_registration text)
returns void language sql security invoker set search_path='' as $$
 insert into public.business_presentations(business_id,profession,linkedin_url,headline,experience,education,certifications,professional_registration)
 values(target_business,btrim(p_profession),btrim(p_linkedin_url),btrim(p_headline),btrim(p_experience),btrim(p_education),btrim(p_certifications),btrim(p_registration))
 on conflict(business_id) do update set profession=excluded.profession,linkedin_url=excluded.linkedin_url,
 headline=excluded.headline,experience=excluded.experience,education=excluded.education,certifications=excluded.certifications,professional_registration=excluded.professional_registration;
$$;
revoke all on function public.save_business_presentation_identity(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_business_presentation_identity(uuid,text,text,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
