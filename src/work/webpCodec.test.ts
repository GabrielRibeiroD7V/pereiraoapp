// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { simd } from 'wasm-feature-detect';
import encode, { init as initEncoder } from '@jsquash/webp/encode.js';
import decode, { init as initDecoder } from '@jsquash/webp/decode.js';

describe('codec WebP real com pixels sintéticos locais', () => {
  it('gera um arquivo WebP decodificável, com proporção e transparência', async () => {
    const variant = await simd() ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
    await initEncoder({ wasmBinary: await readFile(new URL(`../../node_modules/@jsquash/webp/codec/enc/${variant}`, import.meta.url)) });
    await initDecoder({ wasmBinary: await readFile(new URL('../../node_modules/@jsquash/webp/codec/dec/webp_dec.wasm', import.meta.url)) });
    const result = await encode({ width: 2, height: 1, data: new Uint8ClampedArray([255,0,0,255,0,0,255,0]) } as ImageData, { quality: 85 });
    expect(new TextDecoder().decode(new Uint8Array(result).slice(8,12))).toBe('WEBP');
    const image = await decode(result);
    expect([image.width,image.height]).toEqual([2,1]);
    expect(image.data[3]).toBe(255); expect(image.data[7]).toBe(0);
  });
});
