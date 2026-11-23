# Instalação: convite opcional e acesso permanente

## Diagnóstico

A versão de produção auditada é a main `aae251b52edd5f07313bb6188b6f570b903b868f` (squash #42). O domínio e o deployment imutável retornaram a mesma versão PWA `e13fdcb9907b75083e90`. HTML de `/` e `/conta` era idêntico; HTML, version.json e sw.js estavam consistentes. Cache-Control: no-store para HTML/version/worker; assets com hash: immutable. Um HIT do CDN, isoladamente, não demonstra versão antiga. A divergência anterior de metadados do alias não foi reproduzida nessa coleta.

O convite existente exige rota pública, 45 segundos, interação, ausência de campo/modal/ação prioritária focada, dispositivo compatível, ausência de dispensa e modo não standalone. X e Entendi registram dispensa por 14 dias, além da preferência da sessão atual. A Conta não tinha acesso permanente: o usuário dispensado ou em rota privada ficava sem como reabrir as instruções. Essa lacuna é comprovada por inspeção do código. Qual condição ocorreu no iPhone do titular ainda não foi medida: ele não estava com o aparelho durante esta rodada.

As ilustrações #40 e o atalho global #39 continuam exclusivos de seus Previews, sem merge. Sua ausência na Home de produção não comprova problema de cache. O perfil #38/#41 já está na main. Não foi identificado novo defeito reproduzível de alternância de versões nesta rodada, portanto o protocolo de atualização e o worker não foram alterados.

## Correção

Conta → Opções da conta → Aplicativo PEREIRÃO abre diretamente as instruções no iOS ou o prompt nativo quando disponível. Sem login, a Conta mantém a seção de instalação. Disponível com ou sem login, sem aguardar 45 segundos e mesmo durante a dispensa. Mantém ícone oficial e reutiliza as mesmas instruções do convite. Fechar/Entendi neste acesso não altera o cooldown.

Safari: começar no Início, Compartilhar → Adicionar à Tela de Início → Adicionar; manter Abrir como App se oferecido. Outro navegador iOS orienta abertura no Safari. Se já existe ícone, abrir o existente.

Com beforeinstallprompt disponível: chama prompt diretamente no toque. Aceitação do prompt não confirma instalação; apenas appinstalled ou detecção standalone muda o estado. Sem evento: abre orientação honesta sobre o menu do navegador, sem simular instalação. Em standalone, apresenta estado instalado e não oferece reinstalação. O navegador pode não revelar uma instalação existente em outro contexto: não prometemos detecção universal.

Não lê ou limpa tokens, sessão ou armazenamento do usuário. Não cria atalhos via código. Não envolve o aviso de atualização nem liga diagnósticos técnicos por padrão. Nenhum banco, pagamento, negócio ou período gratuito é modificado.

## Validação e limites

Testes direcionados simulam Safari/iPhone, outro navegador iOS, cooldown, retorno/focus, beforeinstallprompt, falha de prompt, appinstalled e mudança de modo. Testam a integração do acesso na Conta e regressões do convite/atualização. Build e histórico de migrações são verificados; os checks do PR registram a suíte completa.

Não houve teste físico de iPhone ou Android nesta rodada. Após aprovação visual do Preview, conferir no aparelho: Conta → instruções; fechar e reabrir; abrir pelo ícone existente e conferir estado instalado. Não é necessário reenviar foto, sair da conta ou limpar dados. A versão e o worker efetivamente em execução no iPhone continuam dependentes da observação no aparelho; diagnóstico opcional em `/?pwa-diagnostico=1`, sem credenciais.

## Retorno real do titular e correção do menu

O titular informou no iPhone: encontrou Aplicativo PEREIRÃO, mas não abriu as instruções. O código publicado no #43 tinha um link de âncora para o final da Conta, exigindo um segundo toque. Isso comprova a etapa intermediária no código; não comprova qual build/worker estava executando no aparelho nem uma falha do Safari.

A correção substitui esse link pelo mesmo componente de instalação em modo menu: um toque abre as instruções ou chama beforeinstallprompt imediatamente. Evita duplicar o acesso na Conta autenticada, preservando a alternativa sem login. Não altera worker, cooldown, sessão, dados ou instruções de instalação.

Quatro novos testes direcionados: menu Safari dispensado abre e fecha sem alterar storage; prompt nativo no mesmo toque sem afirmar instalação; standalone sem reinstalação; integração Conta autenticada com menu → modal, sem âncora/segundo toque. Typecheck/build também executados. Não se repetiu a bateria anterior do #43. A confirmação física desse novo toque → modal → Compartilhar continua pendente até o titular testar o novo Preview.
