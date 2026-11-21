# PR #17 — Cartão, webhook e conciliação Sandbox validados

Data: 21/11/2026. Branch feat/asaas-sandbox. Nenhum merge ou deploy de produção. **Cartão e webhook homologados no fluxo integrado; Pix permanece não homologado e desligado. Isso não habilita monetização real.**

## Configuração final

Asaas Sandbox → Supabase Edge Function `asaas-sandbox-webhook` → endpoint fixo do Preview Vercel → inbox durável/HMAC → GET de conciliação no Asaas.

- Receptor: https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook, ID 5823ce7c-7ca4-4b01-81f2-3db45c7df2be, ACTIVE versão 2. Autenticação própria por token; verify_jwt=false apenas nessa função. Sem chave Asaas, service_role ou acesso direto ao banco no código do receptor.
- O Preview inteiro continua protegido por Vercel Authentication. Nenhuma exceção pública. Bypass independente apenas no header interno, destino fixo, sem proxy genérico, cookies, bearer ou redirecionamentos. A credencial tem alcance de projeto; guardar privadamente e revogar quando o receptor for retirado. A Vercel exige um bypass default no ambiente de servidor/build; não há prefixo VITE_ nem uso do valor no frontend.
- Webhook Asaas Sandbox: f19f75fd-5ed7-4385-8180-2badcb1a1e23, PEREIRAO PR17 SANDBOX, enabled=true, interrupted=false, envio SEQUENTIALLY, 23 eventos suportados. Opt-in de provisionamento esvaziado após a criação. Builds normais continuam somente GET.
- HMAC, token de webhook e bypass independentes, sem segredos em URLs/repositório/frontend/logs da aplicação. HMAC gerado no banco e transportado com PGP; armazenamento privado no banco/Vercel e secrets da Edge Function. Scanner local não encontrou os três segredos gerados nos 15 arquivos do dist.

## Migrações e defeitos corrigidos

1. `20261121031038_sandbox_billing.sql` aplicada mediante autorização. SHA-256 a2690165f6a4c1863ea6ffff82407a44503f6913e490db4931ea80939e9bbdf4.
2. O ensaio autenticado descobriu 42702 na consulta do proprietário: alias SQL c conflitava com a variável PL/pgSQL c. Reproduzido no PostgreSQL local antes da correção.
3. `20261121162242_fix_sandbox_owner_overview.sql` preparada, revisada, autorizada especificamente e aplicada. SHA-256 13a42ae9429400d95e000fab23464a2b3f1c2cc359029d0d3dd122503998aef1. Muda somente o alias para owned_contract, sem dados/grants/direitos. Dois testes de regressão cobrem consulta vazia e com pagamento conciliado.
4. MCP gerou versões de execução diferentes; somente os registros novos foram reconciliados para os IDs dos arquivos, sem reaplicar SQL ou alterar as oito versões anteriores. Histórico final: dez migrações, incluindo as duas acima.
5. O receptor inicialmente convertia conflito 409 do backend em 502; corrigido para preservar 409 CONFLICT e testado localmente e por HTTP real.

## Identificadores registrados antes do estorno/cancelamento

| Registro | ID |
| --- | --- |
| Negócio técnico preexistente, preservado em draft | f790de1a-68a5-41fe-86fc-6c56ea32ac0a |
| Contratação aceita pela sessão legítima | 3787a7cf-f551-4295-be4a-d7634bb4942a |
| Cliente financeiro sintético | cus_000010067874 |
| Checkout hospedado | 578301a6-3d5a-466f-9535-470193be88d0 |
| Assinatura Asaas | sub_ea6zgk6dsijgssru |
| Pagamento Asaas | pay_0_k6naxt3y6m8e8c |
| Pedido idempotente de estorno | a245ae46-383d-4e83-86bf-0061b13a9988 |

Não criar nem usar outro prestador como fixture. O negócio técnico mantém seus mesmos campos/status, proprietário e área de atendimento; somente novos registros financeiros privados foram associados ao seu UUID. Não houve criação de usuário ou negócio.

## Matriz de validação

| Teste | Evidência/ambiente | Resultado |
| --- | --- | --- |
| Login, usuário e proprietário | Sessão legítima no Chrome; backend usa Auth getUser, UUID confere com owner | Aprovado; sem transferência de cookies/tokens |
| Consentimento e contratação | Formulário real do Preview, cartão hospedado; R$ 19,99 explicitamente fictício | Um contrato/cliente/checkout, sem cobrança real |
| Cartão | Cartão de aprovação oficial do Asaas, dados sintéticos, somente no checkout Sandbox | Página confirmou; API conciliou CONFIRMED |
| Vínculo financeiro | PostgreSQL operacional | Mesmo negócio, customer, checkout, subscription e valor/ciclo validados pelo backend |
| Entrega real | Sete eventos gerados pelo Asaas persistidos; logs oficiais mostram HTTP 200 para pagamentos | Aprovado |
| Autenticação entre saltos | Edge sem/com token errado=401; Preview sem bypass=401; bypass sem token=401; body malformado=400 | Aprovado antes de ativar o webhook |
| Persistência antes do ACK | Preflight HTTP 200 + linha única durável na inbox; sequência do handler aguarda INSERT antes de responder | Aprovado |
| Recuperação de concorrência | Eventos reais chegaram pendentes; botão administrativo reprocessou a fila após pagamento | Sete eventos reais processed, sem duplicações |
| Replay após estorno | Reenvio técnico de PAYMENT_CONFIRMED já processado para o endpoint real | HTTP 200, uma linha, auditoria continuou com 7 registros; pagamento não voltou de REFUNDED |
| Conflito de ID | Payload técnico diferente com mesmo ID no receptor versão 2 | HTTP 409, nenhum ACK ou alteração financeira |
| Painel administrativo | Sessão real do administrador | Mostrou 1 ativa/1 confirmação; receita recebida R$ 0,00, separada da receita real |
| Estorno | Confirmação na UI administrativa → API Sandbox → webhook → GET de conciliação | REFUNDED, 1999 centavos estornados, pedido acknowledged |
| Cancelamento | Confirmação na UI → DELETE Sandbox → evento real SUBSCRIPTION_DELETED | Contrato cancelled, provider_cancelled=true; histórico preservado |
| Nova consulta/reload | Retorno hospedado, navegação e nova conciliação autenticada | Sessão preservada; estado final persistente |
| HMAC e replay de prova | HTTP/PostgREST de servidor, antes do checkout | Válida=200, inválida=401/42501, nonce repetido=409/23505; não é sessão de usuário |
| RLS, outros usuários, 90 dias, ordem forçada, timeouts e falhas de rede | PostgreSQL local/automatizados | Aprovados; não declarar troca real de segundo usuário ou corte físico de rede |
| PWA e rotas administrativas | Regressões, build e uso real do painel | Dados privados fora do cache; nenhuma regressão comprovada |

