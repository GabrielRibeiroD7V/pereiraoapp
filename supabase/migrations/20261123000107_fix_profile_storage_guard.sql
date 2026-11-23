begin;
set local lock_timeout='5s';
-- Storage validates caller RLS, then persists as its internal service role.
-- A SECURITY DEFINER trigger cannot assume the caller JWT survives that phase.
create or replace function private.guard_profile_image_object() returns trigger
language plpgsql security definer set search_path='' as $$
declare item public.business_profile_images; uploader text; effective_role text;
begin
 if new.bucket_id<>'business-profile' then return new; end if;
 select * into item from public.business_profile_images where storage_path=new.name for key share;
 if not found or item.media_state<>'pending' then raise exception 'Pending profile metadata required' using errcode='23503'; end if;
 if auth.uid() is not null then
   if not private.can_manage_business(item.business_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 else
   effective_role:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
   if session_user::text<>'supabase_storage_admin' or effective_role not in ('service_role','supabase_storage_admin') then
     raise exception 'Not authorized' using errcode='42501';
   end if;
   -- owner_id is set by Storage from the authenticated upload's subject.
   -- Read through JSON to remain compatible with older owner-column layouts.
   uploader:=coalesce(nullif(to_jsonb(new)->>'owner_id',''),nullif(to_jsonb(new)->>'owner',''));
   if uploader is null or uploader !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
     raise exception 'Upload owner required' using errcode='42501';
   end if;
   if not private.account_enabled(uploader::uuid)
      or exists(select 1 from private.business_moderation where business_id=item.business_id and suspended)
      or not exists(select 1 from public.business_members where business_id=item.business_id and user_id=uploader::uuid and role in ('owner','admin')) then
     raise exception 'Not authorized' using errcode='42501';
   end if;
 end if;
 return new;
end;$$;
revoke all on function private.guard_profile_image_object() from public,anon,authenticated;
commit;
