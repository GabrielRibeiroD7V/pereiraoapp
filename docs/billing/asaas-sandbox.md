# Assinaturas Asaas Sandbox

Esta implementação não habilita monetização real. R$ 19,99/mês é uma referência de homologação, sem oferta comercial aprovada. O contrato exige ação e consentimento explícitos do responsável por cada negócio.

## Limite de ambiente

As APIs novas `/api/sandbox-billing` e `/api/asaas-webhook` exigem simultaneamente `VERCEL_ENV=preview` e `ASAAS_SANDBOX_ENABLED=true`. Production rejeita essas operações antes de usar a chave ou abrir conexão. O diagnóstico administrativo antigo continua somente GET. Não promover um Preview para contornar esse bloqueio.

O provider aceita somente a chave de prefixo `$aact_hmlg_`, host fixo `https://api-sandbox.asaas.com/v3`, redirecionamentos HTTP proibidos e timeout de 8 segundos. Nenhum dado completo de cartão é solicitado pelo aplicativo; cartão de crédito usa o checkout hospedado em `sandbox.asaas.com`. Débito não é oferecido como recorrência.

Pix usa assinatura mensal com `pixAutomaticAuthorizationMode=DISABLED`: cada cobrança é paga individualmente. Pix Automático não faz parte deste PR. Retornos de checkout são navegação, nunca evidência de pagamento.

## Pré-requisitos externos — aguardam autorização

1. Revisar e autorizar separadamente `20261121031038_sandbox_billing.sql`, depois das oito migrações existentes. Ela cria sete tabelas privadas com RLS, acrescenta metadados/lease à inbox existente e expõe uma RPC de servidor autenticada por HMAC. Não altera negócios, assinaturas reais ou datas da gratuidade. Não foi aplicada remotamente neste PR.
2. Gerar um segredo aleatório de alta entropia (pelo menos 48 caracteres) para `BILLING_RPC_SIGNING_SECRET`, sensível e exclusivo do servidor de Preview. Provisionar seu SHA-256 (32 bytes) em `private.sandbox_backend_keys` por operação administrativa autorizada. **O digest também é uma credencial de assinatura: nunca deve ser exposto**, assim como o segredo original. A tabela começa vazia e falha fechada. Não usar a chave do Asaas como segredo HMAC.
3. Configurar `ASAAS_SANDBOX_ENABLED=true` e `VITE_SANDBOX_BILLING=true` apenas no Preview aprovado. Manter a chave sensível existente `ASSAS_API_KEY_SANDBOX` (grafia legada intencional) no servidor. Nenhuma dessas credenciais tem prefixo `VITE_`; a única variável pública nova é o booleano.
4. Gerar outro segredo aleatório para `ASAAS_SANDBOX_WEBHOOK_TOKEN` (32–255 caracteres ASCII sem espaços). Configurar o mesmo token no **Asaas Sandbox**, header `asaas-access-token`, URL HTTPS exata e estável do Preview aprovado `/api/asaas-webhook`, sem wildcard. Não cadastrar webhook na conta Asaas real.
5. Assinar eventos de pagamento, assinatura e checkout tratados em `server/billing-contracts.ts`. Se o Preview tiver Deployment Protection, escolher explicitamente uma forma aprovada de entrega do webhook; não desabilitar a proteção ou expor o token em query string. Nenhum webhook remoto foi criado automaticamente.

Nenhum `service_role` ou JWT de usuário artificial é necessário. O backend verifica a sessão normal em Auth `getUser()`, deriva o UUID e assina um comando financeiro limitado. O banco revalida conta confirmada/ativa, vínculo owner/admin e moderação. A assinatura cobre comando, nonce único, horário (90 segundos) e bytes exatos do JSON. O dispatcher não executa SQL dinâmico, não modifica privilégios e não muda direitos reais.

## Persistência, duplicidade e recuperação

Os IDs externos ficam no schema `private`: customers por negócio, contratos Sandbox, snapshots de pagamentos, solicitações únicas de estorno e auditoria financeira. A API devolve somente a projeção necessária ao responsável/admin, com `private,no-store`.

A reserva transacional registra o aceite, valor e primeiro vencimento antes de chamar o Asaas. O vencimento não antecede o fim da gratuidade existente. A primeira aprovação administrativa continua sendo a única âncora dos 90 dias; nenhuma operação Sandbox inicia, reinicia ou bloqueia esse período.

