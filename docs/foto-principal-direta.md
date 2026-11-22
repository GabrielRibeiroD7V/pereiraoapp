# Foto principal direta — proposta compatível, não aplicada

PR #36, branch `feat/foto-principal-direta`, dependente de #35 para bio/retorno.
O PR #37 contém exclusivamente as duas renomeações de migrações já aplicadas.
Nenhum merge, migração remota ou deploy de produção autorizado nesta rodada. Apenas Previews automáticos são permitidos.

## Mudança de estratégia após revisão de compatibilidade

A versão inicial revogava UPDATE de avatar_path e colocava o caminho do retrato nesse campo, bloqueando #34/#35 e tornando um rollback de leitor incompatível. **Essa proposta foi substituída antes de qualquer aplicação remota.**

A expansão atual mantém dois ponteiros:

| Ponteiro | Escrita | Leitura |
|---|---|---|
| `avatar_path` | #34/#35 continuam escolhendo foto pronta do portfólio do próprio negócio. Trigger invoker valida vínculo, estado e objeto; RLS e grant existentes permanecem. | Clientes antigos continuam recebendo somente caminho do bucket legado ou null. |
| `profile_avatar_path` | Somente RPC validada do retrato; sem grant UPDATE ao cliente. | #36 prefere o retrato; se não houver, usa a foto legada. |

O retrato novo nunca é inserido em portfolio_items nem no bucket de trabalhos. Sua finalização não altera avatar_path, portanto não quebra leitores antigos. Clientes antigos mostram a última foto legada ou o ícone; o novo retrato aparece na versão nova. Isso é compatibilidade de transição, não atualização visual instantânea em runtimes antigos.

Uma nova escolha válida feita diretamente pela interface antiga limpa apenas o ponteiro novo, sem apagar o arquivo: a escolha explícita mais recente passa a valer. Ela também invalida uma finalização de retrato que esperava outro ponteiro (40001). Na exclusão de uma foto de trabalho pelo cliente novo, a RPC `clear_legacy` limpa só seu fallback e preserva o retrato separado.

A função do trigger é SECURITY INVOKER e distingue o papel efetivo `authenticated` de uma chamada à RPC privada SECURITY DEFINER. A autorização continua baseada em RLS e can_manage_business; não usa metadados editáveis do usuário. A RPC privada verifica o responsável antes da mudança; escrever profile_avatar_path diretamente continua proibido.

A RPC de busca anterior permanece **inalterada**. O #36 usa `search_public_businesses_profile`, um wrapper invoker que reutiliza os filtros/paginação anteriores e projeta o ponteiro efetivo. Se o recurso novo ainda não existir, o cliente recua para o contrato anterior apenas em erro específico de recurso ausente. Leitura de perfil e publicações também recua da coluna nova ausente, sem ocultar erro de autorização.

## Migração proposta

`supabase/migrations/20261122184357_business_profile_images.sql` permanece somente em revisão:
- Adiciona profile_avatar_path nullable sem reescrever os ponteiros legados.
- Cria business_profile_images com RLS, caminhos imutáveis, estados pending/ready e snapshot privado do ponteiro esperado.
- Cria bucket privado business-profile, WebP até 5 MiB; upload exige metadado pending e gestão do próprio negócio.
- Prepara/finaliza pela RPC, com lock, validação de metadados MIME/tamanho e comparação otimista. Prepare não troca foto.
- Leitura pública somente do retrato ready atualmente selecionado de negócio publicado. Plataforma revisa retratos prontos sem ganhar propriedade do negócio.
- Objetos imutáveis, sem overwrite/DELETE cliente. Arquivos anteriores/pending conservados; limpeza futura exige Storage API e autorização, nunca DELETE SQL em storage.objects.
- Não revoga o grant legado de avatar_path; não concede UPDATE de status ou da coluna nova.
- Usa lock_timeout de 5s para abortar aquisição de locks prolongada. Não requer janela funcional de fotos indisponíveis, embora DDL possa segurar brevemente um lock transacional. Se houver contenção, abortar/reagendar; não desabilitar proteções.

MIME/tamanho são controles do Storage e seus metadados, não antivírus/sniffing binário próprio. URLs assinadas duram 60s; uma já emitida pode durar até expirar após despublicação/troca.

## UI e retomada

