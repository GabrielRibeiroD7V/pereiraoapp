begin;
set local lock_timeout='5s';
-- Expansão opcional, sem backfill ou alteração de negócios existentes.
create function private.valid_working_schedule(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare d integer; item jsonb; a integer; z integer; starts integer[]='{}'; ends integer[]='{}'; i integer; j integer; shift integer;
begin
 if value is null or jsonb_typeof(value)<>'array' or jsonb_array_length(value)<>7 then return false; end if;
 for d in 0..6 loop
  if jsonb_typeof(value->d)<>'array' or jsonb_array_length(value->d)>2 then return false; end if;
  for item in select * from jsonb_array_elements(value->d) loop
   if jsonb_typeof(item)<>'object' or (item-'start'-'end')<>'{}'::jsonb or
      jsonb_typeof(item->'start') is distinct from 'string' or jsonb_typeof(item->'end') is distinct from 'string' then return false; end if;
   if (item->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (item->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
   a:=split_part(item->>'start',':',1)::integer*60+split_part(item->>'start',':',2)::integer;
   z:=split_part(item->>'end',':',1)::integer*60+split_part(item->>'end',':',2)::integer;
   -- Horários iguais representam 24 horas; término anterior atravessa meia-noite.
   if z<=a then z:=z+1440; end if;
   starts:=array_append(starts,d*1440+a);ends:=array_append(ends,d*1440+z);
  end loop;
 end loop;
 if cardinality(starts)>0 then
  for i in 1..cardinality(starts) loop
   for j in 1..cardinality(starts) loop
    if i=j then continue; end if;
    foreach shift in array array[-10080,0,10080] loop
     if starts[i]<ends[j]+shift and starts[j]+shift<ends[i] then return false;end if;
    end loop;
   end loop;
  end loop;
 end if;
 return true;
end;$$;
revoke all on function private.valid_working_schedule(jsonb) from public,anon,authenticated;
grant execute on function private.valid_working_schedule(jsonb) to authenticated;

create table public.business_working_hours(
 business_id uuid primary key references public.businesses(id) on delete cascade,
 enabled boolean not null default false,
 timezone text not null check(timezone in ('America/Campo_Grande','America/Sao_Paulo')),
 schedule jsonb not null default '[[],[],[],[],[],[],[]]'::jsonb check(private.valid_working_schedule(schedule)),
 accepts_outside_hours boolean not null default false,
 updated_at timestamptz not null default clock_timestamp(),
 check(not enabled or schedule<>'[[],[],[],[],[],[],[]]'::jsonb)
);
alter table public.business_working_hours enable row level security;
revoke all on public.business_working_hours from public,anon,authenticated;
grant select on public.business_working_hours to anon,authenticated;
grant insert(business_id,enabled,timezone,schedule,accepts_outside_hours) on public.business_working_hours to authenticated;
grant update(enabled,timezone,schedule,accepts_outside_hours) on public.business_working_hours to authenticated;
create policy working_hours_public on public.business_working_hours for select to anon,authenticated
 using(enabled and private.business_is_public(business_id));
create policy working_hours_manage_read on public.business_working_hours for select to authenticated
 using(private.can_manage_business(business_id) or private.is_platform_admin());
create policy working_hours_insert on public.business_working_hours for insert to authenticated
 with check(private.can_manage_business(business_id));
create policy working_hours_update on public.business_working_hours for update to authenticated
 using(private.can_manage_business(business_id)) with check(private.can_manage_business(business_id));
create function private.touch_working_hours() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end;$$;
revoke all on function private.touch_working_hours() from public,anon,authenticated;
create trigger working_hours_timestamp before insert or update on public.business_working_hours for each row execute function private.touch_working_hours();
create function public.save_business_working_hours(target_business uuid,p_enabled boolean,p_timezone text,p_schedule jsonb,p_accepts_outside_hours boolean,p_expected_updated_at timestamptz default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.business_working_hours(business_id,enabled,timezone,schedule,accepts_outside_hours)
 values(target_business,p_enabled,p_timezone,p_schedule,p_accepts_outside_hours)
 on conflict(business_id) do update set enabled=excluded.enabled,timezone=excluded.timezone,schedule=excluded.schedule,accepts_outside_hours=excluded.accepts_outside_hours
 where public.business_working_hours.updated_at is not distinct from p_expected_updated_at;
 if not found then raise exception 'Working hours changed; reload before saving' using errcode='40001';end if;
end;$$;
revoke all on function public.save_business_working_hours(uuid,boolean,text,jsonb,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.save_business_working_hours(uuid,boolean,text,jsonb,boolean,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
