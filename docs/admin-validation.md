# Painel administrativo — implementação e ativação

## Entrega

Branch `feat/painel-administrativo`, baseada na main `99cf72c0a87a39bff9f61adf962cc785032e4769`. Deployment de produção conferido READY nesse commit. Nenhum merge, promoção de produção, alteração de Auth ou escrita remota foi realizado.

`/admin` oferece indicadores, pesquisa/paginação de usuários e prestadores, revisão de serviços/fotografias, aprovação/suspensão/reativação de perfis, moderação de trabalhos, histórico de decisões e diagnóstico do Asaas Sandbox. A Conta mostra o acesso ao painel somente quando o servidor confirma a autorização. Cabeçalho público, perfis e as três abas principais foram preservados.

## Autenticação e conta indicada

A conta indicada pelo proprietário foi localizada no projeto correto, com e-mail confirmado e perfil existente. A sessão continua usando o Supabase Auth normal; não foram solicitados senha, cookies ou tokens, nem criada uma sessão por SQL. Não há e-mail operacional fixo no frontend ou no código de autorização.

O papel administrativo fica em `private.platform_admins`, associado ao UUID de Auth, sem gravação pelo cliente. Nenhum administrador é concedido automaticamente pela migração. A concessão inicial usa o modelo separado `supabase/admin/bootstrap_platform_admin.sql`, com conferência de UUID, e-mail esperado e confirmação de e-mail, além de auditoria idempotente. Os valores operacionais não são publicados neste repositório. **Aplicação das migrações e concessão administrativa aguardam revisão e autorização específica.**

## Autorização e auditoria

- API Node da Vercel (`api/admin.ts`) aceita POST, verifica origem quando presente e valida o usuário no Auth com `getUser`. Em seguida consulta `admin_access` no banco a cada requisição. Não autoriza por nome, e-mail, localStorage, user_metadata ou simples presença de bearer.
- A API usa somente a chave publishable e a sessão normal do solicitante. Não usa service_role ou credencial de administração do Auth. Respostas administrativas são `private, no-store`, sem CORS aberto. Erros retornam códigos controlados, sem detalhes SQL ou mensagens privadas do fornecedor.
- As RPCs públicas são SECURITY INVOKER; implementações privadas SECURITY DEFINER verificam `auth.uid()` e o papel administrativo, usam `search_path=''` e objetos qualificados. EXECUTE é revogado de PUBLIC/anon. As tabelas privadas têm RLS e nenhum privilégio de acesso direto para anon/authenticated, inclusive para o administrador da aplicação.
- Usuários comuns, proprietários e administradores de um negócio não são administradores da plataforma. Tentativas de autoelevação, edição direta de status, escrita/exclusão direta de auditoria e leitura administrativa são negadas.
- Decisões exigem motivo de 5–500 caracteres, confirmação no modal e estado esperado. Locks e comparação do estado impedem que uma decisão antiga ou repetida sobrescreva uma revisão recente. Auditoria e alteração são atômicas, com ator, alvo, ação, motivo e estados anterior/posterior. A concessão inicial identifica sua origem como `bootstrap_sql`, sem atribuir falsamente a operação ao usuário beneficiado.
- Nenhuma exclusão permanente de usuário ou negócio foi implementada.

## Publicação, suspensão e mídia

Aprovar/reativar um perfil exige categoria ativa, descrição, WhatsApp, cidade ativa, área de atendimento e proprietário habilitado. A coluna `businesses.status` permanece sem UPDATE para authenticated. Somente a RPC administrativa realiza a decisão autorizada.

Suspender um negócio o retira da busca pública e bloqueia sua gestão profissional. Suspender uma conta impede novas operações profissionais mesmo com JWT anterior ainda válido e retira seus negócios próprios de circulação. **Essa suspensão é da plataforma, não um banimento do Supabase Auth:** o login continua possível para consultar a conta e navegar publicamente. Reativar a conta não republica negócios automaticamente; cada perfil exige revisão administrativa. Contas administrativas são protegidas contra suspensão pela interface.

Análise de serviços e fotos é paginada em blocos de 20. Fotos ready recebem URLs assinadas por 60 segundos, por política SELECT específica de análise administrativa no bucket privado; não foram concedidos upload, substituição ou exclusão ao administrador da plataforma. Dados legais e documentos privados não fazem parte das projeções do painel.

Moderação de trabalhos oferece retirar/bloquear e liberar, sem publicação administrativa automática. O bloqueio impede republicar o mesmo registro pela RPC do prestador. Liberar deixa o trabalho não publicado e exige nova ação explícita do prestador. Não altera o portfólio ou arquivos originais. O controle de perfil/ready e o ciclo de exclusão da mídia existente permanecem aplicáveis. Assinaturas já emitidas podem continuar válidas até seu TTL, e bytes já recebidos não podem ser recolhidos.

## Migrações pendentes

