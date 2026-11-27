# Conciliação das versões financeiras já aplicadas (issue #105)

Esta alteração é **somente de versionamento local**. O Supabase do projeto `yazdjiwaksamizrbqewq` já registrou as migrações:

- `20261127200456_admin_monetization_policy` (PR #95)
- `20261127200512_sandbox_monthly_1990` (PR #96)

Os respectivos arquivos na main usavam `20261127192500` e `20261127193500`. Ambos são renomeados para os IDs remotos **sem modificar o conteúdo SQL**. O executor SQL local é atualizado para os caminhos novos, preservando a ordem explícita dos testes. Nenhum histórico remoto é reparado ou regravado, e nenhuma migração é reaplicada.

## Validações necessárias antes da integração

1. Confirmar que a renomeação conserva os blobs Git `b5d08f2a7e42631794cdd21a5fa76b6400ec4e91` e `b5fcef2d15f4045fb1e55fc13d45d21b1d862f5b`.
2. CI e testes SQL/RLS integrais; dry-run remoto `--dry-run --skip-vault` com **nenhuma migração financeira pendente** na main.
3. Atualizar branches #99 e #104 na main após integração, sem misturar os SQLs; dry-run exclusivo da migração de cada PR.
4. Conferir estado `initial_free`, assinaturas reais zero e flags financeiras desligadas.

**Não executar SQL remoto nem alterar `supabase_migrations.schema_migrations` manualmente.**
