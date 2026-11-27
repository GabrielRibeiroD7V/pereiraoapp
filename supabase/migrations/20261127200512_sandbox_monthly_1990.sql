-- PROPOSTA: somente novas contratações Sandbox; não altera contratos anteriores.
begin;
set local lock_timeout='5s';
alter table private.sandbox_contracts drop constraint sandbox_contracts_amount_cents_check;
alter table private.sandbox_contracts drop constraint sandbox_contracts_consent_version_check;
alter table private.sandbox_contracts add constraint sandbox_contracts_price_consent_check check(
 (amount_cents=1999 and consent_version='sandbox-v1') or
 (amount_cents=1990 and consent_version='sandbox-v2-1990'));
alter table private.sandbox_contracts alter column amount_cents set default 1990;
alter table private.sandbox_payments drop constraint sandbox_payments_amount_cents_check;
alter table private.sandbox_payments add constraint sandbox_payments_amount_cents_check check(amount_cents in (1990,1999));
-- Substituições pontuais na definição atual, preservando o fix 42702,
-- prova HMAC, nonce, autorização, conciliação, inbox e auditoria.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.sandbox_billing_server(text,text,bigint,uuid,text)'::regprocedure);
 if cardinality(string_to_array(definition,$old0$p->>'termsVersion' is distinct from 'sandbox-v1' or (p->>'amountCents')::int is distinct from 1999$old0$))<>2 then raise exception 'Unexpected reviewed reserve fragment 0';end if;
 definition:=replace(definition,$old0$p->>'termsVersion' is distinct from 'sandbox-v1' or (p->>'amountCents')::int is distinct from 1999$old0$,$new0$p->>'termsVersion' is distinct from 'sandbox-v2-1990' or (p->>'amountCents')::int is distinct from 1990$new0$);
 if cardinality(string_to_array(definition,$old1$c.method<>p->>'method' then raise exception 'Operation conflict'$old1$))<>2 then raise exception 'Unexpected reviewed reserve fragment 1';end if;
 definition:=replace(definition,$old1$c.method<>p->>'method' then raise exception 'Operation conflict'$old1$,$new1$c.method<>p->>'method' or c.amount_cents<>1990 or c.consent_version<>'sandbox-v2-1990' then raise exception 'Operation conflict'$new1$);
 if cardinality(string_to_array(definition,$old2$sandbox_contracts(request_id,business_id,user_id,method,consent_version,first_due_date,customer_id)$old2$))<>2 then raise exception 'Unexpected reviewed reserve fragment 2';end if;
 definition:=replace(definition,$old2$sandbox_contracts(request_id,business_id,user_id,method,consent_version,first_due_date,customer_id)$old2$,$new2$sandbox_contracts(request_id,business_id,user_id,method,consent_version,first_due_date,customer_id,amount_cents)$new2$);
 if cardinality(string_to_array(definition,$old3$values(rid,bid,uid,p->>'method','sandbox-v1',greatest$old3$))<>2 then raise exception 'Unexpected reviewed reserve fragment 3';end if;
 definition:=replace(definition,$old3$values(rid,bid,uid,p->>'method','sandbox-v1',greatest$old3$,$new3$values(rid,bid,uid,p->>'method','sandbox-v2-1990',greatest$new3$);
 if cardinality(string_to_array(definition,$old4$(select customer_id from private.sandbox_customers where business_id=bid)) returning * into c$old4$))<>2 then raise exception 'Unexpected reviewed reserve fragment 4';end if;
 definition:=replace(definition,$old4$(select customer_id from private.sandbox_customers where business_id=bid)) returning * into c$old4$,$new4$(select customer_id from private.sandbox_customers where business_id=bid),1990) returning * into c$new4$);
 execute definition;
end;$migration$;
notify pgrst,'reload schema';
commit;
