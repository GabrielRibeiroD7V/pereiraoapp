-- APENAS no cluster PostgreSQL descartável: não representa entrega WebSocket ou Push.
create role service_role nologin;
create schema realtime;
create table realtime.messages(id uuid default gen_random_uuid(), extension text, topic text, payload jsonb);
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$
 select current_setting('realtime.topic',true);
$$;
create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void
 language sql as $$insert into realtime.messages(extension,topic,payload) values('broadcast',topic,payload);$$;
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create schema net;
create function net.http_post(url text,headers jsonb,body jsonb) returns bigint language sql as $$select 0::bigint;$$;
