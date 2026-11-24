# Infraestrutura Asaas Production — publicada desligada

## Limites desta entrega

Provider `ProductionReadProvider`: apenas GET de pagamentos e assinaturas por ID, host fixo `https://api.asaas.com/v3`, chave Production, redirect proibido, timeout e tamanho limitados. Não há métodos para criar cliente, checkout, assinatura, cobrança, cancelar ou estornar recursos reais. Pix, cobrança, checkout, assinatura e bloqueio continuam indisponíveis no código. Habilitar uma flag de operação financeira faz a configuração falhar fechada; não habilita dinheiro.

Endpoints próprios `/api/asaas-production-webhook` e `/api/production-billing-recovery`, ambos desligados por padrão. APIs Sandbox não foram modificadas e continuam recusadas em Production. Não há nova interface de pagamento, preço, aviso de gratuidade ou oferta ao usuário.

## Fluxo preparado

Token próprio do webhook → JSON limitado → projeção mínima sem dados pessoais → inbox Production durável → HTTP 200 → processamento com lease por evento/vínculo → GET oficial → validação contra vínculo consentido → observação e auditoria privadas. Sem alteração de direitos, perfis, trial, isenções ou assinaturas operacionais.

- Deduplicação por ID + digest da projeção; conflito retorna 409. Não persiste payload bruto.
- Vínculo financeiro é separado de Sandbox, com negócio, cliente, assinatura, referência, ciclo, método, valor e consentimento. **Nenhum comando desta entrega cria vínculos.** O processo futuro de contratação/registro exigirá implementação e autorização próprias.
- Evento sem vínculo fica pendente; não cria contrato por confiar no webhook.
- Leituras são realizadas após lease do vínculo. Respostas divergentes, 404, dados incompletos, API indisponível e estados desconhecidos permanecem pendentes para revisão, sem fabricar cancelamento/pagamento. Estorno observado não é revertido por fotografia atrasada; leases antigos não gravam.
- Falhas ficam duráveis com backoff. Admin legítimo (`getUser` + `admin_access`) pode reconciliar até **dois** eventos por chamada, dentro do orçamento de duração da Function. Sem cron/add-on ou custo adicional contratado.
- Log estruturado: componente, hash do evento e resultado permitido. Não registra token, chave, IDs financeiros, payload, resposta ou erro bruto. Inbox oferece estado, tentativas, próximo retry e erro sanitizado; auditoria registra observação única por evento. Monitoramento/alertas externos ainda precisam ser definidos.
- Eventos habilitáveis: somente PAYMENT_* suportados pelo parser e SUBSCRIPTION_CREATED/UPDATED/DELETED. CHECKOUT_* não é aceito neste receptor; não configurar esses eventos nem checkout nesta fase.

## Migração proposta — NÃO aplicada

`20261124182023_production_billing_foundation.sql`, criada pelo CLI em modo local. SHA-256: `4e1b9aec832545e15ca270dee5539dc9065a0712ea634ee3e6de528a432d84e4`. Seis tabelas novas privadas: keys, nonces, bindings, events, payments e audit. RLS habilitada, sem privilégios diretos de anon/authenticated. RPC de máquina exige HMAC com segredo independente, comando+JSON exato, nonce único e janela de 90s. Não usa service_role nem JWT simulado. Prova Production não reutiliza chave de assinatura Sandbox; nenhum segredo inicial é provisionado pela migração.

Expansão aditiva: não altera tabelas, políticas, funções ou gatilhos operacionais existentes. Dependências: schemas private/public/extensions, pgcrypto, businesses e sandbox_backend_keys já existentes. A nova RPC não é usada no frontend; ausente/não provisionada retorna erro de setup, nunca ACK fictício. Código pode ser publicado desligado antes do SQL.

### Preflight necessário antes de pedir aplicação

