# PR #8 — Marketplace público, busca e carrossel

## Comportamento entregue

Início → pesquisa/categorias/carrossel → resultados → `/prestadores/:slug` → serviços, portfólio existente e contatos externos. A navegação continua pública, com somente Início, Buscar e Conta. Perfis públicos mantêm Buscar destacado. O carrossel exibe até oito profissionais publicados que atendem Mundo Novo/MS, em ordem alfabética, com deslizamento horizontal, foco, setas de teclado e botões. Não há classificação paga, nota, distância ou selo inventado.

O PR #7 está integrado à main `5276e472da76e1474c6a6125b6d9b9f22146624c`; deployment de produção conferido READY nesse commit antes do trabalho. Implementação em `feat/marketplace-publico`. Não houve merge ou deployment de produção nesta tarefa.

## Dados, filtros e paginação

- Adaptador em `src/marketplace/repository.ts`, contratos públicos em `types.ts`, separados dos dados de conta e gerenciamento.
- Cliente Supabase público independente: não lê, copia, renova ou persiste a sessão da conta. Teste local confirma que uma sessão persistida do proprietário não é herdada por esse cliente.
- Todas as consultas de negócios exigem `status=published`. Serviços exigem `active=true` e negócio publicado; galeria exige `media_state=ready` e negócio publicado. Nem o proprietário logado vê seus rascunhos nessas telas públicas.
- Pesquisa no servidor pelo nome/descrição do negócio, categoria principal e nomes/descrições de serviços ativos. Aliases vazios de relacionamentos e `not.is.null` combinam o OR sem baixar os serviços para filtrá-los no navegador ou duplicar negócios.
- Categoria principal, tipo e cidade atendida são filtrados no servidor. A cidade usa `business_service_areas`, incluindo atendimento fora da sede.
- Termo/filtros/página preservados na URL (`q`, `categoria`, `cidade`, `tipo`, `pagina`); pesquisa nova reinicia paginação. Voltar/avançar restaura os parâmetros.
- Resultados: 20 itens por página, ordenados por nome e ID, com uma linha adicional para determinar Próxima. Serviços, fotos e áreas: 12 por página, também com uma linha adicional. Sem COUNT global, total fictício ou carregamento integral dos negócios.
- Catálogo de cidades ativas limitado às primeiras 200 em ordem alfabética; a implantação atual tem uma cidade. Expansão desse catálogo além desse limite requer evolução do seletor, sem afetar a paginação dos profissionais.
- Busca textual por trecho, com ILIKE. Categorias também são pesquisadas pelo ID sem acentos. Não há equivalência geral de acentos, relevância ou busca aproximada em nomes/descrições. Para volume maior, avaliar EXPLAIN e índices de busca em uma migração separada e revisada; nenhum índice/migração remota foi criado aqui.

## Perfil e contatos

Perfil apresenta nome, tipo, categoria, cidade, áreas, descrição, serviços ativos com preço em reais e portfólio paginado com ampliação. Texto é renderizado pelo React, sem HTML fornecido pelo prestador.

WhatsApp recebe número normalizado e mensagem contextual codificada. Instagram aceita usuário ou URL HTTPS do domínio exato instagram.com/www.instagram.com, rejeitando credenciais, porta, caminhos extras, query/hash e domínios parecidos. Links externos usam `noopener noreferrer` e avisam sobre nova guia. Nenhuma mensagem foi enviada nos testes e nenhum contador de cliques foi inventado.

Avatar utiliza `avatar_path` somente quando corresponde a um objeto canônico do negócio no bucket atual e a política permite assiná-lo. Ausência/falha exibe ícone neutro; não há fotografia aleatória ou uso de categoria como trabalho realizado. Não foi criado fluxo de envio de logotipo neste PR.

## Segurança de leitura

- Projeções explícitas, sem `select('*')` no novo adaptador. Sem profiles, business_members ou business_details nas telas públicas; não há ownerId, CNPJ, razão social, IDs de usuários ou permissões no contrato público.
- Slugs, páginas e parâmetros são limitados/validados. Termos não introduzem gramática OR, caminhos, curingas ou operadores fornecidos pelo usuário em consultas compostas.
- Cliente não possui chave privada e não modifica status de publicação. Bloqueio anterior de businesses.status preservado.
- Bucket permanece privado. Assinaturas de 60 segundos solicitadas somente para caminhos canônicos do próprio negócio; a resposta deve apontar à origem e ao caminho esperados, sem credenciais na URL. Não há URL pública permanente, persistência de tokens ou registro de URLs assinadas.
- A ampliação solicita nova assinatura; imagens indisponíveis usam fallback. Uma assinatura já emitida é uma autorização temporária e pode permanecer válida até expirar. Conteúdo já recebido não pode ser recolhido do destinatário.
- AbortController e identificação da consulta evitam substituir uma busca nova por resposta atrasada; erros exibem mensagem genérica e opção de tentar novamente.
- RLS existente reutilizada integralmente. Nenhuma migração, policy, bucket, função remota, configuração de Auth ou dado operacional foi alterado.

