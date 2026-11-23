export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type ImagePreparationNotice = 'native-format' | 'native-null' | 'native-error';
export function validateImage(file: Blob) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Formato não aceito. Escolha JPEG, PNG ou WebP. HEIC/HEIF não é suportado; exporte a foto como JPEG.');
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error('Escolha uma imagem de até 10 MB.');
}
export async function optimizeImage(file: File, onFallback?: (reason: ImagePreparationNotice) => void): Promise<Blob> {
  validateImage(file);
  let image: ImageBitmap;
  try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Não foi possível abrir esta imagem. Escolha outro arquivo JPEG, PNG ou WebP.'); }
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw new Error('Esta imagem tem resolução muito alta. Escolha uma versão menor.');
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } catch { throw new Error('Seu navegador não conseguiu desenhar esta foto. Nenhuma foto foi alterada; escolha outra imagem.'); }
    let blob: Blob | null = null, reason: ImagePreparationNotice | undefined;
    try {
      blob = await new Promise<Blob | null>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Canvas timeout')), 10_000);
        try { canvas.toBlob(value => { window.clearTimeout(timer); resolve(value); }, 'image/webp', .85); }
        catch (error) { window.clearTimeout(timer); reject(error); }
      });
      if (!blob || !blob.size) reason = 'native-null';
      else if (blob.type !== 'image/webp') reason = 'native-format';
    } catch { reason = 'native-error'; }
    if (reason) {
      onFallback?.(reason);
      try {
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const { encodeWebpFallback } = await import('./webpFallback');
        blob = await encodeWebpFallback(pixels);
      } catch { throw new Error('A conversão compatível desta foto não pôde ser concluída. Nenhuma foto foi alterada. Confira a conexão e escolha outra foto JPEG, PNG ou WebP.'); }
    }
    if (!blob || blob.type !== 'image/webp' || !blob.size) throw new Error('A conversão não gerou uma foto WebP válida. Escolha outra imagem.');
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('A foto preparada ultrapassou o limite de 5 MB. Escolha uma imagem com menos detalhes ou resolução menor.');
    return blob;
  } finally { image.close(); }
}
