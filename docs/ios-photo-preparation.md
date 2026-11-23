# Preparação de foto principal: Safari e formatos de canvas

## Evidência e limite do diagnóstico

O titular relatou no iPhone, em produção, “Não foi possível otimizar esta foto. Escolha uma imagem menor.” e confirmação desativada. Isso localiza a falha antes de qualquer prepare/upload do Storage. O código anterior agrupava três resultados: null, MIME diferente de WebP e saída maior que 5 MiB. Portanto a captura não identifica qual dos três aconteceu e não prova excesso de tamanho.

Reprodução automatizada: o canvas devolve PNG para uma solicitação WebP; a versão de main lança exatamente a mensagem relatada e o novo teste falha. Com a correção o teste passa. Essa reprodução prova o defeito de compatibilidade e da mensagem, mas NÃO prova que esse foi o resultado do iPhone. O Safari físico ainda deverá confirmar a condição.

Referências: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob documenta PNG quando o formato solicitado não é suportado e a possibilidade de null. https://github.com/jamsinclair/jSquash/tree/main/packages/webp documenta o encoder libwebp/WebAssembly e init/locateFile.

## Implementação e compatibilidade

Mantém WebP de verdade: bucket, RPC, extensão e validação existentes exigem WebP. Não renomeia JPEG/PNG e não expande o Supabase. @jsquash/webp 1.5.0, Apache-2.0, versão exata/lockfile; codec e WASM servidos pelo próprio build. Não usa serviço externo de conversão. O caminho nativo continua preferido; o fallback usa Worker só quando o canvas não exporta WebP, fora da thread da interface, com encerramento e limite de 30 segundos. O build emite variantes WASM de aproximadamente 275/337 KiB; somente a variante escolhida é solicitada. Não é um teste de performance física.

Lê orientação EXIF através de createImageBitmap(imageOrientation: from-image), mantém proporção, não amplia, limita lado a 1600, fonte a 10 MiB e 40 milhões de pixels, saída a 5 MiB e qualidade 85. HEIC/HEIF NÃO é suportado: rejeita explicitamente e orienta exportar JPEG. A orientação física de fotos da Fototeca, assim como particularidades do Safari, continua pendente.

Erro de desenho, falha da conversão, formato inválido e excesso de tamanho têm explicações próprias. Informa localmente se o canvas gerou outro formato, null ou exceção; sem telemetria da foto. Escolher outra foto usa input dentro do dialog para não depender de clicar em um elemento inert fora do modal. Cancelar/erro não chama onSaved nem upload e preserva o retrato atual. O upload continua apenas após confirmação. O helper é compartilhado com fotos de trabalhos; mesmas proteções e contrato WebP preservados.

Offline: a conversão alternativa pode precisar baixar os arquivos de código do build. Se não estiverem disponíveis, explica a falha e mantém a foto anterior; não limpa cache ou sessão, nem guarda fotos no service worker.

## Verificações

Regressão falha na main para canvas→PNG, passa após correção. Casos separados: WebP nativo, PNG inesperado, null, exceção de exportação, erro de desenho, saída acima de 5 MiB nos dois caminhos, erro do fallback e HEIC. Picker: prévia, cancelamentos, foto anterior, confirmação e separação do portfólio. Um teste executa o encoder e decoder WASM reais em Node com pixels sintéticos e confere dimensão, assinatura WebP e transparência. Não equivale a execução do Worker no Safari nem upload no Supabase.

## Ensaio físico no Preview normal

1. Safari/iPhone: abrir o Preview deste PR com a conta legítima e o rascunho consentido. Registrar origem e versão exibidas se houver suspeita de aba antiga; não limpar dados.
2. Tocar na foto, selecionar JPEG/PNG/WebP consentido. Anotar se aparece a nota de outro formato, resultado vazio ou erro nativo. Se não aparece nota e prepara, houve caminho nativo.
3. Conferir orientação/proporção e prévia; cancelar primeiro não altera nada.
4. Nesta rodada, parar na prévia e cancelar: não há autorização para alterar dados remotos. O upload operacional, persistência após recarga/novo login e separação do portfólio exigem ensaio posterior autorizado com a imagem consentida. Não foram realizados nesta revisão.
5. Se falhar, informar a mensagem e a nota da preparação. Sem senha, token, foto ou dados privados no chat.

Sem migração, publicação de prestador, gratuidade, cobrança ou merge.

Ensaio adicional: Worker executado de fato no navegador local de desktop com pixels sintéticos; carregou WASM do servidor local, gerou WebP de 80 bytes e decodificou em 32×16. Nenhum upload remoto. Não é Safari/iPhone físico.
