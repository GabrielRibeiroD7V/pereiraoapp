# Base visual e navegação — PR 1

## Escopo

React + TypeScript estrito + Vite + Sass. Rotas públicas `/`, `/buscar`, `/conta` e fallback para caminhos desconhecidos. Acesso livre, sem autenticação ou dados simulados. Uma única navegação com três destinos, inferior no celular e horizontal no desktop.

Os conteúdos das páginas são provisórios e pequenos: este PR prepara a estrutura, não implementa marketplace, busca, conta autenticada nem espaço profissional. Não há conexão com banco, analytics, cobrança ou envio de formulários.

## Organização

- `src/app`: rotas e composição do aplicativo.
- `src/components`: estrutura, navegação, marca textual, títulos, links de ação e estado informativo.
- `src/pages`: pontos de entrada das três telas e página não encontrada.
- `src/styles/_tokens.scss`: cores, fonte, medidas e espaçamentos centralizados.
- `src/types`: contratos de domínio e interfaces para adaptadores futuros.
- `src/config/categories.ts`: categorias definitivas e mapeamento central de imagens, ainda nulo.

## Design

Amarelo `#FFD000`, azul-marinho `#0B1739`, branco e cinza-claro. Inter é a primeira fonte da pilha, com fallback local: nenhum arquivo de fonte foi fornecido ou baixado. Marca textual provisória, sem extrair/redesenhar o logotipo das referências. Ícones Lucide. Alvos de toque mínimos de 44 px, foco visível, link para pular navegação e foco no título ao trocar de rota.

Breakpoint de navegação: 768 px. Largura máxima: 1120 px. Cabeçalho apresenta Mundo Novo/MS como localização inicial estática: não há seletor inativo fingindo funcionar. Controle de cidade será incorporado com os filtros de busca. Área segura inferior reservada no celular.

## Dados futuros

Contratos não representam tabelas já criadas. O adaptador Supabase precisará mapear e validar dados externos e aplicar RLS no banco. `ownerId` no cliente não concede autorização. As imagens oficiais e as dos prestadores têm tipos diferentes; portfólio e serviços aceitam somente imagens de prestadores. Avaliação e verificação são opcionais; não existem valores inventados. Preços usam centavos e união discriminada.

As seis categorias têm `officialImage: null`. Não há fotografias aleatórias, cópias dos mockups ou placeholders fotográficos. Uma grade com as imagens reais pertence ao próximo PR.

## Limitações e próximos PRs

Busca, filtros, perfis, autenticação, cadastro, upload, métricas e assinatura não são parte desta entrega. Não há dependência do SDK Supabase nem variáveis de ambiente. Nenhuma migração, tabela ou publicação é executada por este código ou CI.

A hospedagem futura precisa servir `index.html` para as rotas da SPA, mantendo assets existentes. Essa configuração depende do destino escolhido e não foi aplicada à Vercel/Lovable. A política de redirects de autenticação também será configurada em etapa própria.

Verificações automatizadas cobrem as três abas, estado ativo, navegação pública, foco, acesso direto no roteador, título e recuperação de rota desconhecida. Elas não substituem revisão visual em aparelhos nem validam configuração de hospedagem. O PR não inicia servidor público nem publica prévia.
