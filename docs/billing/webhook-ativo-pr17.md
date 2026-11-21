> Resultado atual: [cartão e webhook validados no fluxo integrado](resultado-integrado-pr17.md). Pix permanece desligado. Os bloqueios e resultados anteriores abaixo são históricos.

# PR #17 — Receptor ativo e bloqueio encontrado no ensaio autenticado

## Configuração executada

- Migração financeira 20261121031038 registrada e segredos HMAC/webhook provisionados conforme relatório anterior. Não reaplicada.
- Login oficial da CLI concluído na conta correta usando a sessão legítima do navegador. Nenhuma senha, cookie ou token de usuário foi extraído ou solicitado no chat. A credencial da CLI fica no armazenamento normal da ferramenta, fora do repositório.
- Receptor Supabase Edge Function `asaas-sandbox-webhook`, ID `5823ce7c-7ca4-4b01-81f2-3db45c7df2be`, ACTIVE versão 2, verify_jwt=false somente nessa função porque ela faz autenticação própria de webhook antes de ler o corpo.
- Secrets no Supabase: ASAAS_SANDBOX_WEBHOOK_TOKEN, ASAAS_SANDBOX_PREVIEW_BYPASS e ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED. Sem chave Asaas no receptor.
- Bypass independente criado no projeto Vercel. O formato exigido pela API é 32 caracteres alfanuméricos; a primeira tentativa de 64 caracteres foi rejeitada sem criação e corrigida. O bypass real tem 128 bits aleatórios. Nenhuma exceção pública foi aplicada e Vercel Authentication continua habilitada.
- A API Vercel exige que pelo menos um bypass seja o default VERCEL_AUTOMATION_BYPASS_SECRET. A tentativa de remover essa injeção foi rejeitada; o segredo permanece no ambiente de servidor/build, nunca com prefixo VITE_. Não criar um segundo bypass desnecessário apenas para trocar qual é o default. A credencial tem alcance de projeto e deve ser revogada quando o receptor for desativado. Nenhum deploy Production foi feito.
- Webhook criado exclusivamente no Asaas Sandbox, ID `f19f75fd-5ed7-4385-8180-2badcb1a1e23`, nome PEREIRAO PR17 SANDBOX, enabled=true, interrupted=false, SEQUENTIALLY, 23 eventos suportados. Endpoint HTTPS exato: https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook .
- A criação usou a chave sensível já existente dentro do servidor de build do Preview. Nenhuma leitura/decriptação da chave Asaas. O opt-in pontual ASAAS_SANDBOX_WEBHOOK_PROVISION foi esvaziado logo após a confirmação; builds subsequentes não modificam configurações financeiras. O provisionador lista antes de criar e falha com estado incerto sem repetir POST cegamente.

## Testes reais antes da ativação do webhook

| Operação | Resultado |
| --- | --- |
| Edge sem token | 401 AUTH_REQUIRED |
| Edge com token errado | 401 AUTH_REQUIRED |
| Preview sem bypass | 401 da Vercel |
| Preview com bypass, sem token do webhook | 401 AUTH_REQUIRED da aplicação |
| Edge com evento suportado malformado | 400 INVALID_INPUT |
| Evento técnico válido | 200 received; linha persistida |
| Repetição exata | 200; mesma linha, sem duplicação |
| Mesmo ID com conteúdo diferente | Rejeitado, sem ACK; inicialmente 502 do relay; corrigido para preservar 409 CONFLICT na versão 2, com regressão |

Evento técnico: `evt_pr17_preflight_912984527eca412a83143da9701de193`. Objeto sintético inexistente: `pay_pr17_preflight_9899eef8bf944aa086e70dc50e4c6dff`. Linha durável na inbox, state=reconcile_required e attempts=1 na conferência. Não concedeu direitos nem criou pagamento. Essa requisição foi enviada pelo ensaio técnico, **não pelo Asaas**. A pendência é esperada porque o objeto não existe no provider. Não apagar automaticamente essa evidência ou marcá-la como pagamento conciliado.

A autenticação Edge → Vercel e a persistência foram verificadas antes da criação do webhook Asaas. Somente depois o webhook foi ativado. Entrega real pelo provider ainda não foi comprovada nesta execução, pois o checkout autenticado encontrou o bloqueio abaixo.

## Falha real encontrada: SQLSTATE 42702

O proprietário fez login no alias aprovado e o aplicativo exibiu seu Espaço Profissional. O negócio técnico selecionado para o ensaio é `TESTE DESCARTÁVEL STORAGE PR7`, UUID `f790de1a-68a5-41fe-86fc-6c56ea32ac0a`; os dois negócios anteriores não são fixtures de teste financeiro. A consulta da assinatura falhou antes de qualquer contratação.

Diagnóstico real via PostgREST/HMAC de servidor confirmou HTTP 400, SQLSTATE 42702: `column reference c.request_id is ambiguous`. A variável PL/pgSQL `c` conflita com o alias `c` da junção em owner_overview. Esse diagnóstico não substitui uma sessão de usuário: a sessão legítima foi validada separadamente pela interface.

A suíte anterior não exercitava a consulta bem-sucedida do proprietário. Acrescentados dois testes de regressão: consulta sem pagamentos e consulta com pagamento conciliado. Antes da correção, o PostgreSQL local reproduziu exatamente o 42702. Após a correção, passaram 305 asserções SQL/RLS.

Proposta: `20261121162242_fix_sandbox_owner_overview.sql`, SHA-256 `13a42ae9429400d95e000fab23464a2b3f1c2cc359029d0d3dd122503998aef1`. Ela somente renomeia o alias conflitante para owned_contract no corpo da RPC, com guarda da definição esperada. Não altera dados, grants, assinaturas, publicação ou gratuidade. A migração original e seu checksum permanecem intactos. **A correção remota aguarda autorização específica.** Não aplicar junto automaticamente.

## Segurança e situação do ensaio

- Pix desligado, sem novas assinaturas Pix ou boleto aceito como alternativa.
- Nenhum cliente financeiro, checkout, assinatura, pagamento, cancelamento ou estorno novo foi criado nesta ativação antes de corrigir o bloqueio. O cartão homologado em etapa anterior continua evidência histórica.
- Scanner local conferiu os 15 arquivos do dist: nenhum dos três segredos gerados apareceu no frontend. O PWA continua excluindo APIs/respostas privadas.
- Testes atuais antes da correção SQL: 382 automatizados (31 arquivos), typecheck e build aprovados. SQL/RLS após a correção local: 305. CI e Preview registrados no PR após o push.
- Sem merge, exceção de hostname, publicação de prestadores, alteração de gratuidade ou cobranças reais.

Fontes: [webhook Asaas](https://docs.asaas.com/reference/create-new-webhook), [logs somente pela interface web](https://docs.asaas.com/docs/logs-de-webhooks), [bypass Vercel por header](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
