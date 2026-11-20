# PR #3 — Fundação Supabase e autenticação

## Situação e impacto da proposta

Projeto inspecionado: `yazdjiwaksamizrbqewq`, `ACTIVE_HEALTHY`, PostgreSQL 17.12. O schema público estava vazio. Nenhuma escrita, migração, configuração de Auth, envio de e-mail, bucket ou usuário foi criado no projeto remoto.

Migração da fundação: [`20261120214652_backend_auth_foundation.sql`](../supabase/migrations/20261120214652_backend_auth_foundation.sql). Criada originalmente com versão `20261120213346` pelo CLI 3.2.0; aplicada posteriormente pelo MCP com versão remota `20261120214652`. O PR #4 reconcilia somente o nome do arquivo local, com conteúdo intacto. O restante deste documento registra a entrega original do PR #3; a situação atual está no [relatório do PR #4](professional-registration.md).

A futura aplicação cria nove tabelas, índices, constraints, RLS, funções e um trigger em `auth.users`. Os únicos dados de catálogo são Mundo Novo/MS e as seis categorias aprovadas. Para contas já existentes em Auth, há um backfill de `profiles` com nome de apresentação, sem copiar e-mail, senha ou tokens. A migração é transacional e não altera ou remove tabelas existentes; conflitos de nomes devem ser inspecionados antes de aplicá-la. Um erro no trigger poderá impedir novos cadastros: o trigger precisa ser validado no ambiente Supabase de desenvolvimento após autorização.

## Modelo e autorização

| Entidade | Visitante | Conta autenticada | Membro owner/admin |
|---|---|---|---|
| `profiles` | Sem acesso | Lê e atualiza apenas seu nome/avatar | Não ganha acesso aos perfis pessoais de outros membros |
| `cities`, `categories` | Lê registros ativos | Mesmo acesso | Sem escrita pelo cliente |
| `businesses` | Lê publicados | Lê publicados e seus próprios negócios | Atualiza negócios dos quais é membro autorizado |
| `business_members` | Sem acesso | Lê apenas suas associações | Sem mutação direta, inclusive para owner |
| `business_details` | Sem acesso | Sem acesso a negócios de terceiros | Lê e gerencia razão social/CNPJ do próprio negócio |
| `services` | Lê ativos de negócios publicados | Membros também leem inativos de seus negócios | Cria, atualiza e exclui no próprio negócio |
| `portfolio_items`, `business_service_areas` | Lê de negócios publicados | Membros também leem de seus negócios não publicados | Gerencia no próprio negócio |

`viewer` lê dados operacionais do negócio associado, mas não modifica registros nem lê dados empresariais sensíveis. `admin` e `owner` podem gerenciar conteúdo. Não há convites, transferência de propriedade ou edição de membros pelo cliente neste PR; isso exigirá operações transacionais específicas, com regras para preservar o proprietário.

Uma conta pode possuir vários negócios; um negócio pode ter vários membros. O proprietário inicial é único por negócio. A exclusão de uma conta que ainda participa de negócios é bloqueada pela FK, evitando negócios sem responsável; um futuro fluxo de exclusão precisará tratar vínculos explicitamente.

As permissões são verificadas por `auth.uid()` e por `business_members`. Não dependem de `user_metadata`, do nome, de parâmetros owner/user enviados pelo navegador ou de flags de interface. O nome em metadados de Auth é somente apresentação. Rotas protegidas no React são uma conveniência de navegação: a autorização efetiva está no PostgreSQL e no Supabase Auth.

### Funções privilegiadas

- `private.handle_new_user`: trigger, sem EXECUTE para clientes, cria apenas o perfil do usuário inserido por Auth.
- `private.is_business_member` e `private.can_manage_business`: lookup de associação do **uid atual** para evitar recursão de RLS. Não aceitam um user_id arbitrário. EXECUTE somente para authenticated.
- `private.create_business`: exige uid, valida cidade ativa e insere negócio em rascunho, membro owner e área inicial de atendimento na mesma transação. Não recebe owner, role ou status do cliente. EXECUTE somente para authenticated.
- `public.create_business`: wrapper SECURITY INVOKER, exposto para RPC; não concede privilégio adicional além da função interna controlada.

As funções SECURITY DEFINER ficam no schema `private`, com `search_path = ''` e nomes qualificados. `private` não deve ser adicionado aos schemas expostos pela Data API. O schema só concede USAGE a authenticated para as chamadas das políticas e do wrapper. EXECUTE padrão de PUBLIC foi revogado explicitamente. A razão de cada função está comentada no SQL. Não foram criadas views que contornem RLS.

