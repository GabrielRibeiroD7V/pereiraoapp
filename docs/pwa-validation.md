# PEREIRÃO instalável — PWA

## Entrega

Branch `feat/aplicativo-pwa`, baseada na main `7b7a5a78a893204210d4a95cc92e648e22710316`. Produção conferida READY nesse commit. Nenhuma migração, dado operacional, configuração de Auth, permissão administrativa ou pagamento foi alterado. Sem merge automático ou promoção manual de produção.

O aplicativo continua React/TypeScript/Vite. Não há aplicativo nativo, publicação em loja ou dependência adicional de PWA. O build gera o worker após o Vite e preserva a execução do diagnóstico Asaas Sandbox exclusivamente no servidor da Vercel.

## Manifesto, marca e instalação

- Manifesto `/manifest.webmanifest`, nome/short_name PEREIRÃO, idioma pt-BR, `id`, `scope` e `start_url` na raiz `/`, `display: standalone`, fundo branco e tema #FFD000. A navegação direta para perfis e trabalhos continua funcionando; não há redirecionamento geral para a Home.
- PNGs 192/512 para Android, maskable 512 e apple-touch-icon opaco 180 para iPhone. Derivados de `public/images/brand/pereirao-768.png` por redimensionamento proporcional e margem branca, sem redesenho, deformação ou letra genérica. A marca inteira permanece no ícone. A arte maskable cabe no círculo seguro central. Script opcional macOS/sips: `sh scripts/generate-pwa-icons.sh`; PNGs já estão versionados e o CI não precisa gerar imagens.
- `viewport-fit=cover`, metadados Apple e áreas seguras no body, navegação fixa e modais. Não houve reformulação de cabeçalho, lettering, perfis ou das três abas.
- Convite compacto ao final da Home. O botão Instalar PEREIRÃO só aparece após o navegador fornecer `beforeinstallprompt`; consome o evento uma única vez e não declara instalação concluída apenas porque o diálogo foi aceito. Erros não geram um botão de instalação fictício.
- No iPhone/iPad, instruções visuais de Compartilhar → Adicionar à Tela de Início → Adicionar; se aparecer Abrir como App, manter ativado. Outros navegadores no iPhone recebem orientação para abrir no Safari. Não há chamada que finja instalar pelo JavaScript no iOS.
- Em standalone ou após `appinstalled`, o convite fica oculto. O usuário pode dispensá-lo na sessão. Safari fora da janela instalada não oferece detecção universal de que o app já está instalado; não se inventa esse sinal.

