-- Somente PostgreSQL descartável, após a arquitetura de publicação aberta.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-00000000b801','hours-owner@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000b802','hours-other@example.invalid',now()),
 ('00000000-0000-4000-8000-00000000b803','hours-admin@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-00000000b803');
select test.assert_true((select count(*)=0 from public.business_working_hours),'hours: expansion has no backfill');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b801';
select public.create_business('Hours self-employed fixture','hours-autonomo','autonomo','mundo-novo-ms') as bid \gset
select public.create_business('Hours company fixture','hours-empresa','empresa','guaira-pr') as company \gset
select public.save_business_working_hours(:'bid',true,'America/Campo_Grande','[[],[{"start":"08:00","end":"12:00"},{"start":"13:00","end":"18:00"}],[],[],[],[],[]]',true);
select updated_at as revision from public.business_working_hours where business_id=:'bid' \gset
select test.assert_true((select accepts_outside_hours and enabled from public.business_working_hours where business_id=:'bid'),'hours: owner saves draft schedule');
select public.save_business_working_hours(:'company',true,'America/Sao_Paulo','[[{"start":"22:00","end":"06:00"}],[],[],[],[],[],[]]',false);
select test.assert_true((select count(*)=2 from public.business_working_hours),'hours: company and autonomo supported independently');
select test.expect_error(format('select public.save_business_working_hours(%L,true,%L,%L,false)',:'bid','America/Sao_Paulo','[[],[{"start":"09:00","end":"17:00"}],[],[],[],[],[]]'),'40001','hours: stale tab cannot overwrite');
select test.assert_true((select timezone='America/Campo_Grande' from public.business_working_hours where business_id=:'bid'),'hours: conflict preserves prior record');
select test.expect_error(format('update public.business_working_hours set schedule=%L where business_id=%L','[[],[{"start":"08:00","end":"12:00"},{"start":"11:00","end":"18:00"}],[],[],[],[],[]]',:'bid'),'23514','hours: overlaps rejected');
select test.expect_error(format('update public.business_working_hours set schedule=%L where business_id=%L','[[{"start":"22:00","end":"06:00"}],[{"start":"05:00","end":"07:00"}],[],[],[],[],[]]',:'bid'),'23514','hours: overnight adjacent-day overlap rejected');
select test.expect_error(format('update public.business_working_hours set schedule=%L where business_id=%L','[[{"start":"05:00","end":"07:00"}],[],[],[],[],[],[{"start":"22:00","end":"06:00"}]]',:'bid'),'23514','hours: week wrap overlap rejected');
select test.expect_error(format('update public.business_working_hours set schedule=%L where business_id=%L','[[{"start":"25:00","end":"26:00"}],[],[],[],[],[],[]]',:'bid'),'23514','hours: invalid time rejected');
select test.expect_error(format('update public.business_working_hours set schedule=%L where business_id=%L','[[],[],[],[],[],[],[]]',:'bid'),'23514','hours: enabled schedule needs a day');
select test.expect_error(format('update public.business_working_hours set timezone=%L where business_id=%L','UTC',:'bid'),'23514','hours: unsupported timezone rejected');
select test.expect_error(format('update public.business_working_hours set business_id=%L where business_id=%L',:'company',:'bid'),'42501','hours: business pointer immutable');
select test.expect_error(format('update public.business_working_hours set updated_at=now() where business_id=%L',:'bid'),'42501','hours: timestamp cannot be forged');
select test.expect_error(format('delete from public.business_working_hours where business_id=%L',:'bid'),'42501','hours: direct deletion not granted');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=0 from public.business_working_hours),'hours: anonymous cannot read draft schedules');
select test.expect_error(format('select public.save_business_working_hours(%L,true,%L,%L,false)',:'bid','America/Campo_Grande','[[],[],[],[],[],[],[]]'),'42501','hours: anonymous RPC denied');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b802';
select test.assert_true((select count(*)=0 from public.business_working_hours),'hours: other account cannot read drafts');
select test.expect_error(format('select public.save_business_working_hours(%L,true,%L,%L,false)',:'bid','America/Campo_Grande','[[{"start":"08:00","end":"18:00"}],[],[],[],[],[],[]]'),'42501','hours: other account cannot write');
set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b803';
select test.assert_true((select count(*)=2 from public.business_working_hours),'hours: moderator can inspect');
select test.expect_error(format('select public.save_business_working_hours(%L,true,%L,%L,false)',:'bid','America/Campo_Grande','[[{"start":"08:00","end":"18:00"}],[],[],[],[],[],[]]'),'42501','hours: moderator cannot edit owner schedule');
reset role;
select test.assert_true((select bool_and(status='draft') from public.businesses where id in(:'bid',:'company')),'hours: saving never publishes business');
update public.businesses set description='Descrição sintética local',whatsapp='67999999999',category_id='climatizacao' where id=:'bid';
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b801';
select public.owner_business_command(:'bid','publish','draft');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=1 from public.business_working_hours),'hours: public sees only published business');
reset role;
insert into private.business_moderation(business_id,suspended) values(:'bid',true);
set local role anon;
select test.assert_true((select count(*)=0 from public.business_working_hours),'hours: suspension hides public hours');
reset role;
update private.business_moderation set suspended=false where business_id=:'bid';
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-00000000b801';
select updated_at as latest from public.business_working_hours where business_id=:'bid' \gset
select public.save_business_working_hours(:'bid',false,'America/Campo_Grande','[[],[{"start":"08:00","end":"12:00"},{"start":"13:00","end":"18:00"}],[],[],[],[],[]]',true,:'latest');
set local role anon;set local request.jwt.claim.sub='';
select test.assert_true((select count(*)=0 from public.business_working_hours),'hours: disabled schedule is not publicly exposed');
rollback;
