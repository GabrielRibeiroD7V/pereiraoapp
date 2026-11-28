# Recepção avulsa Sandbox sem bypass Vercel

## Arquitetura desta proposta (não implantada)

`Asaas Sandbox → Edge asaas-admin-oneoff-sandbox-webhook → admin_oneoff_server(enqueue, sandbox) → inbox privado → reprocessamento administrativo no Preview → GET Asaas Sandbox → snapshot conciliado → Financeiro`.

A versão anterior #107 era um relay para um Preview protegido. Foi substituída: não há URL Vercel, bypass ou envio de credenciais do chamador na Edge. A proteção do Preview permanece intacta. O endpoint avulso Vercel e o webhook legado de assinaturas permanecem disponíveis e separados; não cadastrar ambos para a mesma finalidade nem alterar o legado.

A Edge recebe e persiste. **A conciliação é executada pelo backend administrativo existente, com sessão legítima**, em “Financeiro → Testes Asaas → Reprocessar eventos persistidos”. Não há worker autônomo, cron ou chave Asaas na Edge. O painel consulta o inbox imediatamente, mas um evento fica pendente até esse reprocessamento. Isso é uma limitação operacional explícita desta preparação, não confirmação automática de pagamento.

## Reuso e segurança

- Reutiliza a migração já aplicada `20261127230000_admin_oneoff_payment_tests`, sem SQL novo ou alterações de RLS/grants/digest.
- A projeção de notificações foi extraída para `_shared/oneoff-notice.ts` e compartilhada com o receptor Vercel. Aceita eventos CHECKOUT/PAYMENT conhecidos; só persiste eventId, tipo, objeto, checkout/referência UUID e ambiente fixo Sandbox. Não persiste corpo bruto, cartão, token, valor ou status alegados no evento.
- Token exclusivo é comparado por digests antes de ler o corpo. POST/JSON, caminhos exatos sem query, stream limitado a 64 KiB, sem destinos arbitrários. Falha de configuração retorna 503; token inválido 401; payload inválido 400/415/413; conflito 409; falha da RPC 503, sem ACK falso nem erro privado.
- RPC assinada com Web Crypto, protocolo `oneoff-v1`, nonce aleatório, timestamp e HMAC-SHA256 usando o digest do segredo Sandbox **existente**. Interoperabilidade testada contra o assinador Node; não altera o digest provisionado.
- Usa chave **publishable** na chamada REST, nunca service_role. Essa chave sozinha não permite escrita no schema privado. A RPC confere HMAC, ambiente e, nos comandos administrativos, administrador habilitado. A Edge só constrói `enqueue` e não aceita comando, ambiente ou ator do chamador.
- O segredo HMAC existente também autoriza outros comandos Sandbox na RPC; não é uma credencial de privilégio restrito a enqueue. Fica somente no servidor. No Supabase os secrets são do projeto, não um cofre isolado por função; a função lê explicitamente apenas os nomes listados abaixo. Uma credencial criptográfica independente com privilégio exclusivamente enqueue exigiria evolução separada da RPC e autorização de SQL. Não alegar isolamento criptográfico inexistente.
- A transação da RPC deduplica `(environment,event_id)`, rejeita o mesmo ID com projeção conflitante e só retorna após persistir. Timeout após commit deve ser reenviado com o mesmo eventId: novo nonce, uma única linha, `duplicate:true`.
- Eventos sem solicitação avulsa válida ficam `ignored` com metadados privados para investigação; não criam solicitação, pagamento ou direito. Estado terminal não é reaberto automaticamente: administrador investiga as referências e a autorização; se aparecer depois uma solicitação legítima, usa conciliação individual por API na solicitação, preservando o evento ignorado. Não editar vínculos ou apagar inbox para forçar sucesso. A prontidão que exige entrega processada continuará pendente até uma entrega real vinculada e processada.

## Conciliação preservada

`server/oneoff-billing.ts` mantém a única implementação de provider/snapshot e leases/backoff: busca oficial por checkout/referência, GET do pagamento conhecido, pagador, PIX/CREDIT_CARD, R$19,90, moeda, ausência de assinatura e parcelamento, checkout/referência, estado verdadeiro, taxas líquidas quando presentes e estornos. Payload de webhook e redirect não podem marcar `paid`. Falha após ACK continua durável no inbox e é retomada pelo administrador; quotas/idempotência e criação incerta não são reiniciadas.

## Configuração necessária — nomes, nunca valores no chat

Nenhuma configuração remota foi executada por este PR. Confirmar novamente o ref `yazdjiwaksamizrbqewq` antes de qualquer provisionamento.

| Configuração Edge | Ação posterior |
| --- | --- |
| `SUPABASE_URL` | Variável automática; deve ser exatamente `https://yazdjiwaksamizrbqewq.supabase.co`. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN` | Reutilizar o token exclusivo já configurado no Asaas; não rotacionar. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_RPC_SIGNING_SECRET` | Provisionar no servidor o mesmo valor de `BILLING_RPC_SIGNING_SECRET` Sandbox existente. Não gerar outro, não alterar o digest, não copiar pelo chat. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_PUBLISHABLE_KEY` | Chave publishable do projeto correto; não usar secret/service_role. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED` | Novo controle, default false. Somente após decisão de implantação/ativação, true exclusivamente para recepção. |

