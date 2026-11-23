import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizeImage, MAX_UPLOAD_BYTES } from './images';
import { encodeWebpFallback } from './webpFallback';
vi.mock('./webpFallback', () => ({ encodeWebpFallback: vi.fn(async () => new Blob(['webp'], { type: 'image/webp' })) }));
const source = () => new File(['source'], 'photo.jpg', { type: 'image/jpeg' });
const close = vi.fn(), draw = vi.fn(), pixels = vi.fn(() => ({ width: 1600, height: 800, data: new Uint8ClampedArray(4) }));
beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 3200, height: 1600, close })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw, getImageData: pixels } as unknown as CanvasRenderingContext2D);
  vi.mocked(encodeWebpFallback).mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('preparação de fotos sem encoder WebP nativo', () => {
  it('converte PNG retornado pelo canvas em WebP local, preservando dimensões e orientação solicitada', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    const notice = vi.fn();
    const result = await optimizeImage(source(), notice);
    expect(result.type).toBe('image/webp'); expect(notice).toHaveBeenCalledWith('native-format');
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
    expect(encodeWebpFallback).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
  it('mantém conversão nativa bem-sucedida sem carregar codec alternativo', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['webp'], { type: 'image/webp' })));
    const notice = vi.fn(); await optimizeImage(source(), notice);
    expect(encodeWebpFallback).not.toHaveBeenCalled(); expect(notice).not.toHaveBeenCalled();
  });
  it('distingue resultado nulo de formato não suportado', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(null));
    const notice = vi.fn(); await optimizeImage(source(), notice);
    expect(notice).toHaveBeenCalledWith('native-null');
  });
  it('recupera exceção na exportação do canvas e identifica a condição', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => { throw new Error('encoder'); });
    const notice = vi.fn(); await optimizeImage(source(), notice);
    expect(notice).toHaveBeenCalledWith('native-error');
  });
  it('erro de desenho é específico e não atribuído ao tamanho', async () => {
    draw.mockImplementationOnce(() => { throw new Error('canvas'); });
    await expect(optimizeImage(source())).rejects.toThrow('não conseguiu desenhar');
    expect(encodeWebpFallback).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  });
  it('saída WebP acima de 5 MiB tem mensagem própria e não contorna o limite', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], { type: 'image/webp' })));
    await expect(optimizeImage(source())).rejects.toThrow('ultrapassou o limite de 5 MB');
  });
  it('aplica o mesmo limite à conversão alternativa', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(null));
    vi.mocked(encodeWebpFallback).mockResolvedValueOnce(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], { type: 'image/webp' }));
    await expect(optimizeImage(source())).rejects.toThrow('ultrapassou o limite de 5 MB');
  });
  it('falha da alternativa não acusa foto grande e permite escolher outra', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(null));
    vi.mocked(encodeWebpFallback).mockRejectedValueOnce(new Error('wasm unavailable'));
    await expect(optimizeImage(source())).rejects.toThrow('conversão compatível');
    expect(close).toHaveBeenCalledOnce();
  });
  it('HEIC é recusado antes de decodificar, sem promessa de suporte', async () => {
    await expect(optimizeImage(new File(['x'], 'photo.heic', { type: 'image/heic' }))).rejects.toThrow('HEIC/HEIF não é suportado');
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});