Os logs de entrega do Asaas só estão disponíveis na interface oficial. A captura mostra três notificações de cobranças com HTTP 200. Os outros eventos foram comprovados na inbox operacional. Não houve reenvio manual pelo próprio Asaas; o replay controlado foi enviado pelo ensaio técnico e está identificado como tal.

## Eventos reais processados

- CHECKOUT_CREATED: evt_37260be8159d4472b4458d3de13efc2d&25680786
- PAYMENT_CREATED: evt_05b708f961d739ea7eba7e4db318f621&25680823
- PAYMENT_CONFIRMED: evt_15e444ff9b9ab9ec29294aa1abe68025&25680824
- CHECKOUT_PAID: evt_20f793f686aa4783d486a40e3c6b91d1&25680822
- SUBSCRIPTION_CREATED: evt_6561b631fa5580caadd00bbe3b858607&25680821
- PAYMENT_REFUNDED: evt_d313266b1bd58128da69a2a96d82e79e&25680854
- SUBSCRIPTION_DELETED: evt_5dbdd3e48f06e3fd744ba0e8e6abd53a&25680877

## Estado final e integridade

Um contrato cancelado, um cliente sintético preservado, um pagamento REFUNDED/settled=false, um pedido de estorno acknowledged e sete auditorias financeiras. Receita recebida Sandbox R$ 0,00; nenhuma receita real ou direito real criado.

A comparação de hashes/contagens confirmou igualdade dos nove conjuntos originais e Storage, assinaturas/gratuidade reais, publicações, auditoria/administradores, vínculos financeiros reais e flags de enforcement/checkout. Continuam três negócios draft preexistentes, zero publicados e um objeto Storage. Nenhum período gratuito começou ou reiniciou. A proteção de UPDATE de businesses.status permanece.

Produção Vercel READY no commit 2eba4951b95e58865c19113602d129dc8592ce28, deployment dpl_F2Lc3HrpC9hVhFG21uYHxdixhZxT. Nenhum deploy de produção, merge ou publicação Lovable.

## Verificações e pendências

- 382 testes automatizados em 31 arquivos, typecheck e build/PWA aprovados.
- 305 asserções SQL/RLS aprovadas em PostgreSQL 17 nativo descartável, sem Docker.
- GitHub Actions e Preview do head final registrados no corpo do PR.
- Uma fixture de preflight ficou reconcile_required: evt_pr17_preflight_912984527eca412a83143da9701de193, objeto inexistente pay_pr17_preflight_9899eef8bf944aa086e70dc50e4c6dff. Foi criada deliberadamente antes da ativação para validar persistência/falha. É a única pendência da fila; não é falha de um pagamento real. Não apagada nem reclassificada automaticamente. Sua limpeza depende de autorização.
- Pix continua bloqueado; a chave pendente não foi considerada causa comprovada de BOLETO. Não aceitar boleto como alternativa.
- A fila continua com reprocessamento administrativo, sem cron automático; monitorar a operação e definir retenção/expurgo de nonces antes de volume sustentado.
- Produção financeira/checkout real continuam desabilitados; requerem revisão comercial e técnica própria. Os 90 dias não acionam contratação automática, e data futura não garante adiamento de captura de cartão.
- A homologação integrada com cartão/webhook está concluída neste escopo. Não declarar homologação de Pix, cobrança real ou testes em dispositivos físicos.

Fontes: [cartões oficiais de homologação](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito), [webhooks Asaas](https://docs.asaas.com/reference/create-new-webhook), [logs oficiais](https://docs.asaas.com/docs/logs-de-webhooks).

## Evidências de interface

- [Confirmação no checkout oficial](capturas/cartao-integrado-confirmado.png), anterior ao estorno.
- [Entregas HTTP 200 nos logs Asaas](capturas/asaas-entregas-http-200.png).
- [IDs, estado final e eventos](evidencias-integradas-pr17.json).

As cópias temporárias locais dos segredos e das chaves de transporte foram removidas após a validação. Os segredos necessários à integração permanecem apenas no armazenamento privado dos serviços, sem valores no relatório.
