# PR #17 — Conclusão técnica de 21/11/2026

PR: https://github.com/GabrielRibeiroD7V/pereiraoapp/pull/17  
Branch: `feat/asaas-sandbox` — mesmo PR, sem merge.  
**Homologação integral ainda não concluída.** Cartão homologado no provider Sandbox; Pix, persistência remota financeira e webhook real dependem das etapas abaixo.

## Resultado por frente

| Frente | Evidência | Estado final |
| --- | --- | --- |
| Cartão | Ensaio real anterior: recusa, aprovação, GET de vínculo/valor/ciclo, estorno REFUNDED e cancelamento da recorrência | Homologado no Asaas Sandbox; não repetido nesta continuação. Não equivale à persistência integrada App → RPC remota. |
| Cadastro da conta | GET real HTTP 200 de myAccount/status em 21/11 00:16:37 Campo Grande | commercialInfo, bankAccountInfo, documentation, general: APPROVED |
| Pix | GET real HTTP 200: uma chave AWAITING_ACTIVATION, hasMore=false. Ensaio anterior pediu PIX e recebeu BOLETO, depois cancelado | Bloqueado; causa não estabelecida. Nenhuma nova assinatura criada e nenhuma flag Pix habilitada. |
| Webhook | Endpoint, deduplicação, ACK após persistência, GET de conciliação e recuperação testados localmente | Entrega real pendente de banco/segredos e de rota aprovada que o Asaas alcance sem Vercel Authentication. |
| Migração financeira | Sequência aplicada apenas em PostgreSQL 17 nativo descartável, com RLS/HMAC/nonce/auditoria | Revisada e proposta; **não aplicada** no Supabase operacional |
| Gratuidade e direitos reais | SQL/regressões locais + snapshot remoto somente leitura | Nenhum período iniciado/reiniciado; nenhum direito real concedido por pagamento Sandbox |
| Cobranças reais | Host e chave Sandbox; handlers recusam Production | Nenhuma cobrança ou operação financeira no Asaas de produção |

O histórico remoto contém exatamente as oito migrações existentes. A proposta `20261121031038_sandbox_billing.sql` permanece ausente. SHA-256 revisado: `a2690165f6a4c1863ea6ffff82407a44503f6913e490db4931ea80939e9bbdf4`.

## Investigação Pix: conclusão limitada pela evidência

A conta está aprovada nos quatro estados consultados. A chave pendente é uma evidência concreta; não demonstra a causa de BOLETO. A documentação aceita PIX e não explica a conversão. GET autorizado também não prova permissão de criação de recorrências. Não pedimos novos documentos, não geramos outra chave e não criamos outra assinatura.

