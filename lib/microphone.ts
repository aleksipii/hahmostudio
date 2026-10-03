import {createAudioContext} from './browser-audio.ts';
/** Dependencies are injectable so device lifecycle can be verified without hardware. */
export type MicrophoneEnvironment={
 getUserMedia:(constraints:MediaStreamConstraints)=>Promise<MediaStream>;
 createContext:()=>AudioContext;
 createProcessor:(context:AudioContext)=>AudioWorkletNode;
 moduleUrl:string;
};
export function microphoneEnvironment(scope:typeof globalThis=globalThis):MicrophoneEnvironment{
 const host=scope as typeof globalThis&{webkitAudioContext?:typeof AudioContext};
 const Context=host.AudioContext??host.webkitAudioContext;
 if(!host.navigator?.mediaDevices?.getUserMedia)throw new Error('Mikrofoni vaatii localhost- tai HTTPS-osoitteen ja selaimen mikrofonituen.');
 if(!Context||!host.AudioWorkletNode)throw new Error('Selain ei tue paikallista äänitallennusta. Päivitä selain ja kokeile uudelleen.');
 return {getUserMedia:c=>host.navigator.mediaDevices.getUserMedia(c),createContext:()=>createAudioContext(undefined,scope),createProcessor:c=>new host.AudioWorkletNode(c,'hahmostudio-mic'),moduleUrl:`${import.meta.env?.BASE_URL??'/'}microphone-recorder.worklet.js`};
}
function aborted(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Mikrofonin käynnistys peruttu.','AbortError');}
export function wav(samples:Float32Array,rate:number):Blob{
 if(!Number.isInteger(rate)||rate<8000||rate>192000||samples.length*2>25*1024*1024)throw new Error('Äänen näytetaajuus tai koko on virheellinen.');
 const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);
 const text=(p:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
 text(0,'RIFF');v.setUint32(4,b.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const sample=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;v.setInt16(44+i*2,sample*(sample<0?32768:32767),true);}
 return new Blob([b],{type:'audio/wav'});
}
export class LocalMicrophone{
 stream:MediaStream;context:AudioContext;analyser:AnalyserNode;processor:AudioWorkletNode;chunks:Float32Array[]=[];recording=false;count=0;closed=false;
 private disconnected:()=>void;
 private constructor(stream:MediaStream,context:AudioContext,analyser:AnalyserNode,processor:AudioWorkletNode,disconnect:()=>void){
  this.stream=stream;this.context=context;this.analyser=analyser;this.processor=processor;this.disconnected=disconnect;
  processor.port.onmessage=e=>{if(this.recording&&!this.closed&&e.data instanceof Float32Array){const chunk=e.data.slice(0,Math.max(0,context.sampleRate*60-this.count));if(chunk.length){this.chunks.push(chunk);this.count+=chunk.length;}}};
 }
 static async start(environment?:MicrophoneEnvironment,signal?:AbortSignal){
  const env=environment??microphoneEnvironment();let stream:MediaStream|undefined,context:AudioContext|undefined;const connected:AudioNode[]=[];
  let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;stream?.getTracks().forEach(t=>t.stop());for(const node of connected){try{node.disconnect();}catch{/* Already disconnected. */}}if(context&&context.state!=='closed')void context.close().catch(()=>{});};
  const onAbort=()=>cleanup();signal?.addEventListener('abort',onAbort,{once:true});
  try{
   aborted(signal);context=env.createContext();if(!context.audioWorklet?.addModule)throw new Error('Selain ei tue AudioWorklet-äänitallennusta. Päivitä selain.');
   await context.resume();aborted(signal);await context.audioWorklet.addModule(env.moduleUrl);aborted(signal);
   const acquired=await env.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
   // A permission dialog cannot be canceled, but a late grant must release its tracks.
   if(signal?.aborted){acquired.getTracks().forEach(t=>t.stop());aborted(signal);}stream=acquired;
   if(!stream.getAudioTracks().some(t=>t.readyState==='live'))throw new Error('Mikrofoni ei palauttanut toimivaa ääniraitaa. Tarkista valittu laite.');
   const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=1024;
   const processor=env.createProcessor(context),mute=context.createGain();mute.gain.value=0;connected.push(source,analyser,processor,mute);
   source.connect(analyser);analyser.connect(processor);processor.connect(mute);mute.connect(context.destination);
   return new LocalMicrophone(stream,context,analyser,processor,cleanup);
  }catch(e){cleanup();throw e;}finally{signal?.removeEventListener('abort',onAbort);}
 }
 get available(){return !this.closed&&this.context.state!=='closed'&&this.stream.getAudioTracks().some(t=>t.readyState==='live');}
 level(){if(!this.available||this.context.state!=='running')return 0;const data=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((n,v)=>n+(Number.isFinite(v)?v*v:0),0)/data.length);}
 begin(){if(!this.available)throw new Error('Mikrofoni on suljettu. Käynnistä se uudelleen.');this.chunks=[];this.count=0;this.recording=true;this.processor.port.postMessage(true);}
 async finish(previous:Blob|undefined,startSeconds:number,duration:number){
  if(!Number.isFinite(startSeconds)||startSeconds<0||!Number.isFinite(duration)||duration<=0)throw new Error('Äänen tallennusaika on virheellinen.');
  this.recording=false;this.processor.port.postMessage(false);const chunks=this.chunks;this.chunks=[];
  const rate=this.context.sampleRate,old=previous?await this.context.decodeAudioData(await previous.arrayBuffer()):undefined;
  const length=Math.max(Math.ceil((startSeconds+duration)*rate),old?.length??0);if(length*2>25*1024*1024)throw new Error('Yhdistetty ääni ylittää projektin 25 Mt rajan.');
  const result=new Float32Array(length);if(old)for(let c=0;c<old.numberOfChannels;c++){const channel=old.getChannelData(c);for(let i=0;i<channel.length;i++)result[i]+=channel[i]/old.numberOfChannels;}
  let offset=Math.round(startSeconds*rate);for(const chunk of chunks){if(offset>=result.length)break;const slice=chunk.subarray(0,result.length-offset);for(let i=0;i<slice.length;i++)result[offset+i]+=slice[i];offset+=chunk.length;}return wav(result,rate);
 }
 close(){if(this.closed)return;this.closed=true;this.recording=false;this.chunks=[];this.processor.port.onmessage=null;this.disconnected();}
}