Privilégios de coluna impedem transferir IDs, business_id ou alterar timestamps pelos updates. Inserts de conteúdo também limitam as colunas; IDs e timestamps usam defaults do banco. Índices cobrem FKs e os caminhos principais de consulta e autorização.

### Integridade

Preços são inteiros em centavos: `quote` exige valor nulo; `fixed` e `starting-at` exigem valor não negativo, com limite explícito. Não existe comissão ou tabela financeira. A FK composta impede associar portfólio a serviço de outro negócio. A exclusão de um serviço vinculado a portfólio exige antes remover/desvincular suas fotos. Caminhos de portfólio começam pelo UUID do próprio negócio. Isso não substitui as futuras políticas de Storage.

## Autenticação e interface

Um único Supabase Auth para todos os usuários. Rotas:

- Públicas: `/`, `/buscar`, `/conta`, `/entrar`, `/criar-conta`, `/recuperar-senha`, `/auth/retorno`.
- Privadas: `/conta/dados` e `/redefinir-senha`.

Cadastro com nome, e-mail e senha; confirmação por e-mail; login; recuperação; definição de nova senha; logout; persistência de sessão; erros traduzidos e estados de carregamento. A navegação principal continua com três destinos. Não há cadastro de negócios, painel ou funções de cobrança na interface.

O cliente usa PKCE, persistência e renovação de sessão. O callback troca o código explicitamente e evita troca duplicada no StrictMode. Após sucesso, substitui a URL com código pela tela de conta ou redefinição de senha. Falhas de callback exibem instruções sem expor payload técnico. Abra o link no mesmo navegador em que iniciou a solicitação, pois PKCE depende do verificador local. Tokens de sessão são gerenciados pelo SDK; não são copiados para tabelas, logs ou contexto de apresentação. A SPA usa armazenamento do navegador: proteção contra XSS e política de expiração devem ser revisadas antes da produção.

Ao trocar a senha pelo fluxo de recuperação, o aplicativo solicita logout antes de voltar ao login. O SDK usa signOut padrão (global); access tokens já emitidos podem continuar válidos até expirar, conforme o comportamento de Auth. Para garantias de revogação imediata, será necessário validar sessões no servidor em operações sensíveis. Essa infraestrutura não foi presumida neste PR.

O guard aguarda a restauração da sessão e não sobrescreve eventos novos com resultados antigos. `next` aceita apenas rotas locais conhecidas, evitando redirecionamentos externos. Mensagens de recuperação e cadastro não afirmam que um e-mail já possui conta. Valores técnicos inesperados não são mostrados na interface.

## Configuração pendente, sem segredos

`.env.example` contém somente a URL pública do projeto e uma variável vazia para `VITE_SUPABASE_PUBLISHABLE_KEY`. Não há credencial real no repositório ou configuração de hospedagem. O cliente recusa outros projetos e chaves que não sejam `sb_publishable_...`; chaves legadas anon não são aceitas nesta base. Não usar `service_role`, `sb_secret_...`, senha do banco ou PAT em variáveis VITE.

Sem configuração válida, o marketplace permanece acessível e os formulários de autenticação apresentam indisponibilidade explícita, com envio desabilitado. Não há sessão simulada em produção. Os testes usam gateways em memória e fixtures restritos aos arquivos de teste.

Para ativar e validar futuramente, após revisão:

1. Definir as origens reais de desenvolvimento, preview e produção. Nenhum domínio Vercel/Lovable foi presumido.
2. Em Supabase Auth, ativar provedor e-mail/senha e **confirmação de e-mail**, revisar expiração e limites. O frontend não pode forçar a política de confirmação se ela estiver desativada no servidor.
3. Definir Site URL para a origem de produção, quando existir. Autorizar os callbacks exatos de cada origem: `/auth/retorno` e `/auth/retorno?flow=recovery`. Não usar wildcard irrestrito para todos os domínios de preview.
4. Preservar templates compatíveis com o fluxo PKCE/ConfirmationURL. Configurar SMTP adequado e limites antes de uso por clientes reais.
5. Configurar localmente apenas a URL pública e a publishable key; conferir que preview e produção usam o projeto aprovado. O callback deriva de `window.location.origin`; HTTPS é obrigatório fora de localhost/loopback.
6. Aplicar a migração **somente com autorização específica**. Confirmar grants/Data API, executar advisors e testar RLS/Auth no ambiente Supabase aprovado. Merge do código não aplica migração nem configura Auth.
7. Regenerar tipos com CLI a partir do banco autorizado. `src/lib/database.types.ts` é uma representação manual da proposta, não uma geração a partir do remoto vazio.

