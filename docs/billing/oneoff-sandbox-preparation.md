# Preflight Preview/Sandbox avulso — 27/11/2026

## Estado confirmado, sem segredos

Base main `d248690f3d111f275d5677abb2fd06d34ec76d2c` (#99). Production READY nesse SHA; sem alteração de Production nesta rodada. Projeto Supabase `yazdjiwaksamizrbqewq`.

Migração `20261127230000_admin_oneoff_payment_tests` já aplicada; não reaplicada. Cinco tabelas privadas com RLS e sem DML de anon/authenticated. RPC de transporte assinada disponível, função de prontidão privada. Digest HMAC Sandbox presente. Fase `initial_free`, zero assinaturas, zero solicitações/eventos avulsos, janelas Sandbox/Production fechadas.

Vercel foi consultada com `decrypt=false`; somente nomes, presença, tipos e escopos foram inspecionados. Nenhum valor de segredo foi lido/copied, gerado ou provisionado.

| Configuração | Presença/escopo observado | Efeito nesta preparação |
|---|---|---|
| `ASSAS_API_KEY_SANDBOX` | Sensitive; Preview e Production, sem filtro de branch | Já alcança o novo Preview; manter nome existente. Nenhuma nova chave API. O provider Production não usa esta variável. Validade/formato da chave não foram rechecados por leitura do valor ou nova autenticação. |
| `BILLING_RPC_SIGNING_SECRET` | Sensitive; Preview, somente `feat/asaas-sandbox` | **Não alcança `feat/oneoff-sandbox`**. Handshake remoto do novo Preview bloqueado até configuração segura nesse escopo. |
| `ASAAS_SANDBOX_WEBHOOK_TOKEN` | Sensitive; somente Preview `feat/asaas-sandbox` | Token das assinaturas; não copiar para o novo receptor avulso. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN` | Ausente | Token interno exclusivo proposto para o novo receptor. Não é chave API Asaas. Ainda não criado. |
| `ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED` | Ausente | Default false: criação avulsa desabilitada. |
| `ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED` | Ausente | Default false: receptor avulso Vercel desabilitado. |
| `ASAAS_ADMIN_ONEOFF_PRODUCTION_ENABLED` | Ausente | Default false: avulsos Production desabilitados. |
| `ASAAS_PRODUCTION_{CHECKOUT,SUBSCRIPTIONS,CHARGES,ENFORCEMENT,PIX,WEBHOOK}_ENABLED` | Ausentes | Defaults desligados; nada foi ativado. |
| Credenciais/HMAC/token Production | Sensitive; apenas Production | Não expostos/copied para Preview nem alterados. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Presentes em Preview/Production/Development | Nomes/escopos confirmados. Configuração do provider exige o projeto exato; não usa service_role. |

Proteção do projeto: Vercel Authentication habilitada em `all_except_custom_domains`, proteção por senha configurada. Nenhuma exceção de hostname foi criada. A resposta de metadados não confirmou um bypass utilizável pelo novo relay; não se presume que esteja disponível nem se imprime qualquer valor.

## Código preparado neste PR (sem migração)

Nova função exclusiva `asaas-admin-oneoff-sandbox-webhook`; código em `supabase/functions/asaas-admin-oneoff-sandbox-webhook/index.ts` e `_shared/oneoff-sandbox-relay.ts`.

Endpoint **proposto, ainda não implantado**:
`https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-admin-oneoff-sandbox-webhook`

Destino único, fixo em código, sem URL escolhida pelo chamador:
`https://pereirao-git-feat-oneoff-sandbox-77badblock-5101s-projects.vercel.app/api/asaas-admin-oneoff-webhook`

O relay legado `asaas-sandbox-webhook` e seu destino `/api/asaas-webhook` não foram modificados. Não alterar/remover seu cadastro no Asaas. Não confundir status ACTIVE da função legada com recepção de eventos avulsos.

O relay novo:
- Começa desligado sem sua própria flag `ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED=true`.
- Exige `ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN` diferente do bypass e do token legado. O backend avulso exige token diferente também do HMAC. Sem fallback para o token das assinaturas.
- Aceita somente o caminho exato e POST sem query string; autenticação de token por comparação de digests antes de ler o body.
- Aceita JSON até 64 KiB com leitura limitada do stream; não segue redirects nem envia cookies, bearer ou headers arbitrários.
- Bypass somente pelo header de servidor `x-vercel-protection-bypass`, nunca URL, frontend ou log. Sem chave Asaas ou acesso direto ao banco na Edge Function.
- Só devolve HTTP 200 ao receber JSON limitado com `received:true` do backend, que persiste o inbox antes do ACK. HTML da proteção, timeout, 401/503 ou ACK inválido geram falha/retry, nunca confirmação falsa.

O provider avulso passa a usar o token exclusivo do Sandbox; a configuração existente de assinaturas permanece inalterada. Isso endurece apenas o módulo avulso, que ainda não está habilitado. Production mantém suas credenciais e todas as flags desligadas.

## HMAC, administrador, deduplicação e conciliação

O servidor valida sessão real com `getUser`, e-mail confirmado, `admin_access`, origem e campos permitidos. Não usa user_metadata como autoridade. A RPC revalida administrador habilitado para os comandos administrativos.

Assinatura de domínio `oneoff-v1`, comando, nonce, timestamp e payload com ambiente. Chave de HMAC derivada do segredo de servidor para corresponder ao digest provisionado; comparação resistente a timing e tolerância temporal de 120 segundos. Nonce único por ambiente. Não testar com segredo copiado para o navegador.

A existência da função/digest **não comprova o handshake do Preview**. Falta o HMAC no escopo da branch nova e uma chamada legítima de status pelo administrador. Esta preparação não abriu sessão alheia, não solicitou senha/token e não escreveu nonce/evento operacional.

Teto fixo: `UNIQUE(environment,method)` com PIX/CREDIT_CARD e `amount_cents=1990`: uma operação por meio, duas por ambiente, máximo R$39,80. Cota não é reciclada após cancelamento/estorno. Reserva antes do POST impede duas criações; timeout incerto exige recuperação por referência, sem novo POST cego. Referência UUID, checkout e payment vinculados ao ambiente, métodos/valor/pagador conferidos; assinatura ou parcelamento são rejeitados.

Webhook não prova recebimento financeiro. Apenas GET conciliado de pagamento confirmado/recebido libera o estado pago; redirect e CHECKOUT_PAID isolados não bastam. Eventos têm chave por ambiente/eventId, conflito de payload é rejeitado, falha depois do ACK é retomada pelo inbox com lease/backoff e reprocessamento administrativo. Nenhum cron foi instalado.

## Procedimento operacional exato pendente

**Etapa A — configuração técnica, sem pagamento (não executada neste PR):**
1. Revisar este PR e seu Preview; confirmar SHA e proteção. Não atualizar a branch de assinaturas para obter segredos implicitamente.
2. Com intervenção autorizada no gerenciador de segredos, disponibilizar o **HMAC Sandbox existente** em Vercel Preview apenas na branch `feat/oneoff-sandbox`, mantendo o escopo antigo. Não ler o valor no chat nem abrir para todos os Previews. Não alterar o digest do Supabase se o segredo existente for preservado.
3. Provisionar um token interno exclusivo `ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN` no novo Preview e nos secrets da nova Edge Function; nunca reutilizar token de assinaturas ou HMAC. A chave Asaas existente não precisa ser criada/substituída.
4. Confirmar mecanismo de bypass autorizado e configurar somente na Edge Function como `ASAAS_ADMIN_ONEOFF_SANDBOX_PREVIEW_BYPASS`. Não alterar Deployment Protection nem expor o hostname inteiro. Não reutilizar/copiar um segredo desconhecido por hipótese.
5. Depois de reconferir a CLI (3.4.0 consultada), implantar somente a função nova: `supabase functions deploy asaas-admin-oneoff-sandbox-webhook --remote=yazdjiwaksamizrbqewq --no-verify-jwt --use-api`. NÃO omitir o nome da função, NÃO usar --prune, NÃO reaplicar SQL. `verify_jwt=false` aplica-se somente ao webhook novo; a autenticação é o token do Asaas validado pelo handler, não acesso público irrestrito.
6. Manter criação avulsa false e janela de banco fechada. Preparar recepção apenas no Preview (`ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED`) e no relay (`ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED`), com decisão explícita de ativação. Redeploy apenas do Preview para absorver seu ambiente. Não tocar flags Production.
7. Administrador legítimo acessa `/admin?sec=oneoff`, ambiente Sandbox, consulta status. Confirmar assinatura HMAC aceita e leitura das tabelas vazias; nonce de transporte pode ser registrado, mas nenhum checkout/pagamento. Testar rejeição de token ausente/incorreto e do chamador não administrativo sem criar evento financeiro. Fila vazia não comprova entrega Asaas.
8. Registrar um webhook **separado na conta Sandbox**, apontado somente ao endpoint novo, sem alterar o de assinaturas. Conferir a lista real de eventos oferecida pela conta antes de salvar. Usar os eventos CHECKOUT e PAYMENT aceitos pelo receptor, incluindo confirmação/recebimento/recusa/vencimento/estorno/cancelamento. Não habilitar eventos de assinaturas por conveniência. A conta e suas opções efetivas ainda precisam dessa verificação; esta preparação não afirma cadastro remoto ou entrega real.

**Etapa B — dois testes, somente depois de autorizados:**
1. Conferir ambiente `sandbox`, janela fechada, zero operações prévias e pagador de teste já existente e consentido. Se não existir, obter decisão própria antes de criar cliente.
2. Habilitar criação **somente Sandbox** na flag, após recepção segura estar pronta; administrador abre janela de uma hora com confirmação/auditoria. Isso não gera cobrança por si.
3. Autorizar individualmente **Pix avulso R$19,90**; confirmar criação uma vez, abrir checkout oficial e concluir o pagamento no Sandbox. Se o Asaas devolver outro método ou negar Pix, parar e registrar divergência; não presumir homologação nem trocar por boleto.
4. Conferir entrega real de webhook, persistência antes do ACK, pagamento conciliado via API por checkout/referência, status/valor/método/pagador e ausência de assinatura/parcelamento. Verificar replay/deduplicação e recuperação sem consumir outra autorização.
5. Repetir individualmente **cartão de crédito avulso R$19,90** no checkout hospedado, com cartão de teste do Asaas. PEREIRÃO não coleta PAN/CVV/token de cartão. Confirmar os mesmos pontos. O teto é R$39,80 por ambiente e não há recorrência.
6. Fechar janela e desabilitar criação Sandbox depois do ensaio. Manter recepção/conciliação pelo tempo necessário. Preservar trilha e não apagar registros para liberar cota. Production segue desligada, ainda que a prontidão Sandbox passe.

**Contenção:** desligar apenas a flag do novo relay e o novo webhook Sandbox; ele passa a falhar sem ACK para permitir retry. Desligar criação e fechar a janela avulsa. Não tocar receptor/contratos de assinaturas. Preservar inbox para reprocessamento. Não existem checkouts criados nesta rodada a cancelar.

## Evidências e limites

89 testes direcionados (relay novo, avulsos, relay legado), typecheck e build passaram. Cobrem autenticação antes do body, destino fixo, credenciais independentes, default off, limites, ACK falso/HTML, erro/retry, controle administrativo, concorrência e bloqueio Production com fixtures. Não equivalem a chamadas reais Asaas, handshake do novo Preview ou entrega real de webhook.

Consultas remotas nesta rodada foram somente leitura. Sem SQL, secrets, flags, cadastros Asaas, checkouts, pagamentos, clientes ou contratos criados/alterados. Nenhuma homologação Pix/cartão avulso ou Production foi declarada.

## Fontes oficiais

- [Asaas Checkout e meios hospedados](https://docs.asaas.com/docs/asaas-checkout)
- [Criar checkout e eventos CHECKOUT](https://docs.asaas.com/reference/criar-novo-checkout)
- [Supabase — autenticação própria de webhooks e verify_jwt por função](https://supabase.com/docs/guides/functions/auth)
- [Vercel — bypass por servidor](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
