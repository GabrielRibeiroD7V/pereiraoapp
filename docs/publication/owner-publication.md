# Publicação pelo responsável — proposta, não aplicada

Projeto: `yazdjiwaksamizrbqewq`. Base: main `99875a5` (fundação #74 já integrada externamente).

Migração: `20261125004446_owner_publication.sql`.
SHA-256: `eca2e53116b3a87f2b9adb6f05e638a56f235ab8f091af1949209850940990c0`.

## Regra

Dono com conta habilitada e e-mail confirmado publica o próprio perfil pelo app, sem aprovação administrativa. Perfil completo exige bio, WhatsApp, categoria, cidade e área ativas. Serviço é opcional. Publicar o perfil divulga apresentação/contatos, serviços ativos e portfólio ready; não publica posts em rascunho. Cada post tem ação própria e exige mídia íntegra. Post profissional independe do estado público do negócio: publicar o post torna somente sua composição e identificação de autor públicas, sem expor bio, contato ou serviços de um negócio draft. RPC de projeção pública evita JOIN que revele o negócio privado. Só as fotos do portfólio explicitamente selecionadas em um post público recebem leitura pública. Até 10 transições de publicação por hora por conta, serializadas com a moderação.

Editar conteúdo publicado retorna o post a não publicado e exige republicação explícita. Retirar perfil remove seus dados e serviços da busca; os posts continuam públicos até sua retirada separada. Excluir perfil retira seus posts, preservando histórico. Moderação de conta/negócio retira os posts; remover a suspensão não os republica. Excluir perfil é retirada lógica, mantendo vínculos/conversas/histórico; o texto da confirmação informa isso. Excluir post segue o ciclo existente, preservando fotografias originais do portfólio. Limpeza definitiva dos arquivos é um procedimento próprio, sem exclusão direta de storage.objects.

Gestão de conteúdo profissional passa a ser somente owner; papel de administrador interno de negócio não dá gestão nem acesso a rascunhos. Administrador da plataforma mantém revisão/moderação por RPCs próprias, com justificativa e auditoria, sem editar/publicar como dono. Retirar suspensão deixa o negócio não publicado, para nova ação do dono. E-mail confirmado é verificado no banco, não por user_metadata editável.

Denúncias: autor autenticado e confirmado, alvo público, motivo 10–1000 caracteres, uma denúncia por conta/alvo, limite de cinco por hora. Dados privados; painel lista registros reais. Encerrar análise não esconde conteúdo: suspensão/retirada são decisões auditadas separadas. Indicadores reais de usuários, posts, conversas, denúncias e assinaturas; ausências retornam zero ou indisponível.

## Preflight remoto somente leitura

24/11/2026: quatro negócios draft, um post draft, zero assinaturas/ativações, uma isenção, initial_free com relógio e operações financeiras false. Nenhuma publicação executada. Histórico até `20261124230953`.

CLI 3.4.0: `db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault --output-format json` listou **somente** esta migração, sem roles/seeds. Não foi aplicado SQL. Reconfirmar hash, histórico e estados imediatamente antes de uma aplicação autorizada.

Adições: businesses.deleted_at (nulo em todos os registros atuais), tabelas privadas publication_actions e content_reports com RLS sem acesso direto, RPC de publicação do dono, denúncias e resolução administrativa. Substitui funções revisadas de gestão/publicação/moderação e consulta; não concede UPDATE direto de status, não altera autores, mídia, estados ou funções financeiras. As quatro linhas draft e o UFMS permanecem intactos.

## Sequência / contenção

1. Revisar SQL/hash e autorizar exclusivamente esta expansão, sem incluir a evolução pessoal dependente.
2. Aplicar versão exata; validar em leitura ACL/RLS, funções e preservação. Não publicar dados para testar.
3. Decisão própria de merge/deploy. Código anterior continua compatível com schema; UI antiga não terá o botão novo, e a nova regra proíbe publicar pelo admin. Janela curta entre SQL e deploy é intencional, sem publicação automática.
4. Só o titular testará o botão real e decidirá publicar os conteúdos. Testes locais/Preview não equivalem a publicação real ou Safari físico.
5. Contenção: reverter código não basta para desabilitar RPC owner; se houver defeito de autorização, revogar EXECUTE da nova RPC em procedimento SQL próprio e autorizado, sem apagar dados e mantendo leitura pública dos já publicados conforme decisão. Preservar auditorias e jamais restaurar triggers antigos de trial. Não reaplicar migrações históricas inteiras.

## Testes

SQL nativo descartável cobre dono, visitante, terceiro, administrador, confirmação, mídia, busca pública, isolamento, retirada, bloqueio/reliberação, denúncia, exclusão lógica e ausência de assinatura/trial. Testes UI cobrem confirmar/cancelar/falha e administração sem botão de aprovação. Nenhum dado sintético foi criado no remoto.

A evolução de contas pessoais/feed único vem em PR dependente: clientes não recebem negócio fictício e não precisam cadastrar serviço.
