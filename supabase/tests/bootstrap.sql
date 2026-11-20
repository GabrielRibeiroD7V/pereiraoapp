-- Simulação mínima da infraestrutura de Auth, APENAS no PostgreSQL temporário.
-- Não substitui GoTrue, PostgREST ou o serviço de envio de e-mail.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema test;
grant usage on schema test to anon, authenticated;
create function test.assert_true(condition boolean, label text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'ASSERT FAILED: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function test.expect_error(statement text, expected_state text, label text) returns void
language plpgsql security invoker as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_state then raise notice 'PASS: %', label; return; end if;
    raise;
  end;
  raise exception 'ASSERT FAILED (no error): %', label;
end;
$$;
grant execute on all functions in schema test to anon, authenticated;
