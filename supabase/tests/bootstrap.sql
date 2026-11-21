-- Simulação mínima da infraestrutura de Auth, APENAS no PostgreSQL temporário.
-- Não substitui GoTrue, PostgREST ou o serviço de envio de e-mail.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}', email text, created_at timestamptz not null default now(), email_confirmed_at timestamptz);
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

-- Somente schema/RLS para ensaio SQL; não simula o servidor HTTP/S3 do Storage.
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;
