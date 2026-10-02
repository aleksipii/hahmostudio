import { renderLayers } from './psd-render';
import type { PsdDocument, LayerNode } from './psd-model';
import type { Animation } from './animation-model';
export async function exportFrames(doc: PsdDocument, animation: Animation, signal: AbortSignal, progress: (frame: number) => void): Promise<Blob> {
 // Limit retained PNG memory; output is capped to 1080 px and 300 frames.
 if (animation.duration > 300) throw new Error('Kuvasarjavienti tukee enintään 300 ruutua. Lyhennä animaatiota vientiä varten.');
 const clone=(nodes:LayerNode[]):LayerNode[]=>nodes.map(n=>({...n,children:clone(n.children)}));
 const snapshot={...doc,layers:clone(doc.layers)};
 const { zip, strToU8 } = await import('fflate');
 const canvas = document.createElement('canvas'), output = document.createElement('canvas');
 const ratio = Math.min(1,1080 / Math.max(doc.width,doc.height)); output.width=Math.round(doc.width*ratio);output.height=Math.round(doc.height*ratio);
 const ctx=output.getContext('2d')!, files: Record<string,Uint8Array> = {}; let bytes=0;
 try {
  for(let i=0;i<animation.duration;i++) {
   signal.throwIfAborted(); renderLayers(canvas,snapshot,undefined,animation,i);ctx.clearRect(0,0,output.width,output.height);ctx.drawImage(canvas,0,0,output.width,output.height);
   const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('Ruudun tallennus epäonnistui.')),'image/png'));
   bytes+=blob.size;if(bytes>128*1024*1024)throw new Error('Kuvasarja on yli 128 Mt. Lyhennä animaatiota.');
   files[`ruutu_${String(i).padStart(4,'0')}.png`]=new Uint8Array(await blob.arrayBuffer());progress(i+1);
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  signal.throwIfAborted(); files['animaatio.json']=strToU8(JSON.stringify({fps:animation.fps,frames:animation.duration,width:output.width,height:output.height},null,2));
  const zipData=await new Promise<Uint8Array>((resolve,reject)=>zip(files,{level:0},(err,data)=>err?reject(err):resolve(data)));
  signal.throwIfAborted();return new Blob([new Uint8Array(zipData)],{type:'application/zip'});
 } finally { canvas.width=canvas.height=output.width=output.height=0; }
}
