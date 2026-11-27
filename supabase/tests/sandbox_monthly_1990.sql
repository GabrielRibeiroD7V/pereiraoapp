begin;
select test.assert_true((select to_jsonb(p)=(select snapshot from test.price_legacy_payment_snapshot) from private.sandbox_payments p where payment_id='pay_legacy_price'),'price: legacy payment data and amount unchanged');
select test.assert_true((select to_jsonb(c)=(select snapshot from test.price_legacy_snapshot) from private.sandbox_contracts c where request_id='00000000-0000-4000-8000-000000008899'),'price: legacy consent and data unchanged');
insert into private.sandbox_backend_keys(key_digest) values(extensions.digest('PRICE-LOCAL-NOT-A-SECRET','sha256')) on conflict(id) do update set key_digest=excluded.key_digest;
create function test.price_call(cmd text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n uuid:=gen_random_uuid();t bigint:=extract(epoch from clock_timestamp())::bigint;s text;
begin
 s:=encode(extensions.hmac(convert_to(cmd||E'\n'||n::text||E'\n'||t::text||E'\n'||p::text,'UTF8'),extensions.digest('PRICE-LOCAL-NOT-A-SECRET','sha256'),'sha256'),'hex');
 return public.sandbox_billing_server(cmd,p::text,t,n,s);
end;$$;
grant execute on function test.price_call(text,jsonb) to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000008801';
select public.create_business('Preço novo local','price-new-local','autonomo','mundo-novo-ms') as biz \gset
select jsonb_build_object('userId','00000000-0000-4000-8000-000000008801','businessId',:'biz','requestId','00000000-0000-4000-8000-000000008898','accepted',true,'termsVersion','sandbox-v2-1990','amountCents',1990,'method','CREDIT_CARD') as consent \gset
select test.assert_true(test.price_call('reserve',:'consent')->'contract'->>'amount_cents'='1990','price: new consent uses 19.90');
select test.assert_true(test.price_call('reserve',:'consent')->>'claimed'='false','price: duplicate request reuses contract');
select test.expect_error(format('select test.price_call(''reserve'',%L::jsonb||''{"requestId":"00000000-0000-4000-8000-000000008897"}''::jsonb)',:'consent'),'23505','price: second request cannot duplicate business contract');
select test.expect_error(format('select test.price_call(''reserve'',%L::jsonb||''{"amountCents":1999,"termsVersion":"sandbox-v1"}''::jsonb)',:'consent'),'22023','price: old client cannot silently create 19.99');
select test.expect_error(format('select test.price_call(''reserve'',%L::jsonb||''{"accepted":false}''::jsonb)',:'consent'),'22023','price: explicit consent required');
select test.expect_error(format('select test.price_call(''reserve'',%L::jsonb||''{"userId":"00000000-0000-4000-8000-000000008802"}''::jsonb)',:'consent'),'42501','price: other account cannot contract');
select test.expect_error('select * from private.sandbox_contracts','42501','price: private contracts remain isolated');
select test.assert_true(jsonb_array_length(test.price_call('owner_overview',jsonb_build_object('businessId',:'biz','userId','00000000-0000-4000-8000-000000008801'))->'contracts')=1,'price: corrected owner overview preserved');
reset role;
select test.assert_true(not exists(select 1 from public.business_subscriptions) and not exists(select 1 from private.subscription_activations),'price: no real subscription or trial');
select test.assert_true(exists(select 1 from private.platform_access_policy where singleton and phase='initial_free'),'price: free phase unchanged');
select test.assert_true(position('sandbox_same_bytes' in pg_get_functiondef('private.sandbox_billing_server(text,text,bigint,uuid,text)'::regprocedure))>0,'price: HMAC validation retained');
rollback;
