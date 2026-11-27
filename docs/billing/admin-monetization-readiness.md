# Monetização sob controle administrativo — 27/11/2026

## Estado comprovado e escopo desta entrega

Leitura no projeto `yazdjiwaksamizrbqewq`: fase `initial_free`, checkout/enforcement falsos, zero assinaturas e ativações reais. Existe um contrato Sandbox histórico de 1.999 centavos. Não representa receita real. Nenhuma chave foi consultada, copiada ou criada e nenhuma operação Asaas foi executada nesta revisão.

A fase atual não tem expiração. `private.start_trial_on_activation` não inicia relógio; o trigger `initial_free_subscription_guard` recusa insert/update de assinaturas reais. Publicação pelo responsável e moderação posterior permanecem independentes de pagamento. Isenção preservada. Não reintroduzir avisos financeiros na Conta/cadastro.

O provider Production só lê/reconcilia objetos vinculados com consentimento. Checkout, criação de clientes/assinaturas, cobranças, Pix e enforcement continuam sem implementação de escrita e com capabilities falsas. As verificações do receptor exigem ambiente Production e flag específica; esta entrega não muda flags nem configura receptor.

## PR: política e painel administrativo

- `/admin?sec=monetization`: estado, R$ 19,90/mês por negócio, contratos reais, vínculos, pendências conciliadas e contratos Sandbox separados. Zeros vêm das tabelas, falha não vira zero.
- “Pagamentos registrados no banco (Production)” é contagem de linhas persistidas, não quantidade de consultas ou chamadas à API. Não há telemetria de chamadas neste indicador. Controle preparado e bloqueado pela fase gratuita não significa ativação operacional completa.
- Presença de credenciais é somente configuração declarada pelo servidor, nunca comprovação de autenticação ou entrega. Sem GET automático ao abrir o painel.
- RPC de decisão exige administrador habilitado, confirmação literal, motivo e revisão esperada. Lock serializa alterações; conflito exige atualizar. Alteração efetiva gera auditoria, repetição sem mudança não gera efeito repetido.
- Habilitação é recusada durante a fase gratuita ou sem prontidão. Não existe API para declarar prontidão nem para encerrar a fase. O diálogo permite examinar a futura decisão, mas não habilitá-la agora.
- Desabilitar novas contratações não modifica contratos existentes, pagamentos nem permissões de acesso.
- Habilitar contratação, exigir recursos pagos após comunicação/transição e cobrar contratos consentidos continuam três operações independentes. A liberação futura exige outra entrega técnica/comercial; este PR não torna cobranças operacionais.

## Migração proposta e preflight

Arquivo: `20261127192500_admin_monetization_policy.sql`.
SHA-256: `0d25295a407dfde4835143a6f39eb21259ffa524400bb71132e832c434eecaad`.
Projeto: `yazdjiwaksamizrbqewq`. Histórico em leitura: 28 versões, última `20261125183249`.
Dry-run remoto Supabase CLI 3.4, `db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault`: somente esse arquivo, sem seeds/roles. **Não aplicado.** O PR #94 de categorias tem outra migração em branch independente e não entra neste dry-run.

Cria uma tabela privada com RLS e sem acesso direto de anon/authenticated, duas RPCs administrativas com search_path vazio, preço fixado por constraint. Não altera funções existentes, RLS de negócios, contratos, histórico nem dados profissionais. Compatível com a interface publicada, que não consulta essas RPCs. O novo painel exige aplicar a expansão antes da integração; Preview sem expansão exibirá indisponibilidade, não prontidão inventada.

Sequência futura: reconferir hash/histórico/dry-run exclusivo → autorização específica do SQL → aplicar transação → verificar estrutura/grants/RLS e preservação de dados em leitura → ensaio administrativo legítimo → revisão do código/CI → decisão separada de merge. Não habilitar contratações no ensaio.

Contenção: falha transacional reverte a expansão inteira. Após commit, manter tabela/auditoria; reverter interface para versão anterior ou retirar a nova rota de API se houver defeito, com revisão. Não apagar contratos/fotos nem desligar a fase gratuita. O guard original continua recusando escritas financeiras.

## Testes desta rodada

35 testes direcionados de API/interface: autorização, confirmação, concorrência, contagens, falhas e bloqueio de habilitação. PostgreSQL 17 descartável executou toda a sequência de migrações e testes SQL/RLS, incluindo nova política, anônimo/usuário comum/admin suspenso, auditoria e preservação. Typecheck/build passaram. Os testes de política habilitada usam somente estado sintético local para provar a contenção; não significam ativação remota. Não houve ensaio físico nem nova contratação Sandbox.

## Modalidades: evidência e pendências

| Modalidade | Evidência oficial | Situação PEREIRÃO |
|---|---|---|
| Cartão de crédito mensal | Checkout hospedado `CREDIT_CARD` + `RECURRENT`, ciclo `MONTHLY` | Implementação Sandbox prévia reutilizável; preço antigo exige expansão/novo consentimento. Homologação histórica não prova nova contratação de R$19,90. |
| Pix Automático | Jornada 3, autorização inicial e estado ACTIVE, `paymentCreationMode=SUBSCRIPTION` | Não implementado/homologado nesta conta. Não confundir PIX com modo automático nem receber BOLETO como sucesso. |
| Pix mensal manual | Pagamento Pix confirmado separadamente a cada ciclo | Alternativa a preparar/homologar, explicitamente manual, sem renovação automática fictícia. |
| Débito | Fatura `invoiceUrl` pode oferecer débito; dados de débito não são enviados pela API | Isso não comprova débito recorrente. Não oferecer como assinatura disponível. |

Fontes oficiais consultadas em 27/11/2026:
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://docs.asaas.com/docs/pix-automatico
- https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito
- https://docs.asaas.com/docs/faq-do-asaas-checkout

Próximo PR independente: atualizar novas contratações Sandbox para 1.990 centavos preservando registros antigos e a prova de consentimento. Homologação real depende de aplicar somente o SQL correspondente com autorização, Preview autorizado com sessão legítima e conta Sandbox apta. Usar chave existente “pereirao - sandbox”; nunca criar outra. Pix permanece bloqueado até evidência da conta e ensaio real. Não declarar homologação financeira completa enquanto esses itens estiverem pendentes.
