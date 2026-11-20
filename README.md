# PEREIRÃO

Plataforma para conectar moradores a profissionais autônomos e empresas prestadoras de serviços.

Desenvolvimento por branches e pull requests. A publicação em produção é controlada pelo responsável pelo projeto.

## Desenvolvimento local

Requer Node.js 22.12 ou superior (CI usa Node 24) e npm.

```sh
npm ci
npm run dev
```

## Verificações

```sh
npm run typecheck
npm test
npm run build
```

`npm run preview` permite inspecionar localmente o resultado do build. Não há script de publicação.

A versão atual contém identidade oficial, tela inicial, navegação pública e a fundação de autenticação Supabase. A pesquisa e as seis categorias direcionam a `/buscar` com parâmetros; a listagem ainda não consulta dados reais.

A autenticação exige configuração pública válida conforme `.env.example`; sem ela, o marketplace permanece navegável e os formulários informam a indisponibilidade. Não coloque chaves secretas em variáveis VITE. As migrações são **propostas para revisão**, não foram aplicadas remotamente. Merge e build não executam SQL ou deploy.

Consulte [backend, segurança e configuração](docs/backend-auth-foundation.md), [arquitetura visual](docs/architecture.md), [marca oficial](assets/brand/README.md) e [validação do PR #2](docs/pr2-validation.md).

O cadastro profissional do PR #4 e o relatório de reconciliação estão em [cadastro profissional](docs/professional-registration.md). A nova migração de categoria principal aguarda aplicação autorizada; até lá, o cadastro informa a pendência e não cria negócios. `npm run test:migrations` confere o arquivo inicial reconciliado. A CI de SQL usa PostgreSQL nativo, sem Docker.
