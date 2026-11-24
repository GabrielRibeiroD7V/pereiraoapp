# Proposta: fase inicial gratuita (não aplicada)

## Estado confirmado em leitura — 24/11/2026

Quatro negócios draft, nenhum publicado, zero `business_subscriptions` e zero `subscription_activations`; uma conta isenta. Checkout e enforcement false; preços de referência sem aprovação comercial. O código do servidor financeiro só permite operações Sandbox em Preview explicitamente habilitado. Não houve chamada financeira nesta auditoria.

Hoje a primeira transição administrativa válida para published chama `private.start_trial_on_activation`: insere uma assinatura trial, início e término exatos de 2160 horas, ativação e histórico. Conflito por business_id impede reinício. Isenção muda o estado apresentado e proíbe contratação, mas NÃO impede esse primeiro relógio. A aprovação continua na RPC administrativa com justificativa, estado esperado, bio, contato, cidade/categoria ativas, atendimento e proprietário habilitado. Gratuidade e revisão não são a mesma decisão.

Arquivo proposto: `20261124163000_initial_free_phase.sql`. SHA-256: `641af930c3702a6503433eed7180031a2137f5dbe80c0ecf769a96a87c374bf6`. Nenhum SQL remoto aplicado.

## Diff proposto

- Migração `20261124163000_initial_free_phase.sql`: política privada de fase gratuita, sem data final ou troca de estado via API; suspende criação automática de trial, protege inserção/conversão de contratos reais, RPC pública só de estado da fase e snapshot privado que preserva a prioridade de isenção.
- A migração exige zero assinaturas/ativações e checkout/enforcement false. Caso o estado mude, ABORTA sem alterar registros. Locks curtos serializam com a publicação concorrente; timeout aborta tudo.
- Compatibilidade corrigida nesta revisão: a API preserva o enum legado `awaiting_activation` e acrescenta `accessPhase=initial_free`. O decoder da produção atual continua lendo a resposta; o novo frontend interpreta a fase explicitamente, mantendo a prioridade de `exempt`. O painel administrativo traduz o filtro novo para o valor entendido pela RPC existente.
- Não altera negócios, posts, preços, isenções, RLS existente, serviços, mensagens ou contratos Sandbox. Não há publicação, cobrança nem reinício de relógio.
- Criação de conta/Cadastro profissional/Conta/Situação mostram “Fase inicial gratuita” SOMENTE se a RPC confirmar. Sem a migração ou com erro, não afirmam que o backend já mudou. Perfil básico, serviços, publicações e conversas são gratuitos; assinatura futura opcional, benefícios a definir com uso real, nenhuma conversão automática e nenhum preço anunciado.
- Encerrar a fase será OUTRA decisão e implementação. Nem passagem do tempo nem futura republicação ativam uma assinatura. Não prometer 90 dias adicionais futuros sem definição comercial.

## Preflight para futura autorização

1. Confirmar `yazdjiwaksamizrbqewq`, head final e SHA-256 do arquivo anexado ao PR. Histórico remoto em leitura tem 20 versões, até `20261124022206`; comparação por IDs neste branch lista apenas `20261124163000` como nova. Dry-run remoto executado com CLI 3.4.0, projeto explícito e `--skip-vault`: lista exclusivamente `20261124163000_initial_free_phase.sql`, sem seed/roles; hash antes/depois idêntico. Nenhuma migração aplicada.
2. Repetir contagens sem expor dados pessoais; confirmar zero assinatura/ativação, quatro drafts, isenção e flags. Comparar as duas funções substituídas com a produção revisada; qualquer divergência exige nova revisão. Conferir que #52 continua separado.
3. Executar aplicador versionado autorizado em dry-run: deve listar EXCLUSIVAMENTE esse arquivo. Se listar outro, tiver contrato/ativação ou hash diferente, parar. Esta rodada não autoriza aplicar nada.
4. Após autorização específica: aplicar transacionalmente só esse ID, validar histórico, política sem grants diretos, RPC com visitante/owner/admin/terceiro, snapshots, gatilho e guard; comparar contagens de negócios/arquivos/isenção e confirmar que não foram criadas assinaturas. Não publicar negócio para testar.
5. Integrar o código apenas após autorização separada e CI. Conferir READY e estado RPC em produção. Não exibir estado gratuito como ativo antes disso.

## Contenção e reversão

