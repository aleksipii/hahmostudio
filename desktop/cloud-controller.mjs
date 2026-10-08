// Pääprosessin pilviohjain: opt-in, pilviprosessin elinkaari, lähtevän datan lupa ja renderöintien checkpoint.
// Electron-riippuvuudet (fork, dialogit) annetaan parametreina, joten logiikka on testattavissa Nodessa.
import {join} from 'node:path';
import {writeFile,rename,rm,access} from 'node:fs/promises';
import {buildCloudEnv,cloudRoute,cloudStatus,egressConsent,freeKind,FREE_KINDS,redactBody} from './cloud-policy.mjs';
import {CloudJobJournal} from './cloud-jobs.mjs';

const START_TIMEOUT=30000,CALL_TIMEOUT=180000,MAX_IMPORT=88*1024*1024,MAX_PINS=1024*1024;
const REV=/^[0-9a-f]{40}$/,SHA=/^[0-9a-f]{64}$/;
/** Mallien lukitustiedoston muoto (sama kuin HAHMOSTUDIO_MODEL_PINS_FILE). Pilviprosessi tarkistaa sen vielä mallirekisteriä vasten. */
export function validPins(v){if(!v||typeof v!=='object'||Array.isArray(v))return false;const e=Object.entries(v);return e.length>0&&e.length<=50&&e.every(([id,p])=>/^[A-Za-z0-9_.-]{1,100}$/.test(id)&&p&&typeof p==='object'&&REV.test(p.revision)&&(p.files===undefined||Array.isArray(p.files)&&p.files.length<=20&&p.files.every(f=>f&&typeof f.path==='string'&&f.path.length<=300&&SHA.test(f.sha256))));}

