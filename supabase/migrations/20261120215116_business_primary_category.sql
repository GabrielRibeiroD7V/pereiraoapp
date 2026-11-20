-- PROPOSTA DO PR #4: aplicação remota exige autorização específica.
begin;
alter table public.businesses add column category_id text references public.categories(id);
create index businesses_category_id_idx on public.businesses(category_id);
grant update(category_id) on public.businesses to authenticated;
-- RLS existente continua autorizando somente membros owner/admin.
-- RPC create_business é preservada; cria rascunho e proprietário atomicamente.
commit;
