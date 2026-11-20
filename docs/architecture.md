# Base visual, navegação e tela inicial

## Escopo

React + TypeScript estrito + Vite + Sass. Rotas públicas `/`, `/buscar`, `/conta` e fallback para caminhos desconhecidos. Acesso livre, sem autenticação ou dados simulados. Uma única navegação com três destinos, inferior no celular e horizontal no desktop.

O PR #2 implementa a tela inicial com uma pesquisa pública que navega para `/buscar?q=...`, seis categorias com links `/buscar?categoria=...`, lista de profissionais em estado vazio e convite compacto para anunciar. O destino reconhece os parâmetros, mas não consulta profissionais. Não há conexão com banco, analytics, cobrança, conta autenticada ou espaço profissional.

## Organização

- `src/app`: rotas e composição do aplicativo.
- `src/components`: estrutura, navegação, marca oficial, títulos, links de ação, busca, categorias e lista de prestadores.
- `src/pages`: pontos de entrada das três telas e página não encontrada.
- `src/styles/_tokens.scss`: cores, fonte, medidas e espaçamentos centralizados.
- `src/types`: contratos de domínio e interfaces para adaptadores futuros.
- `src/config/categories.ts`: categorias definitivas e mapeamento central de imagens, ainda nulo.

## Design

Amarelo `#FFD000`, azul-marinho `#0B1739`, branco e cinza-claro. Azul `#0066CC` e laranja `#FF6A00` são complementares aproximados centralizados nos tokens, sem substituir as cores da imagem oficial. Inter é a primeira fonte da pilha, com fallback local: nenhum arquivo de fonte foi fornecido ou baixado. Marca oficial em PNG, proporcional e com fundo branco preservado. Ícones Lucide. Alvos de toque mínimos de 44 px, foco visível, link para pular navegação e foco no título ao trocar de rota.

Breakpoint de navegação: 768 px. Largura máxima: 1120 px. Cabeçalho apresenta Mundo Novo/MS como localização inicial estática: não há seletor inativo fingindo funcionar. Controle de cidade será incorporado com os filtros de busca. Área segura inferior reservada no celular.

## Dados futuros

Contratos não representam tabelas já criadas. O adaptador Supabase precisará mapear e validar dados externos e aplicar RLS no banco. `ownerId` no cliente não concede autorização. As imagens oficiais e as dos prestadores têm tipos diferentes; portfólio e serviços aceitam somente imagens de prestadores. Avaliação e verificação são opcionais; não existem valores inventados. Preços usam centavos e união discriminada.

As seis categorias têm `officialImage: null` e aparecem na grade com placeholders cinza e ícones minimalistas, sem fotografias aleatórias ou cópias dos mockups. `CategoryTile` aceita o contrato oficial existente, mantém proporção fixa e fallback neutro em caso de falha de imagem. O mapeamento continua em `src/config/categories.ts`.

`ProviderList` aceita resumos tipados de prestadores, com avatar, nome, especialidade, cidade, avaliação opcional e link futuro `/prestadores/:slug`. A tela inicial passa uma lista vazia. O destino de perfil será implementado no PR próprio antes de conectar registros reais; nenhum link de prestador é exposto atualmente. Fixtures existem somente nos arquivos de teste e não fazem parte do bundle.

## Limitações e próximos PRs

Consulta real de busca, filtros avançados, perfis, autenticação, cadastro, upload, métricas e assinatura não são parte desta entrega. Não há dependência do SDK Supabase nem variáveis de ambiente. Nenhuma migração, tabela ou publicação é executada por este código ou CI.

A hospedagem futura precisa servir `index.html` para as rotas da SPA, mantendo assets existentes. Essa configuração depende do destino escolhido e não foi aplicada à Vercel/Lovable. A política de redirects de autenticação também será configurada em etapa própria.

Verificações automatizadas cobrem as três abas, estado ativo, navegação pública, foco, acesso direto no roteador, título, recuperação de rota desconhecida, pesquisa com caracteres especiais e navegação pelas seis categorias. Verificações visuais locais estão registradas em `pr2-validation.md`. Não foi publicada prévia nem alterada hospedagem.
