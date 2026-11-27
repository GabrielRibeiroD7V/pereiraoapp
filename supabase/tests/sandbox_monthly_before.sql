-- Fixtures exclusivamente no PostgreSQL descartável, antes da expansão.
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000008801','price-owner@example.invalid',now()),
('00000000-0000-4000-8000-000000008802','price-other@example.invalid',now());
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000008801';
select public.create_business('Preço legado local','price-legacy-local','autonomo','mundo-novo-ms') as legacy \gset
reset role;
insert into private.sandbox_contracts(request_id,business_id,user_id,method,amount_cents,consent_version,first_due_date,provider_cancelled,state)
values('00000000-0000-4000-8000-000000008899',:'legacy','00000000-0000-4000-8000-000000008801','CREDIT_CARD',1999,'sandbox-v1',current_date,true,'cancelled');
create table test.price_legacy_snapshot as select to_jsonb(c) as snapshot from private.sandbox_contracts c where request_id='00000000-0000-4000-8000-000000008899';
