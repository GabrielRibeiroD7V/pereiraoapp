> Estado mais recente: [migração aplicada, provisionamento e avaliação de exposição](operacao-webhook-pr17.md). As seções históricas abaixo descrevem a ordem e os cuidados originais; não reaplicar a migração financeira.

# PR #17 — Ativação segura e pendências de homologação

Atualização: a migração e os segredos HMAC/webhook foram autorizados e provisionados. A configuração/ensaio do webhook Sandbox está autorizada, mas a rota externa depende da decisão de exposição descrita no relatório operacional. Não há autorização atual para tornar o Preview inteiro público, nova assinatura Pix ou merge. Projeto exclusivo: `yazdjiwaksamizrbqewq`. Ambiente financeiro exclusivo: **Asaas Sandbox**.

## Pix: evidência e próxima ação do proprietário

GETs reais executados pelo servidor de Preview em **21/11/2026 00:16:37 America/Campo_Grande** (`2026-11-21T04:16:37.427Z`):

| Consulta | HTTP | Projeção não sensível |
| --- | --- | --- |
| `/v3/myAccount/status/` | 200 | commercialInfo, bankAccountInfo, documentation e general: APPROVED |
| `/v3/pix/addressKeys?limit=100&offset=0` | 200 | Uma chave AWAITING_ACTIVATION; hasMore=false |

Não foi consultado nem exposto o valor da chave. Permissão de leitura não comprova habilitação para criar recorrências Pix. A documentação aceita `PIX` na criação de assinatura, mas não documenta a conversão observada para `BOLETO`. **A causa continua não estabelecida.** A documentação de cobrança Pix imediata admite QR temporário sem chave cadastrada; isso não comprova elegibilidade de assinatura recorrente nem explica a conversão.

