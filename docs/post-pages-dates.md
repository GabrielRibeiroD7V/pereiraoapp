# Publicações com página própria

Escopo: interface e leitura; nenhuma migração ou escrita operacional.

- Capa em Projetos ou título/imagem em Meu feed abre `/conta/profissional/:businessId/publicacoes/:postId`; a composição como cliente usa `/conta/profissional/:businessId/previa/publicacoes/:postId`.
- Público continua em `/trabalhos/:postId`, consultando somente post e negócio publicados. URL privada exige sessão e vínculo, consulta o par negócio/post e depende da RLS existente. Prévia não apresenta edição.
- Voltar usa histórico quando a origem vem de um link do aplicativo; link direto oferece retorno ao perfil. Seção, página e posição são guardadas em memória, sem dados do perfil; não muda armazenamento de sessão.
- Criado e Publicado vêm de `work_posts.created_at` e `published_at`; rascunho não ganha uma data publicada. Hoje/ontem usam o dia local do navegador.
- A fotografia avulsa continua no portfólio, com detalhe e legenda; nenhum conteúdo é convertido em post.

## Validação

53 testes focados: navegação, retorno de seção, edição/cancelamento, rotas diretas, retorno ao login, rejeição de leitura, prévia sem gestão, datas e transporte do SDK. Typecheck e build aprovados.

Chromium local com dados sintéticos: 320, 375, 390, 393, 430, 768, 1280 e 1440 px; carrossel, menu, retorno e cancelamento do editor; redução de viewport a 360 px simula espaço do teclado. Sem requisições externas ou gravações no Supabase. Isso não é um teste físico do Safari.

O post UFMS e seu negócio continuam em draft; a Home pública não pode exibi-los. Conteúdo e fotografias operacionais não foram alterados.