- Falha de aplicação/lock: rollback transacional, aplicação antiga continua, não publicar enquanto a regra antiga dos 90 dias estiver ativa.
- Janela entre SQL e novo frontend: o aplicativo atual continua consultando sem erro de enum, mas pode mostrar o texto antigo sobre 90 dias. Não efetuar publicações operacionais até a validação da migração e a decisão/deploy separado do frontend.
- Falha de interface: reverter apenas o deploy de interface; MANTER a política gratuita no banco. A versão anterior tolera ausência de linha de assinatura, embora possa exigir correção de texto.
- Antes de QUALQUER publicação na fase, e somente com a metadata da política íntegra, existe proposta `supabase/operations/initial_free_phase_containment.sql`: locks, verificações conservadoras, restauração exata das duas funções anteriores e remoção somente da RPC/guard novos; conserva dados e registro técnico da fase. Não executar automaticamente, não reaplicar migração antiga.
- Depois de publicação/ativação: esse rollback recusa execução. Manter a proteção gratuita, pausar novas aprovações operacionais e corrigir progressivamente com SQL revisado. Restaurar o gatilho antigo sem isso poderia iniciar um prazo numa reativação.

## Números por cidade — contrato de medição, sem contadores fictícios

| Indicador | O que já se pode contar | Próxima instrumentação e cuidado |
|---|---|---|
| Profissionais publicados | Negócios published distintos; separar cidade de origem e cidade atendida, sem somar como negócios diferentes | Definir ativo como publicado, proprietário habilitado e ao menos uma ação do responsável no negócio nos últimos 30 dias (serviço/post salvo ou resposta legítima). Excluir ações administrativas e testes. Ainda não há evento unificado para contar isso; não usar updated_at nem serviço ativo como substituto |
| Buscas | Não há eventos persistidos confiáveis de pesquisa | Evento por pesquisa confirmada, cidade/filtro/categoria, deduplicação, janela temporal, exclusão de testes/bots; não registrar texto livre pessoal |
| Visualizações | Não há evento confiável de visita | Visita única por sessão/perfil/dia, sem autoacesso do dono ou admin, visitante pseudônimo e retenção proposta de 90 dias para eventos mínimos, com agregados semanais; decisão de privacidade antes da instrumentação |
| Interesse/contato | Conversa legítima iniciada e mensagens já têm registros; origem da cidade pesquisada não está persistida | Contar novos contatos de terceiros e respostas separadamente; clique WhatsApp é intenção, NUNCA prova de mensagem entregue |

Sem tráfego não usar zero inventado como medida de demanda; mostrar indisponível quando a coleta não existe. Proposta inicial: acompanhar semanalmente publicados por cidade, buscas únicas, visitas de terceiros, novos contatos, taxa de resposta e retorno em 7/30 dias. Exigir amostra suficiente por cidade antes de definir benefícios opcionais. Os eventos/privacidade/abuso exigem outro modelo e autorização de migração; não foram implementados neste PR.

## Testes e limites

PostgreSQL 17 local descartável valida aprovação administrativa, perfil incompleto, isolamento, publicação/reativação sem trial, auditoria, recusa de writes financeiros e isenção. A suíte aplica primeiro a arquitetura anterior e seus testes, depois simula a atualização com esta migração e a suíte específica. Nenhum teste cria dados remotos. UI/SDK: flags confirmadas, ausência da RPC anterior, falha de rede, conversão/checkout indevidos e texto sem preço definitivo. Não equivale a teste físico ou ativação remota.

## Revisão direcionada solicitada

- Defeito reproduzido: decoder congelado de `deb455a` recusava o enum `initial_free` da proposta anterior. Teste antes/depois comprova que o mesmo decoder aceita a expansão corrigida, enquanto o novo leitor apresenta a fase correta. Isenção e prazo nulo preservados.
- Defesa de reversão corrigida: metadata de fase ausente agora recusa o rollback, mantendo o guard financeiro. O runner focado executa esse erro e a reversão válida de verdade no PostgreSQL descartável.
- Comando focado: `PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/test-free-phase.mjs`; carrega DDL compatível e executa apenas cenários da fase/contensão. Não repete as suítes legadas localmente. CI mantém seus checks obrigatórios completos.
- A regra atual remota foi reconferida por hash, grants, RLS e definição do trigger: 90 dias continuam vinculados à primeira publicação administrativa até a migração ser autorizada/aplicada. Nenhuma função ou política remota foi alterada nesta revisão.
