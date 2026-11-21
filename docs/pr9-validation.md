# PR #9 — Publicações de trabalhos realizados

## Entrega e preparação

Branch `feat/publicacoes-trabalhos`, baseada na main `955c8f11b3e38df3440291af7d415f62fde9b229` (PR #8). Produção conferida READY nesse commit. O projeto remoto consultado foi exclusivamente `yazdjiwaksamizrbqewq`.

Espaço Profissional → Publicações → título, descrição e seleção explícita de até seis fotografias do próprio portfólio, com ordenação. Salvar cria um rascunho; publicar exige confirmação, permissão owner/admin, negócio publicado e pelo menos uma fotografia pronta. Editar um trabalho publicado retira sua circulação até uma nova publicação explícita. Há confirmação para retirar e excluir. Publicar um trabalho não altera `businesses.status`.

Home: categorias → carrossel existente → Trabalhos recentes → convite compacto. Perfil público: Trabalhos publicados e Portfólio separados. `/trabalhos/:postId` mostra descrição completa, fotografias e ampliação. Somente Início, Buscar e Conta permanecem na navegação principal. Nenhuma fotografia adicionada ao portfólio vira publicação automaticamente.

## Migração proposta — não aplicada remotamente

`20261121001632_work_posts.sql`, gerada pelo Supabase CLI com timestamp UTC, cria `work_posts` e `work_post_images`. A única alteração estrutural na tabela existente é a constraint UNIQUE `(id,business_id)` em `portfolio_items`, usada pelas FKs compostas. Não há atualização, exclusão ou cópia de registros/arquivos operacionais.

- FKs compostas impedem vincular fotografia de outro negócio. PKs/UNIQUE impedem repetições; ordens 0–5 limitam a seleção a seis imagens.
- Índices atendem trabalhos recentes, gerenciamento por negócio e localização das referências de uma fotografia.
- Tabelas com RLS; anon/authenticated recebem somente SELECT. INSERT/UPDATE/DELETE diretos são revogados. Alterações passam pela RPC `work_post_command`, sem campos para proprietário ou permissões.
- Wrapper público SECURITY INVOKER; implementação privada SECURITY DEFINER com `search_path=''`, objetos qualificados e verificação de `auth.uid()` e `private.can_manage_business`. EXECUTE revogado de PUBLIC/anon e concedido somente a authenticated para comandos.
- Leitura pública exige trabalho publicado, negócio publicado e todas as imagens `ready`, com objeto existente no bucket e MIME aceito. A função booleana interna evita recursão de policies. Apenas esse predicado recebe EXECUTE para anon/authenticated; USAGE de schema private não libera as demais funções.
- Comandos usam lock do negócio primeiro, compatível com a RPC existente de mídia, e substituem os vínculos em uma única transação. UUID estável por operação evita duplicar rascunho ao repetir a requisição; ações publicadas repetidas são idempotentes.
- Trigger BEFORE em `portfolio_items` retira todos os trabalhos publicados afetados antes da exclusão do vínculo ou da transição de mídia. `begin_delete` da RPC atual altera o estado antes de remover bytes pela API do Storage. Fotografias restantes são preservadas. Excluir trabalho remove somente publicação e associações, sem apagar portfólio/objetos.
- A proteção de `businesses.status`, buckets, políticas de Storage e implementação da RPC de mídia permanecem inalteradas. Não há DELETE por SQL em `storage.objects` na aplicação.

O cache PostgREST é notificado pela migração. Até sua aplicação autorizada, o gerenciamento mostra aviso de indisponibilidade e a seção pública fica oculta quando a API informa ausência das tabelas. Outros erros mostram mensagem e tentativa novamente.

## Dados e limites

Contratos e adaptadores tipados em `src/posts`. Cliente público independente da sessão autenticada, projeções explícitas sem dados de conta ou dados legais privados. UUID, texto, seleção de fotos e cursor são validados. React renderiza o conteúdo como texto.

Feed: seis trabalhos por consulta, mais uma linha para detectar continuação; cursor `(published_at,id)` decrescente preserva a precisão de microssegundos do PostgreSQL. Somente a primeira foto é carregada por trabalho no feed; detalhe tem até seis. Lista de gerenciamento: dez itens, mais um; seletor de fotos: doze, mais um. Respostas antigas são abortadas, IDs repetidos são deduplicados e erros ao carregar mais preservam itens já exibidos.

Imagens reutilizam o bucket privado existente. URLs assinadas por 60 segundos, com caminhos canônicos e origem conferida; ampliação solicita nova assinatura. Nenhum token é persistido ou registrado. Uma URL já emitida pode continuar válida até expirar, inclusive após retirada da publicação; bytes já recebidos não podem ser recolhidos.

## Testes e evidências

| Camada | Resultado | Limite |
|---|---|---|
| Typecheck, build e histórico | Aprovados | Build não ativa tabelas remotas |
| Vitest | 149 testes aprovados, incluindo 19 novos | SDK interceptado e repositórios em memória; não são operações reais de publicação |
| PostgreSQL 17 nativo temporário | 137 verificações SQL/RLS aprovadas, incluindo 36 novas | Roles e Storage mínimo simulados; sem Docker e sem objetos operacionais |
| Segurança SQL | Owner/admin, viewer/terceiro/anon, escrita direta, FKs, drafts, publicação/despublicação, exclusão de foto compartilhada, preservação de arquivos | Dados exclusivamente descartáveis no cluster local |
| Navegador local | Criar, selecionar/reordenar fotos, salvar, publicar/retirar/excluir com confirmação, detalhe/ampliação | Fixtures em memória, sem criação de negócios remotos |
| Responsividade | 36 cenários em 375, 390, 768 e 1280 px; sem overflow ou imagens carregadas quebradas | Viewports emulados, não celular físico |
| Supabase operacional, somente leitura | Integridade, histórico, tabelas/policies e ausência de work_posts; adaptador retorna indisponibilidade esperada | Publicação positiva depende da aplicação autorizada da migração e de perfil legitimamente publicado |

Testes novos incluem idempotência, duplo clique, retorno após autenticação, validação e preservação de rascunho em falhas, paginação sem submit acidental, limite de fotos, precisão do cursor, dados públicos, estado sem migração e recuperação de falha incremental. SQL também verifica que excluir uma fotografia compartilhada retira todos os trabalhos afetados, sem excluir as demais imagens.

## Capturas — dados sintéticos locais

| Tela | Celular | Desktop |
|---|---|---|
| Trabalhos recentes | [390 px](screenshots/pr9/home-390.png) | [1280 px](screenshots/pr9/home-1280.png) |
| Gerenciamento | [375 px](screenshots/pr9/manager-375.png) | [1280 px](screenshots/pr9/manager-1280.png) |
| Editor | [375 px](screenshots/pr9/editor-375.png) | [1280 px](screenshots/pr9/editor-1280.png) |
| Trabalho público | [390 px](screenshots/pr9/public-390.png) | [1280 px](screenshots/pr9/public-1280.png) |
| Perfil | [390 px](screenshots/pr9/profile-390.png) | [1280 px](screenshots/pr9/profile-1280.png) |
| Vazio / erro / ativação pendente | [Vazio](screenshots/pr9/empty-390.png), [erro](screenshots/pr9/error-390.png), [pendente](screenshots/pr9/setup-390.png) | Mesmos estados capturados nas quatro larguras |

[Métricas das 36 capturas](screenshots/pr9/metrics.json). Há também captura de carregamento e ampliação. Nomes simulados e padrão quadriculado não representam profissionais/trabalhos reais. Harness e imagem de teste foram removidos antes do build; fixtures estão restritas aos testes.

## Integridade e ativação pendente

O banco remoto permanece com os três negócios em draft (dois operacionais e um técnico), uma fotografia e um objeto no bucket. As quatro migrações anteriores permanecem registradas, sem a nova migração. Consulta de hashes dos dois negócios originais, vínculos, áreas, dados legais e políticas/constraints/histórico confirmou preservação. Nenhum dado remoto foi criado, editado ou excluído nesta tarefa.

Antes de ativar: revisar e autorizar especificamente a nova migração; após aplicação, conferir cache/FKs/RLS e realizar ensaio autenticado com registros explicitamente autorizados. Teste público positivo exige negócio legitimamente publicado por operação administrativa revisada, sem contornar a proteção de status. Conferir também celular físico. SQL local e mocks não substituem essas validações operacionais.

CI e preview do SHA enviado serão registrados na descrição do PR. Não fazer merge antes da revisão; um futuro merge pode disparar produção automaticamente pela Vercel. Nenhuma promoção manual de produção ou publicação no Lovable foi realizada. Sem mudanças em Auth, SMTP, domínio, pagamentos, funcionalidades sociais ou demais recursos fora do escopo.