1. `20261121001632_work_posts.sql` — publicações, já revisável no PR anterior, ainda ausente do remoto.
2. `20261121004916_platform_admin.sql` — administração e auditoria. Pode ser ativada independentemente de work_posts; consultas detectam a ausência das publicações e os demais indicadores continuam disponíveis.
3. `20261121004917_admin_work_moderation.sql` — vínculo de moderação e trigger; exige as duas estruturas anteriores. Se faltar apenas esta migração, trabalhos podem ser consultados, mas as ações de moderação ficam desabilitadas.
4. Concessão inicial por UUID com `supabase/admin/bootstrap_platform_admin.sql` — operação separada, não é aplicada automaticamente junto das migrações.

Nenhuma dessas operações foi executada no projeto remoto. Não reaplicar as quatro migrações já registradas.

## Diagnóstico Asaas Sandbox

A variável existente `ASSAS_API_KEY_SANDBOX` foi conferida apenas por metadados: segredo, somente Preview. Nenhum valor foi lido, copiado, descriptografado ou incluído em arquivo local.

`server/asaas.ts` aceita somente o prefixo documentado de Sandbox (`$aact_hmlg_`), rejeita formato desconhecido/produção antes da requisição e fixa o destino oficial `https://api-sandbox.asaas.com/v3/customers?limit=1&offset=0`. Executa exclusivamente GET, com timeout de oito segundos, redirecionamentos proibidos e descarte do corpo. Retorna somente estado, HTTP e data; não retorna clientes, saldos, chave, cabeçalhos ou mensagem do fornecedor.

No painel, a verificação exige autorização administrativa e clique em Validar conexão. Também há uma sonda de leitura no build de Preview, usando o mesmo código e o segredo existente no servidor Vercel, sem transferência manual da chave. A sonda grava somente uma linha sanitizada de diagnóstico no log de build; não publica esse resultado como artefato do frontend. Não roda no build de produção e não falha o build caso a configuração esteja ausente ou inválida. O resultado real do Preview será registrado na descrição do PR.

Estados: conectado/validado, variável ausente, credencial inválida ou sem permissão, falha de comunicação e configuração não validada. Nenhum cliente financeiro, cobrança, assinatura, pagamento, wallet ou webhook foi criado. [Prefixos oficiais](https://docs.asaas.com/changelog/novidade-novo-prefixo-de-identifica%C3%A7%C3%A3o-das-chaves-api) e [endpoint de leitura](https://docs.asaas.com/reference/listar-clientes).

## Evidências

| Camada | Verificação | Resultado e limite |
|---|---|---|
| Código | Typecheck, build e histórico de migrações | Aprovados; API e código servidor também incluídos no typecheck |
| Vitest | 186 testes | Incluem servidor, sanitização, bloqueios, filtros, paginação, decisões/erros, clique repetido, seleção da conta e regressões anteriores; fixtures/HTTP interceptado |
| PostgreSQL 17 nativo temporário | 191 verificações SQL/RLS | Incluem usuário anônimo/comum/proprietário/admin, concessão por UUID, auditoria, aprovação, moderação, suspensão e preservação de arquivos. Storage e Auth são schemas mínimos simulados, não os serviços operacionais |
| Visual | 48 cenários em 375, 390, 768 e 1280 px | Sem overflow da página, imagens carregadas quebradas ou modal fora da viewport; tabelas têm rolagem interna. Mais três capturas de resultados simulados |
| Supabase operacional | Somente leitura | Projeto saudável; quatro migrações, nove tabelas originais, três negócios, uma foto e um objeto; nenhuma escrita |
| Navegador local | Aprovação, suspensão e diagnóstico | Repositórios em memória e imagens sintéticas; não equivalem a decisões ou autenticação administrativa operacional |

O ensaio encontrou overflow em texto de acessibilidade de uma ação dentro da tabela móvel. A área rolável recebeu contexto de posicionamento; a repetição das capturas afetadas confirmou a correção, sem ocultar o overflow global da página.

Capturas locais sintéticas: [visão geral](screenshots/admin/dashboard-390.png), [desktop](screenshots/admin/dashboard-1280.png), [usuários](screenshots/admin/users-390.png), [prestadores](screenshots/admin/businesses-390.png), [análise](screenshots/admin/review-390.png), [confirmação](screenshots/admin/decision-390.png), [histórico](screenshots/admin/history-390.png), [publicações pendentes](screenshots/admin/pending-390.png), [acesso negado](screenshots/admin/blocked-390.png). [Métricas](screenshots/admin/metrics.json). Fixtures e harness visual não integram o bundle final.

## Pendências de ativação

Revisar o PR e os SQLs; autorizar as migrações desejadas e a concessão inicial da conta indicada. Depois, validar login administrativo normal e as RPCs em ambiente autorizado, sem alterar prestadores operacionais. Conferir celular físico. Eventos de atividade de 7/30 dias continuam indisponíveis; contagem de rascunhos não é uma fila formal de solicitações de aprovação. Em desenvolvimento, Vite serve a UI; a função /api exige Vercel/preview, e os testes locais usam dependências controladas.

CI, Preview e diagnóstico real do sandbox serão registrados na descrição do PR para o SHA enviado. Não fazer merge automaticamente. Pagamentos permanecem fora do escopo; a decisão comercial de três meses gratuitos por negócio e R$ 19,99 mensais não foi ativada por esta entrega.
