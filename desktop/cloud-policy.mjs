// Työpöydän pilvi-IPC:n politiikka ja syötteiden validointi. Ei Electron-riippuvuuksia, joten testattavissa Nodessa.
import {redact,secretKey} from './cloud-secrets.mjs';
import {join} from 'node:path';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';

/** Työpöydällä kustannuspolitiikka on aina nollakustannus. Maksullisen laskennan ympäristömuuttujia ei lueta eikä välitetä. */
export const DESKTOP_COMPUTE_POLICY=Object.freeze({mode:'zero-cost',allowPaidCompute:false,maxCostEur:0,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:Object.freeze(['free'])});
export const CLOUD_RENDER_AVAILABLE=true;

export function clearTarget(value){return value==='all'?'all':secretKey(value);}
export function noArgs(args){if(args.length)throw new Error('Pyyntö ei odota parametreja.');}

/** Ei-salaiset asetukset. Kaikki oletuksena pois; vain pääprosessin natiivi vahvistus muuttaa ne todeksi. */
export const DEFAULT_SETTINGS=Object.freeze({enabled:false,colabClassifiedFree:false,notebookClassifiedFree:false});
export const FREE_KINDS=Object.freeze({colab:'colabClassifiedFree',notebook:'notebookClassifiedFree'});
export function freeKind(value){if(typeof value!=='string'||!Object.hasOwn(FREE_KINDS,value))throw new Error('Tuntematon ajoympäristö.');return value;}
export class CloudSettingsStore{
 constructor({dir}){this.dir=dir;this.file=join(dir,'cloud-settings.json');this.cache=null;}
 async get(){if(this.cache)return {...this.cache};let v={};try{v=JSON.parse(await readFile(this.file,'utf8'));}catch{}const out={...DEFAULT_SETTINGS};if(v?.schema===1)for(const k of Object.keys(DEFAULT_SETTINGS))if(v[k]===true)out[k]=true;this.cache=out;return {...out};}
 async set(patch){const next={...await this.get()};for(const [k,v] of Object.entries(patch)){if(!Object.hasOwn(DEFAULT_SETTINGS,k)||typeof v!=='boolean')throw new Error('Virheellinen pilviasetus.');next[k]=v;}await mkdir(this.dir,{recursive:true});const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify({schema:1,...next}),{mode:0o600});await rename(tmp,this.file);this.cache=next;return {...next};}
}

/**
 * Pilviprosessin ympäristö rakennetaan sallitulista: salaisuudet + käyttäjän vahvistamat ilmaisuusilmoitukset.
 * Ei process.env:iä, ei maksullisen laskennan muuttujia; Driven puuttuessa tallennus on paikallinen.
 */
export function buildCloudEnv(secrets,settings,{pinsFile}={}){
 const env={};
 for(const k of ['HAHMOSTUDIO_COLAB_COMFYUI_URL','HAHMOSTUDIO_COMFYUI_BEARER','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_REFRESH_TOKEN'])if(typeof secrets?.[k]==='string')env[k]=secrets[k];
 if(settings?.colabClassifiedFree===true)env.HAHMOSTUDIO_COLAB_CLASSIFIED_FREE='yes';
 if(settings?.notebookClassifiedFree===true)env.HAHMOSTUDIO_NOTEBOOK_CLASSIFIED_FREE='yes';
 if(typeof pinsFile==='string')env.HAHMOSTUDIO_MODEL_PINS_FILE=pinsFile;
 const drive=!!(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET&&env.GOOGLE_OAUTH_REFRESH_TOKEN);
 if(!drive){delete env.GOOGLE_OAUTH_CLIENT_ID;delete env.GOOGLE_OAUTH_CLIENT_SECRET;delete env.GOOGLE_OAUTH_REFRESH_TOKEN;env.HAHMOSTUDIO_STORAGE='local-dev';}
 return Object.freeze(env);
}

const ID=/^[A-Za-z0-9_.:-]{1,100}$/;
const MAX_JSON=2*1024*1024;
function obj(v,keys,name){if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(`${name}: pyyntö on virheellinen.`);for(const k of Object.keys(v))if(!keys.includes(k))throw new Error(`${name}: tuntematon kenttä.`);return v;}
function id(v,name){if(typeof v!=="string"||!ID.test(v)||/^\.+$/.test(v))throw new Error(`${name}: virheellinen tunniste.`);return v;}
/**
 * Rendererin sallitut pilvitoiminnot ja niiden tiukka muoto. Jokainen toiminto kartoitetaan yhteen
 * pilvirajapinnan reittiin; renderer ei voi valita reittiä, taustajärjestelmää, mallia, parametreja eikä politiikkaa.
 */
