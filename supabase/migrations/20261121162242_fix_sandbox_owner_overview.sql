-- Correção mínima de 42702 comprovado no owner_overview. Não aplicar sem autorização específica.
-- Preserva todas as validações HMAC, RLS/grants, dados, contratos e períodos gratuitos.
begin;
do $migration$
declare
  definition text;
  before_sql constant text := 'private.sandbox_contracts c on c.request_id=p.request_id where c.business_id=bid';
  after_sql constant text := 'private.sandbox_contracts owned_contract on owned_contract.request_id=p.request_id where owned_contract.business_id=bid';
begin
  definition := pg_get_functiondef('private.sandbox_billing_server(text,text,bigint,uuid,text)'::regprocedure);
  if position(before_sql in definition)>0 then
    if cardinality(string_to_array(definition,before_sql))<>2 then
      raise exception 'Unexpected sandbox owner query definition';
    end if;
    execute replace(definition,before_sql,after_sql);
  elsif position(after_sql in definition)=0 then
    raise exception 'Expected sandbox owner query not found';
  end if;
end;
$migration$;
notify pgrst,'reload schema';
commit;
