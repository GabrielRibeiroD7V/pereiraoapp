# Issue #98 — Pix e crédito avulsos, R$ 19,90

**Preparação para revisão. Nenhuma cobrança, chave, webhook ou configuração remota foi criada/ativada. Nenhum merge. Homologação real no Sandbox ainda pendente.**

## O que foi auditado

Atualização final: main `fda704d45df99a3b6f4efb54d4c274cc47c9aebc` já contém #95. #96 permanece aberto em `4239884ab33e3ffe7aa53aa2cb5248a6bae9f049`, CI aprovado. Seus SQLs estão aplicados, **não devem ser reaplicados**, mas os IDs do histórico remoto diferem dos arquivos locais, com hashes de conteúdo iguais. O preflight anterior exclusivo ficou superado: veja o bloqueio atual abaixo e [a revisão administrativa](admin-finance-review.md).

Supabase `yazdjiwaksamizrbqewq`, em leitura: `initial_free`, uma isenção preservada, zero assinaturas/ativações/vínculos/eventos/pagamentos Production. Há um contrato Sandbox legado de 1999 centavos; não foi alterado. Chaves existentes não foram lidas/exportadas nem recriadas.

A infraestrutura de assinaturas usa HMAC/nonce, inbox privada e conciliação por API, mas foi desenhada para contratos vinculados a negócios. Não seria seguro cadastrar um vínculo profissional fictício ou ativar o receptor recorrente para estes testes. Esta entrega reutiliza autenticação administrativa, digests HMAC separados por ambiente, comparação segura e parser limitado existentes, com namespace `oneoff-v1` e tabelas/rotas próprias para as operações avulsas. Não enfraquece guardas nem muda receptores existentes.

## Escopo implementado

- `/admin?sec=oneoff`: seção “Testes avulsos Asaas”. Pagador já existente, consentido e identificado por ID no Asaas; o app não cria clientes.
- Uma operação `PIX` e uma `CREDIT_CARD` por ambiente, 1990 centavos BRL cada, cota vitalícia total de 3980. Cancelamento, expiração ou estorno não liberam outra tentativa. Não há reset/API de exclusão.
- Checkout hospedado oficial, `chargeTypes=["DETACHED"]`, uma única modalidade por checkout. O transporte recusa `RECURRENT`, `subscription`, `installment`, valor diferente e campos extras. Cartão/PAN/CVV/token nunca são coletados ou persistidos pelo PEREIRÃO.
- Três decisões explícitas: liberar infraestrutura de teste no servidor (futura configuração autorizada), abrir janela administrativa de uma hora e autorizar/criar cada operação separadamente. Abrir janela ou registrar autorização não chama POST no Asaas.
- Production ainda exige os dois meios avulsos conciliados no Sandbox com evento autenticado processado. Não há setter de “homologado”: prontidão é derivada dos registros e eventos. O cartão recorrente histórico não satisfaz essa condição.
- API valida sessão e e-mail confirmado com `getUser`, `admin_access`, origem e limites do corpo. Banco revalida administrador confirmado/habilitado, prova HMAC, domínio, tempo e nonce. Usuários comuns/anon não leem tabelas nem mudam estados/preço.
- Reserva transacional marca `creating` antes do POST. UUID da operação é a chave interna idempotente e `externalReference`. Só o primeiro claim permite criação. Timeout/resultado incerto fica bloqueado para outro POST; recuperação consulta pela referência e valida o pagamento. Não presumimos idempotência de um header não documentado do Asaas.
- Webhook `POST /api/asaas-admin-oneoff-webhook`: autentica antes de ler/processar, limita corpo, persiste aviso mínimo antes do HTTP200, deduplica por ambiente/evento e rejeita payload conflitante. Sem payload bruto, cartão, cookie ou segredo persistidos. Evento sem vínculo fica `ignored` e não cria pagamento, assinatura ou direitos de acesso.
- Reconciliação GET oficial por checkout/referência e, quando conhecido, ID do pagamento. Valida pagador consentido, valor, método, checkout, ausência de assinatura/parcelamento, moeda BRL quando fornecida. A API brasileira usa valores em reais; não inferimos moeda estrangeira a partir de um webhook.
- `CHECKOUT_PAID` e redirect não são prova suficiente. Só a leitura conciliada de `CONFIRMED`/`RECEIVED` produz `paid`. Pendente, recusa, vencido, cancelado, expiração, estorno e disputa não são tratados como pagamento confirmado novo. Regressões e divergências preservam o snapshot anterior com diagnóstico visível.
- Bruto, líquido e diferença bruto−líquido são exibidos somente quando observáveis. Líquido ausente = “Indisponível”. Esse número não é receita de assinaturas nem contagem de consultas.
- Falha pós-ACK fica no inbox; leases, tentativas, backoff e “Reprocessar eventos persistidos” permitem recuperação administrativa. Sem cron/agendamento implantado nesta rodada: o reprocessamento é manual. Fechar a janela não bloqueia leitura/conciliação posterior.

