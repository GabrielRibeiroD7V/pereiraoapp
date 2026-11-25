-- Executar em leitura no SQL Editor do projeto PEREIRÃO; não altera dados.
-- O painel Supabase Usage é a fonte para egress, MAU e faturamento.
select current_timestamp as measured_at,
       pg_database_size(current_database()) as database_bytes,
       (select count(*) from auth.users) as registered_accounts,
       (select count(*) from storage.objects) as stored_files,
       (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects) as storage_bytes;

select bucket_id,
       count(*) as stored_files,
       coalesce(sum((metadata->>'size')::bigint),0) as storage_bytes
from storage.objects
group by bucket_id
order by bucket_id;
