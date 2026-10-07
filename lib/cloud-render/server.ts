import {readFileSync} from 'node:fs';
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
 // The free classification is an explicit operator statement about this exact execution path, never inferred from a free tier.
 const colabUsable=!!url&&/^https:\/\//.test(url)&&classifiedFree;
 backends.register(colabUsable?new ComfyUIBackend({descriptor:{id:'colab-free',class:'free',provider:'comfyui',billingProvider:'google-colab-free',enabled:true},baseUrl:url as string,declaredCostEur:0,models,workflows,fetch:opts.fetch,headers:env.HAHMOSTUDIO_COMFYUI_BEARER?{Authorization:'Bearer '+env.HAHMOSTUDIO_COMFYUI_BEARER}:undefined})
  :new DisabledBackend({id:'colab-free',class:'free',provider:'comfyui',billingProvider:'google-colab-free',enabled:false}));
 backends.register(new DisabledBackend({id:'runpod',class:'paid',provider:'runpod',billingProvider:'runpod',enabled:false}));
 backends.register(new DisabledBackend({id:'modal',class:'paid',provider:'modal',billingProvider:'modal',enabled:false}));
 const projects=new ProjectStore(storage),refs=new CharacterReferenceSystem(storage);
 const service=new RenderService({projects,storage,backends,router:new ModelRouter(models),workflows,policy,modelMode,director:opts.director,refs,requireSceneLock:true});
 const handle=createCloudRenderApi({service,projects,models,workflows,backends,policy,modelMode,director:opts.director,storageId:storage.id});
 return{handle,service,projects,policy,modelMode,storage,backends,models,refs};
}
