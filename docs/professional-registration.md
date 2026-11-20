# PR #4 — Cadastro de autônomos e empresas

## Fluxo implementado

Uma única conta Supabase Auth acessa os perfis profissionais. Início e Buscar continuam públicos; Conta e a chamada da Home oferecem “Anunciar meus serviços”. O destino `/conta/profissional/cadastro` é privado. Login/cadastro e confirmação por e-mail preservam o retorno ao formulário por uma lista fechada de destinos locais.

O formulário tem três etapas: tipo; informações profissionais/categoria/cidade/área; contatos e revisão. Não exige CPF. Empresas podem informar razão social e CNPJ numérico opcional, conforme a constraint existente. Esses dados são enviados apenas a `business_details`. A validação não afirma verificar a existência legal do CNPJ. WhatsApp pode ficar vazio no rascunho, mas será necessário para a futura publicação. Não há botão ou operação de publicar, assinatura ou cobrança.

`/conta/profissional` lista os negócios que a conta pode administrar, com nome, tipo, status e edição. Não existe nova aba principal, dashboard, gerenciamento de serviços ou portfólio. Há somente uma indicação textual sobre essas funções futuras. Não são exibidas métricas inventadas.

## Reconciliação da migração inicial

Consulta do histórico remoto de `yazdjiwaksamizrbqewq`: um único registro, versão `20261120214652`, nome `backend_auth_foundation`, com um statement contendo o SQL aplicado.

| Verificação | Resultado |
|---|---|
| Arquivo anterior | `20261120213346_backend_auth_foundation.sql` |
| Nome canônico alinhado ao remoto | `20261120214652_backend_auth_foundation.sql` |
| MD5 do SQL no histórico remoto | `96f8b9b08666aaac9be47ea809fea081` |
| MD5 do arquivo renomeado | `96f8b9b08666aaac9be47ea809fea081` |
| Git blob antes/depois | `78d8dc14fc0b3543a9d53a90a08cbf3b548eff78` |

Somente o arquivo local foi renomeado. Não houve repair no histórico remoto, reaplicação, edição do SQL inicial ou alteração de tabela para reconciliar versões. `npm run test:migrations` impede regressão do arquivo duplicado e verifica a correspondência ao SQL remoto consultado. Ele verifica esse snapshot, não consulta continuamente o remoto.

O histórico da fundação está alinhado. A segunda migração aparece localmente como **nova e pendente**, não como divergência da inicial.

## Migração adicional aprovada somente para preparação

O schema existente não possui categoria principal em `businesses`. Não foi usada descrição, dado privado ou serviço fictício para esconder essa lacuna. O usuário aprovou preparar [`20261120215116_business_primary_category.sql`](../supabase/migrations/20261120215116_business_primary_category.sql) para revisão, sem aplicação remota.

Ela adiciona somente `businesses.category_id` nullable, FK para `categories(id)`, índice e privilégio UPDATE da coluna para authenticated. As políticas RLS existentes continuam exigindo owner/admin. Nullable preserva rascunhos antigos e a assinatura da RPC `create_business`; o formulário exige categoria para concluir o cadastro.

**Não aplicada no projeto operacional.** O aplicativo testa a disponibilidade da coluna antes de criar um negócio. Enquanto faltar a migração, o formulário mostra indisponibilidade explícita e não chama a RPC. O PR não está pronto para abrir cadastro público até essa aplicação ser revisada e autorizada.

## Persistência, propriedade e retomada

1. Ler cidade/categorias ativas do banco; validar o formulário.
2. Gerar slug com nome normalizado e UUID da tentativa, preservado durante retentativas.
3. Usar exclusivamente a RPC existente `create_business` com nome, slug, tipo e cidade. Ela cria negócio em draft, owner e área inicial atomicamente. Nenhum owner_id, user_id de proprietário, role ou status é enviado pelo formulário.
4. Guardar somente slug/ID do checkpoint no sessionStorage, por uid. Não guardar contatos, descrição ou dados legais no navegador.
5. Atualizar dados públicos por RLS; dados legais separados; inserir áreas com ON CONFLICT DO NOTHING e remover áreas desmarcadas do próprio negócio.
6. Somente após concluir todas as gravações, limpar checkpoint e abrir o espaço profissional.

Um guard em memória bloqueia submissões concorrentes. Colisão de slug resulta em erro compreensível e uma nova tentativa recebe outro UUID. Em caso de resposta perdida, o adaptador procura o mesmo slug **somente entre negócios em que a conta atual é owner/admin**; não adota um negócio de terceiro nem se atribui propriedade.

