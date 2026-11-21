-- MODELO: operação privilegiada revisada, separada das migrações. Não foi executada.
-- Definir pereirao.bootstrap_user_id e pereirao.bootstrap_expected_email nesta sessão SQL
-- antes de executar. Valores ausentes, conta inexistente ou e-mail não confirmado abortam.
-- Nenhum e-mail/UUID operacional é gravado no repositório ou usado pelo frontend.
begin;
do $$
declare target uuid:=nullif(current_setting('pereirao.bootstrap_user_id',true),'')::uuid;
 expected_email text:=nullif(current_setting('pereirao.bootstrap_expected_email',true),'');
begin
 if target is null or expected_email is null or not exists(select 1 from auth.users where id=target and lower(email)=lower(expected_email) and email_confirmed_at is not null) then
   raise exception 'Conta esperada ausente ou não confirmada';
 end if;
 with added as(insert into private.platform_admins(user_id) values(target) on conflict do nothing returning user_id)
 insert into private.admin_audit(actor_source,target_type,target_id,action,reason,before_state,after_state)
 select 'bootstrap_sql','platform',user_id,'bootstrap_admin','Concessão inicial por operação SQL revisada','user','platform_admin' from added;
end$$;
commit;
