> Estado operacional após autorização: [migração e segredos provisionados; decisão do receptor pendente](operacao-webhook-pr17.md). Resultados anteriores abaixo são históricos.

# PEREIRÃO — Asaas Sandbox / PR #17

> Atualização de 21/11: consulte [a conclusão técnica atual](continuacao-pr17.md) e [o roteiro de ativação segura](ativacao-segura-pr17.md). Os ensaios anteriores abaixo são históricos; não equivalem a homologação integral.

PR: https://github.com/GabrielRibeiroD7V/pereiraoapp/pull/17  
Branch: `feat/asaas-sandbox`  
Base: `2eba4951b95e58865c19113602d129dc8592ce28`  
Ensaio: 20–21/11/2026 (America/Campo_Grande). Os horários de build são UTC.

## Resultado

Implementação preparada em PR separado, sem merge. Cartão foi homologado no provider real: recusa, aprovação, vínculo confirmado pela API, estorno `REFUNDED` e cancelamento da recorrência sintética. O Pix não foi homologado: o Asaas retornou `BOLETO` para uma requisição `PIX`; a assinatura foi cancelada e a modalidade ficou bloqueada por padrão. A conta Sandbox mostra uma chave Pix aleatória **Pendente**, consultada somente em leitura. Isso é uma pendência concreta; a relação com o retorno BOLETO ainda precisa ser confirmada pelo Asaas.

Nenhuma migração nova, negócio, assinatura real, gratuidade, publicação ou dado operacional foi modificado no Supabase. Não houve deploy de produção deste PR. A chave foi usada somente no processo servidor da Vercel e no host oficial Sandbox, sem leitura do valor pela integração, sem frontend e sem logs de credenciais.

## Implementação

- Contratação expressa por negócio, valor fixo de homologação R$ 19,99/mês, responsável owner/admin confirmado e ativo.
- Cliente financeiro por negócio, identificadores privados, reserva transacional, impedimento de duas recorrências não canceladas e tratamento de respostas incertas sem repetição cega de POST.
- Pix mensal individual com Pix Automático desabilitado; flag de homologação obrigatória no servidor e opção indisponível por padrão na interface.
- Cartão de crédito no checkout hospedado, sem PAN/CVV no PEREIRÃO. Débito recorrente não é oferecido.
- API de webhook autenticada, inbox mínima durável antes do HTTP 200, deduplicação por evento, leases e conciliação com GET oficial para validar cliente, assinatura/checkout, método, ciclo e valor.
- Estados financeiros, pedidos únicos de estorno e auditoria exclusivos do Sandbox. Nenhuma concessão de acesso real a partir de webhook.
- Financeiro Sandbox no painel administrativo, separado dos 90 dias e da receita real. Receita bruta recebida é anterior às tarifas, deduz estornos e não conta captura de cartão ainda sem liquidação.
- APIs financeiras bloqueadas em Production, mesmo que exista chave Sandbox nesse ambiente. Navegação pública e Início | Buscar | Conta preservadas.

A migração **proposta e não aplicada** é `20261121031038_sandbox_billing.sql`: sete tabelas privadas com RLS, metadados/leases na inbox existente e uma RPC financeira de servidor limitada ao Sandbox. Não altera o status dos negócios nem a estrutura/datas de `business_subscriptions`.

O backend usa sessão normal validada em Auth e prova HMAC restrita; não usa service_role ou JWT artificial. O digest HMAC armazenado também é credencial e precisa permanecer privado. A tabela de assinatura de comandos começa vazia e falha fechada.

## Matriz de evidências