Referências: [instalação e evento do navegador](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt), [WebKit e aplicativos na Tela de Início](https://webkit.org/blog/13878/).

## Cache e segurança

O worker gerado contém uma allowlist fechada: JS/CSS/fontes com nomes de build, arquivos do fallback offline e ícones/marca estáticos conhecidos. Atualmente são 11 entradas. O nome do cache inclui hash do conteúdo desses arquivos, manifesto e template do worker. Não há cache dinâmico, estratégia para API ou snapshot de páginas React.

| Requisição | Comportamento |
|---|---|
| Assets estáticos explicitamente listados, sem query ou Authorization | Cache da versão; valida status, ausência de redirect e MIME antes de gravar |
| Navegação HTML, incluindo Home, perfil, conta, admin e callback Auth | Rede com `cache: no-store`; sem gravar o HTML ou URL solicitada no CacheStorage |
| Navegação quando a rede falha | `/offline.html` genérico, sem dados de conta, permissões, fotos ou formulários anteriores |
| `/api` e `/api/*`, qualquer POST, Authorization, outras origens | Worker não intercepta; requisição normal de rede |
| Supabase Auth/REST/Storage, fotos assinadas, arquivos fora da allowlist ou queries em assets | Sem interceptação ou gravação pelo worker |

Precache aborta e remove somente a versão incompleta se um recurso falhar ou retornar MIME inesperado, preservando a versão ativa. Ativação elimina apenas caches antigos com prefixo próprio; não limpa localStorage, sessões do Supabase ou caches de outras aplicações. `/sw.js` é servido com `Cache-Control: no-store` e escopo raiz; manifesto com `no-cache`.

A política trata o CacheStorage do worker. Não promete apagar bytes já recebidos ou controlar toda a memória/cache HTTP nativa de imagens do navegador. Sessões continuam sob o Supabase Auth existente; nenhum token, cookie ou URL assinada é copiado para o worker ou para o cache público.

## Atualizações e conexão

Atualização permanece waiting. O aviso pede para salvar alterações antes de clicar em Atualizar aplicativo; não recarrega formulários automaticamente quando uma versão é descoberta. Após confirmação, envia a mensagem de ativação e recarrega essa janela no controllerchange. Outras janelas não são recarregadas à força, mas exigem recarga antes de voltar à área privada. Há tratamento de falha/timeout e verificações de versão ao retomar foco, visibilidade e navegação, limitadas por intervalo mínimo.

Sem conexão, conta, Auth e administração ficam ocultos/inertes e modais privados são fechados; dados React não são apresentados como uma cópia privada offline. Ao reconectar, a área privada exige recarga para conferir sessão/permissões. Isso pode exigir revisar dados ainda não salvos, conforme aviso da interface. A descoberta de atualização, enquanto ainda waiting, permite terminar de salvar antes de aplicar. Permissões administrativas e operações profissionais continuam validadas no servidor/banco a cada operação; não são concedidas pelo PWA.

A instalação não exige login. Abrir pelo ícone usa a Home; sessão é preservada quando o sistema compartilha o armazenamento da origem. iOS pode separar o armazenamento da janela instalada e do Safari: o usuário poderá precisar entrar novamente. Não há transferência manual de sessão entre ambientes. Dados e operações profissionais exigem internet; não foi criada fila de envio offline.

## Matriz de validação

| Camada | Resultado | Limite |
|---|---|---|
| Typecheck, build, histórico e diff check | Aprovados | Worker gerado validado pelo build e testes próprios |
| Vitest | 247 testes aprovados, 60 novos | Incluem worker em VM, controlador, UI, sessão/logout, atualização, isolamento de cache e regressões anteriores |
| Worker em Chromium real local | Registro, controle e 11 entradas estáticas; nenhuma inesperada | Servidor local, não Android/iPhone físico |
| Resposta dinâmica em Chromium real | Canary local HTTP 200 não aumentou cache; continuou 11 entradas e zero inesperadas | API sintética local, não dados administrativos operacionais |
| Atualização em Chromium real | Duas versões: 22 entradas durante waiting; clique na UI ativou a nova; depois 11 entradas e zero inesperadas | Segunda versão em cópia descartável do build; nenhum deployment operacional alterado |
| Origem indisponível | `/admin` mostrou somente fallback genérico; logo/CSS vieram do cache | Interrupção do servidor local, não modo avião de aparelho físico |
| Reconexão e links diretos | Tentar novamente abriu Entrar com `next=/admin`; `/prestadores/exemplo` preservou rota pública | Build local sem credenciais de Supabase; autenticação real não foi executada nesse ensaio |
| UI e responsividade | 32 cenários em 375/390/768/1280, sem overflow, modais fora da viewport ou imagens carregadas quebradas | Disponibilidade Android/iOS/standalone emulada por adaptador local de teste; não é uma instalação nativa |
| Sessão e logout | Composição PWA + Auth e regressões anteriores aprovadas | Gateway/SDK interceptados; sem pedir senha ou criar usuário remoto |

O ensaio nativo foi encerrado com unregister e remoção apenas dos dois caches estáticos da origem descartável: registro ausente e zero caches de teste. Harness visual/inspeção, canary, servidor técnico e variantes locais não integram o aplicativo ou o bundle publicado.

Não foi possível afirmar instalação física em Android/Chrome ou iPhone/Safari, abertura pelo ícone do sistema ou transferência real de sessão entre Safari e janela instalada. Essas verificações permanecem pendentes em aparelhos reais. A dimensão emulada e os sinais de instalação simulados não substituem esses testes.

## Capturas

| Cenário | Celular | Desktop |
|---|---|---|
| Convite Chromium, evento emulado | [390 px](screenshots/pwa/android-390.png) | [1280 px](screenshots/pwa/android-1280.png) |
| Instruções iPhone emuladas | [390 px](screenshots/pwa/ios-help-390.png) | [1280 px](screenshots/pwa/ios-help-1280.png) |
| Convite oculto em standalone emulado | [390 px](screenshots/pwa/standalone-390.png) | [1280 px](screenshots/pwa/standalone-1280.png) |
| Aviso de atualização | [390 px](screenshots/pwa/update-390.png) | [1280 px](screenshots/pwa/update-1280.png) |
| Conta sem conexão | [390 px](screenshots/pwa/private-offline-390.png) | [1280 px](screenshots/pwa/private-offline-1280.png) |
| Offline genérico | [390 px](screenshots/pwa/offline-document-390.png) | [1280 px](screenshots/pwa/offline-document-1280.png) |

[Métricas dos 32 cenários](screenshots/pwa/metrics.json). Ensaio nativo: [cache antes](screenshots/pwa/native-cache-before.png), [waiting](screenshots/pwa/native-update-waiting.png), [cache após atualização](screenshots/pwa/native-cache-after-update.png), [offline na rota admin](screenshots/pwa/native-offline-admin-390.png), [limpeza](screenshots/pwa/native-cleanup.png).

## Banco e configuração externa

Somente leitura no Supabase `yazdjiwaksamizrbqewq`: nove tabelas originais, quatro migrações aplicadas, três negócios, uma fotografia e um objeto. `work_posts` e `private.platform_admins` ausentes. Continuam pendentes, sem aplicação:

1. `20261121001632_work_posts.sql`;
2. `20261121004916_platform_admin.sql`;
3. `20261121004917_admin_work_moderation.sql`.

Não foi criada migração PWA. O acesso administrativo operacional também depende da concessão por UUID revisada anteriormente; o PWA não altera esse acesso. A API administrativa e a sonda Asaas Sandbox existentes são preservadas; o resultado do Preview/CI do SHA enviado será registrado na descrição do PR. Não há ativação de pagamentos.

## Antes da liberação

Revisar o PR. Em Android/Chrome físico, verificar o convite quando elegível e abertura pelo ícone; em iPhone/Safari, executar as instruções, conferir standalone, áreas seguras/teclado e retorno dos links. Validar sessão/login/logout com a conta do proprietário, diretamente no aparelho, sem compartilhar credenciais. Após ativação administrativa autorizada, conferir também acesso/revogação real no painel; até lá, a ausência das migrações deve continuar sendo informada. A disponibilidade de instalação é uma decisão do navegador, não uma garantia de exibição imediata do evento.

Um futuro merge pode disparar o deployment automático da main. Não houve publicação no Lovable, aplicativos nativos ou lojas nesta tarefa.
