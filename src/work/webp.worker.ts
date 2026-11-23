import encode, { init } from '@jsquash/webp/encode.js';
import wasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import simdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';

self.onmessage = async (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number }>) => {
  try {
    await init({ locateFile: (path: string) => path.includes('simd') ? simdWasmUrl : wasmUrl });
    const { pixels, width, height } = event.data;
    const result = await encode(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), { quality: 85 });
    self.postMessage({ result }, { transfer: [result] });
  } catch { self.postMessage({ error: true }); }
};
