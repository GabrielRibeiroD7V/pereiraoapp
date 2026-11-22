-- A isenção é concedida a uma identidade privada específica, nunca a todo administrador.
-- O usuário isento é cadastrado separadamente no ambiente autorizado; sem e-mail/UUID em código público.
begin;

create table private.billing_exempt_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default clock_timestamp()
);
alter table private.billing_exempt_accounts enable row level security;
revoke all on private.billing_exempt_accounts from public, anon, authenticated;

create function private.is_billing_exempt_business(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    join private.billing_exempt_accounts e on e.user_id = m.user_id
    where m.business_id = target and m.role = 'owner'
      and not exists (
        select 1 from private.subscription_activations a
        where a.business_id = target and a.initial_owner_id <> m.user_id
      )
  );
$$;
revoke all on function private.is_billing_exempt_business(uuid) from public, anon, authenticated;

-- Nenhum contrato real pode ser criado para um negócio isento, inclusive por SQL interno.
create function private.reject_billing_for_exempt_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'trial' and private.is_billing_exempt_business(new.business_id) then
    raise exception 'Billing exempt business' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_billing_for_exempt_business() from public, anon, authenticated;
create trigger subscription_exempt_guard before insert or update on public.business_subscriptions
for each row execute function private.reject_billing_for_exempt_business();

-- Uma isenção não pode ocultar um contrato já existente. É preciso resolvê-lo antes.
create function private.reject_exemption_with_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.business_members m
    join public.business_subscriptions s on s.business_id = m.business_id
    where m.user_id = new.user_id and m.role = 'owner' and s.status <> 'trial'
      and not exists (
        select 1 from private.subscription_activations a
        where a.business_id = m.business_id and a.initial_owner_id <> new.user_id
      )
  ) then raise exception 'Existing subscription contract' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.reject_exemption_with_contract() from public, anon, authenticated;
create trigger exempt_account_contract_guard before insert on private.billing_exempt_accounts
for each row execute function private.reject_exemption_with_contract();

-- A reserva de Sandbox também é recusada no banco, antes de criar cliente no provedor.
create function private.reject_sandbox_for_exempt_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_billing_exempt_business(new.business_id) then
    raise exception 'Billing exempt business' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_sandbox_for_exempt_business() from public, anon, authenticated;
create trigger sandbox_exempt_guard before insert on private.sandbox_contracts
for each row execute function private.reject_sandbox_for_exempt_business();

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

notify pgrst, 'reload schema';
commit;