export const CLOUD_OPS=Object.freeze(['health','backends','sync','lock','direct','reference','preflight','render','job','cancel','smoke','notebook-save','import']);
export function cloudRoute(op,args){
 if(typeof op!=='string'||!CLOUD_OPS.includes(op))throw new Error('Tuntematon pilvitoiminto.');
 const a=args??{};
 switch(op){
  case 'health':obj(a,[],op);return {method:'GET',path:'/api/health'};
  case 'backends':obj(a,[],op);return {method:'GET',path:'/api/backends'};
  case 'sync':{obj(a,['canonical'],op);const c=a.canonical;if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('sync: kanoninen tila puuttuu.');if(JSON.stringify(c).length>MAX_JSON)throw new Error('sync: kanoninen tila on liian suuri.');const p=id(c.projectId,'sync');return {method:'PUT',path:`/api/projects/${p}`,body:c};}
  case 'lock':obj(a,['projectId','sceneId'],op);return {method:'POST',path:`/api/projects/${id(a.projectId,op)}/scenes/${id(a.sceneId,op)}/lock`};
  case 'direct':obj(a,['projectId','sceneId'],op);return {method:'POST',path:'/api/ai/direct',body:{projectId:id(a.projectId,op),sceneId:id(a.sceneId,op)}};
  case 'reference':{obj(a,['projectId','characterId','mime','dataBase64','label','sourceSha256'],op);if(a.sourceSha256!==undefined&&(typeof a.sourceSha256!=='string'||!/^[0-9a-f]{64}$/.test(a.sourceSha256)))throw new Error('reference: hahmon tiiviste on virheellinen.');if(typeof a.dataBase64!=='string'||a.dataBase64.length>11_200_000||!/^[A-Za-z0-9+/=]+$/.test(a.dataBase64)||!['image/png','image/jpeg','image/webp'].includes(a.mime))throw new Error('reference: kuva on virheellinen.');return {method:'POST',path:`/api/projects/${id(a.projectId,op)}/characters/${id(a.characterId,op)}/reference`,body:{mime:a.mime,dataBase64:a.dataBase64,label:typeof a.label==='string'?a.label.slice(0,80):'reference',...(a.sourceSha256?{sourceSha256:a.sourceSha256}:{})}};}
  case 'preflight':obj(a,['projectId','sceneId','workflowId'],op);return {method:'POST',path:'/api/render/preflight',body:{projectId:id(a.projectId,op),sceneId:id(a.sceneId,op),workflowId:id(a.workflowId,op)}};
  case 'render':{obj(a,['projectId','sceneId','workflowId','authorizationFingerprint'],op);if(typeof a.authorizationFingerprint!=='string'||!/^[a-f0-9]{16,128}$/.test(a.authorizationFingerprint))throw new Error('render: valtuutus puuttuu.');return {method:'POST',path:'/api/render',body:{projectId:id(a.projectId,op),sceneId:id(a.sceneId,op),workflowId:id(a.workflowId,op),authorizationFingerprint:a.authorizationFingerprint}};}
  case 'job':obj(a,['jobId'],op);return {method:'GET',path:`/api/render/${id(a.jobId,op)}`};
  case 'cancel':obj(a,['jobId'],op);return {method:'POST',path:`/api/render/${id(a.jobId,op)}/cancel`};
  case 'smoke':obj(a,[],op);return {method:'POST',path:'/api/live-verification/smoke',body:{}};
  case 'notebook-save':obj(a,['jobId'],op);return {method:'GET',path:`/api/render/${id(a.jobId,op)}/notebook`};
  case 'import':obj(a,['jobId'],op);return {method:'POST',path:`/api/render/${id(a.jobId,op)}/import`};
 }
}

/**
 * Lähtevän datan lupa. Palauttaa natiivin dialogin tekstin tai null, jos toiminto ei lähetä dataa koneelta.
 * Paikallisella tallennuksella synkronointi ja vertailukuva pysyvät koneella; renderöinti lähtee aina taustalle.
 */
export function egressConsent(op,route,{storage,backends=[]}){
 const drive=storage==='google-drive';
 if(op==='sync'&&drive){const c=route.body;return {message:'Lähetetäänkö kohtauksen kanoninen tila Google Driveen?',detail:`Projekti ${c.projectId}: ${Object.keys(c.scenes??{}).length} kohtausta, ${Object.keys(c.characters??{}).length} hahmoa (nimet ja ominaisuudet). Ei ääniä, ei PSD-tiedostoja, ei käsikirjoitusta. Kustannus €0,00.`};}
 if(op==='reference'&&drive)return {message:'Lähetetäänkö vertailukuva Google Driveen?',detail:`Hahmo ${route.path.split('/')[5]}: yksi kuva (${Math.round(route.body.dataBase64.length*3/4/1024)} KiB). Kustannus €0,00.`};
 if(op==='render'){const enabled=backends.filter(b=>b.enabled).map(b=>b.id).join(', ')||'ei käytössä olevaa taustaa';return {message:'Lähetetäänkö lukittu kohtaus renderöitäväksi?',detail:`Kohtaus ${route.body.sceneId}, työnkulku ${route.body.workflowId}. Lähtee: kohtauksen kuvaus ja hyväksytyt vertailukuvat. Kohde: ${enabled}${drive?'; tulos tallennetaan Google Driveen':'; tulos tallennetaan tälle koneelle'}. Kustannus €0,00 (maksullinen laskenta on estetty). Ei ääniä, ei PSD-tiedostoja.`};}
 return null;
}

/** Rendererille näkyvä tila. Ei salaisuuksien arvoja. */
export async function cloudStatus(store,extra={}){
 return {available:CLOUD_RENDER_AVAILABLE,enabled:false,running:false,storage:null,modelPins:false,settings:{...DEFAULT_SETTINGS},jobs:[],...extra,policy:{...DESKTOP_COMPUTE_POLICY,allowedBackendClasses:[...DESKTOP_COMPUTE_POLICY.allowedBackendClasses]},secrets:await store.view()};
}

/** Käärii pilvi-IPC:n käsittelijän: virheviesti peitetään ennen kuin se kulkee rendererille. */
export function guarded(store,fn){
 return async function(...args){
  try{return await fn(...args);}catch(e){const message=e instanceof Error?e.message:'Pilvitoiminto epäonnistui.';const values=await store.values().catch(()=>({}));throw new Error(redact(message,Object.values(values)));}
 };
}
/** Pilviprosessin vastauksen runko peitetään samoin ennen rendereriä. */
export function redactBody(body,secrets){const values=Object.values(secrets??{}).filter(v=>typeof v==='string'&&v.length>=4);if(!values.length)return body;return JSON.parse(redact(JSON.stringify(body),values));}
