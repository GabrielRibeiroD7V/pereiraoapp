-- PROPOSTA: fase inicial gratuita. Não aplicar sem autorização específica.
-- Não encerra a fase, não inicia trials, não publica e não habilita cobrança.
begin;
set local lock_timeout = '5s';
-- Serializa com publicações em andamento. Uma publicação anterior ao lock gera
-- trial e faz o preflight transacional abortar, sem apagar ou reescrever nada.
lock table public.businesses in share row exclusive mode;
lock table public.business_subscriptions in share row exclusive mode;
do $$begin
 if (select md5(pg_get_functiondef(oid)) from pg_proc where oid='private.start_trial_on_activation()'::regprocedure) <> '7777fe5044800934484294fac8fa2978'
 or (select md5(pg_get_functiondef(oid)) from pg_proc where oid='private.subscription_snapshot(uuid,timestamptz)'::regprocedure) <> '03a606b6ecc56f815d20048bc56fcb97'
 then raise exception 'Reviewed function definitions changed: stop rollout' using errcode='55000'; end if;
 if exists(select 1 from public.business_subscriptions) or exists(select 1 from private.subscription_activations)
 then raise exception 'Existing subscription or activation: review preservation plan before rollout' using errcode='55000'; end if;
 if not exists(select 1 from private.subscription_settings where singleton and not checkout_enabled and not enforcement_enabled)
 then raise exception 'Financial protection mismatch' using errcode='55000'; end if;
end;$$;

create table private.platform_access_policy (
 singleton boolean primary key default true check(singleton),
 phase text not null default 'initial_free' check(phase='initial_free'),
 effective_at timestamptz not null default clock_timestamp()
);
insert into private.platform_access_policy(singleton) values(true);
alter table private.platform_access_policy enable row level security;
revoke all on private.platform_access_policy from public,anon,authenticated;

-- O gatilho continua instalado, mas não cria uma assinatura nem um relógio.
-- Não existe expiração, toggle acessível pelo cliente ou transição automática.
create or replace function private.start_trial_on_activation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.platform_access_policy where singleton and phase='initial_free')
 then raise exception 'Access policy unavailable; review required' using errcode='55000'; end if;
 return new;
end;$$;
revoke all on function private.start_trial_on_activation() from public,anon,authenticated;

-- Defesa adicional no banco: nenhum contrato/trial real pode ser criado ou
-- convertido durante a fase. As tabelas separadas do Sandbox não são alteradas.
create function private.reject_financial_write_during_free_phase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Initial free phase: financial writes disabled' using errcode='55000';
end;$$;
revoke all on function private.reject_financial_write_during_free_phase() from public,anon,authenticated;
create trigger initial_free_subscription_guard before insert or update on public.business_subscriptions
for each row execute function private.reject_financial_write_during_free_phase();

create function public.platform_access_status()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('phase',phase,'effectiveAt',effective_at,
 'trialClockRunning',false,'checkoutAvailable',false,'enforcementEnabled',false,
 'automaticConversion',false) from private.platform_access_policy where singleton;
$$;
revoke all on function public.platform_access_status() from public,anon,authenticated;
grant execute on function public.platform_access_status() to anon,authenticated;

create or replace function private.subscription_snapshot(target uuid,at_time timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('businessId',target,
 'state',case when private.is_billing_exempt_business(target) then 'exempt' else 'awaiting_activation' end,
 -- Mantém o enum entendido pela produção; a nova interface usa accessPhase.
 'accessPhase','initial_free','trialStartedAt',null,'trialEndsAt',null,'contractedAt',null,
 'billingPeriodStart',null,'billingPeriodEnd',null,'serverNow',at_time,
 'checkoutAvailable',false,'enforcementEnabled',false) from private.platform_access_policy where singleton and phase='initial_free';
$$;
revoke all on function private.subscription_snapshot(uuid,timestamptz) from public,anon,authenticated;
-- A aprovação permanece exclusivamente em admin_action, com todas as
-- verificações e auditoria originais. Não alterar status, isenções ou preços.
notify pgrst,'reload schema';
commit;
