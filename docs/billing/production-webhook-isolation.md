# Isolamento do webhook Production — proposta, recebimento desligado

## Defeito e correção

O receptor original persistia o aviso antes do ACK, mas deixava eventos sem vínculo financeiro local em retry indefinido. Pagamentos sem `subscription` também provocavam um GET antes da verificação de escopo. Uma chave dedicada não limita os eventos do webhook a um site: os tipos selecionados pertencem à conta Asaas.

O reconciliador agora consulta somente o vínculo local consentido antes de qualquer GET. Avisos sem vínculo ou sem identificador de assinatura são concluídos sem processamento financeiro. A projeção mínima e seu digest permanecem na inbox, sem payload bruto ou dados pessoais. `state=processed` significa finalização da fila; `last_error=IGNORED_UNBOUND` ou `IGNORED_NO_SUBSCRIPTION_LINK` distingue descarte de conciliação. Não gera uma falsa entrada na auditoria de pagamentos. Duplicação não reinicia o evento e a recuperação não o seleciona novamente.

Aviso incompleto não é resolvido por GET especulativo. Isso é deliberadamente conservador: se um futuro evento legítimo omitir `subscription`, ele será retido com motivo para investigação, sem conceder direitos. Não há reabertura automática. A recuperação seletiva preparada abaixo exige administrador legítimo, justificativa, vínculo consentido existente e GET oficial antes de recolocar o evento na fila. Antes de futura contratação, homologar o payload real e a ordem de criação do vínculo: o vínculo deve estar persistido antes de receber eventos. Ainda não há criação de vínculos ou contratação Production neste módulo.

Falha de banco, lease ocupado ou indisponibilidade ao consultar vínculo NÃO equivalem a ausência: seguem recuperáveis. Vínculo conhecido continua com GET oficial, validações e auditoria existentes. Nenhuma alteração de usuário, negócio, isenção, trial, assinatura operacional ou direito de acesso.

## SQL proposto / preflight antes de aplicação

Arquivo: `20261124230953_production_webhook_isolation.sql`. SHA-256: `674a73f92360930d75882ba349120b9b2c368b5f9507585a1ec4c9c2a00c8e72`.

- Substitui o corpo de `private.production_billing_server(text,text,bigint,uuid,text)` e reafirma a revogação de execução direta. Acrescenta `private.production_billing_scope_reviews`, auditoria com RLS, sem privilégios de PUBLIC/anon/authenticated, vinculando evento, vínculo, administrador, justificativa, motivo e horário do descarte e horário da revisão. Não altera RLS existente, wrappers públicos, credenciais ou flags.
- Adiciona comando HMAC `ignore_unbound`, com nonce e lease existentes. O motivo é calculado no banco; cliente não escolhe o motivo. A finalização exige ausência de vínculo tanto no evento como na assinatura da projeção persistida.
- O comando `binding` exige que a assinatura pedida corresponda à projeção persistida. Evita emprestar um vínculo de outro evento.
- Um lock SHARE curto na tabela de vínculos serializa a verificação negativa com uma futura inserção/alteração de consentimento. Pode aguardar um escritor concorrente; deadlock/falha deixa o evento recuperável. Não há GET de rede dentro dessa transação.
- Dependência exclusiva: fundação `20261124182023_production_billing_foundation` aplicada. Não reaplicar a fundação nem editar seu arquivo.
- Antes da aplicação: autorização específica, projeto `yazdjiwaksamizrbqewq`, hash exato, histórico reconciliado, receptor ausente/false e zero vínculos/eventos/pagamentos conforme preflight. Reconfirmar contagens sem divulgar IDs. Parar se divergirem; não apagar dados para satisfazer condição.
- Dry-run remoto versionado precisa listar SOMENTE este arquivo. Executado com CLI 3.4.0, `db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault --output-format json`; lista exclusivamente este arquivo, sem seeds/roles. Repetir se arquivo ou histórico mudarem antes da autorização/aplicação.
- Aplicar somente após autorização. Conferir definição da função, ACL/HMAC, RLS e contagens em leitura; não enviar evento fictício ao banco operacional para provar o SQL.