Ação exata pendente do proprietário: **Asaas Sandbox → Ajuda/suporte de homologação**, com o texto e IDs preparados em [ativação segura](ativacao-segura-pr17.md#pix-evidência-e-próxima-ação-do-proprietário). Conferir a chave em Pix → Minhas chaves e a tentativa em Integrações → Logs de Requisições. Solicitar confirmação de elegibilidade, motivo da conversão e ação necessária para a chave existente. O corpo da tentativa está reconstruído pelo código/testes, não capturado remotamente. Não enviar segredos ou dados pessoais.

## Correções desta continuação

- Eventos de tipo suportado com payload malformado retornam 400; não são descartados com ACK 200. Eventos válidos continuam recebendo 200 somente depois da persistência durável.
- Ações herdadas do protótipo (`constructor`, `__proto__`, `toString`) são rejeitadas antes da criação de serviços/backend.
- Lease vencido não conclui evento; tokens de workers antigos são verificados também nas gravações intermediárias da conciliação. Pagamentos têm proteção transacional contra troca de contrato e identificadores conflitantes não selecionam arbitrariamente um negócio.
- Auditoria guarda snapshots mínimos antes/depois de estorno, valor, vencimento, liquidação e confirmação, sem payload bruto ou dados completos de cartão.
- Preflight opcional exclusivamente GET não imprime dados cadastrais, chave Pix ou API key. Opt-in temporário já esvaziado. Novos testes Pix exigem autorização específica e configuração apta antes de criar qualquer cliente; a regra conservadora não é apresentada como causa do defeito do provider.

Arquivos alterados nesta continuação: `server/billing-contracts.ts`, `server/sandbox-handlers.ts`, `server/sandbox-service.ts`, `server/sandbox.test.ts`, `server/asaas-readonly.test.mjs`, `scripts/check-asaas-sandbox.mjs`, `scripts/preflight-asaas-readonly.mjs`, `scripts/smoke-asaas-sandbox.mjs`, a migração proposta, `supabase/tests/sandbox_billing.sql` e documentação em `docs/billing/`. Nenhuma alteração de UI/UX ou refatoração visual.

## Testes e limites

| Verificação | Ambiente | Resultado |
| --- | --- | --- |
| Vitest completo | Local; mocks de provider/rede, componentes e APIs | **356 testes em 29 arquivos aprovados** |
| SQL/RLS completo e sequência de migrações | PostgreSQL 17 local nativo descartável, sem Docker | **303 asserções aprovadas**; nenhuma conexão ao Supabase remoto pelo executor |
| Typecheck | Local, incluindo frontend/server/API | Aprovado |
| Build + geração PWA | Local | Aprovado; versão PWA `ac212b083325d0e185c1`, mesmos assets de frontend |
| Consistência do histórico local | Local, comparação com snapshot | Aprovado; complementado pela consulta real das oito versões remotas |
| HMAC inválido, nonce repetido, RLS, isolamento, consentimento, estorno, lease vencido, 90 dias | SQL local + automatizados | Aprovados; não são sessões operacionais remotas |
| Webhook repetido, fora de ordem, falha de persistência, retry e conciliação via GET | Mocks + PostgreSQL local | Aprovados; **sem entrega real pelo Asaas** |
| Auth, autorização administrativa, guards Production e APIs/URLs privadas fora do cache PWA | Regressões automatizadas | Aprovadas; não houve novo login humano ou teste em celular físico |
| Diagnóstico e estado cadastral/Pix | GET real Vercel → Asaas Sandbox | HTTP 200, projeção segura registrada |
| Integridade Supabase e deployment Production | Integrações, somente leitura | Preservados; detalhes abaixo |
| GitHub Actions/Preview do novo head | Remoto | Conferência final publicada no corpo do PR; não confundir checks do commit anterior com os novos |

As capturas e os IDs do cartão permanecem no [relatório histórico](relatorio-homologacao.md). A tela de pagamento aprovado é anterior ao estorno, não evidência de cobrança ativa atual. A responsividade já verificada em 375/390/768/1280 px não foi repetida sem mudança visual. Não houve navegador, novo ensaio financeiro, novas fotografias ou screenshots nesta continuação.

## Integridade e produção

Consulta final somente leitura comparou hashes/contagens dos nove conjuntos originais, objetos/buckets Storage, histórico, assinaturas, posts, administradores/auditoria, inbox e vínculos do provider e flags financeiras: **todos iguais ao snapshot anterior**. Permanecem três negócios draft preexistentes (incluindo técnico de tarefa anterior), um objeto no Storage e zero negócios publicados. Nenhum registro, status ou período de gratuidade foi alterado.

Vercel Production: **READY**, deployment `dpl_F2Lc3HrpC9hVhFG21uYHxdixhZxT`, commit `2eba4951b95e58865c19113602d129dc8592ce28`. Não houve deploy de produção, promoção de Preview ou merge. O PR permanece aberto em draft por dependências críticas de homologação.

## Operações ainda dependentes de autorização

1. Aplicar a versão revisada da migração financeira e validar sua integridade remota.
2. Provisionar o segredo HMAC/digest e o token independente do webhook por canal privado aprovado; nenhum valor em chat/commit/log.
3. Aprovar uma rota específica para entrega externa. Preview está protegido; o Asaas não documenta headers customizados de bypass. Não desabilitar a proteção do projeto. A exceção Vercel, se escolhida e disponível no plano, é por hostname inteiro, não caminho.
4. Configurar o webhook na conta Sandbox e executar entrega real/replay/reprocessamento com registros técnicos explicitamente autorizados; o ensaio local não substitui isso.
5. Obter esclarecimento do Asaas sobre Pix, depois autorizar novo ensaio limitado. Não habilitar flags por simulações nem pela simples presença de chave ACTIVE.

O [roteiro de ativação segura](ativacao-segura-pr17.md) detalha provisionamento, aceitação, proteção e fontes oficiais. Não há início automático de contratação no fim dos 90 dias. Checkout de cartão pode capturar imediatamente no Sandbox; vencimento futuro não garante adiamento. Checkout financeiro real continua desabilitado e exige outra revisão/consentimento comercial.
