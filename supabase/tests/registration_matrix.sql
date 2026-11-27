-- Banco nativo descartável. Auth simulada via claims; não comprova novo login GoTrue.
begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-00000000c999','matrix-other@example.invalid',now());
insert into public.categories(id,name,active) values('matrix-inactive','Inativa local',false);
do $$
declare c record; provider_type text; owner_id uuid; b uuid; extra text; snapshot_subscriptions bigint; snapshot_activations bigint; cases integer:=0;
begin
 select count(*) into snapshot_activations from private.subscription_activations;
 select count(*) into snapshot_subscriptions from public.business_subscriptions;
 foreach provider_type in array array['autonomo','empresa'] loop
  for c in select id from public.categories where active order by id loop
   owner_id:=gen_random_uuid();
   insert into auth.users(id,email,email_confirmed_at) values(owner_id,owner_id::text||'@example.invalid',now());
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   execute 'set local role authenticated';
   b:=public.create_business('Matriz local '||c.id,'matrix-'||owner_id,provider_type,'mundo-novo-ms');
   extra:=case when c.id='eletrica' then 'pintura' else 'eletrica' end;
   perform public.set_business_specialties(b,c.id,array[extra],null,'{}');
   update public.businesses set description='Descrição exclusivamente local',whatsapp='5567999999999',instagram='fixture_local' where id=b;
   if provider_type='empresa' then insert into public.business_details(business_id,legal_name,tax_id) values(b,'Empresa exclusivamente local','12345678000199');end if;
   perform test.assert_true((select category_id=c.id and type=provider_type and status='draft' from public.businesses where id=b),'matrix create/save '||provider_type||'/'||c.id);
   perform test.assert_true((select count(*)=1 from public.business_service_areas where business_id=b and city_id='mundo-novo-ms'),'matrix service area persisted');
   -- Outra conta não lê o rascunho e não escreve por RPC nem UPDATE.
   perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000c999',true);
   perform test.assert_true((select count(*)=0 from public.businesses where id=b),'matrix other cannot read draft');
   perform test.expect_error(format('select public.set_business_specialties(%L,%L,%L,null,null)',b,c.id,'{}'),'42501','matrix other RPC rejected');
   update public.businesses set name='ATAQUE LOCAL' where id=b;
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform test.assert_true((select category_id=c.id and name<>'ATAQUE LOCAL' and description='Descrição exclusivamente local' from public.businesses where id=b),'matrix owner claim restored and persisted');
   -- Edição e remoção/inclusão de especialidades preservam comparação de estado.
   perform public.set_business_specialties(b,extra,array[c.id],c.id,array[extra]);
   perform test.assert_true((select category_id=extra from public.businesses where id=b),'matrix edit primary');
   perform public.set_business_specialties(b,c.id,'{}',extra,array[c.id]);
   perform test.assert_true((select count(*)=0 from public.business_categories where business_id=b),'matrix remove additional');
   perform public.set_business_specialties(b,c.id,array[extra],c.id,'{}');
   perform test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',b,c.id,array[extra,extra],c.id,array[extra]),'23505','matrix duplicates rejected');
   perform test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',b,c.id,array[c.id],c.id,array[extra]),'23514','matrix primary as additional rejected');
   perform test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',b,'unknown','{}',c.id,array[extra]),'23514','matrix unknown rejected');
   perform test.expect_error(format('select public.set_business_specialties(%L,%L,%L,%L,%L)',b,'matrix-inactive','{}',c.id,array[extra]),'23514','matrix inactive rejected');
   execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
   perform test.assert_true(not exists(select 1 from jsonb_array_elements(public.search_unified('','mundo-novo-ms',c.id,'provider')) e where e->>'id'=b::text),'matrix draft excluded from search');
   execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform public.owner_business_command(b,'publish','draft');
   execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
   perform test.assert_true(exists(select 1 from public.businesses where id=b),'matrix public profile readable');
   perform test.assert_true(exists(select 1 from jsonb_array_elements(public.search_unified('','mundo-novo-ms',c.id,'provider')) e where e->>'id'=b::text),'matrix primary searchable');
   perform test.assert_true(exists(select 1 from jsonb_array_elements(public.search_unified('','mundo-novo-ms',extra,'provider')) e where e->>'id'=b::text),'matrix additional searchable');
   execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform public.owner_business_command(b,'unpublish','published');
   execute 'reset role';
   cases:=cases+1;
  end loop;
 end loop;
 perform test.assert_true((select count(*)=snapshot_activations from private.subscription_activations),'matrix no activation clock created');
 perform test.assert_true(cases=32,'matrix exactly 16 categories x 2 provider types');
 perform test.assert_true((select count(*)=snapshot_subscriptions from public.business_subscriptions),'matrix no subscription or trial created');
end;$$;
rollback;