O proprietário deve abrir o **Sandbox → Pix → Minhas chaves** ([atalho](https://sandbox.asaas.com/pixAddressKey/index)) para conferir a pendência existente e acionar **Ajuda/suporte de homologação** na conta Sandbox. Consultar a tentativa em **Integrações → Logs de Requisições** ([atalho](https://sandbox.asaas.com/customerConfigIntegrations/logs)). Não criar, excluir ou substituir chaves. Não há evidência de um botão de ativação manual; a conta já está aprovada, portanto não recomendamos reenviar documentação sem orientação do Asaas.

Texto para o chamado, a ser enviado pelo proprietário:

> Na conta Sandbox, os quatro estados cadastrais retornam APPROVED e há uma chave Pix AWAITING_ACTIVATION. A tentativa técnica `sub_mvffq8hyb6dsie7j`, referência `0137f763-f909-48ae-9398-c3132313bdd1`, foi solicitada pelo código com billingType PIX e pixAutomaticAuthorizationMode DISABLED, mas a API retornou BOLETO. A assinatura já foi cancelada. O corpo citado é reconstruído a partir do código e dos testes de serialização; não dispomos de captura remota do corpo dessa requisição. Podem confirmar a disponibilidade de assinaturas recorrentes PIX nesta conta, a razão da conversão e a ação exata necessária para a chave existente? Não pretendemos criar outra assinatura até a confirmação de aptidão.

Não incluir API keys, senha, CPF, chave Pix ou dados pessoais no chamado. Não atribuir causalidade à pendência sem resposta/evidência do provider.

A chave ACTIVE, isoladamente, também não autoriza habilitar a modalidade no produto. Após confirmação do Asaas e autorização específica, realizar um novo ensaio limitado e registrar o método devolvido, confirmação e cancelamento. Somente evidência real de sucesso pode justificar as flags `ASAAS_SANDBOX_PIX_VERIFIED` e `VITE_SANDBOX_PIX_VERIFIED`.

O script opt-in exige, antes de qualquer criação Pix, `ASAAS_SANDBOX_PIX_TEST_AUTHORIZED=true` e GETs com os quatro estados APPROVED, pelo menos uma chave ACTIVE e paginação completa. Essa é uma **regra conservadora do ensaio**, não uma conclusão sobre a causa ou uma regra universal do Asaas. O opt-in não foi provisionado. Não roda em builds normais.

## Migração proposta e ordem

Aplicar somente após revisão e autorização do proprietário, depois das oito migrações atuais:

1. `20261120214652_backend_auth_foundation`
2. `20261120215116_business_primary_category`
3. `20261120223813_restrict_business_status_update`
4. `20261120225759_business_portfolio_storage`
5. `20261121001632_work_posts`
6. `20261121004916_platform_admin`
7. `20261121004917_admin_work_moderation`
8. `20261121013857_business_subscriptions_trial`
9. **Proposta:** `20261121031038_sandbox_billing.sql`

SHA-256 da proposta revisada: `a2690165f6a4c1863ea6ffff82407a44503f6913e490db4931ea80939e9bbdf4`.

Revisão: sete tabelas privadas com RLS e revogação de acesso direto de PUBLIC/anon/authenticated; funções com search_path vazio e EXECUTE restrito; wrapper de servidor exige HMAC válido, nonce único e horário com tolerância de 90 segundos. A RPC revalida usuário confirmado/ativo, vínculo owner/admin, moderação e papel administrativo conforme a ação. A chave inicia ausente e falha fechada. Não permite SQL dinâmico ou concessão de direitos reais.

A inbox existente recebe projeção mínima e leases, preservando registros anteriores. Eventos duplicados com conteúdo divergente falham. Workers vencidos não finalizam eventos nem atualizam snapshots conciliados; pagamentos mantêm vínculo imutável e mapeamentos ambíguos são rejeitados. Auditoria conserva antes/depois de estado, valores, estornos, datas e liquidação, sem payload bruto ou dados de cartão.

A sequência completa foi aplicada em PostgreSQL 17 nativo descartável. Essa validação não substitui PostgREST/Auth e inbox no ambiente operacional. Antes de ativar, comparar novamente histórico/estrutura, conferir checksum e snapshot de integridade. Depois da aplicação autorizada, verificar histórico, RLS/grants, funções e preservação dos dados, somente em leitura. Não reaplicar migrações anteriores.

## Provisionamento de credenciais — exige autorização separada

| Configuração | Destino | Regra |
| --- | --- | --- |
| `ASSAS_API_KEY_SANDBOX` | Servidor, Preview aprovado | Reutilizar a chave sensível existente; grafia legada intencional. Não ler/copiar seu valor. Host fixo api-sandbox.asaas.com e prefixo hmlg obrigatório. |
| `BILLING_RPC_SIGNING_SECRET` | Servidor, Preview da branch aprovada | Segredo aleatório de alta entropia, mínimo 48 caracteres. Não reutilizar a chave Asaas. |
| SHA-256 binário desse segredo | `private.sandbox_backend_keys.key_digest` | 32 bytes, id=true. **O digest também é credencial**; nunca publicar, registrar em chat/log, migration ou commit. |
| `ASAAS_SANDBOX_WEBHOOK_TOKEN` | Servidor e webhook no Asaas Sandbox | Outro segredo independente, 32–255 caracteres ASCII sem espaços. Transmitido no header `asaas-access-token`. |
| `ASAAS_SANDBOX_ENABLED=true` | Servidor, somente Preview aprovado | Production continua bloqueado no código, mesmo que exista chave Sandbox. |
| `VITE_SANDBOX_BILLING=true` | Booleano público de build no Preview | Não contém credencial. Pix permanece desabilitado. |

Gerar e provisionar o par HMAC em operação privada controlada, com transmissão parametrizada e sem eco do segredo/digest. A ferramenta SQL atual recebe texto e não oferece bind de segredo: **não colar valores secretos nela ou no chat**. Aprovar previamente o canal privado de provisionamento; o proprietário pode executar essa etapa em sua interface segura. Não é necessário nem permitido substituir isso por service_role no frontend ou JWT artificial. Só ativar o handler após banco e par de assinatura estarem consistentes. Rotação exige desabilitar temporariamente o consumidor e coordenar ambos os lados; não aceitar duas chaves indefinidamente.

O opt-in `ASAAS_SANDBOX_PREFLIGHT_READ_ONLY` usado nesta investigação foi esvaziado. Ele somente habilita GETs e projeções de estados; não habilita operações financeiras. Os opt-ins financeiros anteriores continuam desligados e fora do build padrão.

## Entrega real do webhook: bloqueio da Vercel

O Preview exige Vercel Authentication antes de a Function executar. O DTO oficial do Asaas permite `authToken`, que fornece **somente `asaas-access-token`**; não documenta headers arbitrários para o bypass da Vercel. Configurar esse token, sozinho, não resolve o HTTP 401 da proteção. O campo User-Agent mostrado em exemplos de requisição da documentação não configura headers de saída do webhook.

Não usar token de bypass na query da URL; não desabilitar a proteção do projeto, não usar wildcard, não inventar exceção por caminho nem tentar resolver com middleware ou allowlist OPTIONS (a entrega é POST).

Opções a revisar e autorizar explicitamente antes da configuração:

- Uma exceção de Deployment Protection para **um hostname exato de Preview**. A documentação atual informa disponibilidade em todos os planos. A exceção é do domínio inteiro, não somente `/api/asaas-webhook`; não ativar plano, add-on ou trial. Auth/RLS/HMAC da aplicação devem continuar obrigatórios para dados privados. Hostname proposto: `pereirao-git-feat-asaas-sandbox-77badblock-5101s-projects.vercel.app`. Endpoint proposto: `https://pereirao-git-feat-asaas-sandbox-77badblock-5101s-projects.vercel.app/api/asaas-webhook`. A exceção permanece dependente de autorização explícita e cobre os futuros deployments desse mesmo alias enquanto existir.
- Um receptor/relay público limitado aprovado separadamente, ou um endpoint específico em domínio já público após revisão de arquitetura/deploy. Não criar infraestrutura agora nem promover Preview para contornar os guards; o handler financeiro atual recusa Production.

Nenhuma dessas opções foi executada. Enquanto não houver rota aprovada alcançável pelo Asaas, a entrega real permanece pendente.

## Configuração no Asaas Sandbox — somente após desbloqueio

1. Fixar a URL HTTPS exata e estável do receptor aprovado, caminho `/api/asaas-webhook`, sem credenciais na URL. Confirmar que o deployment contém a versão revisada e que o código continua limitado ao Sandbox.
2. Provisionar o token independente nos dois lados, sem exibi-lo. Criar/configurar o webhook somente na conta Sandbox e com autorização específica; usar e-mail de notificação controlado pelo proprietário.
3. Selecionar apenas os eventos suportados em `server/billing-contracts.ts`: PAYMENT_CREATED/CONFIRMED/RECEIVED/OVERDUE/REFUNDED/DELETED/UPDATED/RESTORED/PARTIALLY_REFUNDED/REFUND_IN_PROGRESS/CREDIT_CARD_CAPTURE_REFUSED/AWAITING_RISK_ANALYSIS/REPROVED_BY_RISK_ANALYSIS/CHARGEBACK_REQUESTED/CHARGEBACK_DISPUTE/AWAITING_CHARGEBACK_REVERSAL; SUBSCRIPTION_CREATED/UPDATED/DELETED; CHECKOUT_CREATED/PAID/CANCELED/EXPIRED. Conferir os nomes aceitos pela conta antes de salvar; não substituir silenciosamente eventos desconhecidos.
4. Preferir envio sequencial como configuração operacional; a aplicação ainda precisa tolerar repetição e ordem diferente. Nunca confiar na ordem ou no conteúdo do evento como prova de liquidação.
5. Validar token ausente/incorreto → 401; evento suportado malformado → 400; indisponibilidade da persistência → resposta não 200. Evento válido só recebe 200 após INSERT/deduplicação durável da inbox. Evento não suportado é ignorado com 200 sem efeitos financeiros.
6. Após persistir, waitUntil tenta conciliar com GET oficial. Confirmar cliente, assinatura/checkout, método, valor e ciclo; payload do webhook e retorno do checkout não concedem acesso. Timeout deixa a fila recuperável. Registrar ID do evento e linha persistida antes do ACK na evidência real.
7. Ensaiar entrega efetiva pelo Asaas, duplicata, interrupção/retry e evento antigo. Lease vencido não pode concluir processamento. Ação administrativa reprocessa até dez pendências por vez; monitorar fila. Não há cron automático neste PR. Nonces não têm expurgo automático; retenção/monitoramento devem ser definidos antes de uso sustentado, sem apagar evidência de replay dentro da janela de validade.

Os testes de endpoint com mocks e a aplicação SQL local validam a lógica, mas **não constituem entrega do Asaas nem ensaio integrado App → RPC → inbox remota**.

## Gratuidade, consentimento e dinheiro real

Nenhum término de 90 dias chama o provider, contrata ou cobra automaticamente. A primeira aprovação administrativa continua sendo a única origem da gratuidade individual. As tabelas Sandbox não alteram `business_subscriptions`, publicação, direitos ou flags de bloqueio reais.

R$ 19,99 é referência de homologação. O checkout hospedado de cartão pode capturar imediatamente mesmo que haja vencimento futuro: não usar nextDueDate como garantia de adiamento. O fluxo permanece Preview/Sandbox e exige aceite expresso. Monetização real exige outro projeto de revisão comercial, técnica e autorização explícita antes de captura. Nenhum pagamento Sandbox libera direitos reais.

## Fontes oficiais

- [Situação cadastral](https://docs.asaas.com/reference/check-account-registration-status), [chaves Pix](https://docs.asaas.com/reference/list-keys), [assinatura e billingType](https://docs.asaas.com/reference/create-new-subscription).
- [Cobranças via Pix](https://docs.asaas.com/docs/cobrancas-via-pix), [oferta de Pix Automático](https://docs.asaas.com/docs/oferta-autom%C3%A1tica-de-pix-autom%C3%A1tico-em-assinaturas-via-api).
- [Configuração do webhook](https://docs.asaas.com/reference/create-new-webhook), [proteção Vercel](https://vercel.com/docs/deployment-protection), [exceções por domínio](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions), [bypass por automação](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## Conferência para provisionamento do webhook

- Branch e PR existentes: `feat/asaas-sandbox`, #17, head revisado `deeba4c2b6ff43a0023ef46de1efd81db6cc6554`. Não abrir outro PR.
- Proteção atual consultada pela integração: Vercel Authentication habilitada, deploymentType `all_except_custom_domains`; proteção por senha e Trusted IPs desabilitados. Não alterar esses campos globalmente.
- Chave existente `ASSAS_API_KEY_SANDBOX` é Secret, com destinos Preview e Production. Metadados consultados sem decrypt; não mover/copiar a chave. A presença em Production atende somente ao diagnóstico GET existente, não autoriza handlers financeiros.
- Ausentes no inventário: `BILLING_RPC_SIGNING_SECRET`, `ASAAS_SANDBOX_WEBHOOK_TOKEN`, `ASAAS_SANDBOX_ENABLED` e `VITE_SANDBOX_BILLING`. Provisionar somente em Preview, branch `feat/asaas-sandbox`, após autorização. Pix e os opt-ins financeiros continuam desligados.
- A ferramenta de configuração de projetos disponível não expõe uma operação de exceção por hostname. Não substituir por `ssoProtection=null`. Após autorização, se continuar sem API específica disponível, será necessário usar a tela de Deployment Protection para cadastrar unicamente o alias aprovado. Não manipular a proteção por tentativa com payloads desconhecidos.
- A geração dos dois segredos pode ocorrer sem exibição. O digest HMAC não deve passar por SQL literal em ferramenta/log; é necessário um canal privado parametrizado ou a operação privada do proprietário antes de liberar o consumidor. Não solicitar senha/connection string no chat e não criar um endpoint público de bootstrap.
- Na futura criação do webhook, usar nome `PEREIRAO PR17 SANDBOX`, token independente, envio sequencial e e-mail de notificação `77badblock@gmail.com` somente se autorizado como parte do provisionamento. Primeiro verificar webhooks existentes por GET, projetando somente id/url/status/eventos; nunca registrar resposta bruta que possa conter authToken. Não duplicar nem alterar um webhook preexistente sem confirmar sua identidade.
- Antes de habilitar o webhook, confirmar endpoint/token/banco; depois habilitar a entrega, iniciar somente cartão sintético autorizado, registrar IDs, confirmar inbox/GET/painel e executar estorno/cancelamento do ensaio. Qualquer timeout de POST exige conciliação antes de outra tentativa.

A nova consulta de integridade confirmou igualdade integral com o snapshot anterior; a migração financeira continua ausente. Nenhum provisionamento remoto foi executado nesta conferência. O procedimento está pronto para revisão; a execução integrada permanece condicionada às autorizações explícitas.
