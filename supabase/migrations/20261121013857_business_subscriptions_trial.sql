-- PROPOSTA para revisão. Requer platform_admin; não aplicar remotamente sem autorização.
begin;
create table private.professional_plans(code text primary key check(code='professional'),name text not null);
insert into private.professional_plans values('professional','Plano profissional');
create table private.plan_price_versions(id uuid primary key default gen_random_uuid(),plan_code text not null references private.professional_plans(code),reference_amount_cents integer not null check(reference_amount_cents>=0),currency text not null default 'BRL' check(currency='BRL'),cycle text not null default 'monthly' check(cycle='monthly'),approved_for_checkout boolean not null default false check(not approved_for_checkout),created_at timestamptz not null default now());
insert into private.plan_price_versions(plan_code,reference_amount_cents) values('professional',1999);
create table private.subscription_settings(singleton boolean primary key default true check(singleton),extensions_enabled boolean not null default false,enforcement_enabled boolean not null default false check(not enforcement_enabled),checkout_enabled boolean not null default false check(not checkout_enabled),max_extension_days integer not null default 90 check(max_extension_days between 1 and 365),max_total_extension_days integer not null default 365 check(max_total_extension_days between 1 and 730));
insert into private.subscription_settings(singleton) values(true);
create table public.business_subscriptions(
 business_id uuid primary key references public.businesses(id) on delete restrict,
 plan_code text not null default 'professional' references private.professional_plans(code),
 status text not null default 'trial' check(status in ('trial','active','pending_payment','cancelled')),
 trial_started_at timestamptz not null,
 trial_original_ends_at timestamptz not null,
 trial_ends_at timestamptz not null,
 contracted_at timestamptz,
 price_version_id uuid references private.plan_price_versions(id),
 contracted_price_cents integer check(contracted_price_cents>=0),
 billing_cycle text check(billing_cycle='monthly'),
 billing_period_start timestamptz,billing_period_end timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(trial_original_ends_at=trial_started_at+interval '2160 hours'),
 check(trial_ends_at>=trial_original_ends_at and isfinite(trial_started_at) and isfinite(trial_ends_at)),
 check((contracted_at is null and price_version_id is null and contracted_price_cents is null and billing_cycle is null and billing_period_start is null and billing_period_end is null and status='trial') or
 (contracted_at is not null and isfinite(contracted_at) and price_version_id is not null and contracted_price_cents is not null and billing_cycle is not null and billing_cycle='monthly' and status<>'trial')),
 check((billing_period_start is null and billing_period_end is null) or (billing_period_start is not null and billing_period_end is not null and billing_period_end>billing_period_start))
);
create index subscriptions_status_end_idx on public.business_subscriptions(status,trial_ends_at,business_id);
create table private.subscription_activations(business_id uuid primary key references public.business_subscriptions(business_id) on delete restrict,initial_owner_id uuid not null references auth.users(id) on delete restrict,activated_by uuid not null references auth.users(id) on delete restrict,activated_at timestamptz not null);
create index subscription_initial_owner_idx on private.subscription_activations(initial_owner_id,business_id);
create table private.subscription_history(operation_id uuid primary key,business_id uuid not null references public.business_subscriptions(business_id) on delete restrict,action text not null check(action in ('trial_started','trial_extended','subscription_updated')),actor_id uuid references auth.users(id) on delete restrict,reason text not null check(char_length(btrim(reason)) between 5 and 500),change_days integer,previous_ends_at timestamptz,new_ends_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),before_status text,after_status text,billing_period_start timestamptz,billing_period_end timestamptz);
create index subscription_history_business_idx on private.subscription_history(business_id,created_at desc,operation_id desc);
create table private.subscription_provider_links(business_id uuid primary key references public.business_subscriptions(business_id) on delete restrict,environment text not null default 'sandbox' check(environment='sandbox'),asaas_customer_id text,asaas_subscription_id text,unique(environment,asaas_subscription_id));
-- Inbox futura: apenas identificadores mínimos. Nenhum payload bruto, cartão ou CPF.
create table private.billing_event_inbox(event_id text primary key,environment text not null default 'sandbox' check(environment='sandbox'),event_type text not null,provider_object_id text not null,received_at timestamptz not null default clock_timestamp(),processed_at timestamptz,state text not null default 'pending' check(state in ('pending','processed','ignored','reconcile_required')),attempts integer not null default 0 check(attempts>=0),diagnostic_code text);
alter table public.business_subscriptions enable row level security;
alter table private.professional_plans enable row level security;
alter table private.plan_price_versions enable row level security;
alter table private.subscription_settings enable row level security;
alter table private.subscription_activations enable row level security;
alter table private.subscription_history enable row level security;
alter table private.subscription_provider_links enable row level security;
alter table private.billing_event_inbox enable row level security;
revoke all on public.business_subscriptions,private.professional_plans,private.plan_price_versions,private.subscription_settings,private.subscription_activations,private.subscription_history,private.subscription_provider_links,private.billing_event_inbox from public,anon,authenticated;
grant select on public.business_subscriptions to authenticated;

