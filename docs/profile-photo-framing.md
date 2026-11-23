# Enquadramento da foto principal

O titular relatou no iPhone que a foto foi aceita após #45, mas uma imagem 9:16 mostrou apenas parte do cabelo no avatar. O relato confirma a necessidade de enquadramento; não é uma medição de upload/Supabase nesta rodada. O código anterior exibia uma imagem inteira com object-fit:contain antes de salvar e não tinha controles de recorte. O avatar circular poderia cortar outra área.

O novo passo usa prévia circular, arraste com Pointer Events, zoom 1–3, controles de posição horizontal/vertical e redefinição. As coordenadas são compartilhadas entre a imagem na prévia e o recorte quadrado enviado: a máscara circular não deforma os pixels. Sem reconhecimento facial automático ou seleção arbitrária de rosto. A imagem original da galeria não é modificada.

Primeiro usa a preparação compatível de #45 (orientação from-image, entrada JPEG/PNG/WebP até 10 MiB/40 MP, lado máximo 1600). Só ao confirmar cria o recorte quadrado, sem ampliar e com lado máximo 1024, e o codifica em WebP pelo mesmo encoder nativo/fallback local. Preserva limite 5 MiB, bucket privado, RPC e separação do portfólio. Nenhuma migração. HEIC/HEIF continua sem suporte.

Cancelar não envia. Erro de prévia/recorte impede upload e conserva o retrato anterior. Enquanto envia, controles ficam bloqueados. Se houver resultado de upload incerto, nova tentativa usa o mesmo recorte, bytes e ID; não permite ajustar a seleção já tentada silenciosamente. Para outro enquadramento, cancelar e selecionar novamente. Não há remoção ou limpeza automática de objetos/pendências.

Validação direcionada: recorte de 9:16, paisagem e quadrado; coordenadas nos limites e zoom; CSS da prévia compatível com o mesmo retângulo; gestos de arraste; sliders acessíveis; erro e cancelamento; envio dos bytes recortados; tentativa repetida preservando ID/bytes; falha antes de upload mantendo retrato. Os testes da conversão #45 continuam cobrindo WebP nativo/fallback, formatos, tamanho e erro de canvas.

Teste físico pendente: Preview normal no Safari/iPhone → selecionar uma foto consentida → mover rosto para dentro do círculo → ajustar zoom → conferir bordas → cancelar. O upload real do novo recorte e sua persistência dependem de ensaio autorizado; nenhum registro remoto foi alterado nesta revisão. A eventual integração exige decisão separada, sem merge automático.