1. Reconfirmar projeto `yazdjiwaksamizrbqewq`, histórico real, hash do arquivo e estado preservado (negócios/posts privados, assinatura/ativação zero, fase gratuita e isenção).
2. Dry-run versionado remoto deve listar exclusivamente esse arquivo. **Não foi executado nesta entrega**, que não aplica banco; a autorização deve citar o hash final e projeto depois desse dry-run. Não alegar lista exclusiva apenas por comparação local de arquivos.
3. Conferir grants/RLS, schemas e extensões; testar SQL sequencial em PostgreSQL descartável. Confirmar ausência de outra migração pendente e que nenhuma configuração financeira está ativa.
4. Após autorização própria, aplicar só a expansão; validar estrutura, RPC sem segredo recusada, proteção das tabelas e preservação dos dados. Não provisionar credenciais/vínculos/entrega só porque o SQL passou.

### Contenção e reversão que preserva dados

Manter/desligar `ASAAS_PRODUCTION_WEBHOOK_ENABLED` e desabilitar entrega no Asaas (quando futuramente existir), mantendo registros e fotos intocados. Reverter o código pelo procedimento de deploy revisado. O backend anterior ignora as novas tabelas privadas; não é necessário removê-las. Se a RPC precisar ser contida, propor revogação de EXECUTE em SQL separado e autorizado; não apagar inbox, observações, vínculos ou auditoria. Nunca restaurar automaticamente código antigo que reative o relógio dos 90 dias.

## Intervenções externas futuras — não executadas

1. Rever a conta Asaas Production com o proprietário e configurar credencial Production na Vercel, **somente servidor, ambiente Production**: `ASAAS_API_KEY_PRODUCTION`. A chave existente “pereirao - sandbox” não é recriada nem substituída; continua em `ASSAS_API_KEY_SANDBOX` nos ambientes autorizados.
2. Provisionar `ASAAS_PRODUCTION_WEBHOOK_TOKEN` e `BILLING_PRODUCTION_RPC_SIGNING_SECRET` próprios, independentes entre si e de Sandbox; formato recomendado: 64 caracteres hexadecimais aleatórios. Sem VITE_, repositório, URLs ou logs. Provisionar privadamente o SHA-256 do segundo segredo em `private.production_billing_keys` por operação revisada específica. Nenhum valor é solicitado no chat.
3. As cinco flags `ASAAS_PRODUCTION_{CHECKOUT,SUBSCRIPTIONS,CHARGES,ENFORCEMENT,PIX}_ENABLED` ficam ausentes ou `false`. `ASAAS_PRODUCTION_WEBHOOK_ENABLED` permanece ausente/false até autorização explícita de recebimento e preflight completo. Nenhuma variável foi criada/alterada nesta entrega.
4. Só então configurar o endpoint HTTPS próprio no Asaas Production, com auth token e eventos suportados. Validar controle de acesso e entrega real sem criar cobrança; até isso ocorrer, **receptor de Production não está homologado**. A rota de recuperação requer administrador e recebe apenas `{ "action": "reconcile" }`; não há acesso público a filas/dados.
5. Contratação futura depende ainda de termos/benefícios aprovados, consentimento, provider de escrita separado, controles de idempotência de criação, testes e nova decisão de ativação. Não basta fornecer uma chave.

## Evidências e limites

Testes locais com fixtures verificam host/ambiente, flags, segredos, timeout/rejeições, autenticação, persistência antes do ACK, duplicação/conflito, valor/cliente/assinatura divergentes, estorno, cancelamento, ordem, falha e recuperação. SQL/RLS roda em PostgreSQL nativo descartável, sem Docker. Node ESM inicializa APIs sem bundler e falha fechado; PWA ignora as novas APIs. Testes não fazem requisição financeira externa.

O Preview executa o diagnóstico existente `check-asaas-sandbox.mjs`: somente GET Sandbox, sem expor valor da chave. Resultado real deve ser registrado após conferir o log sanitizado do build; não presumir conexão por haver variável. Homologação histórica de cartão/webhook/estorno está em `resultado-integrado-pr17.md`; não é uma nova entrega externa de webhook nem teste Production.

Fontes: [ambientes](https://docs.asaas.com/docs/sandbox), [webhooks, persistência e idempotência](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook). Código não reutiliza contas ou contratos Sandbox como produção.
