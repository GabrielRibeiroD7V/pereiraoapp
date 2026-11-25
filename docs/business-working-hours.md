# Horários opcionais — preflight e implantação

Projeto exclusivo: `yazdjiwaksamizrbqewq`. Branch `feat/business-working-hours` sobre main #86 (`338f588`). Nenhuma aplicação remota nesta entrega.

## Interface

Empresas e autônomos: cadastro inicial, etapa Contatos → Horários de atendimento (opcional); depois Perfil → Editar perfil → Atendimento → Salvar horários. O salvamento de horários é próprio, com cancelamento e proteção de alterações não salvas. Sobre e Ver como cliente mostram somente dados persistidos. Sem cadastro: “Horário não informado”. Não confunde horário com disponibilidade manual, presença online ou publicação.

Até dois intervalos por dia; suporte a almoço, madrugada e 24 horas (início=fim, explicitado). Fusos disponíveis correspondem às cidades atuais MS e PR: America/Campo_Grande e America/Sao_Paulo. Aberto agora usa o dia e a hora nesse fuso, com fechamento exclusivo; é atualizado a cada minuto e no retorno à aba. Depende do relógio do aparelho. Feriados e exceções ainda não são um calendário específico. A preferência por contatos fora do horário é informativa, sem bloquear mensagens.

## SQL exato proposto

`supabase/migrations/20261125181733_business_working_hours.sql`
SHA-256 `59594c6d455149ebc8a436daa460dbb5a29c50a8b46dfbc0c7f27cfb7525ee34`.

Cria business_working_hours, uma linha por negócio (FK), com enabled, timezone, schedule, accepts_outside_hours e updated_at. Nenhum backfill. Validador de intervalos no servidor, incluindo sobreposição na virada do dia e da semana. Timestamp gerado no servidor; RPC invoker save_business_working_hours com revisão esperada para impedir sobrescrita por aba desatualizada. Campo business_id imutável pelo cliente. Sem DELETE concedido; desativar preserva o registro.

RLS: proprietário habilitado edita o próprio negócio usando o helper existente, respeitando suspensão; moderador lê para inspeção, mas não recebe escrita. Público lê somente horário habilitado de negócio realmente público, respeitando a moderação. Nenhuma mudança em status, assinaturas, serviços, mídia, Asaas, regras financeiras ou funções de publicação.

## Reconciliação e dry-run

O arquivo de notificações de #85 estava localmente como 20261125125926, mas o histórico remoto registra 20261125131147. Comparei integralmente o SQL local e o SQL do histórico: iguais, desconsiderando somente whitespace externo. Este PR renomeia apenas o arquivo para o ID registrado, sem alterar seu conteúdo nem o histórico remoto.

Dry-run remoto da CLI 3.4, projeto de produção confirmado, executado sem seed, roles ou Vault:
`supabase db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault`
Resultado: exclusivamente `20261125181733_business_working_hours.sql`; nenhuma migração antiga reaplicada. Repetir e conferir hash imediatamente antes de eventual aplicação autorizada.

Leitura inicial: projeto ACTIVE_HEALTHY, horários inexistentes, 3 negócios draft e 1 publicado. A migração é aditiva e não altera nenhum deles.

## Testes e limitações

PostgreSQL 17 nativo descartável, sem Docker: edição própria, isolamento de duas contas, anon sem rascunhos/escrita, moderador sem edição, conflito de revisão, validações e fronteiras de semana, visibilidade apenas publicada e bloqueio por suspensão. As publicações desse teste são somente fixtures locais, com rollback. Typecheck/build e testes de UI/repositório: persistência simulada, cancelamento, falha e preservação, formulário de empresa e autônomo, ida/volta entre etapas, prévia salva e fuso.

O runner histórico agora adia horários até os helpers de publicação aberta. A migração de notificações já aplicada depende de Vault/pg_net/Realtime e fica explicitamente fora do teste PostgreSQL nativo: não simulamos esses serviços nem declaramos entrega de push validada. A migração de horários não depende dessas extensões. Nenhum teste local equivale a gravar horários no Supabase operacional ou testar Safari físico.

## Ordem depois da autorização específica

1. Conferir projeto, SHA do PR, hash do SQL, histórico e novo dry-run exclusivo; parar se divergir.
2. Aplicar somente a migração de horários com seu ID versionado. Não reaplicar notificações.
3. Validar em leitura histórico, tabela vazia, CHECKs, RPC/trigger, grants/RLS e preservação de negócios/conteúdo e finanças. Não publicar negócio para testar.
4. Com CI aprovado e sem novas pendências, integrar o PR e confirmar Vercel READY, domínio e SHA do squash. Não integrar frontend antes do banco.
5. Titular testa horários reais consentidos: cadastrar/editar, salvar, Sobre/Ver como cliente, recarregar e novo login. Conferir dados em leitura. Esse ensaio não foi executado ainda.

## Contenção

Clientes antigos ignoram a tabela e continuam operando. Reverter somente o código mantém os horários salvos; não executar DROP nem apagar linhas. Se houver defeito de segurança, propor revogação restrita do RPC/escrita/leitura afetada e pedir autorização para esse SQL de contenção. Não ligar pagamentos nem alterar publicação como forma de conter horários.
