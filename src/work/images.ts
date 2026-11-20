export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function validateImage(file: Blob) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error('Escolha uma imagem de até 10 MB.');
}
export async function optimizeImage(file: File): Promise<Blob> {
  validateImage(file);
  let image: ImageBitmap;
  try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Não foi possível abrir esta imagem. Escolha outro arquivo JPEG, PNG ou WebP.'); }
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw new Error('Esta imagem tem resolução muito alta. Escolha uma versão menor.');
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob || blob.type !== 'image/webp' || blob.size > MAX_UPLOAD_BYTES) throw new Error('Não foi possível otimizar esta foto. Escolha uma imagem menor.');
    return blob;
  } finally { image.close(); }
}
