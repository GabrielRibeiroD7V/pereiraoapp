# Contato entre contas — dependente da publicação pessoal

O chat existente dependia de um negócio publicado. Este PR acrescenta contato privado de texto com o autor de uma publicação pública, sem criar negócio para conta pessoal e sem expor os contatos de um perfil profissional privado.

## Interface/API

Post pessoal público → Conversar → login com retorno ao destino, se necessário → mensagem inicial → mesma aba Conversas. Publicação profissional com perfil privado também oferece Conversar com o autor pelo projeto; com perfil público, preserva contato profissional/WhatsApp. Conta pessoal não ganha botão de WhatsApp ou serviços inventados. Mensagens profissionais antigas continuam na mesma caixa.

Duas tabelas privadas novas com RLS e sem acesso direto: account_conversations e account_messages. Participantes canônicos, autoria derivada de auth.uid, e-mail confirmado para envio, bloqueio de conta efetivo. Só participantes leem o histórico. Iniciar contato exige autor de post pessoal público ou alvo de post profissional público; UUID arbitrário de autor com apenas rascunho não permite iniciar contato. Não inclui fotos no chat, presença, contador ou visualizado.

Máximo de 20 novas conversas/dia e 100 mensagens/dia, espera de três segundos entre envios da mesma conta, serialização por autor. request_id do cliente estável durante retry torna a entrega direta idempotente, inclusive resposta perdida. Não altera o contrato legado de histórico/contato profissional; envio legado mantém suas regras anteriores. Métrica administrativa agrega os dois canais persistidos, sem expor conteúdo das mensagens.

## Preflight

Projeto `yazdjiwaksamizrbqewq`. Arquivo `20261125013057_account_conversations.sql`, SHA-256 `d220a36a8e5853a55451666064f28075e229cc60163fe127f65ac5f2cea86d27`.

Depende de owner_publication e personal_posts, nessa ordem. O dry-run final é cumulativo: deve listar exclusivamente essas três migrações propostas, sem antigas, seeds ou roles. Não aplicado remotamente. Nenhuma linha operacional é criada, atualizada ou excluída pela expansão. Funções existentes e histórico de conversas legadas permanecem; as novas APIs são adicionais. Financeiro permanece intocado.

Sequência: autorizar SQLs exatos → aplicar/validar expansões em ordem → integrar #75, publicação pessoal, visual e este contato, atualizando bases/diffs/CI após squash → READY/SHA/domínio em cada deploy → operação explícita dos donos e ensaio com duas contas legítimas. Não pedir autorização rotineira de merge já concedida; SQL segue decisão própria. Não publicar UFMS/negócios para preencher teste.

Contenção: manter versão anterior se validação falhar; revogar novas APIs de escrita em procedimento SQL próprio e autorizado caso necessário, sem apagar histórico nem mexer na fase gratuita. Desativar frontend não revoga endpoints. Não remover funções/tabelas enquanto existirem conversas ou clientes dependentes.

## Testes e ensaio real pendente

SQL local com duas contas + terceiro: alvo privado rejeitado, alvo público permitido, conversa nos dois sentidos, retry sem duplicação, limite, isolamento, anônimo rejeitado e suspensão bloqueando entrega. UI verifica retorno/login, caixa comum, ausência de contato profissional inventado e retry conservando request_id. São fixtures em banco descartável; não são conversas de usuários reais.

Após implantação: A publica deliberadamente um post consentido; B encontra no feed/perfil e envia texto; A responde; ambos recarregam/entram novamente e conferem conteúdo e autoria. Terceiro não abre conversa pela URL/API. Este ensaio exige duas sessões legítimas e consentimento dos participantes; não houve envio operacional nesta entrega. Safari/iPhone físico segue pendente.
