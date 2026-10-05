import {audioEnvelope} from './audio-analysis.ts';
import {createAudioContext} from './browser-audio.ts';
import type {Presentation} from './presentation-model.ts';
import type {PresentationAudio} from './presentation-audio.ts';
import {seconds,type Shot} from './studio/domain.ts';
import {shotDialogueRail,type ShotAudioRail} from './shot-dialogue-waveform.ts';

export type DecodedVoiceEnvelope={waveform:number[];duration:number};

export type ShotWaveformRail=ShotAudioRail&{decoded:boolean};

const decodeCache=new Map<string,Promise<DecodedVoiceEnvelope>>();

export function voiceEnvelopeCacheKey(asset:string,blob:Blob){
 return asset+':'+blob.size+':'+blob.type;
}

/** Decode once per asset blob; PCM peak envelope only (not transcription). */
export async function decodeVoiceEnvelope(blob:Blob,cacheKey:string):Promise<DecodedVoiceEnvelope>{
 let pending=decodeCache.get(cacheKey);
 if(!pending){
  pending=(async()=>{
   const ctx=createAudioContext();
   try{
    const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
    const bins=Math.max(32,Math.min(600,Math.ceil(decoded.duration*36)));
    const {waveform,duration}=audioEnvelope(channels,decoded.sampleRate,bins);
    return {waveform,duration};
   }finally{await ctx.close();}
  })();
  decodeCache.set(cacheKey,pending);
  if(decodeCache.size>40)decodeCache.delete(decodeCache.keys().next().value!);
 }
 return pending;
}

export async function loadPresentationVoiceEnvelopes(voices:Record<string,PresentationAudio>){
 const entries=await Promise.all(Object.entries(voices).filter(([,v])=>v?.blob?.size).map(async([asset,v])=>{
  const key=voiceEnvelopeCacheKey(asset,v.blob);
  return [asset,await decodeVoiceEnvelope(v.blob,key)] as const;
 }));
 return new Map(entries);
}

/** Map decoded clip energy into shot-local bins; falls back to mouth/timing rail when blobs missing. */
export function shotWaveformRail(p:Presentation,shot:Shot,envelopes:Map<string,DecodedVoiceEnvelope>,bins=24):ShotWaveformRail{
 const t0=seconds(shot.at),t1=t0+seconds(shot.duration),span=Math.max(t1-t0,.001);
 const levels=Array.from({length:bins},()=>0);
 let hasDialogue=false,decoded=false;
 for(const clip of p.audioClips){
  const ev=p.events.find(e=>e.id===clip.dialogue);
  if(!ev||ev.kind!=='dialogue')continue;
  const start=ev.at??0,end=start+clip.duration;
  if(end<=t0||start>=t1)continue;
  hasDialogue=true;
  const env=envelopes.get(clip.asset);
  if(!env?.waveform.length)continue;
  decoded=true;
  const trim=Math.max(clip.end-clip.start,.001);
  for(let b=0;b<bins;b++){
   const bt0=t0+(b/bins)*span,bt1=t0+((b+1)/bins)*span;
   const o0=Math.max(start,t0),o1=Math.min(end,t1);
   if(bt1<=o0||bt0>=o1)continue;
   const mid=(Math.max(bt0,o0)+Math.min(bt1,o1))/2;
   const playback=mid-start;
   const source=clip.start+(playback/clip.duration)*trim;
   const wi=Math.min(env.waveform.length-1,Math.max(0,Math.floor((source/env.duration)*env.waveform.length)));
   levels[b]=Math.max(levels[b],env.waveform[wi]??0);
  }
 }
 if(!decoded){
  const fallback=shotDialogueRail(p,shot,bins);
  return {...fallback,decoded:false};
 }
 const peak=Math.max(...levels,.001);
 return {shotId:shot.id,levels:levels.map(v=>v/peak),hasDialogue,decoded:true};
}
