// Read an already approved local model. Never downloads weights or sends audio.
import {app,utilityProcess} from 'electron';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {KokoroModelStore,KokoroService} from '../desktop/kokoro.mjs';
import {createProcessEngineFactory} from '../desktop/kokoro-engine.mjs';
import {wav} from '../lib/microphone.ts';
const data=process.env.HAHMOSTUDIO_KOKORO_MODEL_DATA,out=resolve(process.env.HAHMOSTUDIO_KOKORO_TEST_OUTPUT??'.private-runtime/kokoro-test');
if(!data)throw Error('HAHMOSTUDIO_KOKORO_MODEL_DATA must point to an already approved model store');
app.whenReady().then(async()=>{
 let service;const began=performance.now();
 try{
  await mkdir(out,{recursive:true});const store=new KokoroModelStore(data,{fetchImpl:()=>{throw Error('Network forbidden in local inference test');}});
  const status=await store.status({verify:true});if(!status.installed)throw Error(status.error??'Approved local model missing');
  service=new KokoroService({store,createEngine:createProcessEngineFactory({fork:(path,args,options)=>utilityProcess.fork(path,args,options),workerPath:resolve('desktop/kokoro-worker.mjs'),runtimeDir:resolve('.private-runtime/kokoro')})});
  const text='This is a local voice test. The animation keeps the original timing.';
  const audio=await service.synthesize({text,voice:'af_heart',speed:1});
  const rms=Math.sqrt(audio.samples.reduce((s,v)=>s+v*v,0)/audio.samples.length),seconds=audio.samples.length/audio.sampleRate;
  if(!Number.isFinite(rms)||rms<.001||seconds<1)throw Error('Generated speech is empty or silent');
  await writeFile(join(out,'english.wav'),new Uint8Array(await wav(audio.samples,audio.sampleRate).arrayBuffer()));
  const report={ok:true,text,voice:'af_heart',sampleRate:audio.sampleRate,seconds,rms,elapsedMs:performance.now()-began,model:status.modelVersion,realInference:true,physicalDevices:false,network:false,humanListening:false};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await service.release();app.exit(0);
 }catch(error){const report={ok:false,error:error.message,realInference:false,network:false};await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.error(report);await service?.release();app.exit(1);}
});