Os nomes antigos `ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED` e `ASAAS_ADMIN_ONEOFF_SANDBOX_PREVIEW_BYPASS` são ignorados pelo código novo. Nenhum bypass deve ser criado/reutilizado. Não remover secrets legados que pertençam a outras integrações.

Preview `feat/oneoff-sandbox` mantém HMAC e chave `ASSAS_API_KEY_SANDBOX` existentes. Não precisa de bypass nem acesso público. `ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED` no Preview é uma flag do endpoint Vercel e um gate de criação; **não precisa ser habilitada para receber na Edge nem para status/retry/reconcile**. Manter false nesta etapa. Manter false `ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED`, `ASAAS_ADMIN_ONEOFF_PRODUCTION_ENABLED` e todas as flags financeiras Production. Janelas do banco continuam fechadas. Não configurar credenciais financeiras neste Preview de revisão por conveniência.

## Implantação controlada posterior

1. Revisar diff, CI, SQL/RLS e Preview; registrar SHA aprovado. Preview Vercel não implanta Edge.
2. Conferir projeto/ref, migração aplicada e `initial_free`; janelas fechadas e zero operações. Conferir token existente sem revelá-lo e provisionar somente os dois nomes adicionais de servidor acima por canal seguro autorizado. Os nomes devem ser diferentes dos secrets Production; valores não devem coincidir com token ou segredo Production.
3. Manter receiver false e implantar **somente** `asaas-admin-oneoff-sandbox-webhook` com CLI/options reconferidas via `--help`: `supabase functions deploy asaas-admin-oneoff-sandbox-webhook --remote=yazdjiwaksamizrbqewq --no-verify-jwt --use-api`. Sem `--prune`, sem deploy de outras funções e sem SQL. Verificar versão/source do artefato. O token próprio substitui JWT nesta função; não remover autenticação dos demais endpoints.
4. Ativar apenas recepção com `ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED=true`, por decisão própria. Conferir configuração do webhook **avulso** Sandbox na URL `https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-admin-oneoff-sandbox-webhook`, token existente e eventos CHECKOUT/PAYMENT suportados. Não alterar webhook de assinaturas nem Production.
5. Fazer testes HTTP reais de token ausente/incorreto e payload malformado autenticado, sem inserir evento fictício. Devem rejeitar sem inbox. O teste local HTTP com fixtures deste PR não é entrega Asaas real.
6. No Preview protegido e sessão administrativa legítima, consultar status/reprocessamento. Fila vazia não prova entrega nem consulta API de conciliação.
7. Não criar pagamentos para comprovar infraestrutura nesta etapa. O teste de entrega documentado pelo Asaas depende de uma operação correspondente. Só após autorização posterior para cada teste Sandbox, observar entrega real nos Logs de Webhooks, HTTP 200, uma linha inbox com o mesmo evento, reprocessamento por GET e estado conciliado no painel. Reenvio deve indicar duplicidade sem outra operação.

## Contenção

Desabilitar somente receiver e webhook avulso Sandbox: retorna 503 sem falso ACK, permitindo retry posterior. Manter criação false e janelas fechadas. Inbox já persistido continua disponível ao reprocessamento administrativo mesmo com recepção desligada. Não cancelar contratos ou tocar legado. Rollback preferível: manter receiver false; voltar código só após revisão, sem restaurar bypass descartado. Não apagar registros ou rotacionar HMAC para conter falha.

## Evidências a preencher na entrega

Testes unitários e HTTP loopback usam somente memória/fixtures; SQL/RLS usa PostgreSQL descartável. Nenhuma entrega real, pagamento, ativação, secret remoto ou implantação Edge é comprovada por esses testes. O fluxo operacional completo segue pendente de configuração/implantação autorizada e de pagamentos Sandbox especificamente autorizados.

Referências oficiais consultadas:
- https://supabase.com/docs/guides/functions/auth
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

## Validação desta revisão

- 99 testes focados: receptor direto, avulsos e relay legado.
- Suíte completa: 93 arquivos, 1.054 testes aprovados.
- `npm run typecheck`, `npm run build`, `npm run test:migrations` e SQL/RLS PostgreSQL 17 local aprovados. O build preserva o aviso já existente de import dinâmico/estático de ProfilePreviewPage; não há mudança de frontend nesta revisão.
- HTTP real somente em loopback: autenticação rejeitada e ACK após persistência em fixture, incluindo duplicidade. Não equivale a entrega remota do Asaas.
- Remoto somente em leitura: corpo da RPC igual à migração aplicada; `initial_free`, zero solicitações avulsas, zero eventos, zero assinaturas e nenhuma janela aberta. Nenhuma escrita de evento remoto para testar.
- Migrações, demais Edge Functions, frontend, mensagens, contratos e flags Production sem alteração no diff.
