# Recuperação auditada da rejeição Sandbox — PR #111

## Evidência e limite da conclusão

- Solicitação única: `dd279b98-de7c-4eeb-8253-fd95e2564bc4`, Pix, R$ 19,90; manter ID, pagador, consentimento, criação e unicidade por ambiente/modalidade.
- Log oficial Sandbox `108269826`: um POST `/api/v3/checkouts`, HTTP **400**, `invalid_object`, “O campo name só pode conter no máximo 30 caracteres.” A referência externa no corpo coincide com a solicitação. É rejeição de validação, não timeout; não houve ID de checkout na resposta.
- Pagador existente sem cobranças na interface oficial. O backend consulta `GET /payments?externalReference=<mesmo ID>&limit=2&offset=0` e exige lista vazia completa (`totalCount=0`, `hasMore=false`). Erro, resposta incompleta ou qualquer pagamento bloqueia.
- Uma listagem vazia de pagamentos **não comprova sozinha ausência de checkout**, pois ele pode existir sem pagamento. A prova complementar é a rejeição definitiva vinculada ao único POST no log. Não inventamos um endpoint de listagem de checkouts por referência: a documentação consultada de Checkout descreve criação/cancelamento e webhooks, sem esse recurso de recuperação.

## Implementação restrita

`check_name_rejection` é inspeção administrativa, sem criação nem transição. Funciona com as flags de criação desligadas. A UI mostra o resultado verdadeiro da consulta, sem afirmar que a recuperação ocorreu.

`recover_name_rejection` exige administrador confirmado, HMAC Sandbox existente e confirmação `RECUPERAR REJEICAO SANDBOX SEM CRIAR`. Não chama `start`, `authorize` ou POST no Asaas. O servidor verifica a referência na API imediatamente antes de enviar a prova assinada à nova RPC.

A RPC proposta é deliberadamente exclusiva dessa solicitação e desse log revisado. Não é uma regra para liberar qualquer HTTP 400. Revalida administrador original, pagador, instante de criação, Pix/1990/BRL, janela fechada, nenhuma lease ativa, exatamente uma criação reivindicada, nenhum checkout/pagamento/evento e prova de consulta vazia com no máximo 60 segundos. Production e outros IDs são recusados.

A transação bloqueia política e solicitação, muda `uncertain` para `authorized`, preserva o consentimento original e renova apenas a validade operacional por uma hora. Registra estado/diagnóstico/validade anteriores, log, consulta e nova validade na auditoria. Índice único permite uma recuperação por solicitação; repetição imediata é idempotente, mas uma segunda tentativa incerta nunca é reaberta. A criação posterior ainda exige flags, janela e confirmação próprias. Nada inicia automaticamente.

## Migração proposta e implantação

Arquivo: `supabase/migrations/20261128052010_admin_oneoff_rejected_checkout_recovery.sql`.
Projeto: `yazdjiwaksamizrbqewq`.

A aplicação cria somente RPC e índice de auditoria. Não atualiza solicitação ou conteúdo, não altera a RPC antiga, Secrets, HMAC, webhooks, contratos ou gratuidade. A nova RPC usa `search_path=''`, prova criptográfica com nonce/tempo e função administrativa existente; tabelas continuam privadas com RLS e sem grants diretos.

1. Revisar hash final e dry-run remoto exclusivo; obter autorização específica antes do SQL.
2. Aplicar somente a migração, conferir definição/permissões/índice e integridade em leitura.
3. No Preview protegido e sessão administrativa original, inspecionar a referência novamente e executar **somente** recuperação confirmada. Conferir mesmo ID/consentimento, estado autorizado e um novo registro de auditoria.
4. Manter flags ausentes, recepção falsa e janelas fechadas. Nova tentativa de checkout pertence a etapa separada; não executá-la nesta rodada.

Contenção: manter criação/recepção desligadas e janelas fechadas. Se necessário, revogar EXECUTE da nova RPC mediante procedimento revisado; não apagar auditoria, não reverter estado manualmente e não reutilizar cota. Código antigo permanece compatível, pois a RPC original e os estados não mudam. Sem migração, a inspeção funciona e a recuperação retorna SETUP_REQUIRED, sem mudança parcial.

## Validação

- Testes Node/UI: contexto exato, consulta vazia, pagamento existente, timeout, resposta ambígua, ambiente Production/outro ID, confirmação, migração ausente, inspeção sem transição e ausência de POST.
- PostgreSQL local: HMAC obrigatório, administrador original, evidência exata/fresca, janelas fechadas, IDs/eventos/lease ausentes, recuperação única/idempotente, preservação de consentimento/auditoria/valor e initial_free.
- Testes com fixtures e SQL local não equivalem a recuperação remota. Não aplicar SQL ou criar checkout por consequência destes testes.
