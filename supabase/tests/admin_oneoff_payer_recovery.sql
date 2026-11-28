begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000007901','recovery-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000007902','recovery-other@example.invalid',now()),
('00000000-0000-4000-8000-000000007903','recovery-second-admin@example.invalid',now());
insert into private.platform_admins(user_id) values('00000000-0000-4000-8000-000000007901'),('00000000-0000-4000-8000-000000007903');
insert into private.sandbox_backend_keys(key_digest) values(extensions.digest('RECOVERY-LOCAL','sha256')) on conflict(id) do update set key_digest=excluded.key_digest;
create function test.recover_payer(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n uuid:=gen_random_uuid();t bigint:=extract(epoch from clock_timestamp())::bigint;s text;
begin
 s:=encode(extensions.hmac(convert_to('oneoff-v1'||E'\nrecover_payer_rejection\n'||n::text||E'\n'||t::text||E'\n'||p::text,'UTF8'),extensions.digest('RECOVERY-LOCAL','sha256'),'sha256'),'hex');
 return public.admin_oneoff_recover_payer_rejection(p::text,t,n,s);
end;$$;
grant execute on function test.recover_payer(jsonb) to anon,authenticated;
insert into private.admin_oneoff_requests(id,environment,method,actor_id,customer_id,state,diagnostic,created_at,consent_at,expires_at)
 values('dd279b98-de7c-4eeb-8253-fd95e2564bc4','sandbox','PIX','00000000-0000-4000-8000-000000007901','cus_000010060896','uncertain','creation_uncertain','2026-11-28 05:00:25.467633+00','2026-11-28 05:00:25.466981+00',now()-interval '1 hour');
insert into private.admin_oneoff_audit(environment,actor_id,request_id,action) values('sandbox','00000000-0000-4000-8000-000000007901','dd279b98-de7c-4eeb-8253-fd95e2564bc4','authorized'),('sandbox','00000000-0000-4000-8000-000000007901','dd279b98-de7c-4eeb-8253-fd95e2564bc4','creation_claimed');
insert into private.admin_oneoff_audit(environment,actor_id,request_id,action) values
('sandbox','00000000-0000-4000-8000-000000007901','dd279b98-de7c-4eeb-8253-fd95e2564bc4','name_rejection_recovered'),
('sandbox','00000000-0000-4000-8000-000000007901','dd279b98-de7c-4eeb-8253-fd95e2564bc4','creation_claimed');
select jsonb_build_object('environment','sandbox','actorId','00000000-0000-4000-8000-000000007901','requestId','dd279b98-de7c-4eeb-8253-fd95e2564bc4','confirmation','RECUPERAR REJEICAO SANDBOX SEM CRIAR','payerValidated',true,'payerCheckedAt',clock_timestamp(),'paymentsEmpty',true,'paymentsCheckedAt',clock_timestamp(),'evidence','{"source":"asaas_api_log","logId":"108278750","httpStatus":400,"code":"invalid_object","fields":["phone","address","addressNumber","postalCode","province","city"],"reference":"dd279b98-de7c-4eeb-8253-fd95e2564bc4"}'::jsonb) as proof \gset
set local role anon;
select test.expect_error($q$select public.admin_oneoff_recover_payer_rejection('{}',null,gen_random_uuid(),null)$q$,'42501','recovery: unsigned anon denied');
select test.expect_error('select * from private.admin_oneoff_requests','42501','recovery: no direct table access');
set local role authenticated;
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"actorId":"00000000-0000-4000-8000-000000007902"}''::jsonb)',:'proof'),'42501','recovery: ordinary user denied even with server proof');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"actorId":"00000000-0000-4000-8000-000000007903"}''::jsonb)',:'proof'),'42501','recovery: other administrator cannot recover consent');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"environment":"production"}''::jsonb)',:'proof'),'42501','recovery: Production denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"paymentsEmpty":false}''::jsonb)',:'proof'),'23514','recovery: existing payment denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"payerValidated":false}''::jsonb)',:'proof'),'23514','recovery: incomplete payer denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||jsonb_build_object(''payerCheckedAt'',now()-interval ''2 minutes''))',:'proof'),'23514','recovery: stale payer read denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||jsonb_build_object(''paymentsCheckedAt'',now()-interval ''2 minutes''))',:'proof'),'23514','recovery: stale query denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"evidence":{"httpStatus":504}}''::jsonb)',:'proof'),'23514','recovery: timeout is not definitive rejection');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"evidence":{"httpStatus":200}}''::jsonb)',:'proof'),'23514','recovery: ambiguous response denied');
select test.expect_error(format('select test.recover_payer(%L::jsonb||''{"evidence":{"httpStatus":400,"code":"other"}}''::jsonb)',:'proof'),'23514','recovery: other HTTP 400 denied');
reset role;
update private.admin_oneoff_policy set enabled_until=now()+interval '1 hour' where environment='sandbox';
select test.expect_error(format('select test.recover_payer(%L)',:'proof'),'55000','recovery: open windows denied');
update private.admin_oneoff_policy set enabled_until=null;
update private.admin_oneoff_requests set checkout_id='00000000-0000-4000-8000-000000007999' where id='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
select test.expect_error(format('select test.recover_payer(%L)',:'proof'),'23514','recovery: linked checkout denied');
update private.admin_oneoff_requests set checkout_id=null,lease_until=now()+interval '1 minute' where id='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
select test.expect_error(format('select test.recover_payer(%L)',:'proof'),'23514','recovery: in-flight reconciliation denied');
update private.admin_oneoff_requests set lease_until=null where id='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
insert into private.admin_oneoff_events(environment,event_id,request_id,notice,state) values('sandbox','evt_local_recovery','dd279b98-de7c-4eeb-8253-fd95e2564bc4','{}','pending');
select test.expect_error(format('select test.recover_payer(%L)',:'proof'),'23514','recovery: real notice would block recovery');
delete from private.admin_oneoff_events where event_id='evt_local_recovery'; -- isolated local fixture only
set local role authenticated;
select test.assert_true(test.recover_payer(:'proof')->>'state'='authorized','recovery: documented rejection recovers same request');
select test.assert_true(test.recover_payer(:'proof')->>'state'='authorized','recovery: repeat is idempotent');
reset role;
select test.assert_true((select count(*)=1 from private.admin_oneoff_audit where action='payer_rejection_recovered'),'recovery: exactly one recovery audit');
select test.assert_true((select count(*)=1 from private.admin_oneoff_requests),'recovery: no second request');
select test.assert_true((select consent_at='2026-11-28 05:00:25.466981+00'::timestamptz and created_at='2026-11-28 05:00:25.467633+00'::timestamptz and amount_cents=1990 and expires_at>now() and checkout_id is null and payment_id is null from private.admin_oneoff_requests),'recovery: original consent amount and identity preserved');
select test.assert_true((select count(*)=5 from private.admin_oneoff_audit where request_id='dd279b98-de7c-4eeb-8253-fd95e2564bc4'),'recovery: previous audit preserved');
update private.admin_oneoff_requests set state='uncertain' where id='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
select test.expect_error(format('select test.recover_payer(%L)',:'proof'),'23505','recovery: cannot recover second uncertain attempt');
select test.assert_true(not exists(select 1 from private.admin_oneoff_policy where enabled_until>now()),'recovery: windows remain closed');
select test.assert_true((select phase='initial_free' from private.platform_access_policy where singleton),'recovery: free phase preserved');
rollback;
