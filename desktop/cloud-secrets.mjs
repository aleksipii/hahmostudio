// Pilvirenderöinnin salaisuudet työpöydällä. Vain pääprosessi käyttää tätä moduulia.
// Arvot salataan safeStoragella (macOS: Keychainin avain) tiedostoon userData/cloud-secrets.bin.
// Selväkielistä varavaihtoehtoa ei ole: jos salaus ei ole käytettävissä, tallennus estetään.
// Arvoja ei koskaan palauteta rendererille, lokiin tai virheviestiin; renderer näkee vain onko avain asetettu.
import {join} from 'node:path';
import {readFile,writeFile,rename,rm,mkdir} from 'node:fs/promises';

const MAX_VALUE=4096,MAX_FILE=64*1024;
/** Sallitut avaimet ja niiden muototarkistus. Virheviesti ei koskaan sisällä arvoa. */
export const SECRET_KEYS=Object.freeze({
 HAHMOSTUDIO_COLAB_COMFYUI_URL:{label:'ComfyUI-tunnelin osoite',valid:v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&v.length<=2048;}catch{return false;}}},
 HAHMOSTUDIO_COMFYUI_BEARER:{label:'ComfyUI-välityspalvelimen tunnus',valid:v=>/^[A-Za-z0-9._~+/=-]{16,512}$/.test(v)},
 GOOGLE_OAUTH_CLIENT_ID:{label:'Google OAuth -asiakastunnus',valid:v=>/^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/.test(v)},
 GOOGLE_OAUTH_CLIENT_SECRET:{label:'Google OAuth -asiakassalaisuus',valid:v=>/^[A-Za-z0-9_-]{8,256}$/.test(v)},
 GOOGLE_OAUTH_REFRESH_TOKEN:{label:'Google Drive -päivitystunnus',valid:v=>/^[A-Za-z0-9._/-]{8,1024}$/.test(v)},
});
export function secretKey(value){if(typeof value!=='string'||!Object.hasOwn(SECRET_KEYS,value))throw new Error('Tuntematon pilviasetus.');return value;}
function checkValue(key,value){if(typeof value!=='string')throw new Error(`${SECRET_KEYS[key].label}: arvo puuttuu.`);const v=value.trim();if(!v||v.length>MAX_VALUE||!SECRET_KEYS[key].valid(v))throw new Error(`${SECRET_KEYS[key].label}: arvo ei ole oikeassa muodossa.`);return v;}

/** KEY=VALUE-tiedosto (esim. .env). Vain sallitut avaimet otetaan; tuntemattomista palautetaan vain nimet. */
export function parseSecretFile(text){
 if(typeof text!=='string'||text.length>MAX_FILE)throw new Error('Asetustiedosto on liian suuri tai virheellinen.');
 const values={},ignored=[];
 for(const raw of text.replace(/\r\n?/g,'\n').split('\n')){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const m=line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]{0,63})\s*=\s*(.*)$/);if(!m){ignored.push('(rivi ilman avainta)');continue;}
  const [,key,rest]=m;if(!Object.hasOwn(SECRET_KEYS,key)){ignored.push(key);continue;}
  const value=rest.replace(/^(['"])(.*)\1$/,'$2');values[key]=checkValue(key,value);
 }
 return {values,ignored:[...new Set(ignored)].slice(0,50)};
}

export class CloudSecretStore{
 /** @param {{dir:string,safeStorage:{isEncryptionAvailable():boolean,encryptString(s:string):Buffer,decryptString(b:Buffer):string}}} options */
 constructor({dir,safeStorage}){this.dir=dir;this.file=join(dir,'cloud-secrets.bin');this.safe=safeStorage;this.cache=null;}
 encryptionAvailable(){try{return this.safe.isEncryptionAvailable()===true;}catch{return false;}}
 async #load(){
  if(this.cache)return this.cache;
  let bytes;try{bytes=await readFile(this.file);}catch(e){if(e?.code==='ENOENT'){this.cache={};return this.cache;}throw new Error('Pilviasetuksia ei voitu lukea.');}
  if(!this.encryptionAvailable())throw new Error('Salattuja pilviasetuksia ei voi avata: järjestelmän avainnippu ei ole käytettävissä.');
  let data;try{data=JSON.parse(this.safe.decryptString(bytes));}catch{throw new Error('Pilviasetukset ovat vioittuneet. Poista ne ja anna uudelleen.');}
  const out={};if(data?.schema===1&&data.values&&typeof data.values==='object')for(const key of Object.keys(SECRET_KEYS))if(typeof data.values[key]==='string')out[key]=data.values[key];
  this.cache=out;return out;
 }
 async #persist(values){
  if(!this.encryptionAvailable())throw new Error('Järjestelmän avainnippu ei ole käytettävissä, joten pilviasetuksia ei tallenneta.');
  await mkdir(this.dir,{recursive:true});const tmp=this.file+'.tmp';
  await writeFile(tmp,this.safe.encryptString(JSON.stringify({schema:1,values})),{mode:0o600});await rename(tmp,this.file);this.cache={...values};
 }
 /** Rendererille näytettävä tila: vain onko avain asetettu, ei arvoja. */
 async view(){const values=await this.#load().catch(()=>({}));return {encryption:this.encryptionAvailable(),keys:Object.fromEntries(Object.entries(SECRET_KEYS).map(([k,d])=>[k,{label:d.label,set:typeof values[k]==='string'}]))};}
 async set(key,value){secretKey(key);const v=checkValue(key,value);await this.#persist({...await this.#load(),[key]:v});}
 async setMany(values){const next={...await this.#load()};for(const [k,v] of Object.entries(values))next[secretKey(k)]=checkValue(k,v);await this.#persist(next);return Object.keys(values);}
 async clear(key){if(key==='all'){await rm(this.file,{force:true});this.cache={};return;}secretKey(key);const next={...await this.#load()};delete next[key];await this.#persist(next);}
 /** Vain pääprosessin käyttöön pilviprosessin käynnistyksessä. Ei koskaan IPC:n kautta rendererille. */
 async values(){return {...await this.#load()};}
 /** Peittää tunnetut arvot ja https-osoitteet tekstistä (virheviestit, tilat). */
 async redactor(){const values=Object.values(await this.#load().catch(()=>({})));return text=>redact(text,values);}
}

export function redact(text,secrets=[]){
 let out=String(text??'');
 for(const s of [...secrets].filter(v=>typeof v==='string'&&v.length>=4).sort((a,b)=>b.length-a.length))out=out.split(s).join('***');
 return out.replace(/https?:\/\/[^\s"'<>]+/g,'https://***');
}
