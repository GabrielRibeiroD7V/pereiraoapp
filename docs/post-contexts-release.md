# Post: contexto de acesso e proporções

## Estado operacional conferido somente em leitura — 24/11/2026

O único post UFMS do negócio Gabriel Ribeiro já está com título `Instalação natalina UFMS`, descrição `Instalação natalina ufms`, uma única associação à foto original ready do portfólio. Post e negócio permanecem draft. Não houve nova gravação ou duplicação para corrigir um título que já estava correto. Não se trata de marcação da UFMS, parceria, endosso ou verificação de execução do trabalho.

## Acesso: evidências de servidor, API e interface

- Responsável: sessão legítima foi usada na rodada operacional anterior para abrir/editar o próprio rascunho e confirmar persistência. A RPC existente exige auth.uid(), conta habilitada e vínculo owner/admin do negócio antes de qualquer operação. Este PR move controles para menu, sem conceder acesso.
- Ver como cliente: rota de prévia ainda exige sessão e autorização do responsável para ler um rascunho; não é uma publicação. Gerenciamento não é renderizado no detalhe, feed ou fotos; editores também recebem guard readOnly. Testes cobrem o menu ausente nesse contexto. A prévia não revoga a permissão real do proprietário de voltar à sua área de edição.
- Visitante anônimo operacional: GET work_posts com o post específico retorna HTTP 200 e []; GET de associações também retorna []. POST à RPC work_post_command (save com título nulo e seleção vazia, deliberadamente incapaz de criar conteúdo mesmo se passasse a autorização) retorna HTTP 401 / SQLSTATE 42501, permission denied. A RPC de composição de fotos diretas também foi testada com entradas inválidas e rejeitada. Nunca foram chamados publish/delete para testar segurança remota.
- Browser separado sem sessão: /trabalhos/<post> mostra Trabalho indisponível; /conta/profissional/<negócio>/publicacoes redireciona a Entrar com next correto. Nenhuma credencial ou token de usuário foi extraído.
- Inspeção remota: RLS ativa em work_posts/work_post_images, SELECT público depende de private.work_post_is_public; SELECT privado depende de private.can_manage_business. Sem UPDATE direto para anon ou authenticated. Execução da RPC é negada a anon; a função privada rejeita terceiro sem vínculo.
- Outra conta: não há segunda sessão legítima disponível nesta rodada. Isolamento de owner/admin/viewer/terceiro foi executado em PostgreSQL 17 descartável local com testes work_posts.sql e post_direct_photos.sql. Não é ensaio operacional com uma segunda conta. Rotas de terceiros e recusa do servidor também são cobertas por testes UI/SDK locais.

Não foi encontrada falha remota de autorização que exija migração/RLS nova. Ausência de botão não é usada como única evidência.

## Mudança visual e navegação

Post em uma coluna, autor/avatar no topo, foto/carrossel, título e legenda abaixo. Desktop limitado a 36rem para a composição e 38rem para o modal; sem coluna vazia ou três botões grandes. Perfil/serviços/contato são links discretos com áreas de toque adequadas; WhatsApp continua condicional. O responsável tem menu de reticências para Editar/Gerenciar; visitante não recebe menu e Ver como cliente não recebe controles. Feed, detalhe e prévia do compositor continuam usando PostContent. Grade de capas preservada, sem conversão de fotos avulsas em post.

Não implementa curtidas, salvar, comentários, selos ou contadores sociais. A contagem de imagens vem da coleção existente.

## Validação e limites

28 testes direcionados de conta/contextos/navegação passaram; typecheck e build aprovados. SQL/RLS de posts e fotos diretas passou em PostgreSQL nativo descartável, sem Docker ou acesso remoto. Build mantém aviso preexistente de import estático/dinâmico de ProfilePreviewPage.

Chromium local, fixtures sintéticas, tráfego externo bloqueado: 320, 375, 390, 393x852, 430, 768, 1280 e 1440 px. Perfil/grade, feed, detalhe, menu aberto dentro da viewport e edição/cancelamento; altura de 360 px simula teclado. Capturas em evidence/post-contexts/. Cinza é placeholder intencional, não imagem operacional. O script scripts/post-experience-qa.mjs foi atualizado para exercitar o menu visível.

Não comprova teclado, barras, gesto de pinça ou Safari físico. Esses testes dependem do aparelho do titular. CI não equivale a aceite físico. Nenhum upload ou conteúdo operacional foi criado por esses testes.

## Produção e preservação

Integração de código autorizada após diff e checks; nenhuma migração proposta ou remota. Nenhum post/negócio publicado, registro excluído, alteração de gratuidade, isenção ou cobrança. #52 permanece separado em draft. O post UFMS não aparece na Home porque post E negócio continuam draft. Publicação não será proposta nesta rodada: primeiro o titular revisa a apresentação corrigida em produção.

Caminho: Conta → seu perfil → Projetos → capa Instalação natalina UFMS; ou Meu feed. Ver como cliente abre a prévia sem menu de gerenciamento. Foto avulsa continua em Fotos de trabalhos · Portfólio. Home pública permanece sem rascunhos.