create function private.can_read_subscription(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.business_members where business_id=target and user_id=(select auth.uid()) and role in ('owner','admin'));
$$;
revoke all on function private.can_read_subscription(uuid) from public,anon,authenticated;
grant execute on function private.can_read_subscription(uuid) to authenticated;
create policy subscriptions_own on public.business_subscriptions for select to authenticated using(private.can_read_subscription(business_id));
create function private.guard_subscription_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.business_id<>old.business_id or new.plan_code<>old.plan_code or new.trial_started_at<>old.trial_started_at or new.trial_original_ends_at<>old.trial_original_ends_at then raise exception 'Subscription anchor is immutable' using errcode='23514'; end if;
 if old.contracted_at is not null and (new.contracted_at is distinct from old.contracted_at or new.price_version_id is distinct from old.price_version_id or new.contracted_price_cents is distinct from old.contracted_price_cents or new.billing_cycle is distinct from old.billing_cycle) then raise exception 'Contract snapshot is immutable' using errcode='23514'; end if;
 if old.contracted_at is null and new.contracted_at is not null and not exists(select 1 from private.plan_price_versions p where p.id=new.price_version_id and p.plan_code=new.plan_code and p.reference_amount_cents=new.contracted_price_cents and p.cycle=new.billing_cycle) then raise exception 'Contract price version mismatch' using errcode='23514';end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function private.guard_subscription_identity() from public,anon,authenticated;
create trigger subscription_identity_guard before update on public.business_subscriptions for each row execute function private.guard_subscription_identity();

create function private.start_trial_on_activation() returns trigger language plpgsql security definer set search_path='' as $$
declare started timestamptz; deadline timestamptz; owner_id uuid; inserted uuid;
begin
 if new.status<>'published' or old.status='published' or not private.is_platform_admin() then return new; end if;
 if new.category_id is null or new.whatsapp is null or char_length(btrim(coalesce(new.description,'')))<2
 or not exists(select 1 from public.cities where id=new.city_id and active)
 or not exists(select 1 from public.categories where id=new.category_id and active)
 or not exists(select 1 from public.business_service_areas where business_id=new.id) then raise exception 'Invalid activation for trial' using errcode='23514';end if;
 select user_id into owner_id from public.business_members where business_id=new.id and role='owner' and private.account_enabled(user_id);
 if owner_id is null then raise exception 'Owner unavailable' using errcode='23514';end if;
 started:=clock_timestamp();deadline:=started+interval '2160 hours';
 insert into public.business_subscriptions(business_id,trial_started_at,trial_original_ends_at,trial_ends_at) values(new.id,started,deadline,deadline) on conflict(business_id) do nothing returning business_id into inserted;
 if inserted is not null then
  insert into private.subscription_activations values(new.id,owner_id,auth.uid(),started);
  insert into private.subscription_history(operation_id,business_id,action,actor_id,reason,new_ends_at) values(gen_random_uuid(),new.id,'trial_started',auth.uid(),'Primeira ativação administrativa válida',deadline);
 end if;
 return new;
end;$$;
revoke all on function private.start_trial_on_activation() from public,anon,authenticated;
create trigger business_first_activation_trial after update of status on public.businesses for each row execute function private.start_trial_on_activation();

