-- PROPOSTA PR #6: revisão e autorização específica antes de aplicar no remoto.
-- A fundação concede UPDATE por coluna, sem privilégio UPDATE da tabela inteira.
-- Retirar somente status preserva a edição de todos os demais campos e as RLS.
begin;
revoke update (status) on table public.businesses from authenticated;
commit;
