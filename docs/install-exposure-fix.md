# Instalação: relato físico e correção de exposição

Relato do titular (Safari/iPhone, site oficial): card automático não apareceu; acesso manual Adicionar à Tela de Início abriu corretamente as instruções. O manual está aprovado nesse ensaio; o automático falhou nesse relato. Não é aceite da correção nova.

Causa comprovada no código anterior: um registro de exposição automática usava o mesmo período de 14 dias da dispensa explícita. A preferência era escrita no efeito de elegibilidade, antes de confirmar visibilidade. Portanto uma oferta interrompida por navegação/modal podia bloquear nova oferta sem X. Outra condição encontrada: um botão/link focado no main bloqueava o convite indefinidamente. Não há acesso remoto ao armazenamento ou à versão em execução no iPhone, portanto não é possível afirmar qual condição ocorreu especificamente no aparelho sem o diagnóstico do titular.

Correção: manter X/Entendi e dispensas explícitas anteriores por 14 dias. Separar exposição automática para 24h; registrar apenas após 3s visíveis, com IntersectionObserver quando suportado. Ofertas interrompidas não contam. Preferência automática antiga fica preservada no armazenamento e não é interpretada como dispensa explícita. Não apaga sessão/cache, storage ou atalhos. Campo, teclado, modal e operação em andamento continuam bloqueando; foco de botão tem pausa curta de 3s e não bloqueio permanente.

Continua exigindo 45s + interação em página elegível, antes/depois do login. Não abre instruções ou prompt sem toque. Modo standalone oculta; aceitação de prompt não equivale a appinstalled. Acesso manual permanente mantém o fluxo existente.

Conta → Opções da conta → Aplicativo PEREIRÃO → Informações do convite de instalação mostra versão em execução/publicada, modo e prazos ativos, sem sessão, credenciais ou dados pessoais. Permite identificar dispensa real sem forçar limpeza. Não promete detectar instalação feita em outro navegador/contexto.

32 testes direcionados, typecheck/build; teste físico novo pendente. Para verificar: atualizar normalmente uma página sem formulário pendente, abrir Home ou Conta no Safari, interagir e permanecer 45s sem teclado/modal. Se não aparecer, abrir o acesso manual e enviar apenas as informações do convite. Não apagar dados. Relato físico do titular será registrado separadamente.

Nenhum dado de negócio/post/finanças alterado, sem migração. Demais frentes (post com URL própria, Conversas, Home compacta e demo isolada) continuam em PRs separados.
