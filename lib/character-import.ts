import type {PsdDocument} from './psd-model.ts';
import {createRig} from './rig-model.ts';
import {createAnimation} from './animation-model.ts';
import {createScene} from './scene-model.ts';
import {readProject} from './project-file.ts';
import {importPng} from './png-import.ts';
/** Uses the existing PSD worker without replacing the open project. */
export async function importCharacter(file:File,signal?:AbortSignal){
 if(signal?.aborted)throw new DOMException('Tuonti peruttu.','AbortError');
 if(/\.hahmo$/i.test(file.name))return readProject(file);
 let doc:PsdDocument;
 if(/\.png$/i.test(file.name))doc=await importPng(file,file.name);
 else if(/\.psd$/i.test(file.name)){
  if(file.size>100*1024*1024)throw Error('PSD on yli 100 Mt.');if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')throw Error('PSD-tuonti vaatii työpöytäsovelluksen tai OffscreenCanvas-tuen.');
  const buffer=await file.arrayBuffer();doc=await new Promise<PsdDocument>((resolve,reject)=>{
   const worker=new Worker(new URL('./psd.worker.ts',import.meta.url),{type:'module'});
   const stop=()=>{worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',abort);};
   const abort=()=>{stop();reject(new DOMException('PSD-tuonti peruttu.','AbortError'));};
   const timer=setTimeout(()=>{stop();reject(Error('PSD-tuonti kesti yli 90 sekuntia.'));},90000);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
   worker.onerror=()=>{stop();reject(Error('PSD-tuonti epäonnistui.'));};worker.onmessage=e=>{if(e.data.type==='error'){stop();reject(Error(e.data.message));}else if(e.data.type==='done'){stop();resolve(e.data.doc);}};
   worker.postMessage({buffer,name:file.name},[buffer]);
  });doc.sourcePsd=new Blob([file],{type:'application/octet-stream'});
 }else throw Error('Valitse .hahmo-, PSD- tai PNG-tiedosto.');
 const rig=createRig(doc);return{doc,animation:createAnimation(rig),scene:createScene(doc)};
}