## Implantação e contenção

1. Manter webhook Asaas não cadastrado/desabilitado e flag do receptor ausente/false. Todas as capacidades financeiras permanecem false.
2. Aplicar esta expansão SOMENTE com autorização específica e após preflight/dry-run remoto. Validar em leitura.
3. Revisar e decidir o merge de código separadamente. Compatível com código anterior enquanto receptor desligado. Código novo sem SQL falha fechado no comando desconhecido e mantém evento recuperável; isso não é motivo para habilitar recebimento antes do SQL.
4. Homologar autenticação e persistência numa etapa própria autorizada. Fixture local ou POST manual não comprova entrega pelo Asaas. Não criar cliente, contrato ou pagamento para este teste.
5. Só discutir cadastro/ativação do webhook depois de esclarecer alcance da conta e aceitar explicitamente o tratamento de avisos incompletos.

Contenção: desabilitar o webhook próprio no Asaas (`enabled=false`, não apenas interromper a fila), flag do receptor false e redeploy autorizado. Preservar toda a inbox/auditoria. Não modificar outros webhooks. A expansão pode permanecer aplicada; preferir isso a desfazer SQL. Se for indispensável reverter a função, preparar restauração SOMENTE da definição anterior com autorização própria, receptor desligado e análise dos descartes preservados. Nunca reaplicar o arquivo de fundação inteiro nem limpar tabelas.

## Investigação e recuperação seletiva, preparada e desligada

1. Administrador legítimo consulta a projeção privada e os logs disponíveis: tipo, evento/objeto, assinatura eventualmente ausente, horário de recebimento, motivo de descarte, tentativas. Não usar uma chave/site como prova de propriedade do evento. Confirmar origem no Asaas e prova de consentimento do responsável; se não houver evidência suficiente, manter descartado. Nenhuma busca por recursos alheios via API é feita automaticamente.
2. Deve existir vínculo consentido Production no PEREIRÃO. Esta correção não cria vínculo; se ainda não existir, parar essa recuperação e obter um procedimento/autorização próprios. Não usar contrato Sandbox ou inventar consentimento para recuperar um evento.
3. Em futura etapa autorizada, o administrador usa a própria sessão normal no endpoint `/api/production-billing-recovery` com `{ "action":"review_ignored", "eventId":"<evento investigado>", "subscriptionId":"<assinatura do vínculo existente>", "reason":"<justificativa objetiva sem dados pessoais>" }`. Não colocar sessão/token/HMAC em URL, chat ou log. Sem nova tela pública/financeira. Essa rota e a recuperação ordinária continuam recusadas enquanto o receptor estiver desligado.
4. A rota exige `getUser`, `admin_access`, origem compatível quando presente e validação estrita da entrada; usa o ID da sessão, nunca ID de administrador enviado no corpo. O comando HMAC `scope_target` reconfirma administrador habilitado, motivo e estado descartado, obtendo apenas o vínculo selecionado existente. Se o aviso já tiver assinatura, ela deve ser exatamente a do vínculo.
5. O servidor faz GET da assinatura selecionada e, para pagamento, do objeto original. Compara cliente, assinatura, referência, modalidade, ciclo e valor contra o vínculo. Divergência/404/falha de rede: não reabre o evento nem grava revisão concluída; pode investigar e tentar mais tarde. Nenhum cliente, contrato ou pagamento é criado.
6. Após a conferência, `scope_requeue` reconfirma elegibilidade e administrador e faz, em uma única transação, auditoria privada + recolocação em `pending`. A assinatura resolvida fica associada pelo vínculo existente; `notice`, digest e horário de recebimento originais não são reescritos. Quando o aviso original não informava assinatura, o claim usa a associação revisada sem adulterar a evidência original. Revisão repetida ou tentativa de reabrir conciliação já concluída é recusada. Uma revisão de escopo por evento; eventual erro de decisão requer investigação e procedimento próprio, nunca troca silenciosa de vínculo.
7. A resposta é apenas `requeued`, não pagamento confirmado. A ação administrativa `reconcile` segue o fluxo normal com lease e nova consulta oficial; falhas continuam recuperáveis. A auditoria da revisão sobrevive à conclusão financeira. Não altera direitos, trial, isenção ou negócio.