A hospedagem futura deve servir index.html nas rotas da SPA, inclusive no callback. Não foi publicada prévia nem configurado domínio.

## Adaptadores e compatibilidade

`AuthGateway` separa a UI do SDK e permite testar fluxos sem rede. `createFoundationRepository` usa cliente tipado e RLS para perfil próprio, múltiplas associações, negócios publicados, serviços e RPC de criação. Não está ligado à Home/Buscar: estas telas mantêm o estado vazio até o PR de integração pública.

O retorno público de `businesses` não contém identificadores de usuários, e-mail pessoal ou CNPJ. O tipo legado `Provider` ainda existe para preservar contratos da interface; não é preenchido com ownerId fictício. O adaptador inicial usa `BusinessRow` e `AccountProfile.memberships` (coleção), sem reduzir uma conta a um único negócio. O contrato legado de conta singular não é usado por este adaptador.

## Storage: planejamento, sem buckets criados

Proposta futura de buckets privados, separados por finalidade: `account-media` para perfis pessoais e `business-media` para logos, serviços e portfólios. Limite inicial proposto: 5 MB por arquivo; MIME permitido: image/jpeg, image/png, image/webp. SVG, HTML e executáveis não serão aceitos. Os limites precisam existir no bucket/servidor, não somente no formulário. Validar conteúdo real, dimensões e reprocessar EXIF antes de disponibilizar uploads.

Organização futura: `<user_id>/profile/<uuid>.<ext>` para conta; `<business_id>/logo/<uuid>.<ext>`, `<business_id>/services/<uuid>.<ext>` e `<business_id>/portfolio/<uuid>.<ext>` para negócio. Regras devem consultar o uid/membro atual e o primeiro segmento do caminho; não confiar em owner declarado no metadata do objeto. Upsert precisa de INSERT + SELECT + UPDATE e mesmas restrições de ownership; excluir objetos requer autorização equivalente.

A leitura de arquivos de contas será privada. Para mídia pública de negócios, o serviço de emissão de URLs assinadas deverá verificar publicação e associação do registro ao objeto antes de assinar, sem expor chave privilegiada no navegador. URLs assinadas terão duração curta; despublicar impede novas emissões, mas URLs já emitidas só expiram ao fim do prazo. Imagens oficiais de categorias continuam em `public/images/categories`, separadas dos uploads. Nenhuma política de objetos ou upload foi implementado neste PR.

## Validação realizada e limites

- Typecheck, testes de React/gateway/adaptadores e build; resultados finais no PR.
- Migração executada integralmente em PostgreSQL **17.11 local e isolado**, sem TCP, com schemas de teste mínimos para auth.users/auth.uid e papéis anon/authenticated. O remoto usa 17.12.
- **44 verificações SQL/RLS reais** cobrem trigger, isolamento de contas/negócios, grants, viewer, preços, vínculo de portfólio, publicação/despublicação e propriedade atômica. A identidade dos atores é simulada via claims locais; não há conexão ao serviço Auth remoto.
- CI inclui os mesmos testes SQL em container PostgreSQL 17 efêmero, sem rede e com os arquivos montados somente para leitura.
- Sem Docker local, não foi executada a stack Supabase completa. GoTrue, PostgREST, envio de e-mail, refresh real do token, política real de confirmação, SMTP, configuração remota e Storage **não foram validados ponta a ponta**.
- Não foi realizada inspeção visual em navegador nesta etapa; renderização, labels, estados e navegação são cobertos por testes DOM. O CSS reutiliza a base responsiva existente.
- O SDK Supabase foi separado em chunk próprio para cache independente; não se trata de carregamento sob demanda. Avaliar lazy loading antes de conectar recursos adicionais ao marketplace público.

Execução local, com PostgreSQL disponível no PATH:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:sql
```

No macOS com a instalação utilizada nesta revisão:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:sql
```

O runner não aceita URL de banco e cria um cluster temporário próprio. Não executa testes no projeto remoto nem reaproveita bancos do usuário. O diretório descartável é removido ao final. As fixtures só existem nesse cluster transacional e nunca são usadas em produção.

## Referências técnicas consultadas

- [Supabase Auth — recuperação de senha](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase Auth — PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls)
- CLI 3.2.0: ajuda de migration new e gen types; SDK supabase-js 2.119.2 e seus tipos locais.
