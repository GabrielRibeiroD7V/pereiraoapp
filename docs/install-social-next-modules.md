# Instalação e módulos sociais posteriores

Direção de produto atualizada: [plano por etapas](product-roadmap.md). A publicação aberta substitui a antiga dependência de aprovação prévia mencionada no histórico abaixo. Propostas de salvar, curtir e comentar continuam futuras; não precedem a validação da base funcional.

## Regra objetiva de instalação nesta proposta

Aba flutuante compacta acima da navegação e da safe area, com animação curta (desativada com movimento reduzido), sem abertura automática de modal. Elegível antes e depois do login: Home, Buscar, perfil/trabalho público, Conta e prévia salva do próprio perfil. Não aparece em autenticação, cadastro/edição, mensagens, administração ou finanças.

Exigir 45 segundos e interação real; exibir somente com página visível, online, sem campo focado, teclado virtual, modal ou operação aria-busy. O tempo de espera é decorrido na página elegível, não um contador de atenção comprovada. Ao interagir com formulário ou abrir modal, esconder temporariamente o convite; não roubar foco. Apenas o convite aparece automaticamente, nunca as instruções ou prompt.

Registrar uma exposição local por navegador a cada 14 dias, mesmo sem X; navegar, entrar ou recarregar não reinicia esse limite. X/Entendi também dispensa por 14 dias, preservando dispensas anteriores. Acesso manual permanente em Conta → Opções da conta → Aplicativo PEREIRÃO (e na Conta do visitante), independente desse prazo. Sem armazenamento de preferências disponível, suprimir convite automático e manter manual. Nenhuma limpeza de dados ou alteração de sessão.

Standalone/appinstalled suprime convite e informa estado instalado no acesso manual. Não é possível garantir detecção de instalação realizada em outro navegador/contexto. Aceitar prompt não equivale a conclusão da instalação.

iPhone: Safari → Compartilhar → Adicionar à Tela de Início; navegador diferente orienta abrir o endereço no Safari. Android/desktop compatível: beforeinstallprompt nativo no toque; confirmar conclusão somente em appinstalled. Sem evento, orientação manual correta. Não cria atalhos por JavaScript. Mesmos componentes existentes, sem alteração de cache/Storage/financeiro.

## Catálogo de serviço — diagnóstico limitado

Leitura operacional: seis categorias ativas; categorias têm SELECT público condicionado somente a active, sem filtro por negócio. getCatalog consulta todas e ServiceEditor mapeia catalog.categories, com select nativo. Não há restrição a Climatização no código ou banco revistos. A observação do seletor no Safari físico continua pendente: um campo fechado mostrar a opção selecionada não comprova que existe somente uma opção. Não foram alteradas categorias, especialidades ou serviços do titular. Validar no aparelho abrir Categoria e conferir lista; se vier somente uma, registrar versão e retorno da consulta antes de modificar modelo. Teste local de seis opções e seleção de Construção/Elétrica pode validar contrato sem simular aceite físico.

## Salvar, curtir e comentar — propostas, NÃO implementadas

Dependência: primeiro homologar privado → publicação de post/negócio autorizada → descoberta → texto entre contas. #52 continua draft separado; nenhuma marcação ativada.

1. **Salvar posts**: futura tabela post_bookmarks (user_id,post_id,created_at), PK composta, RLS só o próprio usuário para leitura/escrita; alvo apenas post/negócio públicos no momento da ação. Lista privada, removida da apresentação quando post suspenso/retirado. Não exibir total de pessoas que salvaram, não expor interesses individuais a prestadores. Aceite: salvar/remover idempotente, persistência entre sessões e isolamento de duas contas em iPhone/Android/desktop. Conteúdo próprio draft continua em feed privado do dono, não é um bookmark público.
2. **Curtir**: futura post_reactions (user_id,post_id,kind='like',created_at), UNIQUE usuário/post, uma reação por conta habilitada; RPC transacional e limites por conta/IP com janela/dados mínimos. Contagem derivada de reações válidas em posts públicos, não incrementos arbitrários do cliente. RLS não deve expor lista de usuários por conveniência. Retirada/moderação oculta ação e total; antipadrão a evitar: contar drafts ou likes desativados. Aceite: duplicidade/concorrrência, remover, abuso, contagem real após recarga e sem acesso a drafts.
3. **Comentários**: futura post_comments (id,post_id,author_id,body,status pending/visible/hidden/deleted,created_at,edited_at) + denúncias/auditoria em schema privado. Somente autor autenticado habilitado envia, limites de tamanho/frequência, texto renderizado como texto (sem HTML), URLs com esquema permitido. Administração modera com motivo/auditoria; autor edita/remove o próprio comentário com tombstone e prazo aprovado. Contagens apenas visible e alvo público. Não interpretar interação como prova de contratação. Riscos: spam, assédio, dados pessoais e custo de moderação; definir responsável, política/retention e denúncia antes de liberar.

Nenhuma tabela acima foi criada ou migração aplicada. Cada módulo exige modelo SQL, RLS, preflight, plano de contenção e autorização específica em PR posterior; números não serão exibidos antes de implementação e dados reais. Não adiciona estrelas, selo, reputação, endosso ou seguidores.

## Feed privado e Home

#53 diferencia registros e torna a capa clicável; #54 permite prévia com carrossel completo e reaproveita uma foto sem duplicar arquivo. Dono vê seus drafts na área privada, com rótulo Rascunho privado; visitantes e Home continuam no repositório público condicionado a publicação. Publicar post e negócio são ações explícitas separadas. A Home atual coloca Trabalhos recentes antes do convite profissional; carregar mais trabalhos empurra o convite para baixo. Decisão de produto futura: manter convite compacto antes da lista expansível ou limitar prévia da Home com link Ver trabalhos; não mudar a ordem silenciosamente junto ao reparo de legenda. Sem post publicado no operacional não há evidência de uso real desse layout com muitos posts.
