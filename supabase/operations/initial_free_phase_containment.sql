-- PROPOSTA DE REVERSÃO, não executar automaticamente e não é migração de avanço.
-- Só antes de qualquer publicação nesta fase; depois disso, manter a fase gratuita
-- e preparar correção progressiva para não consumir direitos já prometidos.
begin;
set local lock_timeout='5s';
lock table public.businesses in share row exclusive mode;
lock table public.business_subscriptions in share row exclusive mode;
do $$begin
 if exists(select 1 from public.businesses where status in ('published','suspended'))
 or exists(select 1 from public.business_subscriptions)
 or exists(select 1 from private.subscription_activations)
 or exists(select 1 from private.admin_audit a where a.created_at >= (select effective_at from private.platform_access_policy where singleton) and a.action in ('publish','reactivate'))
 then raise exception 'Rollback unsafe after publication/activation: keep free safeguards and correct forward' using errcode='55000'; end if;
end;$$;
drop trigger initial_free_subscription_guard on public.business_subscriptions;
drop function private.reject_financial_write_during_free_phase();
drop function public.platform_access_status();
create or replace function private.start_trial_on_activation() returns trigger language plpgsql security definer set search_path='' as $$
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

create or replace function private.subscription_snapshot(target uuid, at_time timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'businessId', business_id,
      'state', case when private.is_billing_exempt_business(target) then 'exempt'
                    when status = 'trial' then case when at_time < trial_ends_at then 'trial_active' else 'trial_ended' end
                    else status end,
      'trialStartedAt', trial_started_at, 'trialEndsAt', trial_ends_at,
      'contractedAt', contracted_at, 'billingPeriodStart', billing_period_start,
      'billingPeriodEnd', billing_period_end, 'serverNow', at_time,
      'checkoutAvailable', false, 'enforcementEnabled', false
    ) from public.business_subscriptions where business_id = target
  ), jsonb_build_object(
    'businessId', target,
    'state', case when private.is_billing_exempt_business(target) then 'exempt' else 'awaiting_activation' end,
    'trialStartedAt', null, 'trialEndsAt', null, 'contractedAt', null,
    'billingPeriodStart', null, 'billingPeriodEnd', null, 'serverNow', at_time,
    'checkoutAvailable', false, 'enforcementEnabled', false
  ));
$$;
revoke all on function private.subscription_snapshot(uuid, timestamptz) from public, anon, authenticated;


-- Preserva a linha de política como registro técnico; não remove dados operacionais.
-- As funções antigas voltam a reger APENAS futuras publicações autorizadas.
notify pgrst,'reload schema';
commit;
