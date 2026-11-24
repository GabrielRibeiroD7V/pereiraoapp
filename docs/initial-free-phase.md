# Proposta: fase inicial gratuita (não aplicada)

## Estado confirmado em leitura — 24/11/2026

Quatro negócios draft, nenhum publicado, zero `business_subscriptions` e zero `subscription_activations`; uma conta isenta. Checkout e enforcement false; preços de referência sem aprovação comercial. O código do servidor financeiro só permite operações Sandbox em Preview explicitamente habilitado. Não houve chamada financeira nesta auditoria.

Hoje a primeira transição administrativa válida para published chama `private.start_trial_on_activation`: insere uma assinatura trial, início e término exatos de 2160 horas, ativação e histórico. Conflito por business_id impede reinício. Isenção muda o estado apresentado e proíbe contratação, mas NÃO impede esse primeiro relógio. A aprovação continua na RPC administrativa com justificativa, estado esperado, bio, contato, cidade/categoria ativas, atendimento e proprietário habilitado. Gratuidade e revisão não são a mesma decisão.

Arquivo proposto: `20261124163000_initial_free_phase.sql`. SHA-256: `af1aa1217b85e958240e48d14908e0b1255c7cb36147f3db6b88879cd1b68019`. Nenhum SQL remoto aplicado.

## Diff proposto

- Migração `20261124163000_initial_free_phase.sql`: política privada de fase gratuita, sem data final ou troca de estado via API; suspende criação automática de trial, protege inserção/conversão de contratos reais, RPC pública só de estado da fase e snapshot privado que preserva a prioridade de isenção.
- A migração exige zero assinaturas/ativações e checkout/enforcement false. Caso o estado mude, ABORTA sem alterar registros. Locks curtos serializam com a publicação concorrente; timeout aborta tudo.
- Não altera negócios, posts, preços, isenções, RLS existente, serviços, mensagens ou contratos Sandbox. Não há publicação, cobrança nem reinício de relógio.
- Cadastro/Conta/Situação mostram “Fase inicial gratuita” SOMENTE se a RPC confirmar. Sem a migração ou com erro, não afirmam que o backend já mudou. Perfil básico, serviços, publicações e conversas são gratuitos; assinatura futura opcional, benefícios a definir com uso real, nenhuma conversão automática e nenhum preço anunciado.
- Encerrar a fase será OUTRA decisão e implementação. Nem passagem do tempo nem futura republicação ativam uma assinatura. Não prometer 90 dias adicionais futuros sem definição comercial.

## Preflight para futura autorização

1. Confirmar `yazdjiwaksamizrbqewq`, head final e SHA-256 do arquivo anexado ao PR. Histórico remoto em leitura tem 20 versões, até `20261124022206`; comparação por IDs neste branch lista apenas `20261124163000` como nova. Isso é reconciliação com o histórico lido, NÃO um `db push --dry-run` executado (CLI/aplicador remoto não utilizado).
2. Repetir contagens sem expor dados pessoais; confirmar zero assinatura/ativação, quatro drafts, isenção e flags. Comparar as duas funções substituídas com a produção revisada; qualquer divergência exige nova revisão. Conferir que #52 continua separado.
3. Executar aplicador versionado autorizado em dry-run: deve listar EXCLUSIVAMENTE esse arquivo. Se listar outro, tiver contrato/ativação ou hash diferente, parar. Esta rodada não autoriza aplicar nada.
4. Após autorização específica: aplicar transacionalmente só esse ID, validar histórico, política sem grants diretos, RPC com visitante/owner/admin/terceiro, snapshots, gatilho e guard; comparar contagens de negócios/arquivos/isenção e confirmar que não foram criadas assinaturas. Não publicar negócio para testar.
5. Integrar o código apenas após autorização separada e CI. Conferir READY e estado RPC em produção. Não exibir estado gratuito como ativo antes disso.

## Contenção e reversão

- Falha de aplicação/lock: rollback transacional, aplicação antiga continua, não publicar enquanto a regra antiga dos 90 dias estiver ativa.
- Falha de interface: reverter apenas o deploy de interface; MANTER a política gratuita no banco. A versão anterior tolera ausência de linha de assinatura, embora possa exigir correção de texto.
- Antes de QUALQUER publicação na fase, existe proposta `supabase/operations/initial_free_phase_containment.sql`: locks, verificações conservadoras, restauração exata das duas funções anteriores e remoção somente da RPC/guard novos; conserva dados e registro técnico da fase. Não executar automaticamente, não reaplicar migração antiga.
- Depois de publicação/ativação: esse rollback recusa execução. Manter a proteção gratuita, pausar novas aprovações operacionais e corrigir progressivamente com SQL revisado. Restaurar o gatilho antigo sem isso poderia iniciar um prazo numa reativação.

## Números por cidade — contrato de medição, sem contadores fictícios

| Indicador | O que já se pode contar | Próxima instrumentação e cuidado |
|---|---|---|
| Profissionais publicados | Negócios published distintos; separar cidade de origem e cidade atendida, sem somar como negócios diferentes | “Ativo” exige atividade definida e persistida; não confundir serviço ativo com uso recente da conta |
| Buscas | Não há eventos persistidos confiáveis de pesquisa | Evento por pesquisa confirmada, cidade/filtro/categoria, deduplicação, janela temporal, exclusão de testes/bots; não registrar texto livre pessoal |
| Visualizações | Não há evento confiável de visita | Visita única por sessão/perfil/dia, sem autoacesso do dono ou admin, visitante pseudônimo e retenção limitada |
| Interesse/contato | Conversa legítima iniciada e mensagens já têm registros; origem da cidade pesquisada não está persistida | Contar novos contatos de terceiros e respostas separadamente; clique WhatsApp é intenção, NUNCA prova de mensagem entregue |

Sem tráfego não usar zero inventado como medida de demanda; mostrar indisponível quando a coleta não existe. Proposta inicial: acompanhar semanalmente publicados por cidade, buscas únicas, visitas de terceiros, novos contatos, taxa de resposta e retorno em 7/30 dias. Exigir amostra suficiente por cidade antes de definir benefícios opcionais. Os eventos/privacidade/abuso exigem outro modelo e autorização de migração; não foram implementados neste PR.

## Testes e limites

PostgreSQL 17 local descartável valida aprovação administrativa, perfil incompleto, isolamento, publicação/reativação sem trial, auditoria, recusa de writes financeiros e isenção. A suíte aplica primeiro a arquitetura anterior e seus testes, depois simula a atualização com esta migração e a suíte específica. Nenhum teste cria dados remotos. UI/SDK: flags confirmadas, ausência da RPC anterior, falha de rede, conversão/checkout indevidos e texto sem preço definitivo. Não equivale a teste físico ou ativação remota.
