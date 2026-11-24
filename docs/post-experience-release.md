# Publicações: grade, feed privado e detalhe completo

## Evidência operacional em leitura (24/11/2026, America/Campo_Grande)

Projeto conferido: yazdjiwaksamizrbqewq, ACTIVE_HEALTHY. Consulta agregada dos vínculos owner da conta autorizada: um negócio pertencente à conta, em draft; uma foto identificada pela legenda UFMS, ready e com legenda; nenhum vínculo dessa foto com work_post_images; nenhum work_post da conta e nenhuma imagem direta selecionada de post. Zero posts com negócio e post publicados. Não foram retornados IDs, caminhos, texto de legenda, tokens ou dados privados na evidência agregada.

Portanto UFMS é fotografia de trabalho do portfólio, não publicação. Não existe post em rascunho para abrir no feed desta conta neste momento. Não aparecer na Home é correto: a foto não é um post e o negócio não está publicado. Nenhuma conversão automática, criação de post ou publicação foi feita para demonstrar a interface.

## Escopo de código

- Perfil próprio e prévia: grade de capas de publicações, separada de Fotos de trabalhos · Portfólio; abertura do post completo. Fotos avulsas mantêm detalhe de legenda/serviço e reaproveitamento somente por ação expressa.
- Aba interna Meu feed (não é nova aba principal): dados salvos, aviso Rascunho — só você vê; mesmas composição, ordem de fotos, título e legenda do detalhe público. Paginação e erro/retry explícitos; reconsulta ao retornar; salvar atualiza a lista.
- PostContent compartilhado por detalhe público, detalhe privado, feed privado e prévia de criação. Modal maior no desktop e limitado à visual viewport; cancelamento do editor preservado.
- Perfil/serviços do negócio correto; âncora aguarda consulta antes de rolar. Visitante pode Conversar, mantendo o destino no login existente, e WhatsApp somente quando configurado. Responsável vê gerenciamento, sem contato consigo mesmo. Falha de leitura do vínculo não é tratada como prova de ser visitante.
- Home continua usando exclusivamente publicPosts, cliente sem sessão, status published do post E do negócio e as políticas existentes. Corrigida a projeção de portfólio: images.limit era 1, apesar do carrossel; agora é 6. Fotos diretas são apresentadas apenas se selected e ready. Cards levam ao post, perfil e serviços; revalidam ao voltar à aba.
- Foto primeiro, até seis, ordenar, legenda, título obrigatório pelo modelo atual e confirmação explícita continuam iguais. Rascunho não publica; o compositor usa a mesma composição visual.

Não há migração, alteração de RLS/Storage/permissões, comando de publicação, mudança de assinatura/trial ou regra financeira neste diff. O salvamento usa as funções existentes, somente por ação do responsável. #52 permanece separado em draft.

## Testes e limites

45 testes direcionados de posts, perfil, carrossel e transporte SDK passaram; os cenários afetados pela mudança de rótulo final foram reconferidos (14 testes). Um teste legado da Conta ainda procurava o link antigo na lista; foi atualizado para conferir a capa, o detalhe, a edição e a ausência de contato consigo mesmo. Typecheck e build passaram. Existe aviso já conhecido sobre import estático/dinâmico de ProfilePreviewPage; não bloqueia o build.

Nova regressão cobre grade → detalhe → editar/cancelar; save → atualização imediata → feed; retorno à aba; falha/retry; destino dos serviços; login com next da conversa; responsável sem contato próprio; ausência real de WhatsApp; Home sem consulta privada; filtros de publicação e exclusão de imagens pending/staged.

Emulação Chromium local e offline de 320, 375, 390, 393×852, 430, 768, 1280 e 1440 px: sem overflow da página/modal, duas imagens e seta funcionando, fechamento e cancelamento sem gravação. Viewport de 360 px de altura simula espaço do teclado, não o teclado/barra do Safari. Nenhuma chamada externa permitida. Imagens cinzas são placeholders sintéticos intencionais. Capturas e resultados: evidence/post-experience/. Script: scripts/post-experience-qa.mjs (usa puppeteer-core externo informado em PUPPETEER_MODULE, não adiciona dependência ao aplicativo).

Não houve teste físico no Safari, Android ou iPhone, upload real, criação de post operacional, conversa real ou publicação nesta rodada. UI em produção será avaliada pelo titular. Testes simulados não comprovam entrega de mensagens ou persistência operacional de post que ainda não existe.

## Caminhos na produção após a integração autorizada

1. Conta → Meu perfil profissional → Projetos → Fotos de trabalhos · Portfólio → foto UFMS: detalhe de imagem, legenda salva, serviço e edição.
2. Conta → Meu perfil profissional → Meu feed: lista privada dos posts salvos. Hoje está vazia; para criar, usar Adicionar → Publicação, ou abrir UFMS → Usar esta foto em uma publicação, selecionar outras até seis, ordenar, legenda/título e confirmar salvar rascunho. Nenhuma imagem é enviada sem confirmação. Abrir/cancelar não é upload aprovado.
3. Início → Trabalhos recentes: somente posts e negócios publicados, sem rascunhos. Não contornar consulta para exibir material privado.

Antes de qualquer publicação real, apresentar negócio/post identificados de forma consentida, visibilidade pública e impacto da primeira aprovação administrativa (início dos 90 dias, salvo isenção aplicável). Exige decisão específica; a autorização de interface não inclui essa operação.
