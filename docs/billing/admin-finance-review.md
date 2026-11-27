# PR #99 — administração e Financeiro

Revisão de 27/11/2026. Não autoriza merge, SQL remoto ou operações reais.

## Implementação

- Shell administrativo com logo oficial existente (sem alteração), navegação lateral desktop e menu recolhível no celular (Escape fecha e devolve foco), navy #0B1739, azul #0066CC, ciano e amarelo somente em detalhes. Tabelas possuem região de rolagem própria, foco e cabeçalhos.
- Financeiro centraliza Visão financeira, Assinaturas, Pagamentos, Testes Asaas e Configurações. URLs antigas continuam acessíveis; sidebar evita entradas financeiras duplicadas.
- Reutiliza a política e os controles de #95 já integrados, a gratuidade por negócio e a consulta recorrente Sandbox existente. Sem novos endpoints, SQL ou permissões pelo redesign.
- Testes avulsos preservam todas as ações, limites, consentimentos, idempotência e bloqueios do PR #99. Valores planejados são identificados como tais; somente o backend decide habilitação e confirmação.

## Fontes e limites dos indicadores

| Informação | Fonte / comportamento |
|---|---|
| Totais de registros Production e política gratuita | `monetization_status` já existente. Não equivalem a receita, contratos ativos ou chamadas Asaas. |
| Receita, taxas, líquido e detalhamento Production | Indisponível: não existe endpoint de leitura correspondente neste escopo. Não se lê tabela privada diretamente. |
| Contratos Sandbox | API administrativa Sandbox, preservando preço histórico de cada contrato (inclusive R$ 19,99). Próxima cobrança não é inferida do primeiro vencimento. |
| Bruto confirmado Sandbox | Soma dos pagamentos conciliados com `settled`; é valor de teste e não receita Production. Estornos e taxas não são subtraídos silenciosamente. |
| Pendentes/vencidos Sandbox | Estados dos pagamentos, nunca a contagem de contratos pendentes/vencidos da summary. |
| Taxas, líquido e data de confirmação Sandbox recorrente | Indisponível; `updatedAt` não é data de pagamento. |
| Webhook/conciliacão avulsa | Inbox e projeção do backend próprio. Presença de credencial, fila vazia, flag ou registro não comprova entrega. |

Configurações conserva o controle administrativo real do #95: bloqueado pela fase gratuita, com confirmação, justificativa e auditoria quando aplicável. Não foi criada ativação fictícia. Novas contratações, exigência de assinatura e cobranças são operações distintas.

## Compatibilidade e histórico remoto

Main recebida: `fda704d45df99a3b6f4efb54d4c274cc47c9aebc` (#95 integrado). #96 aberto no head `4239884ab33e3ffe7aa53aa2cb5248a6bae9f049`, verify/sql-rls e Vercel aprovados na consulta. Não foi mesclado.

Leitura do histórico identificou:

| SQL | ID local | ID remoto | SHA-256 igual |
|---|---|---|---|
| admin_monetization_policy | 20261127192500 | 20261127200456 | `0d25295a407dfde4835143a6f39eb21259ffa524400bb71132e832c434eecaad` |
| sandbox_monthly_1990 | 20261127193500 (somente #96) | 20261127200512 | `dff75de045c21feb43f0532f9ebc35ed8e7e6d8c93c8448e5107493b1c7a7aea` |

Não foi reescrito o histórico nem reaplicado SQL. O dry-run remoto do #99 foi executado com `--dry-run --skip-vault` e bloqueia por versões remotas ausentes localmente. Portanto **não existe lista exclusiva válida nem prontidão para aplicar a migração do #99** até reconciliação auditada desses nomes/IDs. Não se copia a migração do #96 para disfarçar a divergência.

Único SQL novo do #99: `20261127193736_admin_oneoff_payment_tests.sql`, SHA-256 `7453e3f26ca0ee374191ca7dc4b5746f6280238bbd71e61d4546deb4a8b5620d`, inalterado pelo redesign e ainda proposto. Preflight/fluxo financeiro: [admin-oneoff-tests.md](admin-oneoff-tests.md).

Leitura remota nesta rodada: 16 categorias ativas, RLS ligado nas seis tabelas de cadastro verificadas, quatro negócios (três draft e um já published), zero assinaturas. Nenhum desses estados foi alterado. Não confundir o estado histórico de quatro drafts com a situação atual.

## Evidências visuais

Capturas da interface React real em Chromium local, fontes sintéticas identificadas e rede externa bloqueada. Não são dados financeiros reais, teste operacional de upload, pagamento ou iPhone físico. Script: `node scripts/admin-finance-qa.mjs`.

| Tela | Celular emulado | Desktop |
|---|---|---|
| Visão geral | [393px](../screenshots/admin-finance-pr99/overview-393.png) | [1440px](../screenshots/admin-finance-pr99/overview-1440.png) |
| Visão financeira | [393px](../screenshots/admin-finance-pr99/finance-393.png) | [1440px](../screenshots/admin-finance-pr99/finance-1440.png) |
| Assinaturas | [393px](../screenshots/admin-finance-pr99/subscriptions-393.png) | [1440px](../screenshots/admin-finance-pr99/subscriptions-1440.png) |
| Pagamentos | [393px](../screenshots/admin-finance-pr99/payments-393.png) | [1440px](../screenshots/admin-finance-pr99/payments-1440.png) |
| Testes Asaas | [393px](../screenshots/admin-finance-pr99/oneoff-393.png) | [1440px](../screenshots/admin-finance-pr99/oneoff-1440.png) |
| Configurações | [393px](../screenshots/admin-finance-pr99/settings-393.png) | [1440px](../screenshots/admin-finance-pr99/settings-1440.png) |

Layout verificado em 320, 375, 393, 430, 768, 1024 e 1440px: seis telas por largura, sem overflow da página, sem erros JavaScript ou acesso ao Supabase. Menu mobile testado com abertura e Escape. Tabelas extensas mantêm rolagem contida. Testes de fontes indisponíveis, navegação sem escrita, separação de ambientes e preço legado incluídos.

## Pendências de homologação

- Corrigir os identificadores locais versus remotos em entrega auditada própria, antes de qualquer aplicação.
- Autorizar separadamente a única migração avulsa após dry-run exclusivo.
- Configuração segura de Preview e receptor, entrega efetiva pelo Asaas e pagamentos Sandbox com pagador consentido ainda não foram executados pelo redesign. Fixtures/CI não comprovam isso.
- Aceite visual e ensaio físico de iPhone/Android pendentes; não houve teste em aparelho nesta rodada.
- Production, checkout real, cobrança, recorrência e publicação de conteúdo não foram ativados. #52 e #62 fora do escopo.
