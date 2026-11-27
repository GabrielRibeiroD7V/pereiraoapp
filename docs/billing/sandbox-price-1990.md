# Sandbox: novas contratações a R$ 19,90

## Estado atual após a integração do #94

Branch atualizada sobre `e3fce5ef91632ebf248a6d4f629108c3b8773976`. Conflito apenas no runner SQL, resolvido preservando os testes de categorias da main e os testes de preço deste PR. Nenhum SQL alterado ou transportado de outro PR.

**Aplicação remota bloqueada por divergência de identificador na main:** o Supabase registra as categorias como `20261127192706_marketplace_sixteen_categories`, mas o arquivo da main usa `20261127185515`. A leitura confirmou SQL integralmente igual ao desconsiderar espaços nas extremidades (SHA-256 `9df00800a675cafc8578f29526f85fd269ee6605c890d2bd369c7d3c6a103688`). O dry-run atual recusa a operação com `DbPushMissingLocalError`; o resultado exclusivo registrado abaixo é histórico, anterior a essa aplicação. Não reparar nem reaplicar o histórico remoto. A reconciliação do nome deve ser uma correção própria da main, fora deste PR financeiro; depois atualizar esta branch e refazer o dry-run exclusivo.

## Escopo e compatibilidade

Usa a chave Sandbox existente; nenhuma credencial lida ou criada. Production continua recusando o endpoint Sandbox. Não modifica a fase gratuita nem gera contratos reais.

Preço/consentimento novos: `1990` centavos, `sandbox-v2-1990`. Valor compartilhado pelo cliente, validação HTTP, serviço e provider. Checkout hospedado continua `CREDIT_CARD`, `RECURRENT`, `MONTHLY`, sem coleta de cartão pelo PEREIRÃO. O preço não aparece aos profissionais na versão Production, pois a experiência Sandbox só existe em Preview autorizado.

A migração original exigia 1999 nas duas tabelas e na RPC. A expansão mantém contratos `sandbox-v1`/1999 intactos e permite novos contratos somente com consentimento 1990/v2. Pagamentos legados continuam conciliados pelo valor do próprio contrato. Reapresentar uma operação antiga como novo consentimento gera conflito antes de qualquer chamada financeira. Não converte nem cancela o contrato de teste antigo; não altera seu ID, termos, datas, estado ou valor.

Pix existente é mensal **manual**, nunca Pix Automático. Continua bloqueado pelas flags de homologação. Resposta BOLETO não equivale a sucesso Pix; as validações de modalidade/valor e a contenção existentes continuam. Nenhuma flag Pix foi habilitada. Pix Automático necessita autorização oficial e comprovação própria; débito em fatura hospedada não comprova recorrência por débito.

## Preflight proposto

- Projeto: `yazdjiwaksamizrbqewq`, histórico em leitura com 28 migrações, última `20261125183249`.
- Arquivo: `20261127193500_sandbox_monthly_1990.sql`.
- SHA-256: `dff75de045c21feb43f0532f9ebc35ed8e7e6d8c93c8448e5107493b1c7a7aea`.
- Dry-run remoto versionado executado com `--dry-run --skip-vault`: exclusivamente esse arquivo; seeds/roles vazios. **Não aplicado.**
- Branch independente da política administrativa (#95) e das categorias (#94). Não usar um dry-run de uma branch para autorizar todas. Se a main incorporar outra migração, atualizar e repetir preflight.
- Apenas constraints/defaults privados e fragmentos exatos de `reserve`. A substituição recusa definição inesperada. Preserva HMAC, nonce, grants/RLS, owner_overview corrigido, leases, inbox e auditoria. Não altera dados operacionais nem funções de publicação.
- Antes de aplicar: reconfirmar definições e constraints remotas, hash, histórico e dry-run. Exige autorização específica deste SQL.

## Ordem e contenção

1. Rever PR e autorizar exclusivamente a expansão SQL.
2. Aplicar transação, conferir definição/grants/constraints e snapshot dos registros legados em leitura.
3. Disponibilizar Preview autorizado com a chave Sandbox já existente e HMAC separado, sem exportá-los ao cliente ou ao ambiente local. A versão antiga do Preview pode deixar de iniciar testes novos: seus termos v1 serão recusados deliberadamente; consulta/conciliação/cancelamento existentes continuam.
4. Ensaio real com sessão legítima e dados sintéticos: consentimento → checkout hospedado → cartão oficial de teste → webhook real → conciliação via API → renovação simulada no Sandbox → cancelamento/estorno. Diferenciar eventos de fixture dos entregues pelo Asaas.
5. Somente depois avaliar integração de código; checkout real e enforcement permanecem desligados.

Falha de preflight/transação não aplica nada. Após commit, não restaurar constraints 1999 se existirem contratos novos1990. Conter desabilitando apenas novas operações Sandbox pela flag Preview; manter leitura, auditoria e recuperação. Não apagar contratos nem reescrever pagamentos. Um rollback de código antigo não deve ser usado para iniciar contratos a 19,99.

## Resultado dos testes e bloqueios

- Testes locais direcionados: transporte host fixo, preço/termos, checkout hospedado, ausência de campos de cartão, idempotência, divergência de valor/modalidade, pagamento pendente/recusado, timeout, cancelamento, estorno e conciliação. Dados e respostas são fixtures.
- PostgreSQL17 descartável: expansão sobre esquema completo, preservação integral do contrato legado, consentimento1990, repetição da mesma solicitação, duplicata por negócio, isolamento entre duas contas, proteção HMAC e ausência de contratos/trials reais.
- Typecheck e build executados. CI do PR deve estar aprovado antes de qualquer integração.
- **Nenhum novo checkout, pagamento, renovação ou webhook real foi executado nesta rodada.** A nova homologação1990 está bloqueada pela migração não autorizada e pela necessidade de Preview financeiro autorizado com sessão legítima. Não instalar a migração por inferência deste relatório.
- Cartão teve homologação histórica documentada no PR17; isso não substitui o ensaio novo1990. Pix Automático/manual e débito não estão homologados. Não declarar o módulo financeiro completo enquanto esses pontos estiverem pendentes.

## Reconferência final — 27/11/2026

Contrato e pagamento legados agora têm snapshots integrais antes/depois da expansão nos testes SQL. Testes de conciliação cobrem dois pagamentos (original/renovação) para cada versão de consentimento: 1999/v1 e 1990/v2; o valor da outra versão é rejeitado. Trata-se de fixtures locais, não renovação financeira real. SQL proposto e hash permanecem inalterados.