UUID repetido não repete criação. Índice parcial impede dois contratos não cancelados por negócio, inclusive após estorno. A tentativa é marcada antes do POST. Resposta perdida fica `uncertain`; o sistema nunca repete POST financeiro cegamente. Reconciliação procura cliente por referência estável e assinatura por UUID/checkout. Havendo zero ou múltiplos resultados, exige investigação, mantendo o bloqueio de duplicidade. Se a falha ocorreu antes de uma assinatura existir, não há retomada automática de criação: verificar o provider antes de autorizar compensação. Clientes de teste não são excluídos automaticamente.

Cancelar recorrência preserva histórico/cobranças já geradas. Estorno é reservado uma vez por pagamento, somente por administrador, com confirmação na interface. Resposta do POST não basta para reconhecer estorno: o estado é reconciliado pela API.

## Webhooks e conciliação

O endpoint valida o token em comparação de tempo constante, limita o body e persiste **apenas identificadores mínimos** antes do HTTP 200. Não persiste PAN, cliente bruto ou payload financeiro completo. ID repetido com conteúdo diferente é conflito. Após persistência, `waitUntil` tenta processar; evento interrompido permanece recuperável na inbox. Administrador pode reprocessar até dez eventos pendentes por ação. Não há cron de produção neste PR; monitorar a fila e reprocessar falhas é uma pendência operacional.

Cada evento consulta o estado atual da API oficial. Cliente, assinatura/checkout, negócio, moeda implícita BRL, ciclo, método e valor em centavos precisam corresponder. Lease por evento e contrato impede workers concorrentes de aplicar snapshots fora de ordem; lease vencido não grava pagamentos. Webhooks antigos não sobrepõem estados com seus próprios campos. Falhas de leitura mantêm o contrato em conciliação, sem conceder acesso.

Estados tratados incluem pendência, confirmado, recebido, vencido, estorno parcial/total, exclusão, análise/recusa e chargeback. Cartão `CONFIRMED` não conta como receita recebida. Receita Sandbox considera liquidação e deduz estornos efetivos. Cancelamento de assinatura prevalece sobre pagamentos tardios; pagamentos ainda são conciliados após cancelamento. Checkout expirado/cancelado sem assinatura conciliável fica pendente de verificação; não se infere cancelamento financeiro de um evento isolado. API 404 de pagamento requer investigação, sem fabricar liquidação/estorno.

O painel mostra indicadores agregados Sandbox separados de gratuidade real; listas exibem os 20 contratos/100 pagamentos mais recentes, explicitamente. Receita real permanece indisponível. O service worker não intercepta nenhuma das APIs, tokens, URLs assinadas ou respostas privadas.

## Homologação e limites da evidência

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:migrations` e `PG_BIN=... npm run test:sql`. O último cria PostgreSQL nativo descartável, aplica a sequência inteira e testa RLS, provas HMAC, leases, isolamento, consentimento, duplicidade, estorno e preservação de direitos. Não substitui PostgREST/Auth/Asaas reais.

`scripts/smoke-asaas-sandbox.mjs pr17-<identificador-unico>` é opt-in: exige Preview e branch `feat/asaas-sandbox`, usa a chave somente no processo servidor e cria exclusivamente cliente financeiro sintético, assinatura Pix e checkout de cartão. Nunca executá-lo no build padrão. Registra IDs antes de cancelar/estornar; repetição do mesmo identificador para antes de outro POST. Não acessa Supabase. Confirmação Pix usa a ação oficial `/sandbox/payment/{id}/confirm`. Pagamento com cartão deve ser concluído somente no checkout hospedado com dados oficiais de homologação. Resultados reais ficam no relatório do PR, sem tratá-los como teste remoto da persistência ainda não autorizada.

Após aprovação dos pré-requisitos, testar com sessão legítima: contratação por responsável autorizado, retorno hospedado, webhook real, inbox durável, replay, reconciliação, estorno, cancelamento, tentativa de terceiro, reload e fila após interrupção. Não usar negócios operacionais como fixtures; a autorização para registros técnicos e a execução remota devem ser explícitas.

Fontes oficiais consultadas: [Checkout recorrente](https://docs.asaas.com/docs/checkout-with-subscription-recurring), [assinaturas](https://docs.asaas.com/reference/create-new-subscription), [webhooks](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook), [confirmação Sandbox](https://docs.asaas.com/reference/confirm-payment), [cartões de homologação](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito).
