import { initializeCanvas, type PixelData } from 'ag-psd';
import { parseDocument } from './psd-import';
initializeCanvas((w, h) => new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement);
const encode = async (p: PixelData) => {
 const c = new OffscreenCanvas(p.width, p.height);
 c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
 return c.convertToBlob({ type: 'image/png' });
};
self.onmessage = async (e: MessageEvent<{buffer: ArrayBuffer; name: string}>) => {
 try {
  const doc = await parseDocument(e.data.buffer, e.data.name, encode, (done, total) => self.postMessage({ type: 'progress', done, total }));
  self.postMessage({ type: 'done', doc });
 } catch (err) { self.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'PSD:n avaaminen epäonnistui.' }); }
};