Referência da composição de filtros: [PostgREST — OR entre relacionamentos](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html#or-filtering-across-embedded-resources).

## Matriz de evidências

Verificações finais locais: typecheck, **130 testes automatizados**, build, **101 verificações SQL/RLS**, verificação do histórico e `git diff --check` aprovados. Sem fixtures do ensaio ou padrões de chaves privadas no bundle final. CI e preview serão registrados na descrição do PR para o SHA enviado.

| Camada | Verificação | Evidência/limitação |
|---|---|---|
| Supabase real, somente leitura | Busca composta, cidades, serviços, áreas e fotos | Adaptador compilado executado com SDK e chave publishable. Busca/detalhes privados vazios; Mundo Novo/MS retornada. Sem registros publicados no projeto |
| Storage real | Assinatura anônima de fotografia de rascunho existente | Negada, NoSuchKey; nenhum arquivo enviado, excluído ou tornado público |
| Navegador + Supabase real | Busca com filtros e URL direta do rascunho técnico | Estado vazio; Perfil não encontrado sem nome privado exposto; console sem erros/avisos no ensaio |
| SDK com HTTP interceptado | Colunas, filtros, aliases, limites/offset, assinaturas e erros | Testes locais; não provam resultados positivos em registros operacionais publicados |
| UI com repositório simulado | Paginação/URL, preços, contatos, galeria, erros e respostas atrasadas | Fixtures restritas a teste; não cadastradas no banco |
| PostgreSQL 17 temporário | RLS e busca equivalente, serviços inativos, área fora da sede, pending/deleting, dados legais, despublicação | 101 verificações SQL/RLS locais. Storage é schema mínimo simulado; publicação local em fixtures não é uma operação administrativa remota |
| Visual | 24 cenários em 375, 390, 768 e 1280 px | Nenhum overflow da página; três abas; modal dentro da viewport; imagens carregadas. Carrossel por teclado e abertura de perfil verificados |

Os testes automatizados incluem regressão do filtro de cidade, que podia retornar a Todas após a atualização assíncrona do catálogo; agora o seletor é controlado. Nenhuma alteração em schemas ou permissões foi usada para resolver isso.

## Capturas — dados simulados locais

| Tela | Celular | Desktop |
|---|---|---|
| Início/carrossel | [390 px](screenshots/pr8/home-390.png) | [1280 px](screenshots/pr8/home-1280.png) |
| Resultados | [375 px](screenshots/pr8/search-375.png) | [1280 px](screenshots/pr8/search-1280.png) |
| Perfil | [375 px](screenshots/pr8/profile-375.png) | [1280 px](screenshots/pr8/profile-1280.png) |
| Galeria ampliada | [390 px](screenshots/pr8/enlarged-390.png) | [1280 px](screenshots/pr8/enlarged-1280.png) |
| Sem resultados | [390 px](screenshots/pr8/empty-390.png) | [1280 px](screenshots/pr8/empty-1280.png) |
| Falha de consulta | [390 px](screenshots/pr8/error-390.png) | [1280 px](screenshots/pr8/error-1280.png) |

[Métricas](screenshots/pr8/metrics.json). Fixtures de prestadores e imagem sintética não representam profissionais ou trabalhos reais; o harness visual foi removido antes do build final e não faz parte do aplicativo.

## Pendências e escopo preservado

1. Atualmente os três negócios permanecem draft. Resultados positivos reais exigem profissionais legitimamente publicados por uma operação administrativa revisada e autorizada, ainda inexistente. Este PR não cria atalho de aprovação/publicação no frontend nem altera qualquer rascunho para preencher telas.
2. Conferir um celular físico e validar resultados públicos positivos quando houver um negócio publicado autorizado. Emulação de viewport e fixtures não equivalem a esse ensaio operacional.
3. Publicações de trabalhos e seção de trabalhos recentes ficam exclusivamente para o PR #9, com seleção explícita e migração própria. A galeria deste PR lê somente o portfólio já existente no perfil público; nenhuma foto virou publicação de descoberta automaticamente.

Sem feed social, avaliações, chat, orçamentos internos, pagamentos, Asaas, categorias novas, landing page, Docker, backup manual ou publicação no Lovable. A revisão técnica precede qualquer merge; um futuro merge poderá disparar deployment automático da main pela Vercel.
