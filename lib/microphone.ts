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
 private disconnected:()=>void;private epoch=0;private startFrame=0;private offsets:number[]=[];private stopPending?:{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
 private constructor(stream:MediaStream,context:AudioContext,analyser:AnalyserNode,processor:AudioWorkletNode,disconnect:()=>void){
  this.stream=stream;this.context=context;this.analyser=analyser;this.processor=processor;this.disconnected=disconnect;
  processor.port.onmessage=e=>{
   const data=e.data;if(data?.type==='stopped'&&data.epoch===this.epoch&&this.stopPending){clearTimeout(this.stopPending.timer);const pending=this.stopPending;this.stopPending=undefined;pending.resolve();return;}
   const raw=data instanceof Float32Array?data:data?.type==='samples'&&data.epoch===this.epoch?data.samples:undefined;
   const offset=data instanceof Float32Array?this.count:data?.frame-this.startFrame;
   if(this.recording&&!this.closed&&raw instanceof Float32Array&&Number.isInteger(offset)&&offset>=0&&offset<context.sampleRate*60){const chunk=raw.slice(0,Math.max(0,context.sampleRate*60-offset));if(chunk.length){this.chunks.push(chunk);this.offsets.push(offset);this.count=Math.max(this.count,offset+chunk.length);}}
  };
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
 begin(){if(!this.available||this.stopPending)throw new Error('Mikrofoni ei ole valmis. Odota tallennuksen valmistumista.');this.chunks=[];this.offsets=[];this.count=0;this.epoch++;this.startFrame=Math.round((this.context.currentTime??0)*this.context.sampleRate);this.recording=true;this.processor.port.postMessage({type:'begin',epoch:this.epoch,frame:this.startFrame});}
 async finish(previous:Blob|undefined,startSeconds:number,duration:number){
  if(this.closed)throw new Error('Mikrofoni on suljettu.');
  if(!Number.isFinite(startSeconds)||startSeconds<0||!Number.isFinite(duration)||duration<=0)throw new Error('Äänen tallennusaika on virheellinen.');
  if(this.stopPending)throw new Error('Äänitystä viimeistellään jo.');
  try {await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{this.stopPending=undefined;reject(new Error('Mikrofonin viimeisten näytteiden kuittaus puuttui. Käynnistä mikrofoni uudelleen.'));},1500);this.stopPending={resolve,reject,timer};this.processor.port.postMessage({type:'end',epoch:this.epoch});});}finally{this.recording=false;}
  const chunks=this.chunks,offsets=this.offsets;this.chunks=[];this.offsets=[];
  const rate=this.context.sampleRate,old=previous?await this.context.decodeAudioData(await previous.arrayBuffer()):undefined;
  const length=Math.max(Math.ceil((startSeconds+duration)*rate),old?.length??0);if(length*2>25*1024*1024)throw new Error('Yhdistetty ääni ylittää projektin 25 Mt rajan.');
  const result=new Float32Array(length);if(old)for(let c=0;c<old.numberOfChannels;c++){const channel=old.getChannelData(c);for(let i=0;i<channel.length;i++)result[i]+=channel[i]/old.numberOfChannels;}
  const start=Math.round(startSeconds*rate);for(const [index,chunk] of chunks.entries()){const offset=start+offsets[index];if(offset>=result.length)continue;const slice=chunk.subarray(0,result.length-offset);for(let i=0;i<slice.length;i++)result[offset+i]+=slice[i];}return wav(result,rate);
 }
 close(){if(this.closed)return;if(this.stopPending){clearTimeout(this.stopPending.timer);this.stopPending.reject(new Error('Mikrofoni suljettiin kesken viimeistelyn.'));this.stopPending=undefined;}this.closed=true;this.recording=false;this.chunks=[];this.offsets=[];this.processor.port.onmessage=null;this.disconnected();}
}
