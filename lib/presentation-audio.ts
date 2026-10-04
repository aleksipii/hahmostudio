import {wav} from './microphone.ts';
import {createAudioContext} from './browser-audio.ts';
import {speechFrames} from './speech-animation.ts';
import {encodeSpeechWav,validateCues} from './phonetic-speech.ts';
import {desktop} from './platform.ts';
import type {AudioClip,Presentation} from './presentation-model.ts';
export type PresentationAudio={name:string;blob:Blob};
export async function analyzeDialogue(blob:Blob,dialogue:string,asset:string,start=0,end?:number,phonetic=false,signal?:AbortSignal):Promise<AudioClip>{
 if(blob.size>25*1024*1024)throw Error('Äänitiedosto on yli 25 Mt.');const context=createAudioContext();try{const decoded=await context.decodeAudioData(await blob.arrayBuffer()),last=end??decoded.duration;if(start<0||last>decoded.duration+.001||last<=start||last-start>60)throw Error('Repliikin äänirajat ovat virheelliset (enintään 60 s).');signal?.throwIfAborted();
 const first=Math.round(start*decoded.sampleRate),count=Math.round((last-start)*decoded.sampleRate),samples=new Float32Array(count);for(let c=0;c<decoded.numberOfChannels;c++){const data=decoded.getChannelData(c);for(let i=0;i<count;i++)samples[i]+=(data[first+i]??0)/decoded.numberOfChannels;}
 const duration=count/decoded.sampleRate,activity=speechFrames(samples,decoded.sampleRate,30,Math.max(2,Math.ceil(duration*30))),mouth:AudioClip['mouth']=[{time:0,shape:'rest'}];
 if(phonetic){const wav=encodeSpeechWav([samples],decoded.sampleRate),bridge=desktop();let data:any;if(bridge){const cancel=()=>{void bridge.cancelSpeech();};signal?.addEventListener('abort',cancel,{once:true});try{data={mouthCues:await bridge.speech(new Uint8Array(wav),'en')};}finally{signal?.removeEventListener('abort',cancel);}}else{const response=await fetch('/api/speech/recognize?language=en',{method:'POST',headers:{'Content-Type':'audio/wav'},body:new Blob([new Uint8Array(wav)]),signal});data=await response.json();if(!response.ok)throw Error(data.error??'Paikallinen äännetunnistus epäonnistui.');}for(const c of validateCues(data.mouthCues))mouth.push({time:Math.min(duration,c.start),shape:c.value==='X'?'rest':['E','F','H'].includes(c.value)?'round':'open'});
 }else{let previous=false;activity.forEach((open,i)=>{if(i/30<duration&&open!==previous){mouth.push({time:i/30,shape:open?'open':'rest'});previous=open;}});}
 // Real silence always closes the mouth, including a phoneme detector's silent gaps.
 const ordered=mouth.sort((a,b)=>a.time-b.time),times=new Set(ordered.map(m=>m.time));activity.forEach((v,i)=>{if(i/30<duration&&(i===0||v!==activity[i-1]))times.add(i/30);});const filtered:AudioClip['mouth']=[];let index=0,shape:AudioClip['mouth'][number]['shape']='rest';for(const time of [...times].sort((a,b)=>a-b)){while(index<ordered.length&&ordered[index].time<=time)shape=ordered[index++].shape;const gated=activity[Math.floor(time*30)]?shape:'rest';if(!filtered.length||filtered.at(-1)!.shape!==gated)filtered.push({time,shape:gated});}if(filtered.length>3999)throw Error('Suuajoituksia on liikaa.');filtered.push({time:duration,shape:'rest'});
 return {id:'voice-'+dialogue,dialogue,asset,start: first/decoded.sampleRate,end:first/decoded.sampleRate+duration,duration,mouth:filtered,source:phonetic?'viseme':'volume',trailingSilence:Math.max(0,duration-activity.reduce((last,v,i)=>v?i+1:last,0)/30)};
 }finally{await context.close();}
}
/** No time stretching. Each trimmed original clip is copied at its globally scheduled sample offset. */
export async function mixDialogueAudio(p:Presentation,files:Record<string,PresentationAudio>,fps:number,startFrame:number,old?:PresentationAudio,signal?:AbortSignal,totalSeconds?:number):Promise<PresentationAudio>{
 const context=createAudioContext();try{const rate=48000,length=Math.ceil((totalSeconds??(startFrame/fps+p.seconds))*rate),mono=new Float32Array(length);if(length>rate*1200)throw Error('Äänivienti ylittää 1200 s.');
 const copy=(buffer:AudioBuffer,from:number,to:number,at:number)=>{const count=Math.round((to-from)*rate),offset=Math.round(at*rate);for(let i=0;i<count&&offset+i<mono.length;i++){const source=(from+i/rate)*buffer.sampleRate,j=Math.floor(source),fraction=source-j;let v=0;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);v+=((d[j]??0)*(1-fraction)+(d[j+1]??0)*fraction)/buffer.numberOfChannels;}mono[offset+i]+=v;}};
 if(old){const decoded=await context.decodeAudioData(await old.blob.arrayBuffer());copy(decoded,0,Math.min(decoded.duration,startFrame/fps),0);const tail=startFrame/fps+p.seconds;if(decoded.duration>tail&&length/rate>tail)copy(decoded,tail,Math.min(decoded.duration,length/rate),tail);}
 const decoded=new Map<string,AudioBuffer>();for(const a of p.audioClips){signal?.throwIfAborted();if(!files[a.asset])throw Error('Repliikin alkuperäinen ääni puuttuu.');let buffer=decoded.get(a.asset);if(!buffer){buffer=await context.decodeAudioData(await files[a.asset].blob.arrayBuffer());decoded.set(a.asset,buffer);}const e=p.events.find(e=>e.id===a.dialogue)!;copy(buffer,a.start,a.end,startFrame/fps+(e.at??0));}
 // WAV conversion retains pauses and PCM duration; export uses the existing AAC encoder.
 return {name:p.metadata.series+'-dialogue.wav',blob:wav(mono,rate)};
 }finally{await context.close();}
}
