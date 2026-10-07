import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

/** Paikallinen Kokoro-malli sovelluksen tietokansiossa. Ei koskaan sovelluspaketissa, repossa tai projektitiedostoissa. */
export const MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
export const MODEL_VERSION='Kokoro-82M-v1.0-ONNX';
export const MODEL_LICENSE='Apache-2.0';
const HOST='https://huggingface.co/';
// sha256 on tyhjä, koska pilvi-ympäristö ei voinut hakea tiedostoja. Ensimmäinen lataus kirjaa tarkisteen manifestiin
// (trust-on-first-use) ja jokainen käynnistys varmistaa sen. Kiinnitä arvo tähän, kun se on tarkistettu omalla Macilla.
export const MODEL_FILES=Object.freeze([
 {path:'config.json',sha256:null,maxBytes:2*1024**2},
 {path:'tokenizer.json',sha256:null,maxBytes:8*1024**2},
 {path:'tokenizer_config.json',sha256:null,maxBytes:2*1024**2},
 {path:'onnx/model_quantized.onnx',sha256:null,maxBytes:400*1024**2}
]);
export const MAX_TEXT=600,MAX_SECONDS=120;
const voicePattern=/^[ab][fm]_[a-z]{2,12}$/;

export function validateSynthesisRequest(r){
 if(!r||typeof r.text!=='string'||!r.text.trim()||r.text.length>MAX_TEXT)throw Error('Puhuttava teksti on virheellinen.');
 if(typeof r.voice!=='string'||!voicePattern.test(r.voice))throw Error('Kokoro-ääni on virheellinen.');
 if(!Number.isFinite(r.speed)||r.speed<.5||r.speed>1.5)throw Error('Puhenopeus on virheellinen.');
 return {text:r.text,voice:r.voice,speed:r.speed};
}
const sha256File=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const safeRelative=p=>{if(typeof p!=='string'||p.startsWith('/')||p.split('/').some(s=>!s||s==='..'))throw Error('Mallitiedoston polku on virheellinen.');return p;};

export class KokoroModelStore{
 constructor(dataDir,{fetchImpl=globalThis.fetch,files=MODEL_FILES}={}){this.dir=join(dataDir,'kokoro');this.modelDir=join(this.dir,'models',MODEL_ID);this.manifestPath=join(this.dir,'manifest.json');this.fetch=fetchImpl;this.files=files;}
 async manifest(){try{const m=JSON.parse(await readFile(this.manifestPath,'utf8'));if(m?.schemaVersion!==1||m.modelVersion!==MODEL_VERSION||!Array.isArray(m.files))return null;return m;}catch{return null;}}
 /** Asennettu vain, jos jokainen tiedosto löytyy ja vastaa manifestin kokoa ja tarkistetta. */
 async status({verify=false}={}){
  const m=await this.manifest();if(!m)return {installed:false,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes:0};
  let bytes=0;
  for(const f of this.files){const entry=m.files.find(e=>e.path===f.path);if(!entry)return {installed:false,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes:0,error:'Mallitiedosto puuttuu manifestista.'};
   const file=join(this.modelDir,safeRelative(f.path));let info;try{info=await stat(file);}catch{return {installed:false,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes:0,error:'Mallitiedosto puuttuu.'};}
   if(info.size!==entry.size)return {installed:false,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes:0,error:'Mallitiedoston koko ei täsmää.'};
   if(verify&&await sha256File(file)!==entry.sha256)return {installed:false,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes:0,error:'Mallitiedoston tarkiste ei täsmää.'};
   bytes+=info.size;}
  return {installed:true,modelVersion:MODEL_VERSION,license:MODEL_LICENSE,bytes};
 }
 /** Kutsutaan vasta, kun pääprosessi on saanut käyttäjän vahvistuksen natiivi-ikkunassa. */
 async download({signal,onProgress}={}){
  await mkdir(this.dir,{recursive:true});const staging=join(this.dir,'staging-'+process.pid+'-'+Date.now()),entries=[];
  try{
   for(const f of this.files){
    signal?.throwIfAborted();const url=HOST+MODEL_ID+'/resolve/main/'+safeRelative(f.path),target=join(staging,f.path);await mkdir(dirname(target),{recursive:true});
    const response=await this.fetch(url,{signal,redirect:'follow'});if(!response.ok||!response.body)throw Error('Mallin lataus epäonnistui ('+f.path+', '+response.status+').');
    const length=Number(response.headers.get('content-length')??0);if(length>f.maxBytes)throw Error('Mallitiedosto on odotettua suurempi: '+f.path);
    let received=0;const source=Readable.fromWeb(response.body);source.on('data',chunk=>{received+=chunk.length;if(received>f.maxBytes)source.destroy(Error('Mallitiedosto ylitti kokorajan: '+f.path));onProgress?.({file:f.path,received,total:length||null});});
    await pipeline(source,createWriteStream(target),{signal});
    const hash=await sha256File(target);if(f.sha256&&hash!==f.sha256)throw Error('Mallitiedoston tarkiste ei täsmää: '+f.path);
    entries.push({path:f.path,size:(await stat(target)).size,sha256:hash});
   }
   signal?.throwIfAborted();
   await rm(this.modelDir,{recursive:true,force:true});await mkdir(dirname(this.modelDir),{recursive:true});await rename(staging,this.modelDir);
   const tmp=this.manifestPath+'.tmp';await writeFile(tmp,JSON.stringify({schemaVersion:1,modelVersion:MODEL_VERSION,source:HOST+MODEL_ID,license:MODEL_LICENSE,downloadedAt:new Date().toISOString(),files:entries}));await rename(tmp,this.manifestPath);
   return this.status();
  }finally{await rm(staging,{recursive:true,force:true});}
 }
 async remove(){await rm(this.dir,{recursive:true,force:true});return this.status();}
}

/** Palvelu serialisoi synteesin: yksi pyyntö kerrallaan, peruutus vapauttaa moottorin. */
export class KokoroService{
 constructor({store,createEngine}){this.store=store;this.createEngine=createEngine;this.engine=null;this.busy=null;}
 status(){return this.store.status();}
 async synthesize(request,{signal}={}){
  const r=validateSynthesisRequest(request);
  if(this.busy)throw Error('Edellinen puhesynteesi on kesken.');
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});this.busy=controller;
  try{
   const status=await this.store.status({verify:!this.engine});if(!status.installed)throw Error(status.error??'Kokoro-mallia ei ole ladattu.');
   controller.signal.throwIfAborted();
   this.engine??=await this.createEngine({modelDir:this.store.modelDir,modelId:MODEL_ID});
   const audio=await this.engine.synthesize(r,controller.signal);
   if(!(audio?.samples instanceof Float32Array)||!audio.samples.length||!Number.isFinite(audio.sampleRate)||audio.samples.length/audio.sampleRate>MAX_SECONDS)throw Error('Puhemoottori palautti virheellisen äänen.');
   return {samples:audio.samples,sampleRate:audio.sampleRate,modelVersion:MODEL_VERSION};
  }catch(error){if(controller.signal.aborted)await this.release();throw error;}
  finally{signal?.removeEventListener('abort',abort);if(this.busy===controller)this.busy=null;}
 }
 cancel(){this.busy?.abort();}
 async release(){const engine=this.engine;this.engine=null;await engine?.dispose?.();}
}
