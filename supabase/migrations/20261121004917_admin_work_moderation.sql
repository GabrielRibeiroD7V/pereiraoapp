-- PROPOSTA. Aplicar somente após work_posts e platform_admin, com autorização específica.
begin;
alter table private.post_moderation add constraint post_moderation_post_fkey foreign key(post_id) references public.work_posts(id) on delete cascade;
create function private.guard_moderated_post() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and exists(select 1 from private.post_moderation where post_id=new.id and blocked) then
   raise exception 'Post blocked by moderation' using errcode='42501';
 end if; return new;
end;$$;
revoke all on function private.guard_moderated_post() from public,anon,authenticated;
create trigger work_posts_moderation_guard before update of status on public.work_posts for each row execute function private.guard_moderated_post();
notify pgrst,'reload schema';
commit;
