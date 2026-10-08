import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {LocalMicrophone,microphoneEnvironment,wav,type MicrophoneEnvironment} from './microphone.ts';
function fixture(fail?:'resume'|'module'|'permission'|'processor'|'track'){
 let stopped=0,closed=0;const disconnected:string[]=[],messages:unknown[]=[];
 const track={readyState:fail==='track'?'ended':'live',stop(){stopped++;this.readyState='ended';}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream;
 const node=(name:string)=>({connect(){},disconnect(){disconnected.push(name);}});
 const analyser={...node('analyser'),fftSize:4,getFloatTimeDomainData(data:Float32Array){data.fill(.25);}};
 const processor={...node('processor'),port:{onmessage:null as null|((e:{data:Float32Array})=>void),postMessage:(v:unknown)=>{messages.push(v);if((v as {type?:string})?.type==='end')queueMicrotask(()=>processor.port.onmessage?.({data:{type:'stopped',epoch:(v as {epoch:number}).epoch} as unknown as Float32Array}));}}};
 const context={state:'running',currentTime:0,sampleRate:8000,destination:node('destination'),resume:async()=>{if(fail==='resume')throw new Error('resume');},audioWorklet:{addModule:async()=>{if(fail==='module')throw new Error('module');}},close:async()=>{closed++;context.state='closed';},createMediaStreamSource:()=>node('source'),createAnalyser:()=>analyser,createGain:()=>({...node('mute'),gain:{value:1}}),decodeAudioData:async()=>({length:16000,numberOfChannels:2,getChannelData:()=>new Float32Array(16000).fill(.2)})};
 let constraints:MediaStreamConstraints|undefined;
 const environment={createContext:()=>context,getUserMedia:async(c:MediaStreamConstraints)=>{constraints=c;if(fail==='permission')throw new DOMException('Denied','NotAllowedError');return stream;},createProcessor:()=>{if(fail==='processor')throw new Error('processor');return processor;},moduleUrl:'/nested/microphone-recorder.worklet.js'} as unknown as MicrophoneEnvironment;
 return {environment,processor,context,track,stream,messages,disconnected,get stopped(){return stopped;},get closed(){return closed;},get constraints(){return constraints;}};
}
test('microphone requests audio only, measures RMS, gates PCM and releases every node once',async()=>{
 const f=fixture(),mic=await LocalMicrophone.start(f.environment);assert.deepEqual(f.constraints,{audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});assert.equal(mic.level(),.25);
 f.processor.port.onmessage!({data:new Float32Array([.5])});assert.equal(mic.count,0);mic.begin();f.processor.port.onmessage!({data:new Float32Array([.5,-.5])});assert.equal(mic.count,2);
 const b=await mic.finish(undefined,1,.1),v=new DataView(await b.arrayBuffer());assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(44+8000*2,true),16383);assert.equal(mic.recording,false);assert.deepEqual(f.messages,[{type:'begin',epoch:1,frame:0},{type:'end',epoch:1}]);
 mic.close();mic.close();assert.equal(f.stopped,1);assert.equal(f.closed,1);assert.deepEqual(f.disconnected,['source','analyser','processor','mute']);assert.equal(f.processor.port.onmessage,null);assert.equal(mic.level(),0);assert.throws(()=>mic.begin());
});
test('permission, worklet, context and processor failures clean up acquired devices',async()=>{for(const stage of ['resume','module','permission','processor','track'] as const){const f=fixture(stage);await assert.rejects(LocalMicrophone.start(f.environment));assert.equal(f.closed,1,stage);assert.equal(f.stopped,stage==='processor'||stage==='track'?1:0,stage);}});
test('canceling a pending permission closes context immediately and stops a late granted stream',async()=>{
 const f=fixture(),abort=new AbortController();let resolve!:(s:MediaStream)=>void;let requested!:(v:void)=>void;const ready=new Promise<void>(r=>requested=r);
 f.environment.getUserMedia=()=>{requested();return new Promise(r=>resolve=r);};const pending=LocalMicrophone.start(f.environment,abort.signal);await ready;abort.abort();assert.equal(f.closed,1);resolve(f.stream);await assert.rejects(pending,{name:'AbortError'});assert.equal(f.stopped,1);assert.equal(f.closed,1);
});
test('abort before start creates no device; missing AudioWorklet reports actionable error',async()=>{const f=fixture(),abort=new AbortController();abort.abort();await assert.rejects(LocalMicrophone.start(f.environment,abort.signal),{name:'AbortError'});assert.equal(f.closed,0);const old=fixture();old.context.audioWorklet=undefined as never;await assert.rejects(LocalMicrophone.start(old.environment),/AudioWorklet/);assert.equal(old.closed,1);});
test('Safari-style prefixed AudioContext and unavailable APIs are detected without ReferenceError',()=>{
 const requests:unknown[]=[];class Context{}class Worklet{}const scope={webkitAudioContext:Context,AudioWorkletNode:Worklet,navigator:{mediaDevices:{getUserMedia:(c:unknown)=>{requests.push(c);return Promise.resolve({});}}}};
 const env=microphoneEnvironment(scope as unknown as typeof globalThis);assert.ok(env.createContext() instanceof Context);assert.equal(env.moduleUrl,'/microphone-recorder.worklet.js');assert.throws(()=>microphoneEnvironment({} as typeof globalThis),/HTTPS/);assert.throws(()=>microphoneEnvironment({navigator:scope.navigator} as unknown as typeof globalThis),/Päivitä/);
});
test('device removal and suspended context produce silence, recording preserves previous audio tail',async()=>{const f=fixture(),mic=await LocalMicrophone.start(f.environment);f.context.state='suspended';assert.equal(mic.level(),0);f.context.state='running';mic.begin();f.processor.port.onmessage!({data:new Float32Array([.3])});const b=await mic.finish(new Blob(['old']),.5,.1);const v=new DataView(await b.arrayBuffer());assert.equal(b.size,44+16000*2);assert.ok(Math.abs(v.getInt16(44+4000*2,true)-16383)<2);assert.ok(Math.abs(v.getInt16(44+15999*2,true)-6553)<2);f.track.readyState='ended';assert.equal(mic.available,false);assert.equal(mic.level(),0);mic.close();});
test('WAV has valid mono PCM16 header, finite clipping, sample-rate and size guardrails',async()=>{const b=await wav(new Float32Array([-2,2,NaN,Infinity,0]),48000).arrayBuffer(),v=new DataView(b);assert.equal(new TextDecoder().decode(new Uint8Array(b,0,4)),'RIFF');assert.equal(v.getUint32(4,true),b.byteLength-8);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint16(34,true),16);assert.deepEqual(Array.from({length:5},(_,i)=>v.getInt16(44+i*2,true)),[-32768,32767,0,0,0]);assert.throws(()=>wav(new Float32Array(1),0));assert.throws(()=>wav(new Float32Array(1),48000.5));});
test('AudioWorklet processes copied samples only during recording and survives silent input',()=>{
 let Processor:any;const sent:Float32Array[]=[];class Base{port={onmessage:null as any,postMessage:(v:Float32Array)=>sent.push(v)};}
 vm.runInNewContext(readFileSync(new URL('../public/microphone-recorder.worklet.js',import.meta.url),'utf8'),{AudioWorkletProcessor:Base,Float32Array,registerProcessor:(name:string,ctor:unknown)=>{assert.equal(name,'hahmostudio-mic');Processor=ctor;}});
 const p=new Processor(),source=new Float32Array([.1,.2]);assert.equal(p.process([[source]]),true);assert.equal(sent.length,0);p.port.onmessage({data:true});p.process([[source]]);source.fill(0);assert.ok(sent[0][0]>.09);p.port.onmessage({data:false});p.process([[source]]);p.process([]);assert.equal(sent.length,1);
});
test('audio decoding selects the standard context before prefixed fallback and reports absent support',async()=>{const {createAudioContext}=await import('./browser-audio.ts');class Standard{options:unknown;constructor(options:unknown){this.options=options;}}class Legacy{}const host={AudioContext:Standard,webkitAudioContext:Legacy};const context=createAudioContext({sampleRate:48000},host as unknown as typeof globalThis);assert.ok(context instanceof Standard);assert.deepEqual(context.options,{sampleRate:48000});assert.ok(createAudioContext(undefined,{webkitAudioContext:Legacy} as unknown as typeof globalThis) instanceof Legacy);assert.throws(()=>createAudioContext(undefined,{} as typeof globalThis),/jatka ilman ääntä/);});

