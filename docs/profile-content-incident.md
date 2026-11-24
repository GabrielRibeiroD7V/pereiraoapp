# Foto, publicação e atualização do perfil

Leitura operacional autorizada: a foto identificada pelo texto UFMS existe em portfolio_items, media_state=ready, com legenda persistida, sem serviço associado e sem vínculo em work_post_images. Não há work_posts do negócio acompanhado. Portanto não é post nem publicação pública; o negócio permanece draft. Não foram copiados IDs/caminhos ou conteúdo pessoal para esta documentação.

Legenda: ProfilePreviewPage guardava apenas URL no estado enlarged e renderizava img no Modal, descartando caption/service_id. Agora o detalhe usa o registro, mostra legenda (ou ausência explícita), serviço disponível (ou ausência), e edição pelo responsável via PhotoEditor existente. Na visão pública, a projeção usa FK existente para nome do serviço; políticas existentes ocultam serviços inativos/privados. Sem escrita nova no banco, alteração de grants ou migração.

Atualização: o perfil fazia leitura somente na montagem/troca de dependências; a aba aberta em outro computador não revalidava no retorno. O mesmo valia para usePublicQuery/useBusinessWork. Novo hook reúne focus/pageshow/visibilitychange/online e reconsulta quando visível, preservando sessão/storage e abortando/ignorando respostas antigas. Mudança de negócio limpa a seleção antiga. Estado é local à aba, não cache público. Salvamento já chama refresh no fluxo correspondente.

Limite da evidência: metadata foi criada aproximadamente 0,72 s antes do objeto e está ready agora. Não há timestamp de finalize em portfolio_items nem horário da observação no computador. Isso NÃO prova atraso de Storage/CDN nem mede o tempo até ready. Falta de revalidação é causa reproduzida para aba aberta; não é apresentada como explicação exclusiva de qualquer atraso histórico. Sem apagar cache/sessão.

Capa de publicação própria agora abre autor, título, legenda e todas as fotos em ordem, com “Rascunho privado”. A prévia privada do responsável inclui seus dados salvos, inclusive drafts; rotas continuam protegidas/getEditable. Visitantes/Home seguem somente repositório público/RLS de post+negócio publicados. Um item de portfólio não é convertido nem publicado automaticamente. A grade explica as duas finalidades e remove acesso ambíguo via imagem sem contexto.

Testes novos: detalhe com/sem legenda/serviço, edição/cancelamento, capa do draft, reconsulta agrupada no retorno e isolamento do negócio. Sem ensaio operacional de criação, publicação, mensagens ou cobrança. Nenhuma foto foi enviada em nome do titular. Sem teste físico Safari nesta rodada; prints citados não foram anexados ao pedido.