## Flags e segredos — nenhum provisionamento nesta rodada

Somente no servidor:

| Ambiente | Criação avulsa (padrão desligado) | Credenciais já previstas |
|---|---|---|
| Preview/Sandbox | `ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED` | `ASSAS_API_KEY_SANDBOX`, `BILLING_RPC_SIGNING_SECRET`, `ASAAS_SANDBOX_WEBHOOK_TOKEN` |
| Production | `ASAAS_ADMIN_ONEOFF_PRODUCTION_ENABLED` | `ASAAS_API_KEY_PRODUCTION`, `BILLING_PRODUCTION_RPC_SIGNING_SECRET`, `ASAAS_PRODUCTION_WEBHOOK_TOKEN` |

`ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED` também começa desligada e precisa de token válido, independente entre ambientes e do segredo HMAC. Nenhum segredo é enviado ao frontend, URL ou log. Usar os segredos existentes; não criar outra chave “pereirao - sandbox”.

As flags gerais `ASAAS_PRODUCTION_{CHECKOUT,SUBSCRIPTIONS,CHARGES,ENFORCEMENT,PIX}_ENABLED` continuam ausentes/falsas. Se alguma estiver ligada, o novo modo recusa configuração. `ASAAS_PRODUCTION_WEBHOOK_ENABLED` não é ativada por esta entrega. Teste Pix avulso não habilita Pix de assinatura nem Pix Automático.

O Preview está protegido. O relay Sandbox existente aponta para o receptor antigo e **não pode ser reutilizado ou redirecionado silenciosamente**. Entrega real ao novo endpoint exige configurar, mediante revisão própria, um receptor restrito ao caminho avulso com bypass exclusivamente em header/servidor, ou outro meio equivalente com proteção mantida. Não tornar o hostname inteiro público nem alterar webhook de outro projeto.

## Preflight SQL proposto

- Projeto: `yazdjiwaksamizrbqewq`.
- Arquivo: `20261127230000_admin_oneoff_payment_tests.sql`.
- SHA-256: 7453e3f26ca0ee374191ca7dc4b5746f6280238bbd71e61d4546deb4a8b5620d.
- Dependências DDL: fundação Auth/admin, `private.sandbox_same_bytes`, digests `sandbox_backend_keys` e `production_billing_keys` já previstos/aplicados. Não depende do esquema proposto de #95/#96; sua revisão/homologação continua pré-requisito operacional do issue. Não aplicar seus SQLs junto por inferência.
- Cinco tabelas privadas com RLS/revokes; uma função interna de prontidão Sandbox sem permissão pública e uma RPC com prova HMAC. A RPC aceita anon/authenticated apenas como transporte assinado; isso não autoriza o cliente a usá-la sem segredo do servidor.
- Não modifica tabelas/funções/políticas existentes, negócios, posts, contratos, isenção ou fase gratuita. Ambos os ambientes e suas janelas começam desabilitados, sem operações financeiras.
- Dry-run remoto versionado desta branch reexecutado com `--dry-run --skip-vault`: **BLOQUEADO**, `DbPushMissingLocalError`, versões remotas `20261127200456` (admin_monetization_policy) e `20261127200512` (sandbox_monthly_1990). Hashes iguais aos SQLs locais de IDs `20261127192500` / `20261127193500`. Nenhum repair, pull de esquema ou SQL foi executado. Não existe lista exclusiva válida nesta revisão.
- Antes de aplicação: reconciliar os identificadores em entrega auditada própria; #96 continua separado. Como o ID avulso é anterior aos últimos IDs remotos, reavaliar explicitamente a ordem e eventual `--include-all` em dry-run, exigindo lista de somente este arquivo. Não usar inclusão silenciosa nem reaplicar SQL de #95/#96.

