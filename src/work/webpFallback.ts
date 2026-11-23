// Codecs are first-party build assets. Pixels remain on this device, never sent to a server.
export function encodeWebpFallback(data: ImageData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./webp.worker.ts', import.meta.url), { type: 'module' });
    const timer = window.setTimeout(() => finish(), 30_000);
    function finish(blob?: Blob) {
      window.clearTimeout(timer); worker.terminate();
      if (blob) resolve(blob); else reject(new Error('WebP fallback failed'));
    }
    worker.onerror = () => finish();
    worker.onmessage = (event: MessageEvent<{ result?: ArrayBuffer; error?: boolean }>) => {
      const result = event.data.result;
      if (!(result instanceof ArrayBuffer) || !result.byteLength) { finish(); return; }
      const bytes = new Uint8Array(result);
      // Check the encoder output, not just a user-supplied MIME label.
      const signature = new TextDecoder('ascii');
      if (signature.decode(bytes.slice(0,4)) !== 'RIFF' || signature.decode(bytes.slice(8,12)) !== 'WEBP') { finish(); return; }
      finish(new Blob([result], { type: 'image/webp' }));
    };
    try { worker.postMessage({ pixels: data.data, width: data.width, height: data.height }, [data.data.buffer]); }
    catch { finish(); }
  });
}
