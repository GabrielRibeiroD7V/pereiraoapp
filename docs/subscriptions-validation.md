# Gratuidade por negócio e preparação de assinaturas

## Escopo e entrega

Branch `feat/gratuidade-assinaturas`, baseada na `main` `272a91e70ca483e3729a3d44a32d9300d6c6d37b` (PR #14). A produção permaneceu nesse commit, READY. Nenhum merge, publicação de produção, pagamento, cliente financeiro, assinatura Asaas ou alteração remota foi realizado.

Implementação: consulta em `/conta/assinaturas`, linha compacta no Espaço Profissional e seção administrativa **Gratuidade e assinaturas**. Apenas três abas principais. Nenhum botão de pagamento ou oferta de R$ 19,99. Quando falta a migração, a interface comunica a preparação sem inventar datas ou assinantes. A API administrativa preserva autenticação normal, autorização no banco e `private, no-store`.

## Banco remoto e dependências

Somente leitura no projeto `yazdjiwaksamizrbqewq`, pela conexão Supabase já autorizada. Quatro migrações aplicadas:

- `20261120214652_backend_auth_foundation`
- `20261120215116_business_primary_category`
- `20261120223813_restrict_business_status_update`
- `20261120225759_business_portfolio_storage`

Continuam pendentes e **não foram aplicadas**:

1. `20261121001632_work_posts.sql`
2. `20261121004916_platform_admin.sql`
3. `20261121004917_admin_work_moderation.sql`
4. Nova proposta: `20261121013857_business_subscriptions_trial.sql`

`work_posts`, `private.platform_admins` e `business_subscriptions` não existem no remoto. A nova migração depende da estrutura administrativa anterior; futura ativação exige revisão e autorização explícita e execução na ordem versionada. Não é executada pelo build, CI, frontend, merge ou deployment. Não há backfill nem ativação retroativa nesta proposta. Se surgirem perfis publicados antes da aplicação, deve-se definir e revisar a política histórica antes de ativar a migração.

Conferência final: 3 negócios, 0 publicados, 1 fotografia, 1 objeto no Storage; 2 contas/perfis, 6 categorias e Mundo Novo/MS. Os dois negócios originais e seus vínculos, dados legais e áreas mantiveram seus checksums. Hashes de políticas RLS, constraints e histórico permaneceram iguais aos da conferência inicial. Nenhum registro técnico foi criado no operacional.

## Modelagem proposta

| Estrutura | Finalidade e acesso |
| --- | --- |
| `public.business_subscriptions` | Uma assinatura por negócio; leitura apenas pelo proprietário/administrador do negócio; nenhuma escrita pelo frontend. |
| `private.professional_plans` | Plano único `professional`. |
| `private.plan_price_versions` | Versões imutáveis de preço; referência inicial 1999 centavos, BRL/mensal, sem aprovação para checkout. |
| `private.subscription_settings` | Checkout e bloqueio financeiro impossíveis de habilitar nesta versão; extensão excepcional desativada. |
| `private.subscription_activations` | Proprietário inicial, administrador responsável e primeira ativação; sinal para revisão de múltiplos negócios. |
| `private.subscription_history` | Início, extensão e mudanças internas de estado/período auditadas. |
| `private.subscription_provider_links` | IDs opcionais do Asaas, exclusivamente Sandbox, fora do DTO do navegador. |
| `private.billing_event_inbox` | Preparação mínima para deduplicação futura por ID; sem endpoint de ingestão ou processamento ativo. |

Todas as tabelas novas têm RLS, revogação de privilégios de escrita e ausência de acesso anônimo. As estruturas privadas não são legíveis pelos usuários comuns. Não há dados de cartões, payload bruto de webhook, CPF ou dados legais nesta modelagem. FKs com `RESTRICT` preservam os registros financeiros/auditáveis contra exclusão acidental do negócio; isso não oferece rotina de exclusão nem altera dados existentes.

Contratação futura exigirá data, versão de preço, snapshot do valor contratado e ciclo. A versão precisa corresponder ao snapshot na primeira contratação e ambos ficam imutáveis. Aumentar a referência criando outra versão não altera contratos anteriores. Ainda não existe operação que contrate o plano ou atribua esses campos pelo aplicativo.

## Regra dos 90 dias e acesso

O trigger atua somente na primeira transição administrativa válida para `published`. Revalida categoria/cidade ativas, descrição, WhatsApp, área e proprietário habilitado. Não começa no signup nem em rascunho incompleto. Calcula `clock_timestamp() + interval '2160 hours'`: 90 dias decorridos, independentes do tamanho dos meses e de horário de verão. A chave do negócio e o início/fim original são imutáveis; `ON CONFLICT` e transação impedem reinício e duplicação do histórico.

Editar, suspender, reativar e recriar sessões não reiniciam nem pausam o relógio. Suspensão administrativa e estado financeiro são independentes. Um usuário pode ter vários negócios legítimos com datas próprias. Preservam-se o proprietário inicial e a contagem de ativações para análise; impedir clonagem deliberada sob novos negócios/contas depende da revisão administrativa, sem prometer identificação de pessoas ou prevenção completa de fraude.

No instante final exato, a leitura retorna `trial_ended`. Esse estado é calculado no servidor; o relógio do cliente não concede acesso. A tela usa o snapshot da consulta e atualiza ao consultar novamente. Nenhuma rotina de expiração, cron, cobrança, exclusão, paywall ou alteração de publicação é ativada. A conta suspensa ainda consulta sua situação pelo RPC restrito, sem recuperar permissões de gestão. Clientes continuam com navegação pública gratuita.

## Extensão excepcional futura

`admin_extend_trial` exige administrador de plataforma, motivo, UUID idempotente e prazo esperado. Locks transacionais, comparação do prazo anterior e limite acumulado protegem contra decisões concorrentes. Repetir a mesma operação retorna a mesma resposta; reutilizar o ID com conteúdo diferente é recusado. Registra administrador, motivo, prazo anterior/novo no histórico da assinatura e na auditoria administrativa.

Está fechado por padrão (`extensions_enabled=false`), sem botão de extensão. Limites técnicos propostos para revisão: até 90 dias por decisão e 365 dias adicionais acumulados, sem habilitação remota nesta tarefa. Não é um benefício automático. Uma futura autorização de habilitação deverá revisar esses limites e a política operacional.

## Asaas e arquitetura futura

O código existente continua fazendo somente GET no Sandbox, descartando o corpo e mostrando diagnóstico sanitizado. Não copia a chave ao frontend. O diagnóstico da nova Preview deve ser conferido nos logs de build; o resultado efetivo está registrado na entrega do PR.

`server/billing-contracts.ts` apenas tipa/projeta identificadores mínimos; não é endpoint, não valida autenticidade por si só, não concede assinatura ativa e exige conciliação para todo evento aceito. A futura sequência será:

1. Validar `asaas-access-token` no servidor, com comparação segura e segredo próprio separado da API key, antes de aceitar o evento.
2. Validar ambiente, tipo e IDs; persistir inbox durável por ID único. Só depois confirmar HTTP 200; repetição não repete efeitos.
3. Resolver o vínculo privado entre assinatura externa e negócio; nunca confiar em um ID de negócio enviado pelo navegador ou no payload para conceder propriedade.
4. Consultar o Asaas para conciliar assinatura/cobrança, valor em centavos, moeda, período e confirmação real. Considerar atrasos, reembolsos e eventos fora de ordem.
5. Atualizar estado, período e auditoria atomicamente, com reprocessamento controlado. Divergências ficam em `reconcile_required`, sem conceder direitos automaticamente.

Não há webhook configurado, fila em execução, rota pública nova, cobrança ou conciliação financeira implementada. Por isso **receita confirmada permanece indisponível**, não estimada a partir de assinantes. Fontes oficiais: [recebimento e autenticação](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook), [idempotência](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks) e [estrutura dos eventos](https://docs.asaas.com/docs/eventos-de-webhooks).

## Validação e limites

| Execução | Resultado/limite |
| --- | --- |
| Typecheck, Vitest e build | Aprovados; 267 testes automatizados, incluindo 20 novos. |
| SQL/RLS | PostgreSQL 17 local descartável, sem TCP e sem Docker; 250 assertions. Aplicação de todas as migrações somente nesse cluster e rollback das fixtures. |
| Migrações | Fundação reconciliada e inalterada; proposta nova não aplicada remotamente. |
| Regras de segurança | Vários negócios por usuário, duas contas distintas, viewer/admin de negócio, tentativas de autoalteração/exclusão, limite exato dos 90 dias, DST/meses, suspensão/reativação, idempotência, CAS, privacidade, snapshots e auditoria. |
| UI | Navegador desktop com viewport emulado 375, 390, 768 e 1280 px, fixtures locais. Sem overflow da página; tabela administrativa tem rolagem interna. Não são testes em aparelhos físicos nem assinaturas operacionais. |
| Integração remota | Somente consultas de integridade. Cadastro/ativação/assinaturas não exercitados no projeto real: as dependências SQL aguardam autorização. |
| Asaas | Somente diagnóstico Sandbox de leitura no preview. Testes de contratos/webhooks são simulados; não comprovam recebimento financeiro. |

Capturas em `docs/screenshots/subscriptions/`, com dados explicitamente sintéticos. O harness visual temporário foi removido antes do commit. GitHub Actions e Preview serão vinculados no PR após a execução do commit.

## PWA preservado e pendências

Não foram alterados manifesto, ícones oficiais, worker, política de cache, instalação ou links públicos. A nova rota fica sob `/conta`, já excluída do cache de navegação. `/api/admin`, requests autenticados e dados Supabase continuam fora do cache do worker; os testes de regressão PWA e o build verificam essas regras. O build gera uma versão nova dos estáticos para atualização segura.

Registrar para outro PR: substituir o convite de instalação no fim da Home por uma mensagem flutuante contextual, dispensável e discreta. Não implementado aqui.

Antes de ativar no operacional: revisar o PR e a nova migração com suas dependências; autorizar explicitamente a aplicação; definir tratamento de perfis já publicados se existirem nessa data; testar uma ativação real autorizada. Contratação, preço definitivo, webhooks, conciliação e eventual política não destrutiva após a gratuidade exigem etapas futuras. Nada deste PR inicia cobrança automaticamente.
