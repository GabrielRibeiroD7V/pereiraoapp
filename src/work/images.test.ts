import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SOURCE_BYTES, optimizeImage, validateImage } from './images';
import { emptyService, priceInCents, validateService } from './validation';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('preços e preparação de imagens', () => {
  it('valida reais em centavos sem arredondamento silencioso e aceita orçamento sem preço', () => {
    expect(priceInCents('150,99')).toBe(15099); expect(priceInCents('0.05')).toBe(5);
    expect(priceInCents('-1')).toBeNull(); expect(priceInCents('12,345')).toBeNull();
    expect(validateService({ ...emptyService, name: 'Serviço', categoryId: 'eletrica' })).toBeNull();
    expect(validateService({ ...emptyService, name: 'Serviço', categoryId: 'eletrica', pricingType: 'fixed' })).toContain('preço');
  });
  it('rejeita formatos não aceitos e arquivos acima de 10 MB antes de decodificar', () => {
    expect(() => validateImage(new Blob(['x'], { type: 'image/svg+xml' }))).toThrow('JPEG');
    expect(() => validateImage(new Blob([new Uint8Array(MAX_SOURCE_BYTES + 1)], { type: 'image/png' }))).toThrow('10 MB');
  });
  it('preserva proporção, reduz a 1600 px e libera a imagem decodificada', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 3200, height: 1600, close })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      expect(this.width).toBe(1600); expect(this.height).toBe(800); callback(new Blob(['optimized'], { type: 'image/webp' }));
    });
    expect((await optimizeImage(new File(['image'], 'image.png', { type: 'image/png' }))).type).toBe('image/webp');
    expect(close).toHaveBeenCalledOnce();
  });
  it('trata arquivo corrompido sem tentar enviá-lo', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failure')));
    await expect(optimizeImage(new File(['bad'], 'bad.png', { type: 'image/png' }))).rejects.toThrow('Não foi possível abrir');
  });
});