| Teste | Tipo | Resultado |
| --- | --- | --- |
| Autenticação da chave na API Sandbox, GET | Real, Vercel → Asaas | HTTP 200, inclusive no ensaio final |
| Criação/reuso do pagador financeiro técnico | Real, Asaas | Dois clientes sintéticos, separados por ensaio; notificações desabilitadas |
| Criação de assinatura PIX | Real, Asaas | Retornou BOLETO; rejeitada e cancelada; não houve confirmação Pix |
| Consulta da chave Pix da conta | Real, navegador autorizado | Chave aleatória Pendente; nenhuma configuração alterada |
| Checkout hospedado de cartão | Real, API + navegador | HTTP 200; cliente sintético preenchido e marca oficial exibida |
| Cartão oficial de recusa | Real, Sandbox | Pagamento não autorizado; mesmo checkout reutilizado na tentativa seguinte |
| Cartão oficial de aprovação | Real, Sandbox | Página confirmou sucesso; API confirmou pagamento e uma assinatura vinculada ao checkout |
| Identidade/valor/ciclo da assinatura de cartão | Real, GET | Mesmo cliente, checkout correto, CREDIT_CARD, MONTHLY, R$ 19,99 |
| Estorno | Real, Sandbox | API retornou REFUNDED após a solicitação |
| Cancelamento | Real, Sandbox | DELETE da assinatura sintética concluído; histórico/pagamento preservados |
| Persistência financeira App → RPC nova no Supabase | Bloqueado | Migração e provisionamento restrito ainda não autorizados |
| Entrega e replay de webhook pelo Asaas | Bloqueado | Endpoint externo/token/rota de entrega ainda não configurados |
| Duplicidade de contrato, isolamento, HMAC/nonce, permissões e leases | PostgreSQL local real | Aprovado; fixtures revertidas em cluster nativo descartável |
| Replay, evento antigo, falha de rede, estorno repetido e recuperação de ID | Simulação automatizada | Aprovado; não representa entrega remota de webhook |
| Retorno privado e consentimento no frontend | Simulação automatizada | Aprovado |
| Responsividade do formulário e painel | Navegador local, dimensões emuladas | 375, 390, 768 e 1280 px, largura do documento igual à viewport; três abas públicas |
| Aparelhos Android/iPhone físicos | Não executado | Sem validação física nesta tarefa |
| Proteção de cache do PWA e inicialização das APIs em Node ESM | Automatizado | Aprovado; APIs e respostas privadas não entram no cache do worker |

Os ensaios reais de provider ocorreram diretamente no processo servidor autorizado e no checkout do Asaas. Eles **não substituem** o ensaio autenticado App → nova RPC → inbox remota, ainda bloqueado pelos pré-requisitos externos.

## Identificadores técnicos no Asaas Sandbox

| Registro | ID / estado final observado |
| --- | --- |
| Cliente do ensaio Pix | `cus_000010060896` — preservado |
| Assinatura solicitada como Pix | `sub_mvffq8hyb6dsie7j` — cancelada; GET mostrou `deleted: true`, método BOLETO |
| Referência dessa tentativa | `0137f763-f909-48ae-9398-c3132313bdd1` |
| Cliente do ensaio de cartão | `cus_000010060912` — preservado |
| Checkout | `4fa84e61-980f-4110-b35a-8f4678c8808e` — concluído no Sandbox |
| Assinatura de cartão | `sub_ctdndwr6mg8oz1mi` — cancelada após o estorno |
| Pagamento de cartão | `pay_0_1gh29817c158da` — CONFIRMED → REFUNDED |

Não foram criados UUIDs financeiros no Supabase remoto. Não foram excluídos os clientes financeiros ou a conta usada. Os IDs de assinatura e pagamento foram registrados antes do estorno/cancelamento. Apenas os contratos técnicos deste ensaio foram cancelados.

O checkout foi recuperado pelos logs da sessão legítima do Asaas, sem repetir sua criação após resposta 200. Não houve acesso a senhas, cookies de sessão ou tokens privados.

## Defeitos encontrados e correções

