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

A base atual contém somente estrutura visual, navegação pública e contratos tipados. Não conecta ao Supabase, não exige segredos e não implementa busca/autenticação. Consulte [arquitetura e limites](docs/architecture.md).