A atualização das informações complementares usa múltiplas requisições e **não é uma transação única**. Se falhar, o rascunho já criado continua associado ao owner, visível em Conta e retomável sem executar a criação novamente. Pode haver dados parcialmente salvos, explicitamente informados ao usuário; não há registros de negócio sem membro proprietário criados pelo formulário. Uma falha total de rede após a criação exige retentar quando a conexão voltar. Sem sessionStorage disponível, a retomada após reload pode exigir selecionar o rascunho no espaço profissional.

O formulário não inclui status no PATCH e não cria linhas em `services` ou `portfolio_items`. Editar preserva o status existente. A UI deste PR não publica. As permissões atuais do backend permitem owner/admin modificar status via API: regras server-side de aprovação e requisitos de publicação, inclusive WhatsApp, continuam pendentes e devem ser definidas antes da abertura pública de perfis.

Trocar empresa para autônomo não apaga silenciosamente os dados legais privados já existentes; eles permanecem privados e não são exibidos no formulário de autônomo. Exclusão de dados legais será uma ação explícita futura.

## Segurança

O adaptador verifica a sessão com getUser, consulta associações da própria conta e exige owner/admin para editar. A segurança efetiva permanece nas policies/grants do PostgreSQL, e não depende do JavaScript. Terceiros e viewer não podem gerenciar registros. O perfil pessoal não é recriado no cadastro profissional: o trigger de Auth já o mantém, permitindo uma conta com vários negócios.

Os slugs e IDs do checkpoint não são considerados prova de autorização: o banco e o adaptador verificam o vínculo. Erros SQL não são expostos ao usuário. As variáveis usadas pelo cliente continuam públicas; nenhuma service_role, chave secreta ou credencial foi incluída.

## Testes e limites reais

Testes de interface cobrem visitante → login → cadastro, retorno após confirmação, autônomo/empresa, etapas, validação, duplicação de submissão, colisão, retomada, edição, espaço profissional e bloqueio enquanto a nova migração não existe. O SDK Supabase real é usado nos testes do adaptador com transporte HTTP interceptado: verificam RPC/PATCHs, separação de dados privados e ausência de proprietário/status no payload. **Esses testes não equivalem a uma sessão Auth real no servidor.**

Os testes SQL/RLS executam as duas migrações em PostgreSQL 17.11 nativo temporário, sem TCP. Verificam também categoria principal, preço, permissões entre contas, integridade de portfólio e manutenção do status draft. Os atores de Auth são representados por fixtures apenas no banco isolado, removido ao final. O workflow foi ajustado para PostgreSQL 17 nativo em vez de Docker. Nenhum Docker foi executado nesta tarefa.

O primeiro job SQL no Actions identificou que o runner não inclui os binários da versão 17 no caminho esperado. A CI passou a instalar a versão necessária pelo [repositório oficial PostgreSQL para Ubuntu](https://www.postgresql.org/download/linux/ubuntu/) antes de iniciar o cluster temporário; essa instalação ocorre apenas no runner descartável, não no projeto Supabase ou na máquina do usuário.

No Supabase operacional foram feitas apenas leituras: estrutura, funções, histórico e hash do SQL. Nenhum cadastro fictício ou alteração remota foi feito. O teste ponta a ponta com autenticação real e persistência operacional **não foi realizado**: a nova migração está aguardando autorização e não foi fornecida uma sessão real de teste. Não foram solicitadas senhas ou chaves privadas para contornar isso.

Não foi realizado teste visual em navegador nesta etapa. A interface reutiliza Sass e componentes responsivos existentes, e os controles/estados foram verificados em DOM. Resultados finais de tipos, testes, SQL, build e Actions estão no PR.

## Pendências para ativar o cadastro real

1. Revisar o PR e a nova migração. Autorizar especificamente a aplicação remota de `20261120215116_business_primary_category.sql`.
2. Conferir as variáveis públicas no ambiente local/preview aprovado. O projeto permitido continua sendo somente `yazdjiwaksamizrbqewq`.
3. Conferir SMTP/entrega, confirmação de e-mail e callbacks. A confirmação agora pode conter `next` para `/conta/profissional/cadastro`; a allowlist deve permitir o callback aprovado com esse parâmetro, sem liberar domínios arbitrários.
4. Fazer ensaio acompanhado com uma conta real autorizada: confirmar e-mail, entrar, concluir cadastro, conferir draft e associação owner, editar, sair e verificar proteção de rota. Não usar dados fictícios no operacional nem compartilhar senha no chat.
5. Definir enforcement de publicação no backend em etapa própria; este PR não altera essas regras e não publica perfis.

Nenhuma publicação Vercel/Lovable ou novo ambiente foi criado. Merge do PR não aplica a migração e não torna o cadastro público automaticamente.
