import {layerPixels} from './layer-pixels.ts';
import {paintCutout3D,type Cutout3D} from './cutout-3d.ts';
import {animationTransforms} from './animation-transform.ts';
import { type Animation, type Pose } from './animation-model.ts';
import { blendModes, type LayerNode, type PsdDocument } from './psd-model.ts';
export function renderLayers(canvas: HTMLCanvasElement, doc: PsdDocument, solo?: string, animation?: Animation, frame = 0, draft?: { key: string; pose: Pose; poses?: Record<string,Pose> }) {
 const ratio = Math.min(1, 2048 / Math.max(doc.width, doc.height));
 canvas.width = Math.round(doc.width * ratio); canvas.height = Math.round(doc.height * ratio);
 const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height);
 const transforms=animation?animationTransforms(animation,frame,draft):undefined;
 const activeParts=!animation&&doc.quick?.views?new Set(Object.values(doc.quick.roles)):undefined;
 const paint = (nodes: LayerNode[], target: CanvasRenderingContext2D, selected = false) => {
  for (const n of nodes) {
   if(n.kind==='layer'&&activeParts&&!activeParts.has(n.key)&&!n.key.startsWith('edit-'))continue;
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
   } else if (layerPixels(n)) {
    const transform=transforms?.get(n.key);
    if(transform){target.globalAlpha*=transform.opacity;target.transform(transform.a,transform.b,transform.c,transform.d,transform.e*ratio,transform.f*ratio);}
    target.drawImage(layerPixels(n)!, n.left * ratio, n.top * ratio, n.width * ratio, n.height * ratio);
   }
   target.restore();
  }
 };
 paint(doc.layers, ctx);
}

/** Draw library animation in stage coordinates, so moving limbs aren't clipped to the source PSD canvas. */
export function paintAnimatedLayers(ctx:CanvasRenderingContext2D,doc:PsdDocument,animation:Animation,frame:number,draft?:{key:string;pose:Pose;poses?:Record<string,Pose>},depth?:Cutout3D){if(depth?.enabled){paintCutout3D(ctx,doc,animation,frame,depth,draft);return;}
 const transforms=animationTransforms(animation,frame,draft);
 const paint=(nodes:LayerNode[],target:CanvasRenderingContext2D)=>{for(const n of nodes){if(!n.visible)continue;target.save();target.globalAlpha*=n.opacity;target.globalCompositeOperation=blendModes[n.blendMode]??'source-over';if(n.kind==='group'){
  if(n.blendMode==='pass through'&&n.opacity===1)paint(n.children,target);
  else{const layer=document.createElement('canvas');layer.width=target.canvas.width;layer.height=target.canvas.height;const isolated=layer.getContext('2d')!;isolated.setTransform(target.getTransform());paint(n.children,isolated);target.setTransform(1,0,0,1,0,0);target.drawImage(layer,0,0);layer.width=layer.height=0;}
 }else if(layerPixels(n)){const t=transforms.get(n.key);if(t){target.globalAlpha*=t.opacity;target.transform(t.a,t.b,t.c,t.d,t.e,t.f);}target.drawImage(layerPixels(n)!,n.left,n.top,n.width,n.height);}target.restore();}};paint(doc.layers,ctx);
}
