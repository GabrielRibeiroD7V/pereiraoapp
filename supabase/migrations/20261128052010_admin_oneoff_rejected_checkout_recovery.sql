-- PROPOSTA: recuperação única da rejeição definitiva documentada no log Asaas
-- Sandbox 108269826. Não altera registros ao aplicar; nenhuma criação financeira.
begin;
set local lock_timeout='5s';
create unique index admin_oneoff_name_recovery_once on private.admin_oneoff_audit(request_id)
 where action='name_rejection_recovered';
create function public.admin_oneoff_recover_name_rejection(raw_payload text,issued_at bigint,nonce uuid,signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;k bytea;actor uuid;rid uuid;r private.admin_oneoff_requests;before_row jsonb;
begin
 if raw_payload is null or issued_at is null or nonce is null or signature is null or octet_length(raw_payload)>4096 or abs(extract(epoch from clock_timestamp())-issued_at)>120 or signature !~ '^[0-9a-f]{64}$' then raise exception 'Invalid proof' using errcode='42501';end if;
 p:=raw_payload::jsonb;
 if jsonb_typeof(p)<>'object' or p->>'environment' is distinct from 'sandbox' then raise exception 'Sandbox only' using errcode='42501';end if;
 select key_digest into k from private.sandbox_backend_keys where id;
 if k is null or not private.sandbox_same_bytes(extensions.hmac(convert_to('oneoff-v1'||E'\nrecover_name_rejection\n'||nonce::text||E'\n'||issued_at::text||E'\n'||raw_payload,'UTF8'),k,'sha256'),decode(signature,'hex')) then raise exception 'Invalid server proof' using errcode='42501';end if;
 insert into private.admin_oneoff_nonces(environment,id) values('sandbox',nonce);
 actor:=(p->>'actorId')::uuid;rid:=(p->>'requestId')::uuid;
 if not exists(select 1 from private.platform_admins a join auth.users u on u.id=a.user_id where a.user_id=actor and u.email_confirmed_at is not null and private.account_enabled(actor)) then raise exception 'Confirmed administrator required' using errcode='42501';end if;
 -- Exceção estreita: não permite liberar qualquer timeout ou outro HTTP 400.
 if rid is distinct from 'dd279b98-de7c-4eeb-8253-fd95e2564bc4'::uuid
 or p->>'confirmation' is distinct from 'RECUPERAR REJEICAO SANDBOX SEM CRIAR'
 or p->'evidence' is distinct from '{"source":"asaas_api_log","logId":"108269826","httpStatus":400,"code":"invalid_object","field":"items.name","limit":30,"reference":"dd279b98-de7c-4eeb-8253-fd95e2564bc4"}'::jsonb
 or p->'paymentsEmpty' is distinct from 'true'::jsonb
 or p->>'paymentsCheckedAt' is null
 or (p->>'paymentsCheckedAt')::timestamptz not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '5 seconds'
 then raise exception 'Reviewed rejection and fresh empty API query required' using errcode='23514';end if;
 -- Serializa com start/claim e com a política; recuperação exige janela fechada.
 perform 1 from private.admin_oneoff_policy order by environment for update;
 if exists(select 1 from private.admin_oneoff_policy where enabled_until>clock_timestamp()) then raise exception 'Close windows first' using errcode='55000';end if;
 select * into r from private.admin_oneoff_requests where id=rid and environment='sandbox' for update;
 if not found or r.actor_id is distinct from actor then raise exception 'Original administrator required' using errcode='42501';end if;
 if exists(select 1 from private.admin_oneoff_audit where request_id=rid and action='name_rejection_recovered') then
  if r.state='authorized' and r.checkout_id is null and r.payment_id is null then return to_jsonb(r);end if;
  raise exception 'Recovery already used' using errcode='23505';
 end if;
 if r.state<>'uncertain' or r.diagnostic is distinct from 'creation_uncertain' or r.checkout_id is not null or r.payment_id is not null
 or r.method<>'PIX' or r.amount_cents<>1990 or r.currency<>'BRL' or r.customer_id<>'cus_000010060896'
 or r.created_at is distinct from '2026-11-28 05:00:25.467633+00'::timestamptz
 or r.lease_until>clock_timestamp()
 or (select count(*) from private.admin_oneoff_audit where request_id=rid and action='creation_claimed')<>1
 or exists(select 1 from private.admin_oneoff_events where environment='sandbox' and (request_id=rid or notice->>'reference'=rid::text or notice->>'checkoutId'=r.checkout_id::text))
 then raise exception 'Ambiguous operation cannot recover' using errcode='23514';end if;
 before_row:=jsonb_build_object('state',r.state,'diagnostic',r.diagnostic,'expiresAt',r.expires_at);
 update private.admin_oneoff_requests set state='authorized',diagnostic=null,lease=null,lease_until=null,
 expires_at=clock_timestamp()+interval '1 hour',last_checked_at=(p->>'paymentsCheckedAt')::timestamptz where id=rid returning * into r;
 insert into private.admin_oneoff_audit(environment,actor_id,request_id,action,reason) values('sandbox',actor,rid,'name_rejection_recovered',
 jsonb_build_object('evidence',p->'evidence','paymentsEmpty',true,'paymentsCheckedAt',p->>'paymentsCheckedAt','before',before_row,'newExpiresAt',r.expires_at,'createsCheckout',false)::text);
 return to_jsonb(r);
end;$$;
revoke all on function public.admin_oneoff_recover_name_rejection(text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_oneoff_recover_name_rejection(text,bigint,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
