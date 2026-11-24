# Evidências visuais — correções #53 / #54

Build local do #54 sobre #53; /qa/profile-editor/?view=profile. Dados sintéticos e repositórios somente em memória, Supabase desligado. Chromium emulado, NÃO Safari físico. Nenhuma imagem operacional usada ou enviada.

- [Detalhe mobile 393 px](detalhe-mobile.jpg) e [desktop 1280 px](detalhe-desktop.jpg): imagem, legenda, serviço e ações. O botão reutilizar foto pertence ao #54, não ao #53 isolado.
- [Seleção de três fotos](tres-fotos-mobile.jpg): miniaturas e botão acima da grade.
- [Carrossel mobile](carrossel-mobile.jpg) e [desktop](carrossel-desktop.jpg): todas as fotos ordenadas com setas/posição.
- [Legenda em 393×340](legenda-altura-reduzida.jpg) e [ações ao rolar](acoes-altura-reduzida.jpg): o cabeçalho permanece, os campos e ações rolam sem sobreposição. É uma simulação de espaço disponível, não teclado físico.
- [Feed privado mobile](feed-privado-mobile.jpg), [post completo mobile](post-completo-mobile.jpg) e [desktop](post-completo-desktop.jpg). Rascunho sintético criado apenas na memória de QA para inspecionar a interface. Recarregar a demo apaga esse estado, não representa persistência operacional.

Conferência em 320, 375, 390, 393, 430, 768 e 1280 px: sem overflow horizontal do documento, diálogo dentro da viewport. O carrossel tem rolagem horizontal interna intencional. Seleção múltipla de três arquivos foi exercitada no seletor do browser de emulação; também foi conferida reutilização de uma foto + duas novas. Cancelar sem gravação é coberto pelo teste direcionado; o salvamento visual foi somente no backend de memória.

Em produção, a foto UFMS continua um registro de portfólio e nenhum conteúdo foi convertido/publicado por estes ensaios. Validar o novo Preview normal com sessão legítima e conferir Safari/iPhone, Android e desktop reais antes do aceite.

Correção após inspeção: a regra legada de três colunas de posts foi sobreposta por uma coluna de feed. Medição final em 393 px: card=361 px, lista=361 px, sem overflow do documento. As capturas finais de feed/post completo usam um draft pré-carregado de duas fotos sintéticas (`&posts=demo`); as capturas do compositor usam seleção de três fotos. Ambos exclusivamente em memória, sem banco operacional.
