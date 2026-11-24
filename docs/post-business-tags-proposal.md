# Proposta: mencionar empresas em publicações

PR dependente do compositor #51; somente modelo SQL testado e desenho de interação, sem controles ativos no aplicativo e sem aplicação remota. Não bloqueia a correção visual #50 nem o compositor #51. Nenhuma empresa fictícia foi criada no operacional.

## Significado e apresentação proposta

“Referências a empresas (opcional)” significa que o autor vinculou um negócio cadastrado; NÃO comprova parceria, contratação, participação no projeto, endosso ou consentimento da empresa. Não oferece selo, notificação automática ou criação de conversa. Exibir “Empresas mencionadas pelo autor — não indica parceria ou verificação”. O texto e os links ficam abaixo da legenda no detalhe do trabalho; o card compacto da Home pode mostrar “Empresas mencionadas” abrindo o detalhe, sem inventar contagens.

Depois de escolher fotos e preencher legenda, o compositor poderá abrir um seletor compacto: pesquisar por pelo menos 2 caracteres, mostrar no máximo 10 empresas reais publicadas, selecionar até 5, remover chips antes de confirmar. Pesquisa literal por nome (não curingas), incluindo apenas id/nome/slug públicos. Sem campo de texto livre para inventar empresa e sem permitir marcar o próprio negócio. Somente empresas, não autônomos, nesta proposta. Navegação /prestadores/{slug} existente. Rotular para acessibilidade; lista/teclado cabem no Modal corrigido em #50. Antes de habilitar, a interface deve repetir a observação de ausência de endosso. Se o produto exigir aprovação pela empresa marcada, este modelo NÃO equivale a consentimento: exigirá um fluxo próprio e outra revisão.

## Modelo e permissões propostos

`20261124023609_work_post_business_tags.sql` cria work_post_business_tags: FK composta para post/negócio autor, FK restrita para empresa alvo, ordem 0–4, autor/data de auditoria. Não armazena nomes duplicados. Índices nas FKs e PK post/alvo impedem duplicação; sem políticas de INSERT/UPDATE/DELETE e sem grants diretos de escrita. Nem created_by nem created_at têm grant de leitura ao cliente.

RPC search_work_post_companies verifica gestão do negócio autor e retorna somente empresas publicadas/não suspensas; 2–80 caracteres, limite 10. RPC set_work_post_companies verifica gestão/conta e pertencimento do post, tranca o negócio/post, valida até 5 alvos distintos; a substituição é transacional e idempotente. Se alterar post já público, retira somente o post de circulação até nova publicação explícita, preservando fotos e o negócio. Nunca publica nem altera trial. Não escreve nos negócios mencionados. Donos/admins do negócio podem gerenciar; administração da plataforma não ganha propriedade.

RLS do vínculo: público somente se post e negócio autor públicos com mídia pronta e empresa alvo ainda publicada/não suspensa. A retirada ou suspensão do alvo oculta o vínculo; não revela que existe um rascunho. Responsável pode ver seus vínculos apenas para alvos ainda públicos, remover referências antigas por substituição vazia sem recuperar seus dados. Uma marcação privada não vira visível por si só. Não concede acesso a retratos, portfólio ou documentos do alvo.

## Preflight e dependências — NÃO executado

1. Conferir projeto yazdjiwaksamizrbqewq, head/hash final, histórico e ausência da tabela/RPCs. Esta rodada confirmou por dry-run que há duas propostas pendentes: primeiro 20261124022206_post_direct_photos.sql (#51), depois 20261124023609_work_post_business_tags.sql. Nenhuma migração anterior seria reaplicada. NÃO autorizar/aplicar em lote por inferência.
2. A expansão #51 exige decisão própria e homologação real de Storage; a marcação deve ter autorização separada. Antes desta segunda aplicação, repetir dry-run e prosseguir apenas se listar exclusivamente o SQL de marcações. Parar em divergência. Sem seeds, roles ou Vault.
3. Aplicação transacional com lock_timeout 5s; nenhuma carga inicial, nenhuma alteração de registros existentes. RLS e RPCs legadas não são substituídas. Interface atual ignora tabela nova, portanto expansão compatível antes do frontend.
4. Após autorização/aplicação, verificar histórico/FKs/grants/policies e contagens somente em leitura; preparar ensaio com sessão legítima e alvos publicados consentidos. O operacional atualmente não oferece um conjunto público para homologação: não publicar empresas de teste para destravar.
5. Habilitar UI somente após revisão do desenho e validação das APIs; apresentar novo Preview com controles. Este PR não anuncia marcação disponível nem afeta posts existentes.

Contenção/reversão: manter expansão e vínculos, reverter/desabilitar somente controles novos no frontend. Se necessário, revogar EXECUTE das duas RPCs em operação separada autorizada; leitura pública segue RLS. Não apagar vínculos, tabela, históricos ou Storage. Rollback de aplicação em falha de transação é automático; falha de busca/salvamento deve manter composição e permitir tentar novamente, sem publicar post ou gravar parcialmente tags.

## Validação executada

PostgreSQL 17 descartável sem Docker: aplicação sequencial das propostas; busca literal/limite, empresa draft/inativa oculta, proprietário autorizado, terceiro/anônimo bloqueados, escrita direta e exposição do autor bloqueadas, duplicação/limite, idempotência, leitura somente com post completo público, retirada de alvo, edição retira post sem apagar fotos. Dados locais sintéticos, transação rollback; não equivale a teste operacional. Não foi implementada nem homologada a seleção visual de empresas no iPhone.

SHA-256 proposto: `b367999d1ab136c0ac8b2baefe341783d83040749e4066b2ba71d406b115da28`.
