# Contas pessoais e feed único — proposta dependente do #75

Base: `feat/owner-publication`, head `1eed66b7242ba3f79344458a24474a54cf7d4a94`.

## Contrato

Qualquer conta habilitada e com e-mail confirmado publica sem negócio ou serviço. Conta → Suas publicações → Adicionar publicação abre o seletor nativo, permite 1–6 fotos, ordenação, título opcional, legenda, prévia e confirmação. Selecionar/cancelar não envia. Salvar rascunho envia apenas após confirmação e não publica; Publicar é ação explícita e disponibiliza imediatamente o conteúdo válido.

Página própria `/publicacoes/:id`; perfil pessoal `/pessoas/:autor`; lista privada `/conta/publicacoes`. Autor vê rascunhos e controles; `?visao=visitante` oculta gestão sem alterar autorização. Terceiro não lê rascunho pela RPC, tabela ou Storage. Sem credenciais verificadas, serviços ou contatos profissionais inventados.

Feed público une posts pessoais e profissionais, com data de publicação persistida, paginação keyset e reconsulta ao retornar. Post profissional independe da publicação do negócio: mostra apenas composição/autor; serviços, bio, contatos e fotos não selecionadas do negócio privado não entram na projeção.

## SQL e preflight

Projeto exclusivo: `yazdjiwaksamizrbqewq`.

1. `20261125004446_owner_publication.sql` (#75), SHA-256 `eca2e53116b3a87f2b9adb6f05e638a56f235ab8f091af1949209850940990c0`.
2. `20261125005220_personal_posts.sql`, SHA-256 `0cd40289c0074e8c364d0d57b6bfa225610194c0ee2a62207e76dafc3b7e2575`.

A segunda depende das funções de autoria/moderação/denúncia da primeira. Dry-run do ramo pai listou somente a primeira; o ramo dependente lista as duas, em ordem. Não confundir a lista cumulativa com dry-run exclusivo da segunda. Reconfirmar histórico/hash e lista antes de qualquer aplicação; aplicar somente com autorização específica. Nenhuma aplicada nesta entrega.

Adições: personal_posts, personal_post_images, moderação privada e bucket privado personal-posts (WebP, 5 MiB por arquivo otimizado). Sem UPDATE/INSERT/DELETE direto de clientes; RPC deriva o autor de auth.uid, valida e-mail no Auth, bloqueios, propriedade, mídia real e limites. Até seis imagens selecionadas, doze preparadas por rascunho, trinta criações/dia e dez publicações/hora por conta. RLS separa dono de visitante; ACLs das funções são explícitas. Administração só revisa posts pessoais que já foram públicos, sem abrir rascunhos nunca publicados.

## Recuperação, privacidade e contenção

Retry conserva IDs de post/fotos: resposta perdida de upload verifica finalização do mesmo objeto, sem gerar outro arquivo. Fotos ready de upload interrompido são recuperáveis na lista privada. Exclusão retira o post antes de remover pelo Storage; metadados só são removidos quando os objetos já não existem. Falha mantém exclusão pendente para repetir. Não excluir storage.objects por SQL.

URLs assinadas expiram em 60 segundos; retirada/moderação impede novas autorizações, mas uma URL já emitida pode funcionar até expirar. Não há cache do service worker para URLs assinadas ou dados privados. Limpar objetos staged antigos exige procedimento próprio; não há exclusão automática de dados operacionais.

Código atual continua funcionando após a expansão. Não publicar a interface dependente antes das duas migrações validadas. Depois, integrar pai → filho → visual, atualizando bases/diffs e CI. Se houver falha de permissão, interromper rollout; contenção por revogação das novas RPCs de escrita em SQL específico autorizado, sem restaurar triggers financeiros nem apagar posts/fotos/auditoria. Reverter somente frontend não revoga APIs.

## Evidências e limites

Testes SQL em PostgreSQL nativo descartável usam duas identidades e administrador: isolamento, e-mail, publicação imediata, feed misto com negócio draft, cursor, Storage, moderação, suspensão, denúncia, recuperação e exclusão. Testes React/SDK cobrem seletor/cancelamento, ordenação, limite, confirmação, retry com IDs iguais, prévia sem gestão e refresh. São testes locais, não homologação com pessoas reais ou Safari físico.

Produção preservada: quatro negócios draft, UFMS draft, zero assinaturas/ativações. Nenhum post/usuário/arquivo foi criado remotamente. Conversas profissionais existentes continuam; o caminho atual ainda exige negócio público para iniciar contato. Essa limitação precisa ser tratada para contato entre contas pessoais, sem confundir feed com conversa operacional comprovada.
