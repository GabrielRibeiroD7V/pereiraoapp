-- PROPOSTA: aplicar no projeto remoto somente após revisão e autorização específica.
-- Preserva IDs, nomes, ativação e vínculos de registros já cadastrados.
begin;

insert into public.cities (id, name, state_code, slug, active)
select candidate.id, candidate.name, candidate.state_code, candidate.id, true
from (values
  ('mundo-novo-ms', 'Mundo Novo', 'MS'),
  ('navirai-ms', 'Naviraí', 'MS'),
  ('itaquirai-ms', 'Itaquiraí', 'MS'),
  ('eldorado-ms', 'Eldorado', 'MS'),
  ('iguatemi-ms', 'Iguatemi', 'MS'),
  ('guaira-pr', 'Guaíra', 'PR'),
  ('terra-roxa-pr', 'Terra Roxa', 'PR')
) as candidate(id, name, state_code)
where not exists (
  select 1 from public.cities existing
  where existing.id = candidate.id
     or existing.slug = candidate.id
     or (lower(existing.name) = lower(candidate.name) and existing.state_code = candidate.state_code)
)
on conflict do nothing;

commit;