create function private.subscription_snapshot(target uuid,at_time timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('businessId',business_id,'state',case when status='trial' then case when at_time<trial_ends_at then 'trial_active' else 'trial_ended' end else status end,
 'trialStartedAt',trial_started_at,'trialEndsAt',trial_ends_at,'contractedAt',contracted_at,'billingPeriodStart',billing_period_start,'billingPeriodEnd',billing_period_end,
 'serverNow',at_time,'checkoutAvailable',false,'enforcementEnabled',false) from public.business_subscriptions where business_id=target),
 jsonb_build_object('businessId',target,'state','awaiting_activation','trialStartedAt',null,'trialEndsAt',null,'contractedAt',null,'billingPeriodStart',null,'billingPeriodEnd',null,'serverNow',at_time,'checkoutAvailable',false,'enforcementEnabled',false));
$$;
revoke all on function private.subscription_snapshot(uuid,timestamptz) from public,anon,authenticated;
create function private.my_subscriptions(target_business uuid default null,page_number integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if page_number is null or page_number not between 1 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
 if target_business is not null and not private.can_read_subscription(target_business) then raise exception 'Not authorized' using errcode='42501';end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('businessName',x.name)||private.subscription_snapshot(x.id,now()) order by x.name,x.id),'[]'),'hasNext',count(*)>20) into result
 from(select b.id,b.name from public.businesses b join public.business_members m on m.business_id=b.id where m.user_id=auth.uid() and m.role in ('owner','admin') and(target_business is null or b.id=target_business) order by b.name,b.id limit 21 offset (page_number-1)*20)x;
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'items') with ordinality e(v,n) where n<=20),'[]'));
end;$$;
revoke all on function private.my_subscriptions(uuid,integer) from public,anon,authenticated;
grant execute on function private.my_subscriptions(uuid,integer) to authenticated;
create function public.my_subscriptions(target_business uuid default null,page_number integer default 1) returns jsonb language sql stable security invoker set search_path='' as $$select private.my_subscriptions(target_business,page_number);$$;
revoke all on function public.my_subscriptions(uuid,integer) from public,anon,authenticated;
grant execute on function public.my_subscriptions(uuid,integer) to authenticated;

