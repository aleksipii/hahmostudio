import {createAudioContext} from './browser-audio';
import {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,Quality,canEncodeVideo,canEncodeAudio} from 'mediabunny';
import {renderScene} from './scene-render';
import {contain,episodeTiming,type Scene} from './scene-model';
import type {LayerNode,PsdDocument} from './psd-model';
import type {Animation} from './animation-model';
import type {ProjectAudio} from './project-file';
export type Episode={doc:PsdDocument;animation:Animation;scene:Scene;audio?:ProjectAudio};
export async function exportMp4(episodes:Episode[],wide:boolean,signal:AbortSignal,progress:(message:string)=>void):Promise<Blob>{
 const clone=(nodes:LayerNode[]):LayerNode[]=>nodes.map(n=>({...n,children:clone(n.children)}));episodes=episodes.map(e=>({...e,doc:{...e.doc,layers:clone(e.doc.layers)},animation:structuredClone(e.animation),scene:{...e.scene}}));
 if(!episodes.length||episodes.length>5)throw new Error('Valitse 1–5 jaksoa.');
 const timing=episodeTiming(episodes.map(e=>e.animation)),total=timing.reduce((n,t)=>n+t.frames,0),width=wide?1920:episodes[0].scene.width,height=wide?1080:episodes[0].scene.height,quality=new Quality({bitrate:wide?3000000:8000000});
 const check=()=>{if(signal.aborted)throw new DOMException('Vienti peruttu.','AbortError');};check();
 if(!await canEncodeVideo('avc',{width,height,frameRate:30,quality}))throw new Error('Selain ei tue H.264-vientiä. Päivitä selain tai vie PNG-kuvasarja.');
 const hasAudio=episodes.some(e=>e.audio),audioQuality=new Quality({bitrate:128000});
 if(hasAudio&&!await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2,quality:audioQuality}))throw new Error('Selain ei tue AAC-äänivientiä. Päivitä selain tai vie PNG-kuvasarja.');
 const canvas=document.createElement('canvas'),scratch=document.createElement('canvas'),stage=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target}),video=new CanvasSource(canvas,{codec:'avc',quality,keyFrameInterval:2});output.addVideoTrack(video,{frameRate:30});
 const audio=hasAudio?new AudioBufferSource({codec:'aac',quality:audioQuality}):null;if(audio)output.addAudioTrack(audio);
 let context:AudioContext|undefined,tooLarge=false;target.on('write',({end})=>{if(end>128*1024*1024)tooLarge=true;});
 try{await output.start();
  // Encode the smaller audio track first; this avoids retaining queued raw video frames.
  if(audio){context=createAudioContext({sampleRate:48000});for(let i=0;i<episodes.length;i++){check();progress(`Valmistellaan jakson ${i+1} ääntä…`);const ep=episodes[i],length=timing[i].frames*1600,buffer=context.createBuffer(2,length,48000);if(ep.audio){const decoded=await context.decodeAudioData(await ep.audio.blob.arrayBuffer());for(let ch=0;ch<2;ch++){const source=decoded.getChannelData(Math.min(ch,decoded.numberOfChannels-1));buffer.copyToChannel(source.subarray(0,length),ch);}}check();await audio.add(buffer);}audio.close();}
  for(let i=0;i<episodes.length;i++){const ep=episodes[i],t=timing[i];for(let frame=0;frame<t.frames;frame++){check();if(tooLarge)throw new Error('Video ylittää 128 Mt. Lyhennä jaksoja.');renderScene(stage,scratch,ep.doc,ep.animation,Math.min(ep.animation.duration-1,frame/30*ep.animation.fps),ep.scene);const ctx=canvas.getContext('2d')!;ctx.fillStyle=ep.scene.background;ctx.fillRect(0,0,width,height);const r=contain(stage.width,stage.height,width,height);ctx.drawImage(stage,r.x,r.y,r.width,r.height);await video.add((t.start+frame)/30,1/30);if(frame%10===0){progress(`MP4 · jakso ${i+1}/${episodes.length} · ${Math.round((t.start+frame+1)/total*100)} %`);await new Promise(r=>setTimeout(r,0));}}}
  video.close();check();progress('Viimeistellään MP4-tiedostoa…');await output.finalize();check();if(!target.buffer||target.buffer.byteLength>128*1024*1024)throw new Error('Video ylittää 128 Mt. Lyhennä jaksoja.');return new Blob([target.buffer],{type:'video/mp4'});
 }finally{if(output.state!=='finalized'&&output.state!=='canceled')await output.cancel();await context?.close();for(const c of [canvas,scratch,stage])c.width=c.height=0;}
}