## Evidências desta correção

- Regressão executada com o serviço anterior: falham os casos de eventos sem vínculo e sem assinatura; com a correção, passam.
- Testes TypeScript com store/provider simulados: sem GET indevido; descarte durável; falha de vínculo/descarte mantém recuperação; logs não expõem IDs.
- PostgreSQL 17 nativo descartável: migrações sequenciais, prova HMAC, lease, assinatura divergente, recusa de descarte vinculado, deduplicação, exclusão da fila, motivos e preservação dos dados/direitos. Sem Docker, sem chamadas remotas.
- Nenhuma entrega real Asaas nesta rodada; nenhum webhook, segredo, flag ou dado remoto alterado.

## Preflight remoto em 24/11/2026 — sem aplicação

- CLI Supabase 3.4.0; alvo explícito `--remote=yazdjiwaksamizrbqewq`, projeto `pereiraoapp`, Production. O dry-run remoto final do SQL acima retornou somente `20261124230953_production_webhook_isolation.sql`, `dryRun:true`, seeds e roles vazios, com `--skip-vault`. Não é comparação local de arquivos.
- Histórico remoto: 22 migrações, última `20261124182023_production_billing_foundation`. Nova migração ausente; tabela de revisão ainda ausente. Nenhum push efetivo, repair ou SQL de alteração foi executado.
- Corpo `prosrc` da função privada atual coincide byte a byte com a definição da fundação revisada: SHA-256 `82a5c97ebdb7b4dfa8d4adca3ccc9eb25235a0dcec4af76777ffae5f3ec633b8`. SECURITY DEFINER com search_path vazio, sem EXECUTE direto de anon/authenticated.
- Leitura remota: zero vínculos, eventos, pagamentos e observações Production; quatro negócios draft; zero assinaturas operacionais e ativações. Fase initial_free; checkout, enforcement, trialClockRunning e automaticConversion false.
- Asaas Production autenticado: lista de webhooks vazia (`Nenhum Webhook encontrado`). Nenhum cadastro/ativação realizado. Não repetido o GET de autenticação da chave.
- Vercel: flags de receptor e cinco capacidades financeiras ausentes no ambiente Production. POST técnico vazio, sem autenticação/dados financeiros, ao endpoint do webhook e ao da recuperação retornou `403 DISABLED`, sem leitura de evento nem persistência. Não equivale a teste de token, HMAC ou entrega Asaas.
- Alteração nesta revisão: recuperação seletiva auditada adicionada ao próprio arquivo ainda não aplicado. Hash anterior `80c7456b…` foi substituído; não autorizar/aplicar o hash antigo. CI/Preview devem corresponder ao head final do PR.
- Testes novos: 10 casos direcionados de revisão manual (demais 45 TypeScript pulados), PostgreSQL nativo descartável focado em Production incluindo reconhecimento tardio, ausência de assinatura, imutabilidade do digest, recusa por administrador/vínculo/motivo inválidos, deduplicação de revisão e ausência de direitos reais. Não reexecutada localmente a bateria de 783 testes. CI obrigatório usa o workflow do repositório.

Riscos residuais: classificação incompleta demanda investigação humana e vínculo consentido pré-existente; a conta pode gerar eventos de outros usos; o recebimento real e os payloads Production ainda não foram homologados. Revisão administrativa errada não é corrigida trocando silenciosamente o vínculo: parar e preparar procedimento próprio. Não há autorização para criar vínculo, habilitar receptor, mesclar ou executar operações financeiras nesta revisão.

Decisões distintas: (1) aplicar somente a migração com o hash final após conferir novamente alvo/histórico/dry-run; (2) merge do PR; (3) eventual cadastro/ativação e ensaio real do webhook. Uma decisão não implica as demais.