**Contenção:** falha SQL reverte transação. Depois de aplicado, manter dados/auditoria; não apagar tabelas para liberar cota. Desligar criação na flag e fechar janela impede novos checkouts, mas não cancela os já emitidos. Para impedir pagamento de link já emitido é necessário cancelar/expirar no Asaas, mediante decisão específica. Manter recepção/conciliação dos existentes enquanto necessário. Se o receptor apresentar falha, desligar o novo webhook na conta Asaas e a flag específica; preservar inbox para recuperação. Não desabilitar webhooks de outros projetos.

## Validação e sequência de implantação

1. Rever este PR, SQL/hash e #95/#96. Nenhum merge automático.
2. Resolver a divergência de histórico sem reaplicar #95/#96; obter autorização específica do único SQL avulso após novo dry-run exclusivo. Não há autorização remota nesta rodada.
3. Preview autorizado com credenciais Sandbox já existentes, novas flags somente nesse ambiente e entrega restrita do webhook. Sem copiar segredos para a máquina/chat.
4. Administrador legítimo abre janela; escolhe pagador sintético consentido já existente no Sandbox. Autoriza Pix, confirma criação, abre checkout; depois repete crédito. Nunca capturar cartão no app.
5. Homologar pagamento, webhook entregue de fato, conciliação, deduplicação, falhas/recuperação e estorno/cancelamento pelos procedimentos oficiais. Confirmar que nenhum vínculo/assinatura de profissional foi criado. Registros de teste permanecem auditáveis.
6. Somente após Sandbox comprovado, revisão do código/CI e decisões específicas: integração, provisionamento/recepção Production, abertura de janela e cada cobrança real. São decisões distintas. Autorizar o PR não autoriza criar pagamento.

**Resultados finais com o frontend:** 936 testes passaram na suíte completa, incluindo projeção segura, fontes indisponíveis e separação financeira; typecheck, build, histórico e SQL/RLS passaram. Testes automatizados de provider/serviço/rotas/interface e SQL/RLS em PostgreSQL17 descartável; não são chamadas reais ao Asaas. As fixtures cobrem ambiente, confirmação, duas contas/administradores, preço, quota, nonce/domínio, concorrência/idempotência, timeout, conciliação, não regressão, evento repetido/conflitante, persistência antes do ACK, estorno, cancelamento e isolamento de dados. Nenhum teste físico foi declarado.

**Sandbox real: NÃO EXECUTADO.** Bloqueio: migração avulsa ainda proposta, histórico divergente e entrega restrita do webhook avulso ainda não configurada; Preview normal não tem a infraestrutura avulsa operacional nem entrega autenticada desse novo webhook. Não contornar usando armazenamento efêmero ou o contrato recorrente legado. Sem essas etapas não declarar o módulo homologado nem apto a cobrar dinheiro real.

## Fontes oficiais conferidas

- https://docs.asaas.com/docs/checkout-para-pix
- https://docs.asaas.com/reference/criar-novo-checkout
- https://docs.asaas.com/docs/eventos-para-checkout
- https://docs.asaas.com/reference/list-payments
- https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente


## Alinhamento de histórico
A branch foi atualizada após a integração de #96, #104 e #103. Os SQLs já executados foram reconciliados na main. Somente a migração avulsa nova recebeu o nome de arquivo `20261127230000_admin_oneoff_payment_tests.sql` antes de ser aplicada; o SQL permaneceu byte a byte idêntico. O sistema permanece em fase gratuita, com cobranças reais bloqueadas. O ensaio Sandbox com operações reais do Asaas ainda não ocorreu.
