// Erillinen prosessi: malli ja ONNX-ajoympäristö pysyvät poissa renderöijästä. Peruutus tappaa prosessin ja vapauttaa muistin.
import {createRequire} from 'node:module';
import {join} from 'node:path';
const port=process.parentPort;let tts;
const reply=(id,payload)=>port.postMessage({id,...payload});
port.on('message',async({data})=>{
 const {id}=data;
 try{
  if(data.type==='init'){
   const require=createRequire(join(data.runtime,'package.json')),{KokoroTTS}=require('kokoro-js'),{env}=require('@huggingface/transformers');
   env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=data.modelsDir;
   tts=await KokoroTTS.from_pretrained(data.modelId,{dtype:'q8',device:'cpu'});reply(id,{ok:true});
  }else if(data.type==='synthesize'){
   const raw=await tts.generate(data.text,{voice:data.voice,speed:data.speed}),samples=Float32Array.from(raw.audio);
   reply(id,{ok:true,samples:samples.buffer,sampleRate:raw.sampling_rate});
  }
 }catch(error){reply(id,{ok:false,error:String(error?.message??error).slice(0,300)});}
});
