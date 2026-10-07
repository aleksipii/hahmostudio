import {frameMetrics,PlaybackController} from './playback-machine.ts';
import {renderPresentation} from './presentation-render.ts';
import type {Presentation} from './presentation-model.ts';
import type {PresentationAssets} from './presentation-compile.ts';

/** Canvas sizes matching common Electron layouts (logical scene pixels). */
export const PLAYBACK_VIEWPORTS=[{label:'portrait-full',width:1080,height:1920},{label:'stage-compact',width:720,height:1280},{label:'preview-panel',width:540,height:960}] as const;

export function summarizeRenderTimings(ms:number[]){
 if(!ms.length)return {frames:0,totalMs:0,meanMs:0,p95Ms:0,maxMs:0};
 const sorted=[...ms].sort((a,b)=>a-b),total=ms.reduce((a,b)=>a+b,0);
 return {frames:ms.length,totalMs:+total.toFixed(3),meanMs:+(total/ms.length).toFixed(3),p95Ms:+(sorted[Math.floor((sorted.length-1)*.95)]??0).toFixed(3),maxMs:+sorted.at(-1)!.toFixed(3)};
}

export function createStubCanvas(width:number,height:number){
 const canvas:any={width,height};
 const ctx:any=new Proxy({canvas,globalAlpha:1,getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),createLinearGradient:()=>({addColorStop:()=>{}})},{get:(target,key)=>{const k=String(key);return k in target?(target as Record<string,unknown>)[k]:(...args:unknown[])=>{void args;};},set:(target,key,value)=>{(target as Record<string,unknown>)[String(key)]=value;return true;}});
 canvas.getContext=()=>ctx;
 return {canvas:canvas as HTMLCanvasElement,scratch:canvas as HTMLCanvasElement};
}

export type PlaybackLoadReport={fps:number;durationFrames:number;sampledFrames:number;stepMs:number;viewports:Record<string,{render:ReturnType<typeof summarizeRenderTimings>;raf:ReturnType<typeof frameMetrics>}>};

/** Simulates 60 Hz rAF steps and measures stub-canvas presentation render cost per viewport. */
export function measurePresentationPlayback(compiled:Presentation,assets:PresentationAssets,options:{fps:number;durationFrames:number;frames:number[];viewports?:readonly {label:string;width:number;height:number}[];stepMs?:number}):PlaybackLoadReport{
 const viewports=options.viewports??PLAYBACK_VIEWPORTS,step=options.stepMs??1000/60;
 const controller=new PlaybackController(options.fps,options.durationFrames,[]);
 controller.send('play',0);
 let clock=0;
 const renderSamples:Record<string,number[]>={};
 const rafIntervals:number[]=[];
 for(const vp of viewports)renderSamples[vp.label]=[];
 for(const targetFrame of options.frames){
  while(controller.frame<targetFrame&&controller.state==='toistaa'){controller.tick(clock);rafIntervals.push(step);clock+=step;}
  const time=targetFrame/options.fps;
  for(const vp of viewports){
   const {canvas,scratch}=createStubCanvas(vp.width,vp.height);
   // CPU time, not wall time: parallel test files or a busy CI host must not inflate the sample.
   const start=process.cpuUsage();
   renderPresentation(canvas,scratch,compiled,assets,time,vp.width,vp.height);
   const used=process.cpuUsage(start);
   renderSamples[vp.label].push((used.user+used.system)/1000);
  }
 }
 const viewportsOut:PlaybackLoadReport['viewports']={};
 for(const vp of viewports)viewportsOut[vp.label]={render:summarizeRenderTimings(renderSamples[vp.label]),raf:frameMetrics(rafIntervals)};
 return {fps:options.fps,durationFrames:options.durationFrames,sampledFrames:options.frames.length,stepMs:step,viewports:viewportsOut};
}
