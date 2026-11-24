# Publicações começando pela foto — preflight e limites

Depende do PR de perfil/mobile. O menu do perfil e a Nova publicação na central usam input file montado antes do toque; click síncrono mantém a ativação do seletor nativo. Após selecionar: fotos/ordem (1–6) → título obrigatório pelo modelo atual/legenda → prévia → Confirmar fotos e salvar rascunho. Retrato e portfólio não são gravados pelo novo fluxo. Links antigos ?acao=novo continuam abrindo o compositor, com botão explícito para seleção se o navegador não mantém a ativação após navegação. Não se promete abrir Fototeca por efeito assíncrono.

## Esquema proposto

20261124022206_post_direct_photos.sql: work_post_photos, bucket PRIVADO business-posts (WebP preparado, 5 MiB), RPCs prepare/finalize/save composition e policies/guard de Storage. Originais aceitos no cliente: JPEG/PNG/WebP até 10 MiB; orientação/proporção e fallback WebP reutilizados. HEIC não implementado. Associação ao post e negócio por FK composta. Mídia pending/ready, staged/selected separadas: preparar/upload não publica. Nenhuma nova foto é inserida em portfolio_items nem business_profile_images. Vínculos legados ao portfólio são mantidos e continuam legíveis; edição nova pode misturar fontes sem alterar suas finalidades.

Título e legenda são do post, nunca a bio. Primeiro preparo confirmado cria rascunho técnico no servidor, com título/legenda, para recuperar operações interrompidas. Antes da confirmação, seleção, prévia e cancelar fazem zero gravações remotas. Falha após confirmação mantém a composição na tela e o rascunho técnico. IDs persistem na tentativa; prepare/finalize idempotentes, tentativa de finalizar antes de reenviar bytes, sem upsert/overwrite. Reabrir edição recupera metadados staged; pendentes sem arquivo exigem reescolher o original com mesmo ID. Ao salvar, seleciona fotos/ordem atomicamente; edições publicadas saem de circulação. Nenhum negócio muda de status.

## Permissões

Somente owner/admin habilitado do negócio prepara, finaliza e salva, com auth.uid verificado nas RPCs. Tabela não tem INSERT/UPDATE/DELETE para cliente. SELECT privado por responsável/revisor; público apenas mídia selecionada, ready, post published e negócio published, incluindo regras existentes de moderação. Bucket privado; assinatura de URL continua curta e obtida pelo usuário autorizado. Guard de inserção considera a fase interna real do Storage (supabase_storage_admin/owner_id), sem simular usuários ou usar service_role no frontend. Restrictive policies isolam somente o novo bucket; sem overwrite/delete pelos clientes. Tipos/tamanho reais declarados pelo Storage são validados no finalize. Isto não é scanner de conteúdo/antivírus.

## Compatibilidade e implantação (NÃO executada)

1. Conferir projeto yazdjiwaksamizrbqewq, head/hash, 19 versões anteriores e ausência do bucket/tabela/RPCs. Repetir dry-run exclusivo deste arquivo, sem seeds/roles/vault; interromper divergência.
2. Solicitar autorização específica para o arquivo e hash final. Sem essa autorização, não aplicar nada remotamente.
3. Expansão transacional, lock_timeout 5s. Não há backfill ou reescrita de dados comerciais. RLS legada e RPC work_post_command permanecem; readiness aceita ambas as fontes. Trigger de edição legada desmarca seleção direta quando um cliente antigo salva conteúdo (evita publicar fotos que ele não apresentou); registros/bytes não são apagados.
4. Depois de autorizada/aplicada: validar história, bucket privado/limites, tabela, FKs, grants e políticas em leitura; comparar negócios/serviços/arquivos/assinaturas e isenção antes/depois. Preview normal deve testar com sessão legítima/foto consentida; nenhuma publicação necessária para salvar draft. Não criar dados fictícios no operacional.
5. Separar decisão de merge. Sem migração, o cliente detecta relação ausente e informa que o envio aguarda ativação antes de qualquer upload. Perfil/menu funcionam sem expansão; clientes antigos continuam com seus vínculos de portfólio.

Contenção: reverter frontend mantendo expansão/bytes/rascunhos. Pausar novas RPCs exige autorização própria. Não apagar tabelas/colunas/histórico ou objetos por SQL. Excluir post pelo fluxo existente remove metadados em cascade e torna bytes inacessíveis; limpeza física/retention de objetos órfãos exige procedimento próprio via Storage API e autorização. Limite de 12 staged por post controla abandono; erros/arquivos órfãos não são limpos automaticamente. Configuração do bucket/Storage HTTP ainda precisa de homologação real após a expansão; SQL local não a substitui.

## Evidências

SQL/RLS em PostgreSQL 17 descartável sem Docker passou, incluindo autorização, idempotência, MIME/tamanho, draft privado, leitura pública condicional, edição legada e retirada sem apagar composição. Testes de UI/repos: seleção antes de campos, cancelar, ordem, submit repetido, resposta perdida/finalize antes de reenvio, não-publicação e preservação de canais. Demo Preview /qa/profile-editor/?view=profile tem backend desligado e fotos só em memória; não prova upload real. Safari/teclado físico dependem do titular. Capturas/viewport emulados serão documentados separadamente.

SHA-256 do SQL proposto: `0dc1343fb790974ab6ee6efd93a827b8dce16686d96ee1e19871214f87852248`. Nenhuma aplicação remota executada.

## Revisão visual desta rodada

Capturas locais do build de Preview, com dados sintéticos e sem Supabase: perfil em 393×852 e desktop 1280×900; menu em 320 px; composição de fotos e descrição em 393 px; altura reduzida 393×340 com campo focado. Nesta última, dialog ficou em x=8..385/y=8..332, sem overflow horizontal, corpo rolável e ações/fechar alcançáveis. A redução de altura representa uma restrição de espaço, NÃO teclado real do Safari. Menu foi conferido em 320, 375, 390, 393, 430, 768 e 1280 px, sem overflow horizontal observado. Instalação, teclado físico e seleção/gestos de iPhone continuam pendentes. A prévia sintética usa arquivo local sem dados pessoais; cancelar fechou o compositor sem criar post no backend de demonstração.
