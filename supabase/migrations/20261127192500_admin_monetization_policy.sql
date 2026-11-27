-- PROPOSTA. Não aplicar sem autorização específica. Nenhuma operação Asaas.
begin;
set local lock_timeout='5s';
create table private.monetization_policy (
 singleton boolean primary key default true check(singleton),
 monthly_cents integer not null default 1990 check(monthly_cents=1990),
 new_contracts_enabled boolean not null default false,
 contracting_ready boolean not null default false,
 revision integer not null default 0 check(revision>=0),
 updated_at timestamptz not null default clock_timestamp(),
 check(not new_contracts_enabled or contracting_ready)
);
insert into private.monetization_policy(singleton) values(true);
alter table private.monetization_policy enable row level security;
revoke all on private.monetization_policy from public,anon,authenticated;

create function public.admin_monetization_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 return (select jsonb_build_object(
 'monthlyCents',monthly_cents,'newContractsEnabled',new_contracts_enabled,
 'contractingReady',contracting_ready,'revision',revision,
 'initialFree',exists(select 1 from private.platform_access_policy where singleton and phase='initial_free'),
 'checkoutEnabled',false,'enforcementEnabled',false,'automaticConversion',false,
 'subscriptions',(select count(*) from public.business_subscriptions),
 'productionBindings',(select count(*) from private.production_billing_bindings),
 'pendingPayments',(select count(*) from private.production_billing_payments where status in ('PENDING','OVERDUE')),
 'sandboxContracts',(select count(*) from private.sandbox_contracts),
 'productionReconciledPayments',(select count(*) from private.production_billing_payments))
 from private.monetization_policy where singleton);
end;$$;
revoke all on function public.admin_monetization_status() from public,anon,authenticated;
grant execute on function public.admin_monetization_status() to authenticated;

-- Prepara a decisão de novas contratações. Não modifica contratos, isenções,
-- direitos de acesso, a fase gratuita, os provedores ou as flags financeiras.
-- Não há API para declarar prontidão. Essa etapa requer futura entrega revisada.
create function public.admin_set_new_contracts(enabled boolean,expected_revision integer,confirmation text,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.monetization_policy;
begin
 if not private.is_platform_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if enabled is null or expected_revision is null or confirmation is distinct from 'CONFIRMAR NOVAS CONTRATACOES'
 or reason is null or char_length(btrim(reason)) not between 5 and 500
 then raise exception 'Explicit confirmation required' using errcode='22023';end if;
 select * into strict p from private.monetization_policy where singleton for update;
 if p.revision<>expected_revision then raise exception 'Refresh policy before changing' using errcode='40001';end if;
 if enabled and (not p.contracting_ready or exists(select 1 from private.platform_access_policy where singleton and phase='initial_free'))
 then raise exception 'Free phase preserved; contracting not released' using errcode='55000';end if;
 if p.new_contracts_enabled is distinct from enabled then
  update private.monetization_policy set new_contracts_enabled=enabled,revision=revision+1,updated_at=clock_timestamp() where singleton;
  insert into private.admin_audit(actor_id,target_type,target_id,action,reason,before_state,after_state)
  values(auth.uid(),'platform','00000000-0000-4000-8000-000000001990','new_contracts_policy',btrim(reason),p.new_contracts_enabled::text,enabled::text);
 end if;
 return public.admin_monetization_status();
end;$$;
revoke all on function public.admin_set_new_contracts(boolean,integer,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_new_contracts(boolean,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