Foto redonda e Adicionar fotografia abrem input no gesto do usuário, sem navegar para Fotos e trabalhos. Prévia e confirmação precedem qualquer upload. Cancelar não grava. Otimização existente aceita JPEG/PNG/WebP até 10 MiB de origem e produz WebP até 1600 px e 5 MiB. HEIC não tem conversão prometida.
Falha SQL na finalização mantém a foto anterior; resposta HTTP perdida é resultado ambíguo, conciliado repetindo o mesmo ID. Nenhum código inventa bio ou presume persistência operacional.

## Sequência revisada — ações futuras condicionadas à autorização

1. Concluir a aceitação da bio no Preview #35 pelo titular (docs/aceitacao-bio-preview.md). Continua pendente.
2. Revisar/integrar #37 com autorização; propagar sua base/nomenclatura aos PRs dependentes sem manter arquivos duplicados.
3. Com autorização de merge/deploy, integrar #35, aguardar READY e retarget/rebase do #36 sobre main; rever diff/CI e novo Preview. Nenhum desses passos foi executado nesta rodada.
4. Conferir projeto, histórico, hash aprovado e pending list: com #37 propagado, só a migração de retratos deve estar pendente. Não aplicar migrações antigas, repair ou include-all. A integração Supabase não recebe parâmetro de versão: combinar previamente aplicador versionado ou registro/renomeação para o ID real gerado; não mudar histórico silenciosamente.
5. Após autorização específica, aplicar exclusivamente a expansão. Conferir tabela, coluna, bucket, RPCs e triggers; RLS/grants: avatar legado UPDATE continua true, profile_avatar_path UPDATE false, status UPDATE false. Conferir IDs/estados dos negócios, trial, isenção e arquivos preservados.
6. **Só agora** o Preview #36 poderá testar upload real, com sessão legítima e consentimento para gravar o retrato no banco operacional compartilhado. Não requer publicação nem merge do #36. Testar também troca legada em produção e retorno ao Preview com a foto selecionada mais recentemente, sem simular dados comerciais.
7. Após teste físico e revisão administrativa sem publicação, autorizar integração do #36 e aguardar READY. Publicação de prestador, início dos 90 dias, busca e conversa reais exigem consentimento/autorização separados.

## Reversão compatível

- Erro durante a transação: verificar rollback/histórico antes de repetir. Resposta perdida exige inspeção, não reaplicação cega.
- Se a homologação do Preview falhar, manter produção #34/#35: seu leitor e sua troca de foto continuam funcionando. Preservar a expansão e o histórico.
- Se #36 já tiver sido integrado com autorização e precisar reverter, o leitor #34/#35 pode voltar para a foto legada/ícone, pois nunca recebeu caminhos do bucket novo. O retrato permanece privado/armazenado para retomada; não é apagado ou copiado para o portfólio.
- Para conter apenas o recurso novo, parar novas ações e aguardar requisições em andamento; mediante autorização, revogar EXECUTE de profile_photo_command pública/privada e adicionar policy restritiva que impeça INSERT em business-profile. Preservar a revisão administrativa e leitura. Não revogar avatar_path, não derrubar tabelas/buckets nem editar status/finanças. Revogação não cancela transação já iniciada: conferir estabilização.
- Não foi preparada reversão destrutiva de dados. Caso precise preservar um retrato novo também na UI antiga, isso exige build de leitor compatível; não contornar a separação com upload de foto pessoal no portfólio.

## Evidências e pendências

- Reconfirmação somente leitura: isenção e mensagens locais são integralmente iguais ao remoto após trim das extremidades. PR #37: dois renames 100%, zero linhas alteradas; 14 IDs locais = 14 remotos, pending vazio. Nenhum SQL remoto foi executado novamente.
- PostgreSQL 17 descartável, sem Docker: testes de troca por #34/#35 após expansão, persistência do fallback, RPCs de busca antiga/nova, troca concorrente, clear_legacy, isolamento, dados financeiros e aprovação protegidos. O schema mínimo de Storage não substitui HTTP/S3 real.
- SDK/HTTP e React simulados: fallback de recurso/coluna ausentes, retrato preferido, cancelamento, confirmação, respostas perdidas e erro. Verificar resultados do CI no PR, sem confundir com teste físico.
- Roteiro Safari do titular: seletor, cancelar, prévia, confirmar, falha/retomada, novo login, segundo plano e histórico. Nenhum teste físico ou upload no Storage operacional foi executado nesta rodada.
- Checkout/bloqueio financeiro desligados, isenção preservada e 90 dias somente na primeira publicação administrativa. Quatro rascunhos permanecem sem aprovação.