export class CloudController{
 /**
  * @param {{dir:string,secrets:any,settings:any,journal?:CloudJobJournal,fork:(path:string)=>any,servicePath:string,
  *  confirm:(o:{message:string,detail:string,ok?:string})=>Promise<boolean>,saveFile:(name:string,bytes:Uint8Array)=>Promise<string|null>,
  *  openJson:(kind:'result'|'pins')=>Promise<{size:number,read:()=>Promise<string>}|null>}} d
  */
 constructor(d){this.d=d;this.journal=d.journal??new CloudJobJournal({dir:d.dir});this.pins=join(d.dir,'cloud-model-pins.json');this.child=null;this.ready=null;this.pending=new Map();this.seq=0;this.storage=null;}
 async status(){const settings=await this.d.settings.get();const jobs=(await this.journal.list()).map(r=>({id:r.id,state:r.state,sceneId:r.sceneId,workflowId:r.workflowId,at:r.at,...(r.jobId?{jobId:r.jobId}:{})}));return cloudStatus(this.d.secrets,{enabled:settings.enabled,running:!!this.child,settings,jobs,storage:this.storage,modelPins:await this.#hasPins()});}
 async #hasPins(){try{await access(this.pins);return true;}catch{return false;}}
 /** Mallien lukitus (revisio + SHA-256) tuodaan tiedostosta pääprosessin dialogilla; ei painoja, vain metatieto. */
 async importPins(){const file=await this.d.openJson('pins');if(!file)return this.status();if(file.size>MAX_PINS)throw new Error('Lukitustiedosto on liian suuri.');let v;try{v=JSON.parse(await file.read());}catch{throw new Error('Lukitustiedosto ei ole JSON-muotoinen.');}if(!validPins(v))throw new Error('Lukitustiedostossa pitää olla jokaiselle mallille 40-merkkinen revisio ja tiedostoille SHA-256.');const tmp=this.pins+'.tmp';await writeFile(tmp,JSON.stringify(v),{mode:0o600});await rename(tmp,this.pins);await this.reload();return this.status();}
 async clearPins(){await rm(this.pins,{force:true});await this.reload();return this.status();}
 async enable(){
  const s=await this.d.settings.get();if(s.enabled)return this.status();
  const ok=await this.d.confirm({ok:'Ota käyttöön',message:'Otetaanko pilvirenderöinti käyttöön?',detail:'Pilvirenderöinti on valinnainen. Kun se on päällä, voit lähettää lukitun kohtauksen ilmaiseen ajoympäristöön renderöitäväksi. Jokainen lähetys kysyy erikseen luvan ja kertoo, mitä lähtee ja minne. Äänet, PSD-tiedostot ja käsikirjoitus eivät lähde. Maksullinen laskenta on aina estetty (€0,00). Voit poistaa pilven käytöstä milloin tahansa.'});
  if(!ok)return this.status();
  await this.d.settings.set({enabled:true});return this.status();
 }
 async disable(){await this.d.settings.set({enabled:false});await this.stop();return this.status();}
 async declareFree(kind,value){
  freeKind(kind);if(typeof value!=='boolean')throw new Error('Virheellinen valinta.');
  if(value){const label=kind==='colab'?'ComfyUI-tunnelin (esim. Colab) ajoympäristö':'Kaggle-muistikirjan ajoympäristö';const ok=await this.d.confirm({ok:'Vahvistan',message:`Vahvistatko, että ${label} on sinulle ilmainen?`,detail:'Sovellus ei voi itse tietää, onko ulkoinen ajoympäristö ilmainen. Vahvistus on sinun ilmoituksesi tästä nimenomaisesta ajoympäristöstä. Ilman sitä taustaa ei käytetä. Maksullista laskentaa ei sallita missään tilanteessa.'});if(!ok)return this.status();}
  await this.d.settings.set({[FREE_KINDS[kind]]:value});await this.reload();return this.status();
 }
 /** Asetukset tai salaisuudet muuttuivat: käynnissä oleva prosessi käynnistetään uudelleen uusilla arvoilla. */
 async reload(){if(this.child){await this.stop();}}
 async #start(){
  if(this.ready)return this.ready;
  this.ready=(async()=>{
   const settings=await this.d.settings.get();if(!settings.enabled)throw new Error('Pilvirenderöinti ei ole käytössä.');
   const env=buildCloudEnv(await this.d.secrets.values(),settings,{pinsFile:await this.#hasPins()?this.pins:undefined});
   const child=this.d.fork(this.d.servicePath);this.child=child;
   const started=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{reject(new Error('Pilvipalvelun käynnistys aikakatkaistiin.'));},START_TIMEOUT);
    child.on('message',m=>{
     if(m?.type==='ready'){clearTimeout(timer);this.storage=m.storage;resolve();}
     else if(m?.type==='error'){clearTimeout(timer);reject(new Error(m.message));}
     else if(m?.type==='result'){const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);p.resolve({status:m.status,body:m.body});}}
    });
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('Pilvipalvelu sulkeutui.'));this.#exited(child);});
   });
   child.postMessage({type:'start',env,dataDir:join(this.d.dir,'cloud-render')});
   await started;
  })();
  try{await this.ready;}catch(e){await this.stop();throw e;}
  return this.ready;
 }
 #exited(child){if(this.child!==child)return;this.child=null;this.ready=null;this.storage=null;for(const [id,p] of this.pending){clearTimeout(p.timer);p.reject(new Error('Pilvipalvelu sulkeutui kesken pyynnön.'));this.pending.delete(id);}void this.journal.interruptAll();}
 async stop(){const child=this.child;if(!child){this.ready=null;return;}await new Promise(resolve=>{const timer=setTimeout(()=>{try{child.kill();}catch{}resolve();},2500);child.once('exit',()=>{clearTimeout(timer);resolve();});try{child.postMessage({type:'stop'});}catch{resolve();}});this.#exited(child);}
 #send(route){
  const child=this.child;if(!child)throw new Error('Pilvipalvelu ei ole käynnissä.');
  const id=++this.seq;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Pilvipalvelu ei vastannut ajoissa.'));},CALL_TIMEOUT);this.pending.set(id,{resolve,reject,timer});child.postMessage({type:'call',id,route});});
 }
 async call(op,args){
  const route=cloudRoute(op,args);
  if(!(await this.d.settings.get()).enabled)throw new Error('Pilvirenderöinti ei ole käytössä. Ota se käyttöön Tekoäly-paneelista.');
  await this.#start();
  const secrets=await this.d.secrets.values();
  if(op==='import'){const file=await this.d.openJson('result');if(!file)return {status:200,body:{cancelled:true}};if(file.size>MAX_IMPORT)throw new Error('Tulostiedosto on liian suuri.');try{route.body=JSON.parse(await file.read());}catch{throw new Error('Tiedosto ei ole Hahmostudion tulostiedosto (JSON).');}}
  const backends=op==='render'?((await this.#send({method:'GET',path:'/api/backends'})).body?.backends??[]):[];
  const consent=egressConsent(op,route,{storage:this.storage,backends});
  if(consent&&!(await this.d.confirm({...consent,ok:'Lähetä'})))return {status:200,body:{cancelled:true}};
  if(op==='render'){
   // Checkpoint levylle ennen lähetystä; vasta sitten pilviprosessille.
   const entry=await this.journal.begin(route.body);let res;
   try{res=await this.#send(route);}catch(e){await this.journal.update(entry,{state:'FAILED'});throw e;}
   if(res.status===202&&typeof res.body?.jobId==='string')await this.journal.update(entry,{state:res.body.record?.state??'QUEUED',jobId:res.body.jobId});else await this.journal.update(entry,{state:'FAILED'});
   return {status:res.status,body:redactBody(res.body,secrets)};
  }
  const res=await this.#send(route);
  if(op==='job'&&res.status===200&&typeof res.body?.state==='string'){const r=await this.journal.byJob(args.jobId);if(r&&r.state!=='interrupted')await this.journal.update(r.id,{state:res.body.state});}
  if(op==='notebook-save'){if(res.status!==200)return {status:res.status,body:redactBody(res.body,secrets)};const name=typeof res.body?.fileName==='string'&&/^[A-Za-z0-9_.-]{1,120}\.ipynb$/.test(res.body.fileName)?res.body.fileName:'hahmostudio-render.ipynb';const saved=await this.d.saveFile(name,new TextEncoder().encode(String(res.body.notebook??'')));return {status:200,body:{saved:!!saved}};}
  return {status:res.status,body:redactBody(res.body,secrets)};
 }
}
