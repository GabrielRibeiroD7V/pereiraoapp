# Equipe pública e local de atendimento — issue #102

## Escopo e dependências

Base: main `d9f000de1748ff1f610eae267ff87619d097a9f1` (#101). Independente de #99 (financeiro) e #103 (cards/convite).

- Limite final solicitado: **10 integrantes por empresa**, validado na interface e na RPC sob lock da linha do negócio. O 11º é rejeitado. Não há cobrança por integrante.
- Integrantes são apresentações públicas, sem contas ou permissões. `business_members`, mensagens, Realtime e Push não são alterados.
- A seção da equipe aparece em **Sobre → Nossa equipe** somente para empresas. Nome, profissão, até 12 especialidades declaradas, apresentação de até 600 caracteres e WhatsApp opcional. Sem credencial verificada.
- Inserir/editar requer nova declaração de autorização do integrante; envio de foto requer confirmação própria. Auditoria privada guarda ator, alvo, ação, versão do consentimento e data, sem duplicar telefone/endereço na trilha.
- Remover é retirada lógica: oculta integrante, contato e ponteiro da foto; arquivos e trilha são preservados. Ocultar é reversível pela edição.
- E-mail confirmado e titular habilitado são exigidos pelas novas escritas. Suspensão existente continua efetiva.

## Caminhos

Cadastro inicial: etapa **Contatos e revisão → Configurar local de atendimento agora (opcional)**. Mantém as três etapas. Ao salvar primeiro obtém o mesmo ID durável do rascunho e então grava o atendimento; falha mantém o checkpoint, sem duplicar negócio.

Edição: **Conta → perfil profissional → Editar perfil → Atendimento → Equipe e endereço de atendimento** (autônomos: Endereço e modo de atendimento). Rota existente acrescida: `/conta/profissional/:businessId/equipe-localizacao`. Salvar/cancelar e Voltar preservam a seleção desse negócio.

Local: presencial / domicílio / ambos. CEP sem consulta externa, rua, número (aceita S/N), bairro, complemento, cidade/UF exclusivamente do catálogo ativo. Endereço fica privado até confirmação de localização e autorização pública. Mudança de rua/CEP/número/bairro/complemento/cidade exige reconfirmar. Trocar para domicílio desmarca publicação e preserva os dados privados.

A prévia usa somente os dados gravados e omite endereço não autorizado e integrantes ocultos. O perfil público só recebe projeção segura se o negócio estiver publicado e habilitado. Uma publicação profissional isolada nunca recebe esses novos campos de um negócio draft.

Google Maps: `https://www.google.com/maps/dir/?api=1&destination=...`; Apple Maps: `https://maps.apple.com/?daddr=...&dirflg=d`. Destino composto do endereço confirmado, codificado com URLSearchParams; sem coordenadas, GPS, geocodificação, chave, custo ou agendamento. Links abrem com noopener/noreferrer.

## Migração proposta — NÃO aplicada

Projeto: `yazdjiwaksamizrbqewq` (pereiraoapp, Production).

Arquivo: `20261127204538_business_team_location.sql`.

SHA-256: `e4905f9c0d5cca0c301f33941eb5e3a9b927d4f5a656de6cd769e0c5eef2ae42`.

Expansão:
- `public.business_team_members`: pessoas apresentadas, separadas das associações de acesso; RLS e SELECT somente do titular. Escritas somente pela RPC validada.
- `public.business_locations`: endereço completo e consentimento; RLS somente do titular. Sem SELECT direto para anon.
- `private.team_images`: operações imutáveis de mídia e ponteiro esperado para troca concorrente.
- `private.team_location_audit`: auditoria sem acesso dos clientes.
- Bucket **privado** `business-team`, apenas WebP, máximo 5 MiB. Original JPEG/PNG/WebP até 10 MiB passa pela otimização existente; HEIC não é prometido.
- RPCs `business_team_location` (leitura projetada) e `business_team_location_command` (escrita pelo dono). Wrappers invoker, autorização nas implementações privadas, search_path vazio, execução revogada por padrão e concedida por função/role.
- Políticas restritivas de Storage protegem o novo bucket mesmo na presença de outras políticas permissivas. Sem overwrite/delete pelo cliente. Foto pronta antiga permanece se upload/finalização falhar. Retry usa o mesmo UUID/caminho e finalização idempotente; 200 preparações por negócio/dia limitam abuso. Cancelar antes de confirmar não faz RPC nem upload.

Não altera registros existentes, estados de publicação, assinaturas, gratuidade, funções de cobrança ou tabela de mensagens. O backend antigo permanece compatível: simplesmente não utiliza as tabelas novas.

### Preflight remoto somente leitura — 27/11/2026

Confirmados: quatro negócios, três draft e um published; zero assinaturas. As duas tabelas públicas novas ainda não existem. Nenhum dado pessoal foi reproduzido nesta documentação.

Dry-run REAL executado com `db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault`: **BLOQUEADO / DbPushMissingLocalError**.

O remoto contém `20261127200456_admin_monetization_policy` e `20261127200512_sandbox_monthly_1990`; o histórico local usa outro identificador para a primeira e não inclui a segunda na main. São divergências anteriores e financeiras, fora da issue #102. Não executamos repair, pull, renomeação ou reaplicação para escondê-las. Assim, **não há comprovação de dry-run exclusivo e a migração NÃO está liberada para aplicação**.

Ordem futura: reconciliar esse histórico em entrega própria revisada; reconferir main/hash/projeto e dependências; obter dry-run listando SOMENTE este arquivo; obter autorização específica de SQL; aplicar expansão; validar funções/permissões/bucket em leitura; ensaio consentido de uma empresa legítima e foto autorizada; só então decidir integração do código. Nunca integrar #99 ou outras migrações por dependência implícita.

### Contenção e reversão sem apagar fotos

Reverter apenas o frontend para a versão anterior deixa as novas tabelas inativas e preserva todos os dados. Em falha de segurança, operador autorizado deve revogar EXECUTE das RPCs novas de escrita e leitura e substituir temporariamente `private.team_object(text,boolean)` por uma função com o MESMO contrato que retorne false, bloqueando apenas o novo bucket. Preservar políticas restritivas, bucket privado, objetos e trilha. Não revogar o helper sem substituição, pois as políticas compartilhadas podem falhar por falta de privilégio.

Antes de conter, exportar definições exatas para restauração; validar que buckets antigos e chat continuam acessíveis. URLs assinadas já emitidas podem continuar válidas por até **60 segundos**: retirada não revoga um token anteriormente entregue. Não prometer revogação instantânea nem exclusão de cópias já baixadas. Restauração é roll-forward revisado, sem DROP de tabelas/bucket, sem apagar arquivos ou remover histórico de migrações. Uma reversão remota exigirá decisão própria; este documento não executa nada.

## Validação

- Typecheck e build passaram. Não há script lint no package.json; `git diff --check` passou.
- 958 testes automatizados passaram (13 direcionados à nova interface): 0/1/3/10 integrantes, limite, consentimento, CRUD, cancelamento, dados não salvos ao foco, foto com falha/retry, contatos sem redirecionamento de chat e URLs de mapas.
- SQL/RLS executado no PostgreSQL 17 descartável, sem rede remota: dono/terceiro/anônimo, rascunho/publicado/suspenso, endereço privado/público, 1/3/10 e rejeição do 11º, reorder, conflito de versão, mídia pendente/pronta, finalização idempotente, falha preservando foto anterior, ocultação/remoção, ausência de permissões de equipe e auditoria privada. Infraestrutura Auth/Storage é bootstrap local; não equivale a upload HTTP real.
- Capturas da aplicação IMPLEMENTADA com fixtures identificadas, Chromium isolado e rede externa bloqueada. 320/360/375/390/393/430/768/1024/1280/1440; 40 combinações de 0/1/3/10; modal em viewport curta 393×360. Não é Safari/iPhone físico, Android físico, teclado real ou VoiceOver/TalkBack.
- Preview normal utiliza o projeto operacional, cujo SQL continua ausente: a tela informa indisponibilidade, sem criar dados. As capturas locais permitem revisão visual antes da autorização da expansão. Sem contas, membros, endereços ou mensagens fictícios em Production.

## Aceite real ainda pendente

Após autorização e expansão: conta legítima confirmada → escolher empresa correta → salvar integrante consentido → recarregar → sair/entrar → editar/ordenar/ocultar/remover; escolher foto consentida no iPhone e Android → prévia → cancelar sem envio → confirmar → testar recuperação de falha sem perder retrato. Conferir endereço privado, confirmação pública e destino real do Maps. Visitante verifica somente empresa publicada. O WhatsApp individual deve abrir o número consentido, e Mensagem pelo PEREIRÃO deve continuar na caixa central existente. Não enviar mensagem ou publicar empresa para antecipar esse ensaio.
