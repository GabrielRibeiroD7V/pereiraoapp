# Isolamento do webhook Production — proposta, recebimento desligado

## Defeito e correção

O receptor original persistia o aviso antes do ACK, mas deixava eventos sem vínculo financeiro local em retry indefinido. Pagamentos sem `subscription` também provocavam um GET antes da verificação de escopo. Uma chave dedicada não limita os eventos do webhook a um site: os tipos selecionados pertencem à conta Asaas.

O reconciliador agora consulta somente o vínculo local consentido antes de qualquer GET. Avisos sem vínculo ou sem identificador de assinatura são concluídos sem processamento financeiro. A projeção mínima e seu digest permanecem na inbox, sem payload bruto ou dados pessoais. `state=processed` significa finalização da fila; `last_error=IGNORED_UNBOUND` ou `IGNORED_NO_SUBSCRIPTION_LINK` distingue descarte de conciliação. Não gera uma falsa entrada na auditoria de pagamentos. Duplicação não reinicia o evento e a recuperação não o seleciona novamente.

Aviso incompleto não é resolvido por GET especulativo. Isso é deliberadamente conservador: se um futuro evento legítimo omitir `subscription`, ele será retido com motivo para investigação, sem conceder direitos. Não existe botão de reabertura automática; recuperar um evento descartado após investigação exige procedimento próprio e autorizado. Antes de futura contratação, homologar o payload real e a ordem de criação do vínculo: o vínculo deve estar persistido antes de receber eventos. Ainda não há criação de vínculos ou contratação Production neste módulo.

Falha de banco, lease ocupado ou indisponibilidade ao consultar vínculo NÃO equivalem a ausência: seguem recuperáveis. Vínculo conhecido continua com GET oficial, validações e auditoria existentes. Nenhuma alteração de usuário, negócio, isenção, trial, assinatura operacional ou direito de acesso.

## SQL proposto / preflight antes de aplicação

Arquivo: `20261124230953_production_webhook_isolation.sql`. SHA-256: `80c7456bc7d3fbfa43cae9433a7364724bcb985556e8234f6462236dc1b5aa23`.

- Substitui somente o corpo de `private.production_billing_server(text,text,bigint,uuid,text)` e reafirma a revogação de execução direta. Não cria tabela nem altera RLS, wrappers públicos, credenciais ou flags.
- Adiciona comando HMAC `ignore_unbound`, com nonce e lease existentes. O motivo é calculado no banco; cliente não escolhe o motivo. A finalização exige ausência de vínculo tanto no evento como na assinatura da projeção persistida.
- O comando `binding` exige que a assinatura pedida corresponda à projeção persistida. Evita emprestar um vínculo de outro evento.
- Um lock SHARE curto na tabela de vínculos serializa a verificação negativa com uma futura inserção/alteração de consentimento. Pode aguardar um escritor concorrente; deadlock/falha deixa o evento recuperável. Não há GET de rede dentro dessa transação.
- Dependência exclusiva: fundação `20261124182023_production_billing_foundation` aplicada. Não reaplicar a fundação nem editar seu arquivo.
- Antes da aplicação: autorização específica, projeto `yazdjiwaksamizrbqewq`, hash exato, histórico reconciliado, receptor ausente/false e zero vínculos/eventos/pagamentos conforme preflight. Reconfirmar contagens sem divulgar IDs. Parar se divergirem; não apagar dados para satisfazer condição.
- Dry-run remoto versionado precisa listar SOMENTE este arquivo. NÃO executado nesta correção local; não afirmar que a verificação local de histórico é dry-run remoto.
- Aplicar somente após autorização. Conferir definição da função, ACL/HMAC, RLS e contagens em leitura; não enviar evento fictício ao banco operacional para provar o SQL.

## Implantação e contenção

1. Manter webhook Asaas não cadastrado/desabilitado e flag do receptor ausente/false. Todas as capacidades financeiras permanecem false.
2. Aplicar esta expansão SOMENTE com autorização específica e após preflight/dry-run remoto. Validar em leitura.
3. Revisar e decidir o merge de código separadamente. Compatível com código anterior enquanto receptor desligado. Código novo sem SQL falha fechado no comando desconhecido e mantém evento recuperável; isso não é motivo para habilitar recebimento antes do SQL.
4. Homologar autenticação e persistência numa etapa própria autorizada. Fixture local ou POST manual não comprova entrega pelo Asaas. Não criar cliente, contrato ou pagamento para este teste.
5. Só discutir cadastro/ativação do webhook depois de esclarecer alcance da conta e aceitar explicitamente o tratamento de avisos incompletos.

Contenção: desabilitar o webhook próprio no Asaas (`enabled=false`, não apenas interromper a fila), flag do receptor false e redeploy autorizado. Preservar toda a inbox/auditoria. Não modificar outros webhooks. A expansão pode permanecer aplicada; preferir isso a desfazer SQL. Se for indispensável reverter a função, preparar restauração SOMENTE da definição anterior com autorização própria, receptor desligado e análise dos descartes preservados. Nunca reaplicar o arquivo de fundação inteiro nem limpar tabelas.

## Evidências desta correção

- Regressão executada com o serviço anterior: falham os casos de eventos sem vínculo e sem assinatura; com a correção, passam.
- Testes TypeScript com store/provider simulados: sem GET indevido; descarte durável; falha de vínculo/descarte mantém recuperação; logs não expõem IDs.
- PostgreSQL 17 nativo descartável: migrações sequenciais, prova HMAC, lease, assinatura divergente, recusa de descarte vinculado, deduplicação, exclusão da fila, motivos e preservação dos dados/direitos. Sem Docker, sem chamadas remotas.
- Nenhuma entrega real Asaas nesta rodada; nenhum webhook, segredo, flag ou dado remoto alterado.