test('voice actor keeps original PCM rhythm and quick mouth reacts promptly to synthetic speech then releases in silence',async()=>{
 const {readProject}=await import('./project-file.ts'),{initialQuick,quickPoses}=await import('./quick-animation.ts');const p=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))])),q=p.doc.quick!,s=initialQuick();quickPoses(s,q,p.animation.rig,0);const poses=quickPoses(s,q,p.animation.rig,1/30,.06);assert.equal(poses[q.roles.mouthOpen].opacity,1);let quiet=poses;for(let f=2;f<22;f++)quiet=quickPoses(s,q,p.animation.rig,f/30,0);assert.equal(quiet[q.roles.mouthNeutral].opacity,1);const f=fixture(),mic=await LocalMicrophone.start(f.environment);mic.begin();const samples=Float32Array.from({length:800},(_,i)=>Math.sin(i*.3)*.5);f.processor.port.onmessage!({data:samples});const voice=await mic.finish(undefined,0,.1),v=new DataView(await voice.arrayBuffer());for(const i of [0,10,20,200,799])assert.ok(Math.abs(v.getInt16(44+i*2,true)/32768-samples[i])<.0001);mic.close();
});
test('timestamped PCM retains gaps and final queued samples before stop acknowledgement',async()=>{
 const f=fixture();f.context.currentTime=10;const mic=await LocalMicrophone.start(f.environment);mic.begin();
 const emit=(data:unknown)=>f.processor.port.onmessage!({data:data as Float32Array});
 emit({type:'samples',epoch:0,frame:80000,samples:new Float32Array([1])});assert.equal(mic.count,0);
 emit({type:'samples',epoch:1,frame:80002,samples:new Float32Array([.25])});
 f.processor.port.postMessage=(v:unknown)=>{f.messages.push(v);};const pending=mic.finish(undefined,0,.01);assert.equal(mic.recording,true);assert.throws(()=>mic.begin());await assert.rejects(mic.finish(undefined,0,.01),/viimeistellään/);
 emit({type:'samples',epoch:1,frame:80004,samples:new Float32Array([.5])});emit({type:'stopped',epoch:1});
 const wave=new DataView(await(await pending).arrayBuffer());assert.equal(wave.getInt16(44,true),0);assert.equal(wave.getInt16(44+2*2,true),8191);assert.equal(wave.getInt16(44+3*2,true),0);assert.equal(wave.getInt16(44+4*2,true),16383);assert.equal(mic.recording,false);mic.close();
});
test('worklet cuts a partial first quantum and acknowledges only the active epoch',()=>{
 let Worklet:any;const messages:unknown[]=[];class Base{port={onmessage:null as any,postMessage:(v:unknown)=>messages.push(v)}}
 const scope={AudioWorkletProcessor:Base,currentFrame:100,Float32Array,registerProcessor:(_name:string,c:unknown)=>Worklet=c};vm.runInNewContext(readFileSync(new URL('../public/microphone-recorder.worklet.js',import.meta.url),'utf8'),scope);const w=new Worklet();w.port.onmessage({data:{type:'begin',epoch:2,frame:102}});w.process([[new Float32Array([1,2,3,4])]]);const result=messages[0] as {frame:number;epoch:number;samples:Float32Array};assert.equal(result.frame,102);assert.equal(result.epoch,2);assert.deepEqual([...result.samples],[3,4]);w.port.onmessage({data:{type:'end',epoch:1}});assert.equal(w.recording,true);w.port.onmessage({data:{type:'end',epoch:2}});assert.equal(w.recording,false);assert.equal((messages.at(-1) as {type:string}).type,'stopped');
});
