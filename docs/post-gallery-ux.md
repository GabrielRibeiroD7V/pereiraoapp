# Fotos de publicação: seleção e prévia completas

Dependente da correção de detalhe/retorno #53. Sem migração nova e sem dados operacionais de teste.

Botão de escolher/acrescentar fotos agora aparece antes das miniaturas e permanece acessível também na etapa de legenda. Contagem real 0–6, limite explícito, input multiple nas duas entradas. Miniaturas permitem remover/ordenar; legenda primeiro, título depois (continua obrigatório de 2–120 caracteres por CHECK e RPC existentes). Nenhuma promessa de acesso irrestrito à Fototeca: somente arquivos explicitamente selecionados no seletor do aparelho.

A prévia passa de capa isolada para carrossel com todas as fotos na ordem, gesto horizontal nativo e setas/posição reais. O detalhe do rascunho usa o mesmo carrossel. Cancelar antes de confirmar mantém zero gravações. Uma foto pronta do portfólio pode ser usada num post por “Usar esta foto em uma publicação”; preserva vínculo existente via work_post_images, sem duplicar o objeto. Não converte automaticamente, não copia retrato para trabalho e não publica post/negócio. Título/legenda podem ser editados antes de confirmar.

A existência de input multiple não prova comportamento de Safari físico. O relato UFMS foi identificado como foto de portfólio, não post: pode ter ocorrido uso da entrada de foto de trabalho, mas isso NÃO comprova a causa de não encontrar o botão no iPhone. O botão anterior ficava depois da grade e sumia na etapa de legenda; essa lacuna de interface foi corrigida. Ensaios locais 1/2/3/6 fotos, acrescentar depois de entrar na legenda, voltar/remover/ordenar, cancelar, reutilizar portfólio e carrossel passaram. Sem repetir upload operacional; teste físico depende do titular.

Um modelo foto+legenda sem título requer migração futura dos CHECKs e RPCs e compatibilidade com leitores existentes; não é parte deste PR. Sem SQL proposto/aplicado nesta rodada para esse fim.

Complemento do titular: o carrossel horizontal passa a ser a apresentação principal em cada post da Home/feed público, no detalhe público, no feed privado do proprietário e no modal completo, além da prévia do compositor. É o mesmo componente, sem empilhar as imagens como leitura principal. Todas continuam na ordem salva. Na viewport visual curta, o toolbar e as ações deixam de ser sticky para não cobrir campos; rolam dentro do modal com fechar sempre acessível. Capturas em docs/evidence/content-review/README.md.
