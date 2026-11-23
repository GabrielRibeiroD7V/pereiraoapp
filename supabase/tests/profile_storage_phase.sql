-- Isolated PostgreSQL only: reproduces caller probe and internal Storage write.
begin;
create role supabase_storage_admin nologin;
create role service_role nologin bypassrls;
grant service_role to supabase_storage_admin;
grant usage on schema storage,test to service_role;
grant execute on all functions in schema test to service_role;
grant insert,select on storage.objects to service_role;
insert into auth.users(id) values('00000000-0000-4000-8000-000000009001'),('00000000-0000-4000-8000-000000009002');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009001';
select public.create_business('Storage phase local','storage-phase-local','autonomo','mundo-novo-ms') as bid \gset
select public.profile_photo_command('prepare',:'bid','00000000-0000-4000-8000-000000009101');
reset role;
-- Service persistence does not carry the user's JWT. The original guard fails.
set session authorization supabase_storage_admin;
set local role service_role;
set local request.jwt.claim.sub='';
\if :guard_fixed
insert into storage.objects(bucket_id,name,owner_id,metadata) values('business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009101.webp','00000000-0000-4000-8000-000000009001','{"mimetype":"image/webp","size":1024}');
select test.assert_true((select count(*)=1 from storage.objects where bucket_id='business-profile'),'internal Storage role persists valid owner upload without JWT');
\else
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009101.webp','00000000-0000-4000-8000-000000009001','{"mimetype":"image/webp","size":1024}'),'42501','reproduced original internal phase rejection');
\endif
reset session authorization;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009001';
\if :guard_fixed
select public.profile_photo_command('finalize',:'bid','00000000-0000-4000-8000-000000009101');
select test.assert_true((select profile_avatar_path is not null from public.businesses where id=:'bid'),'normal caller finalizes internal Storage upload');
\endif
select public.profile_photo_command('prepare',:'bid','00000000-0000-4000-8000-000000009102',case when :'guard_fixed'::boolean then :'bid'||'/profile/00000000-0000-4000-8000-000000009101.webp' else null end);
reset role;
set session authorization supabase_storage_admin;
set local role service_role;
set local request.jwt.claim.sub='';
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009102.webp','00000000-0000-4000-8000-000000009002','{}'),'42501','internal phase still rejects owner from another business');
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009102.webp',null,'{}'),'42501','internal phase rejects missing owner');
reset session authorization;
-- A non-Storage login cannot use service_role as an escape hatch in the trigger.
set local role service_role;
set local request.jwt.claim.sub='';
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009102.webp','00000000-0000-4000-8000-000000009001','{}'),'42501','service role without Storage session is rejected');
reset role;
set session authorization supabase_storage_admin;
set local role authenticated;
set local request.jwt.claim.sub='';
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009102.webp','00000000-0000-4000-8000-000000009001','{}'),'42501','caller probe without user cannot borrow internal phase');
reset session authorization;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000009002';
select test.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','business-profile',:'bid'||'/profile/00000000-0000-4000-8000-000000009102.webp','00000000-0000-4000-8000-000000009001','{}'),'42501','normal caller cannot impersonate authorized object owner');
reset role;
rollback;