create function private.admin_subscription_overview(filters jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q text:=left(coalesce(filters->>'q',''),80);st text:=coalesce(filters->>'status','');page_no integer:=coalesce((filters->>'page')::integer,1);result jsonb;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if page_no not between 1 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x) order by x."trialEndsAt" nulls last,x."businessId"),'[]'),'hasNext',count(*)>20) into result from(
 select b.id as "businessId",b.name as "businessName",private.subscription_snapshot(b.id,now())->>'state' as state,s.trial_started_at as "trialStartedAt",s.trial_ends_at as "trialEndsAt",
 (select count(*) from private.subscription_activations a2 where a2.initial_owner_id=a.initial_owner_id) as "sameOwnerActivations"
 from public.businesses b left join public.business_subscriptions s on s.business_id=b.id left join private.subscription_activations a on a.business_id=b.id
 where(q='' or position(lower(q) in lower(b.name))>0) and(st='' or private.subscription_snapshot(b.id,now())->>'state'=st)
 order by s.trial_ends_at nulls last,b.id limit 21 offset (page_no-1)*20)x;
 result:=jsonb_set(result,'{items}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'items') with ordinality e(v,n) where n<=20),'[]'));
 return result||jsonb_build_object('summary',jsonb_build_object('trialActive',(select count(*) from public.business_subscriptions where status='trial' and trial_ends_at>now()),'trialEnded',(select count(*) from public.business_subscriptions where status='trial' and trial_ends_at<=now()),'active',(select count(*) from public.business_subscriptions where status='active'),'cancelled',(select count(*) from public.business_subscriptions where status='cancelled'),'pendingPayment',(select count(*) from public.business_subscriptions where status='pending_payment'),'confirmedRevenueCents',null,'revenueAvailable',false),
 'extensionsEnabled',(select extensions_enabled from private.subscription_settings),'enforcementEnabled',false,'checkoutAvailable',false);
end;$$;
revoke all on function private.admin_subscription_overview(jsonb) from public,anon,authenticated;
grant execute on function private.admin_subscription_overview(jsonb) to authenticated;
create function public.admin_subscription_overview(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_subscription_overview(filters);$$;
revoke all on function public.admin_subscription_overview(jsonb) from public,anon,authenticated;
grant execute on function public.admin_subscription_overview(jsonb) to authenticated;

-- Controle futuro, fechado por padrão. Nenhuma UI oferece extensão sem habilitação revisada.
create function private.admin_extend_trial(target_business uuid,operation_id uuid,days integer,reason text,expected_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg private.subscription_settings;s public.business_subscriptions;prior private.subscription_history;deadline timestamptz;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 select * into cfg from private.subscription_settings;
 if not cfg.extensions_enabled then raise exception 'Extensions not activated' using errcode='55000';end if;
 if operation_id is null or days is null or days not between 1 and cfg.max_extension_days or reason is null or char_length(btrim(reason)) not between 5 and 500 then raise exception 'Invalid extension' using errcode='22023';end if;
 perform 1 from public.businesses where id=target_business for update;
 select * into s from public.business_subscriptions where business_id=target_business for update;
 if not found then raise exception 'Not found' using errcode='P0002';end if;
 select * into prior from private.subscription_history h where h.operation_id=admin_extend_trial.operation_id;
 if found then
  if prior.business_id<>target_business or prior.actor_id<>auth.uid() or prior.action<>'trial_extended' or prior.change_days<>days or prior.reason<>btrim(reason) then raise exception 'Operation mismatch' using errcode='23505';end if;
  return jsonb_build_object('businessId',target_business,'trialEndsAt',prior.new_ends_at,'replayed',true);
 end if;
 if s.status<>'trial' then raise exception 'Not a trial' using errcode='23514';end if;
 if expected_end is distinct from s.trial_ends_at then raise exception 'State changed' using errcode='40001';end if;
 deadline:=s.trial_ends_at+make_interval(hours=>days*24);
 if deadline>s.trial_original_ends_at+make_interval(hours=>cfg.max_total_extension_days*24) then raise exception 'Extension cap' using errcode='23514';end if;
 update public.business_subscriptions set trial_ends_at=deadline where business_id=target_business;
 insert into private.subscription_history(operation_id,business_id,action,actor_id,reason,change_days,previous_ends_at,new_ends_at) values(operation_id,target_business,'trial_extended',auth.uid(),btrim(reason),days,s.trial_ends_at,deadline);
 insert into private.admin_audit(actor_id,target_type,target_id,action,reason,before_state,after_state) values(auth.uid(),'business',target_business,'trial_extended',btrim(reason),s.trial_ends_at::text,deadline::text);
 return jsonb_build_object('businessId',target_business,'trialEndsAt',deadline,'replayed',false);
end;$$;
revoke all on function private.admin_extend_trial(uuid,uuid,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function private.admin_extend_trial(uuid,uuid,integer,text,timestamptz) to authenticated;
create function public.admin_extend_trial(target_business uuid,operation_id uuid,days integer,reason text,expected_end timestamptz) returns jsonb language sql security invoker set search_path='' as $$select private.admin_extend_trial(target_business,operation_id,days,reason,expected_end);$$;
revoke all on function public.admin_extend_trial(uuid,uuid,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_extend_trial(uuid,uuid,integer,text,timestamptz) to authenticated;
create function private.audit_subscription_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status or new.contracted_at is distinct from old.contracted_at or new.billing_period_start is distinct from old.billing_period_start or new.billing_period_end is distinct from old.billing_period_end then
 insert into private.subscription_history(operation_id,business_id,action,actor_id,reason,new_ends_at,before_status,after_status,billing_period_start,billing_period_end)
 values(gen_random_uuid(),new.business_id,'subscription_updated',auth.uid(),'Atualização interna de estado ou período',new.trial_ends_at,old.status,new.status,new.billing_period_start,new.billing_period_end);
 end if;return new;
end;$$;
revoke all on function private.audit_subscription_update() from public,anon,authenticated;
create trigger subscription_update_history after update on public.business_subscriptions for each row execute function private.audit_subscription_update();
create function private.immutable_price_version() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Insert a new price version' using errcode='23514';end;$$;
revoke all on function private.immutable_price_version() from public,anon,authenticated;
create trigger price_version_immutable before update or delete on private.plan_price_versions for each row execute function private.immutable_price_version();
notify pgrst,'reload schema';
commit;
