import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {BackendRegistry,DisabledBackend} from './backends.ts';
import {ComfyUIBackend} from './comfyui-backend.ts';
import {loadComputePolicy} from './compute.ts';
import {ModelRegistry,ModelRouter} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {GoogleDriveStorage,driveTokenFromEnv} from './storage-gdrive.ts';
import {LocalDevelopmentStorage} from './storage-local.ts';
import type {StorageBackend} from './storage.ts';
import {CharacterReferenceSystem} from './character-refs.ts';
import {ProjectStore,RenderService} from './pipeline.ts';
import {createCloudRenderApi} from './api.ts';
import type {AIDirector} from './ai-suggestion.ts';
import {PaletteInspector} from './inspector.ts';
import {LiveVerificationLedger,type ProvisionReceipt} from './live-verification.ts';

export type Env=Record<string,string|undefined>;
/**
 * Builds the whole cloud render subsystem from SERVER environment only. The browser never supplies any of this.
 * Defaults: zero-cost policy, PRODUCTION_SAFE model mode, no paid backend enabled, no LLM configured.
 */
export function createCloudRender(env:Env,dataDir:string,opts:{director?:AIDirector;fetch?:typeof fetch}={}){
 const policy=loadComputePolicy(env),modelMode=env.HAHMOSTUDIO_MODEL_MODE==='DEVELOPMENT'?'DEVELOPMENT' as const:'PRODUCTION_SAFE' as const;
 const models=new ModelRegistry(),workflows=new WorkflowRegistry();
 if(env.HAHMOSTUDIO_MODEL_PINS_FILE)models.applyPins(JSON.parse(readFileSync(resolve(env.HAHMOSTUDIO_MODEL_PINS_FILE),'utf8')));
 const hasDrive=!!(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET&&env.GOOGLE_OAUTH_REFRESH_TOKEN);
 const storage:StorageBackend=hasDrive||env.HAHMOSTUDIO_STORAGE!=='local-dev'?new GoogleDriveStorage({getAccessToken:driveTokenFromEnv(env,opts.fetch)}):new LocalDevelopmentStorage(resolve(dataDir,'cloud-render-dev'));
 const backends=new BackendRegistry(),url=env.HAHMOSTUDIO_COLAB_COMFYUI_URL,classifiedFree=env.HAHMOSTUDIO_COLAB_CLASSIFIED_FREE==='yes';
 const tmo=Number(env.HAHMOSTUDIO_COMFYUI_TIMEOUT_MS??600000);
 if(env.HAHMOSTUDIO_COMFYUI_TIMEOUT_MS!==undefined&&!(Number.isInteger(tmo)&&tmo>=60000&&tmo<=3600000))throw new Error('HAHMOSTUDIO_COMFYUI_TIMEOUT_MS must be an integer between 60000 and 3600000.');
 // The free classification is an explicit operator statement about this exact execution path, never inferred from a free tier.
 const colabUsable=!!url&&/^https:\/\//.test(url)&&classifiedFree;
 backends.register(colabUsable?new ComfyUIBackend({descriptor:{id:'colab-free',class:'free',provider:'comfyui',billingProvider:'google-colab-free',enabled:true},baseUrl:url as string,declaredCostEur:0,models,workflows,fetch:opts.fetch,timeoutMs:tmo,headers:env.HAHMOSTUDIO_COMFYUI_BEARER?{Authorization:'Bearer '+env.HAHMOSTUDIO_COMFYUI_BEARER}:undefined})
  :new DisabledBackend({id:'colab-free',class:'free',provider:'comfyui',billingProvider:'google-colab-free',enabled:false}));
 backends.register(new DisabledBackend({id:'runpod',class:'paid',provider:'runpod',billingProvider:'runpod',enabled:false}));
 backends.register(new DisabledBackend({id:'modal',class:'paid',provider:'modal',billingProvider:'modal',enabled:false}));
 const projects=new ProjectStore(storage),refs=new CharacterReferenceSystem(storage);
 // Receipts come from a directory on the SERVER (copied there by the operator), never from the browser.
 const receiptsDir=env.HAHMOSTUDIO_PROVISION_RECEIPTS_DIR;
 const receipts=():ProvisionReceipt[]=>{if(!receiptsDir)return[];try{return readdirSync(receiptsDir).filter(f=>f.endsWith('.json')).flatMap(f=>{try{const r=JSON.parse(readFileSync(resolve(receiptsDir,f),'utf8'));return r?.schema===1&&typeof r.repo==='string'&&typeof r.revision==='string'&&Array.isArray(r.files)?[r as ProvisionReceipt]:[];}catch{return[];}});}catch{return[];}};
 const ledger=new LiveVerificationLedger({models,policy,mode:modelMode,storage,receipts});
 const thr=Number(env.HAHMOSTUDIO_PALETTE_THRESHOLD??0.55);
 if(env.HAHMOSTUDIO_PALETTE_THRESHOLD!==undefined&&!(thr>=0.2&&thr<=0.9))throw new Error('HAHMOSTUDIO_PALETTE_THRESHOLD must be between 0.2 and 0.9.');
 // Opt-in. Output strictness stays 'reject': a drift flag blocks the output; there is no setting that downgrades flags.
 const inspector=env.HAHMOSTUDIO_OUTPUT_INSPECTOR==='palette'?new PaletteInspector(storage,thr):undefined;
 const service=new RenderService({inspector,projects,storage,backends,router:new ModelRouter(models),workflows,policy,modelMode,director:opts.director,refs,requireSceneLock:true,requireAuthorizationFingerprint:true,ledger});
 const handle=createCloudRenderApi({service,projects,models,workflows,backends,policy,modelMode,director:opts.director,storageId:storage.id,ledger,refs,storage});
 return{handle,service,projects,policy,modelMode,storage,backends,models,refs,workflows,ledger};
}
