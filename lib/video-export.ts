import {createAudioContext} from './browser-audio';
import {renderLayers} from './psd-render';import type {PsdDocument,LayerNode} from './psd-model';import type {Animation} from './animation-model';
export async function exportVideo(doc:PsdDocument,animation:Animation,signal:AbortSignal,progress:(n:number)=>void,audioUrl?:string):Promise<Blob>{
 if(typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('Selain ei tue videovientiä. Käytä ajantasaista Chromea tai PNG-kuvasarjaa.');
 if(animation.duration/animation.fps>30)throw new Error('Videovienti tukee enintään 30 sekunnin animaatioita.');
 const clone=(nodes:LayerNode[]):LayerNode[]=>nodes.map(n=>({...n,children:clone(n.children)}));const snapshot={...doc,layers:clone(doc.layers)};
 const source=document.createElement('canvas'),output=document.createElement('canvas'),ratio=Math.min(1,1080/Math.max(doc.width,doc.height));output.width=Math.round(doc.width*ratio);output.height=Math.round(doc.height*ratio);const ctx=output.getContext('2d')!;
 const draw=(frame:number)=>{renderLayers(source,snapshot,undefined,animation,frame);ctx.clearRect(0,0,output.width,output.height);ctx.drawImage(source,0,0,output.width,output.height);};draw(0);
 const stream=output.captureStream(animation.fps);let audio:HTMLAudioElement|undefined,context:AudioContext|undefined,request=0;
 try{
  signal.throwIfAborted();
  if(audioUrl){audio=new Audio(audioUrl);audio.preload='auto';await new Promise<void>((resolve,reject)=>{audio!.onloadedmetadata=()=>resolve();audio!.onerror=()=>reject(new Error('Äänitiedoston avaaminen epäonnistui.'));signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});context=createAudioContext();const node=context.createMediaElementSource(audio),dest=context.createMediaStreamDestination();node.connect(dest);stream.addTrack(dest.stream.getAudioTracks()[0]);await context.resume();}
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('WebM-videomuoto ei ole tuettu tässä selaimessa.');
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000}),chunks:Blob[]=[];let bytes=0;
  const blob=await new Promise<Blob>((resolve,reject)=>{
   const abort=()=>{if(recorder.state!=='inactive')recorder.stop();reject(new DOMException('Vienti peruttu','AbortError'));};signal.addEventListener('abort',abort,{once:true});
   recorder.ondataavailable=e=>{bytes+=e.data.size;if(bytes>128*1024*1024){recorder.stop();reject(new Error('Video on yli 128 Mt.'));}else if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>reject(new Error('Videon tallennus epäonnistui.'));recorder.onstop=()=>{signal.removeEventListener('abort',abort);resolve(new Blob(chunks,{type:mime}));};recorder.start(1000);
   const start=performance.now(),duration=animation.duration/animation.fps*1000;
   if(audio)void audio.play().catch(()=>{recorder.stop();reject(new Error('Äänen toisto estettiin. Kokeile vientiä uudelleen.'));});
   const tick=(now:number)=>{if(signal.aborted||recorder.state==='inactive')return;const frame=Math.min(animation.duration-1,Math.floor((now-start)/1000*animation.fps));draw(frame);progress(frame+1);if(now-start>=duration)recorder.stop();else request=requestAnimationFrame(tick);};request=requestAnimationFrame(tick);
  });signal.throwIfAborted();return blob;
 }finally{cancelAnimationFrame(request);audio?.pause();if(audio)audio.src='';if(context)await context.close();for(const track of stream.getTracks())track.stop();source.width=source.height=output.width=output.height=0;}
}