1. Dados sintéticos incompletos e telefone rejeitado pelo provider causaram HTTP 400. O pagador técnico foi completado com exemplos de homologação e notificações desabilitadas; a API aceitou a atualização.
2. O link oficial trazia prefixo `/000/checkoutSession/show/<uuid>`. A whitelist foi corrigida com teste de regressão, preservando o host Sandbox fixo. IDs conhecidos são preservados mesmo se aparecer um formato de link ainda desconhecido.
3. Retorno BOLETO para pedido PIX: a validação não foi relaxada. A recorrência inequivocamente pertencente à operação é registrada e cancelada; o Pix exige homologação antes de ser oferecido.
4. Estorno não equivale a cancelamento da recorrência. O bloqueio de duplicidade permanece até o cancelamento efetivo.
5. Estorno tardio após exclusão da assinatura: conciliação continua pelos IDs conhecidos de pagamento/evento, sem tratar 404 de assinatura como motivo para abandonar o histórico.
6. O empacotador de Functions tentava resolver bibliotecas de tipos após podar dependências de desenvolvimento. A transpilaçao foi isolada em `api/tsconfig.json`; o build/CI principal continua verificando estritamente toda a API e servidor, com teste de regressão dessa exigência. A logo é incluída explicitamente no pacote da Function.
7. Erros de setup no frontend agora preservam mensagens específicas; body malformado retorna erro de entrada. Datas impossíveis e URLs de produção são rejeitadas.

## Verificações

- `npm run typecheck`: aprovado.
- `npm test`: **344 testes**, 28 arquivos.
- `npm run build`: aprovado, PWA gerado.
- `npm run test:migrations`: aprovado.
- PostgreSQL 17 nativo descartável, sem Docker: **296 asserções SQL/RLS**, sendo 46 específicas do Sandbox.
- Nenhuma resposta administrativa, token, URL assinada ou resposta financeira é adicionada ao cache do service worker.
- Capturas do produto em `docs/billing/capturas/` usam fixtures locais e não são indicadores financeiros reais. A captura de pagamento confirmado veio do checkout real de homologação.
- CI/Preview final: estado registrado no PR após o push final.

## Integridade e produção

O Supabase `yazdjiwaksamizrbqewq` continua com **oito migrações aplicadas**. A nova migração Sandbox permanece ausente. O `pgcrypto` já existe no schema `extensions`, compatível com a proposta.

Hashes e contagens dos nove conjuntos de dados originais e do Storage permaneceram iguais: três negócios draft preexistentes (incluindo técnico anterior), um objeto de fotografia e nenhuma assinatura real iniciada. Publicações e negócios publicados continuam zero. Auditoria administrativa, administradores e flags reais de checkout/bloqueio não foram alterados.

Produção permanece no commit `2eba4951b95e58865c19113602d129dc8592ce28`, sem merge deste PR. As operações financeiras reais não foram habilitadas. O acionamento temporário de ensaio por build foi removido; a variável de opt-in foi esvaziada, e builds padrão voltaram a somente GET.

## Pendências para homologação integral

1. Revisar o PR e autorizar separadamente a migração `20261121031038_sandbox_billing.sql`.
2. Provisionar segredo HMAC sensível no servidor Preview e seu digest privado, além de token independente do webhook; não enviar credenciais no chat.
3. Aprovar a origem estável de Preview e a entrega do webhook através da proteção da Vercel, sem segredo em query string. Configurar o webhook somente no Asaas Sandbox.
4. Habilitar os booleanos gerais de homologação apenas nesse Preview e repetir o fluxo com sessão legítima e negócio técnico autorizado.
5. Resolver/confirmar a disponibilidade do Pix na conta Sandbox, repetir o ensaio e exigir resposta PIX. Até lá, manter suas duas flags de homologação falsas.
6. Executar entrega/repetição de eventos, recuperação após interrupção e conciliação no banco remoto após os passos autorizados. A fila tem retomada administrativa; agendamento automático não foi ativado.
7. Monetização real exige tarefa e aprovação comercial próprias. O cartão pode capturar na confirmação do checkout; não assumir adiamento de cobrança apenas por `nextDueDate`. Os 90 dias reais continuam intactos e não disparam cobranças ou bloqueios.

O PR permanece sem merge. Não habilitar pagamentos reais, não aplicar SQL remoto e não publicar este código em produção automaticamente.

