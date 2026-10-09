import { readPsd, getLayerImageData, getLayerMaskImageData, getCompositeImageData, type Layer, type PixelData } from 'ag-psd';
import { blendModes, type LayerNode, type PsdDocument } from './psd-model';
export function validateHeader(buffer: ArrayBuffer) {
 if (buffer.byteLength < 26) throw new Error('Tiedosto ei ole kelvollinen PSD.');
 const view = new DataView(buffer);
 if (view.getUint32(0) !== 0x38425053) throw new Error('Valitse Photoshopin .psd-tiedosto.');
 if (view.getUint16(4) !== 1) throw new Error('PSB ei ole vielä tuettu. Tallenna tiedosto PSD-muotoon.');
 if (view.getUint16(22) !== 8) throw new Error('Käytä Photoshopissa 8 bittiä / kanava -asetusta.');
 if (![1, 3].includes(view.getUint16(24))) throw new Error('Käytä Photoshopissa RGB- tai harmaasävytilaa.');
 const height = view.getUint32(14), width = view.getUint32(18);
 if (!width || !height || width > 8192 || height > 8192 || width * height > 16_000_000)
  throw new Error('Kuva on liian suuri. Enimmäiskoko on 16 miljoonaa pikseliä ja 8192 px / sivu.');
}
export function readStructure(buffer: ArrayBuffer) {
 validateHeader(buffer);
 const psd = readPsd(buffer, { useRawData: true, skipThumbnail: true, skipLinkedFilesData: true, totalMemoryLimit: 256_000_000 });
 let pixels = psd.width * psd.height, count = 0;
 const check = (layers: Layer[], depth = 0) => {
  if (depth > 20) throw new Error('Tasoryhmiä on liian monta sisäkkäin (enintään 20).');
  for (const l of layers) {
   if (++count > 1000) throw new Error('Tässä versiossa voi avata enintään 1000 tasoa.');
   for (const b of [l, l.mask, l.realMask]) {
    if (!b) continue;
    const w = (b.right ?? 0) - (b.left ?? 0), h = (b.bottom ?? 0) - (b.top ?? 0);
    if (w < 0 || h < 0 || w > 16384 || h > 16384) throw new Error('Tiedoston tasokoko ei ole tuettu.');
    pixels += w * h;
   }
   if (pixels > 48_000_000) throw new Error('Tasojen yhteiskoko on liian suuri. Pienennä kuvaa tai yhdistä turhia tasoja Photoshopissa.');
   if (l.children) check(l.children, depth + 1);
  }
 };
 check(psd.children ?? []); return psd;
}
export function layerWarnings(l: Layer) {
 const ws: string[] = [];
 if (l.effects) ws.push('Tasotehosteita ei toisteta tasoesikatselussa.');
 if (l.clipping) ws.push('Leikkausmaskia ei toisteta tasoesikatselussa.');
 if (l.adjustment) ws.push('Säätötason vaikutusta ei toisteta.');
 if (l.vectorMask) ws.push('Vektorimaskia ei toisteta; rasteroi maski Photoshopissa.');
 if (l.mask && l.children) ws.push('Ryhmän maskia ei toisteta.');
 if (l.realMask) ws.push('Yhdistettyä vektori-/rasterimaskia ei toisteta.');
 if (l.mask?.userMaskFeather || l.mask?.userMaskDensity !== undefined) ws.push('Maskin pehmennystä tai tiheysasetusta ei toisteta.');
 if (l.blendMode && !blendModes[l.blendMode]) ws.push(`Sekoitustila ”${l.blendMode}” näytetään normaalina.`);
 return ws;
}
export function applyRasterMask(l: Layer, p: PixelData) {
 const mask = l.mask;
 if (!mask || mask.disabled || l.children) return p;
 const m = getLayerMaskImageData(l);
 const left = (mask.left ?? 0) + (mask.positionRelativeToLayer ? (l.left ?? 0) : 0);
 const top = (mask.top ?? 0) + (mask.positionRelativeToLayer ? (l.top ?? 0) : 0);
 for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
  const mx = x + (l.left ?? 0) - left, my = y + (l.top ?? 0) - top;
  const value = m && mx >= 0 && my >= 0 && mx < m.width && my < m.height ? m.data[(my * m.width + mx) * 4] : (mask.defaultColor ?? 255);
  const i = (y * p.width + x) * 4 + 3; p.data[i] = Math.round(p.data[i] * value / 255);
 }
 return p;
}
export async function parseDocument(buffer: ArrayBuffer, name: string, encode: (p: PixelData) => Promise<Blob>, progress: (done: number, total: number) => void): Promise<PsdDocument> {
 const psd = readStructure(buffer);
 const count = (ls: Layer[]): number => ls.reduce((s, l) => s + 1 + count(l.children ?? []), 0);
 const total = count(psd.children ?? []); let done = 0;
 const warnings = new Set<string>();
 const convert = async (ls: Layer[], parent = '', parentPath = ''): Promise<LayerNode[]> => {
  const nodes: LayerNode[] = [];
  for (let i = 0; i < ls.length; i++) {
   const l = ls[i], key = `${parent}/${i}`, name = l.name || 'Nimetön taso';
   const flags = layerWarnings(l); flags.forEach(w => warnings.add(w));
   const p = l.children ? undefined : getLayerImageData(l);
   const png = p && p.width && p.height ? await encode(applyRasterMask(l, p)) : undefined;
   const path = parentPath ? `${parentPath}/${name}` : name;
   const n: LayerNode = { key, psdId: l.id, name, path, kind: l.children ? 'group' : 'layer',
    left: l.left ?? 0, top: l.top ?? 0, width: p?.width ?? Math.max(0, (l.right ?? 0) - (l.left ?? 0)),
    height: p?.height ?? Math.max(0, (l.bottom ?? 0) - (l.top ?? 0)), opacity: l.opacity ?? 1,
    visible: !l.hidden, blendMode: l.blendMode ?? 'normal', png, warnings: flags, children: [] };
   progress(++done, total); n.children = await convert(l.children ?? [], key, path); nodes.push(n);
  }
  return nodes;
 };
 const layers = await convert(psd.children ?? []), composite = getCompositeImageData(psd);
 return { name, width: psd.width, height: psd.height, size: buffer.byteLength, layers,
  composite: composite ? await encode(composite) : undefined, warnings: [...warnings] };
}
