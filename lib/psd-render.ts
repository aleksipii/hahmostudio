import { blendModes, type LayerNode, type PsdDocument } from './psd-model';
export function renderLayers(canvas: HTMLCanvasElement, doc: PsdDocument, solo?: string) {
 const ratio = Math.min(1, 2048 / Math.max(doc.width, doc.height));
 canvas.width = Math.round(doc.width * ratio); canvas.height = Math.round(doc.height * ratio);
 const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height);
 const paint = (nodes: LayerNode[], target: CanvasRenderingContext2D, selected = false) => {
  for (const n of nodes) {
   const within = selected || n.key === solo;
   if (!solo && !n.visible) continue;
   if (solo && !within && !solo.startsWith(n.key + '/')) continue;
   target.save(); target.globalAlpha *= n.opacity;
   target.globalCompositeOperation = blendModes[n.blendMode] ?? 'source-over';
   if (n.kind === 'group') {
    if (n.blendMode === 'pass through' && n.opacity === 1) paint(n.children, target, within);
    else {
     const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
     paint(n.children, c.getContext('2d')!, within); target.drawImage(c, 0, 0); c.width = c.height = 0;
    }
   } else if (n.image) target.drawImage(n.image, n.left * ratio, n.top * ratio, n.width * ratio, n.height * ratio);
   target.restore();
  }
 };
 paint(doc.layers, ctx);
}
