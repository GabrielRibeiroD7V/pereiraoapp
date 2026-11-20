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

A versão atual contém a identidade oficial, tela inicial, navegação pública e contratos tipados. A pesquisa e as seis categorias direcionam a `/buscar` com os parâmetros na URL; a listagem ainda não consulta dados reais. Não conecta ao Supabase, não exige segredos e não implementa autenticação. Consulte [arquitetura e limites](docs/architecture.md), [marca oficial](assets/brand/README.md) e [validação do PR #2](docs/pr2-validation.md).
