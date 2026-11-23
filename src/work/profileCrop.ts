import { encodeCanvasWebp } from './images';
export interface ProfileCrop { x: number; y: number; zoom: number }
export const initialProfileCrop: ProfileCrop = { x: .5, y: .5, zoom: 1 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function profileCropRect(width: number, height: number, crop: ProfileCrop) {
  if (![width, height, crop.x, crop.y, crop.zoom].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Dimensões inválidas para enquadrar a foto.');
  const size = Math.min(width, height) / clamp(crop.zoom, 1, 3);
  return { x: (width - size) * clamp(crop.x, 0, 1), y: (height - size) * clamp(crop.y, 0, 1), size };
}
export async function cropProfileImage(file: Blob, crop: ProfileCrop): Promise<Blob> {
  let image: ImageBitmap;
  try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Não foi possível abrir a foto para enquadrar. Escolha outra imagem.'); }
  const canvas = document.createElement('canvas');
  try {
    const rect = profileCropRect(image.width, image.height, crop);
    canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.floor(rect.size)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar o enquadramento. Sua foto anterior foi mantida.');
    context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, canvas.width, canvas.height);
    return await encodeCanvasWebp(canvas);
  } finally { image.close(); canvas.width = canvas.height = 0; }
}
