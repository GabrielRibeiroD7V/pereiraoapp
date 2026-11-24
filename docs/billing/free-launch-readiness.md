# Direção de lançamento e prontidão financeira — 24/11/2026

## Decisão de produto

Concluir e validar perfil, publicações, busca e conversas com usuários legítimos antes de monetizar. Nenhuma oferta de preço, prazo ou benefício premium hipotético na interface. A assinatura futura será uma decisão própria, opcional e consentida; não há conversão automática. Fase gratuita, isenção e proteções atuais permanecem intactas. Não criar outra chave: a existente chama-se “pereirao - sandbox”. Nenhuma chave foi solicitada ou lida nesta rodada.

## Auditoria direcionada

| Frente | Evidência | Limite |
|---|---|---|
| Aplicativo | Conta, criação de conta/cadastro, edição e prévia sem anúncios financeiros; backend e serviços/preços preservados | Não é novo aceite físico de iPhone nem validação completa entre duas contas |
| Sandbox | `server/sandbox-store.ts`: somente Preview + opt-in; provider fixa `api-sandbox.asaas.com/v3`, recusa chave de outro ambiente e redirects | Não houve nova chamada autenticada ao Asaas nesta rodada |
| Webhook | Handler autentica token antes do enqueue, espera persistência antes do HTTP 200 e concilia com API; HMAC + nonce e leases no store/SQL | Testes atuais automatizados; entrega externa atual não revalidada |
| Homologação histórica | `resultado-integrado-pr17.md`: cartão confirmado, sete eventos reais, replay, cancelamento e estorno Sandbox | Evidência de 21/11; não assumir que a configuração atual do receptor/Preview continua ativa sem nova verificação |
| Recuperação | Testes cobrem duplicidade, conflito, erro de rede sem repetir POST, persistência antes do ACK, estorno e rejeição em Production | Ainda exige monitoramento operacional e futura validação remota de recuperação/entrega |
| Pix | Continua bloqueado até homologação real | Não assumir que a chave pendente explique o retorno BOLETO |
| Produção financeira | Código atual **recusa** operações Sandbox em Production, mesmo com flags | Não existe provider financeiro real pronto para ser ativado apenas trocando uma chave |

A bateria automatizada desta entrega inclui os testes de `server/sandbox.test.ts`, `server/sandbox-relay.test.ts`, `server/webhook-provision.test.mjs`, `server/asaas-readonly.test.mjs` e `server/admin.test.ts`: fixtures/mocks locais, sem novos clientes, cobranças ou assinaturas no Asaas. SQL/RLS no CI roda em PostgreSQL descartável; não altera o projeto operacional.

## O que falta antes de uma operação financeira real

1. Decisão comercial própria: benefícios existentes, preço aprovado, consentimento, cancelamento/estorno e preservação dos usuários da fase gratuita. Sem oferecer isso agora.
2. Implementação separada e revisada de provider, persistência e reconciliação de **produção**, com flags inicialmente desligadas. Não remover o bloqueio Sandbox nem reutilizar seus contratos como direitos reais.
3. Após autorização específica, provisionar em Vercel Production uma credencial Asaas de produção **somente no servidor**. Nome sugerido para a implementação futura: `ASAAS_API_KEY_PRODUCTION`; não é variável já consumida pelo código e sua existência não foi presumida. Sem prefixo `VITE_`, sem frontend/logs/repositório. Sandbox continua usando `ASSAS_API_KEY_SANDBOX` existente.
4. Endpoint e autenticação de webhook próprios de produção; segredo de webhook e assinatura HMAC independentes dos de Sandbox, host/API e ambiente fixos, deduplicação durável, monitoramento e reprocessamento. Projetar e revisar o provisionamento antes de executar.
5. Revalidar primeiro o circuito Sandbox existente por sessão administrativa legítima e diagnóstico GET, sem criar contratos nesta rodada. Um novo ensaio completo com criação de assinatura precisa de autorização específica; nenhuma entrega nova do Asaas foi declarada aqui.
6. Somente depois de revisão e homologação, decisão expressa para ativar qualquer checkout real. Bloqueio de perfil não é consequência implícita dessa decisão.

Contas, chaves e URLs Sandbox/produção são separados conforme a [documentação oficial de ambiente](https://docs.asaas.com/docs/sandbox). Persistência anterior ao ACK e idempotência por ID seguem a [documentação de webhooks](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## Alteração de interface desta entrega

Removidos os avisos na Conta, criação de conta, cadastro profissional, edição e prévia/perfil próprio. Removidos os atalhos de “Gratuidade e assinatura”. A rota antiga `/conta/assinaturas` permanece protegida e sem oferta futura, exibindo apenas contratações persistidas, ou “Nenhuma contratação registrada”. Informações administrativas internas e avisos necessários à simulação Sandbox não são oferta ao público e foram preservados.

Sem SQL, migração, alteração de provider/API, flags, isenções, publicação de negócios/posts ou habilitação de cobrança. Primeiro avanço operacional continua sendo um serviço legítimo, revisão e autorização de publicação específicas, descoberta e conversa entre duas contas reais.
