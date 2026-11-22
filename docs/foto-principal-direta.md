# Foto principal direta — proposta para revisão

Branch: `feat/foto-principal-direta`. PR dependente de `fix/profile-bio-return` (#35).
Sem merge, aplicação remota ou deployment de produção nesta tarefa.

## Comportamento

- Na prévia do perfil na Conta, a foto redonda e **Adicionar fotografia** acionam um input de arquivo no próprio gesto do usuário, sem navegar para Fotos e trabalhos.
- Prévia, otimização já existente (JPEG/PNG/WebP até 10 MiB de origem, até 1600 px, WebP até 5 MiB), confirmação explícita e feedback de erro.
- Cancelar o seletor ou a prévia não prepara registros nem envia bytes. A seleção de arquivo não equivale a envio.
- Falha antes da finalização não troca o ponteiro anterior. Finalização SQL é transacional.
- Uma resposta perdida pode deixar o resultado desconhecido: repetir a mesma tentativa verifica o mesmo ID, sem fazer novo retrato ou forçar PATCH. Conflitos com outra seleção retornam 40001.
- O retrato não vira foto de trabalho, serviço ou publicação. As antigas fotos de portfólio e os ponteiros legados permanecem como estavam, sem classificação, migração ou remoção automática.
- A revisão administrativa mostra o retrato separadamente dos trabalhos. Não modifica regras de aprovação.

## Migração proposta — NÃO aplicada

Arquivo: `supabase/migrations/20261122184357_business_profile_images.sql`.

1. Criar `public.business_profile_images` (UUID, negócio/FK, caminho imutável, estado pending/ready, ponteiro anterior esperado e data). RLS habilitada, sem escrita direta do cliente.
2. Criar bucket **privado** `business-profile`, 5 MiB, somente WebP otimizado, caminhos `<business-id>/profile/<photo-id>.webp`.
3. RPC `profile_photo_command`: prepara metadados, verifica objeto/tipo/tamanho e finaliza a troca com lock e comparação do ponteiro anterior. Não aceita proprietário, status de publicação, permissões ou dados financeiros do frontend.
4. Revogar somente UPDATE de `businesses.avatar_path` ao cliente; preservar edição dos demais campos e revogação de `status`. Remover a escolha de retrato a partir do portfólio da UI nova.
5. Permitir leitura ao responsável; plataforma pode revisar retratos prontos. Visitantes só podem obter nova URL assinada do retrato pronto **atualmente selecionado** de um negócio publicado. Outros retratos/pending permanecem privados.
6. Bloquear overwrite e DELETE cliente dos objetos de retrato. A remoção do retrato atual apenas desassocia o ponteiro, com comparação otimista. Arquivos antigos e envios interrompidos são conservados; limpeza futura exige procedimento próprio via Storage API, nunca DELETE SQL em storage.objects.
7. Acrescentar RPC de leitura administrativa `admin_profile_photo`, protegida por autorização de plataforma. Nenhuma tabela de portfólio é usada para retratos.

As URLs assinadas expiram em 60 segundos; uma URL já emitida pode continuar válida até expirar após despublicação ou troca. Não é revogação instantânea de URLs emitidas.
A validação de MIME/tamanho usa os controles do bucket e metadados do Storage, como o pipeline existente; não afirma inspeção antivírus ou validação binária independente.

## Dependências e implantação futura

- Aceitação humana da bio descrita em `docs/aceitacao-bio-preview.md`.
- Revisão e merge autorizado do PR #35; depois retarget deste PR para main e rever diff/CI, pois o merge pode ser squash.
- Revisão e autorização **específicas** desta migração no projeto `yazdjiwaksamizrbqewq`. A tabela/bucket novos estão ausentes no remoto; a UI trata falta de RPC antes de enviar bytes.
- Aplicação e integração devem ser coordenadas: a revogação de avatar_path impede a escolha antiga pelo portfólio. Fazer backup manual ou reaplicar migrações anteriores não é parte desta proposta.
- Os 14 registros remotos existentes permanecem. As divergências já documentadas entre versões locais/remotas de isenção e mensagens não foram alteradas nem reaplicadas.
- O CLI Supabase local foi tentado e encerrado por SIGKILL; o arquivo proposto recebeu timestamp UTC local. Não foi executado db push nem apply_migration remoto.

## Validações e limites

- Typecheck, testes de aplicação, build e histórico local. Testes de seleção direta, cancelamento, prévia sem envio, clique repetido, falha/repetição, resposta tardia e separação do portfólio.
- SDK real com transporte HTTP simulado: bucket correto, sem PATCH de avatar, migração ausente, falha, resposta de upload perdida e conflito.
- PostgreSQL 17 descartável via socket local, sem Docker: aplicação sequencial das migrações e regressões SQL/RLS, incluindo isenção e mensagens; isolamento, estados, tamanho/MIME, privacidade de draft, retrato público atual, revisão administrativa, repetição e seleção obsoleta. Esses testes usam schema mínimo do Storage e não substituem upload HTTP/S3 real.
- Nenhum usuário, negócio, fotografia, assinatura ou mensagem criado, alterado ou removido no Supabase operacional. Snapshot somente leitura: 4 draft, 0 publicados, 0 assinaturas, 1 isenção, 1 foto de portfólio, 14 migrações; tabela/bucket propostos ausentes.
- Aviso de build preexistente: ProfilePreviewPage é importado estática e dinamicamente; não bloqueia build.

## Testes físicos e operacionais — titular

Não executados por automação; ficam com o titular, conforme combinado.

1. No Preview correto, autenticar e selecionar o próprio negócio.
2. No Safari/iPhone, tocar a foto e o botão. Confirmar abertura da Fototeca/Galeria/Arquivos conforme o sistema oferecer; não forçar câmera nem prometer todas as opções em todo navegador.
3. Cancelar o seletor: nenhum envio ou mudança. Escolher uma foto compatível; conferir prévia/orientação/proporções. Arquivo HEIC não suportado deve gerar orientação de erro; não prometer conversão.
4. Cancelar a prévia: nada muda. Confirmar: somente após o Storage ser autorizado/ativado deverá salvar o retrato; não deve criar item na grade de trabalhos.
5. Testar erro de rede, repetição da tentativa, recarga, novo login, troca entre seções e voltar/avançar. Conferir que a foto anterior permanece em falhas definitivas e que uma resposta perdida é conciliada por repetição.
6. Conferir sessão, visual atual e ausência do painel técnico de versão na navegação comum. Android e outros navegadores requerem validação própria.
7. Revisão com administrador legítimo: retrato e bio separados das fotos de trabalho. Não aprovar/publicar apenas para teste visual; primeira aprovação real exige consentimento e autorização, iniciando os 90 dias pela regra vigente.

Checkout real, bloqueio financeiro, isenção e início de gratuidade não são modificados por esta proposta.
