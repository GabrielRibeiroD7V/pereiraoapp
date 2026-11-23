import { afterEach, describe, expect, it, vi } from 'vitest';
import { cropProfileImage, initialProfileCrop, profileCropRect } from './profileCrop';
import { encodeCanvasWebp } from './images';
vi.mock('./images', () => ({ encodeCanvasWebp: vi.fn(async () => new Blob(['square'], { type: 'image/webp' })) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('recorte quadrado para avatar circular', () => {
  it('permite trazer o rosto do topo numa imagem 9:16 para o enquadramento', () => {
    expect(profileCropRect(900,1600,initialProfileCrop)).toEqual({ x: 0, y: 350, size: 900 });
    expect(profileCropRect(900,1600,{ x:.5, y:0, zoom:1 })).toEqual({ x:0,y:0,size:900 });
  });
  it('zoom e pan nunca expõem pixels fora da imagem em retrato ou paisagem', () => {
    for (const [w,h] of ([[900,1600],[1600,900],[900,900]] as const)) for (const zoom of [1,2,3]) for (const x of [0,.5,1]) for (const y of [0,.5,1]) {
      const rect=profileCropRect(w,h,{x,y,zoom});
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x+rect.size).toBeLessThanOrEqual(w); expect(rect.y+rect.size).toBeLessThanOrEqual(h);
    }
    expect(() => profileCropRect(0,1600,initialProfileCrop)).toThrow();
    expect(() => profileCropRect(900,1600,{x:NaN,y:.5,zoom:1})).toThrow();
  });
  it('o arquivo enviado contém exatamente o retângulo escolhido sem distorcer ou ampliar', async () => {
    const close=vi.fn(), drawImage=vi.fn();
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:900,height:1600,close})));
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
    const output=await cropProfileImage(new Blob(['source']),{x:.5,y:.1,zoom:2});
    expect(drawImage).toHaveBeenCalledWith(expect.anything(),225,115,450,450,0,0,450,450);
    expect(output.type).toBe('image/webp'); expect(encodeCanvasWebp).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
  it('falha de canvas libera o bitmap e não cria um arquivo falso', async () => {
    const close=vi.fn(); vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:900,height:1600,close})));
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
    await expect(cropProfileImage(new Blob(['source']),initialProfileCrop)).rejects.toThrow('foto anterior foi mantida');
    expect(close).toHaveBeenCalledOnce(); expect(encodeCanvasWebp).not.toHaveBeenCalled();
  });
});
