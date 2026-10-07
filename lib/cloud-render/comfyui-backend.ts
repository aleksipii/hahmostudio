import type {BackendCapabilities,BackendValidation,CostEstimate,RenderArtifact,RenderJob,RenderResult} from './types.ts';
import {Blocked} from './types.ts';
import type {BackendDescriptor,RenderBackend} from './backends.ts';
import {assertToken,type ExecutionToken} from './compute.ts';
import type {ModelRegistry} from './models.ts';
import type {WorkflowRegistry} from './workflows.ts';
import {isModelWeightName} from './weights.ts';

type F=typeof fetch;
export type ComfyConfig={descriptor:BackendDescriptor;baseUrl:string;/** Explicit, operator-declared cost of this exact execution path; null = unknown (always blocked). */declaredCostEur:number|null;models:ModelRegistry;workflows:WorkflowRegistry;fetch?:F;headers?:Record<string,string>;pollMs?:number;timeoutMs?:number;maxOutputBytes?:number};
const OUT_EXT=new Map([['png','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg'],['webp','image/webp'],['gif','image/gif'],['mp4','video/mp4'],['webm','video/webm']]);
const LOADER_FIELDS:Record<string,string>={CheckpointLoaderSimple:'ckpt_name',UNETLoader:'unet_name',CLIPLoader:'clip_name',VAELoader:'vae_name'};
/**
 * Renders through a ComfyUI HTTP API. ComfyUI is only a backend: the studio never exposes graphs publicly.
 * Models are provisioned inside the remote runtime (cloud/runtime/provision_models.py); this class never downloads weights
 * and only verifies, through /object_info, that the pinned files are present remotely.
 * Every method that touches the runtime requires a PaidComputeFirewall token.
 */
export class ComfyUIBackend implements RenderBackend{
 readonly descriptor:BackendDescriptor;private f:F;private active=new Map<string,{promptId?:string;abort:AbortController}>();
 private cfg:ComfyConfig;
 constructor(cfg:ComfyConfig){this.cfg=cfg;this.descriptor=cfg.descriptor;this.f=cfg.fetch??fetch;}
 async getCapabilities():Promise<BackendCapabilities>{return{workflows:this.cfg.workflows.list().filter(w=>w.implemented).map(w=>w.id),outputFormats:['png','jpg','webp','mp4','webm']};}
 async estimateCost():Promise<CostEstimate>{return{estimatedCostEur:this.cfg.declaredCostEur,confidence:this.cfg.declaredCostEur===null?'unknown':'exact',billingProvider:this.descriptor.billingProvider};}
 private url(p:string){return this.cfg.baseUrl.replace(/\/+$/,'')+p;}
 private async req(p:string,init:RequestInit&{signal?:AbortSignal}={}){const r=await this.f(this.url(p),{...init,headers:{...this.cfg.headers,...(init.headers as Record<string,string>|undefined)}});if(!r.ok)throw new Error(`ComfyUI ${p} returned ${r.status}`);return r;}
 private graph(job:RenderJob){
  const wf=this.cfg.workflows.require(job.workflowId),model=this.cfg.models.get(job.modelId);if(!model)throw new Blocked('model-unknown','Model is not registered.');
  return wf.buildGraph!(job,model);
 }
 staticValidate(job:RenderJob):string[]{try{this.graph(job);return [];}catch(e){return [(e as Error).message];}}
 async validate(job:RenderJob,auth:ExecutionToken):Promise<BackendValidation>{
  assertToken(auth,job.id,this.descriptor.id);
  const problems:string[]=[];let g;try{g=this.graph(job);}catch(e){return{ok:false,problems:[(e as Error).message]};}
  let info:Record<string,{input?:{required?:Record<string,unknown[]>}}>;
  try{info=await(await this.req('/object_info')).json();}catch{return{ok:false,problems:['ComfyUI runtime is unavailable.']};}
  for(const [id,n] of Object.entries(g)){
   const spec=info[n.class_type];if(!spec){problems.push(`Node "${n.class_type}" (${id}) is not installed in the runtime.`);continue;}
   const field=LOADER_FIELDS[n.class_type];if(field){const opts=spec.input?.required?.[field]?.[0];const want=n.inputs[field];if(!Array.isArray(opts)||!opts.includes(want))problems.push(`Model file "${String(want)}" is not provisioned in the remote runtime.`);}
  }
  return{ok:!problems.length,problems};
 }
 async render(job:RenderJob,auth:ExecutionToken,inputs?:ReadonlyMap<string,Uint8Array>):Promise<RenderResult>{
  assertToken(auth,job.id,this.descriptor.id);
  const graph=this.graph(job),ctl=new AbortController(),state={abort:ctl} as {promptId?:string;abort:AbortController};this.active.set(job.id,state);
  const started=Date.now(),timeout=this.cfg.timeoutMs??600000,timer=setTimeout(()=>ctl.abort(),timeout);
  try{
   for(const [nodeId,n] of Object.entries(graph))if(n.class_type==='LoadImage'){
    const assetId=String(n.inputs.image),bytes=inputs?.get(assetId);if(!bytes)throw new Blocked('input-missing',`Input asset "${assetId}" was not provided.`);
    const name=`${job.id}-${nodeId}.png`,form=new FormData();form.set('image',new Blob([new Uint8Array(bytes)],{type:'image/png'}),name);form.set('overwrite','true');
    await this.req('/upload/image',{method:'POST',body:form,signal:ctl.signal});n.inputs.image=name;
   }
   const sub=await(await this.req('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:graph,client_id:job.id}),signal:ctl.signal})).json() as {prompt_id?:string;node_errors?:Record<string,unknown>};
   if(!sub.prompt_id||sub.node_errors&&Object.keys(sub.node_errors).length)throw new Error('ComfyUI rejected the prompt.');
   state.promptId=sub.prompt_id;
   let outputs:Record<string,Record<string,{filename:string;subfolder?:string;type?:string}[]>>|undefined;
   while(!outputs){
    if(ctl.signal.aborted)throw new Error('Render cancelled or timed out.');
    const h=await(await this.req('/history/'+encodeURIComponent(sub.prompt_id),{signal:ctl.signal})).json() as Record<string,{outputs?:typeof outputs;status?:{status_str?:string}}>;
    const e=h[sub.prompt_id];if(e?.status?.status_str==='error')throw new Error('ComfyUI reported a render error.');
    if(e?.outputs&&Object.keys(e.outputs).length)outputs=e.outputs;else await new Promise(r=>setTimeout(r,this.cfg.pollMs??1000));
   }
   const max=this.cfg.maxOutputBytes??512*1024*1024,artifacts:RenderArtifact[]=[];let total=0;
   for(const node of Object.values(outputs))for(const list of Object.values(node))if(Array.isArray(list))for(const o of list){
    if(!o?.filename||isModelWeightName(o.filename))throw new Blocked('output-weights','Runtime returned a disallowed file.');
    const ext=o.filename.split('.').pop()?.toLowerCase()??'',mime=OUT_EXT.get(ext);if(!mime)throw new Blocked('output-type',`Unsupported output type ".${ext}".`);
    const r=await this.req('/view?'+new URLSearchParams({filename:o.filename,subfolder:o.subfolder??'',type:o.type??'output'}),{signal:ctl.signal});
    const bytes=new Uint8Array(await r.arrayBuffer());total+=bytes.length;if(total>max)throw new Blocked('output-size','Output exceeds the size limit.');
    artifacts.push({name:o.filename.replace(/[^A-Za-z0-9._-]/g,'_'),mime,bytes});
   }
   return{artifacts,backendJobId:sub.prompt_id,durationMs:Date.now()-started};
  }finally{clearTimeout(timer);this.active.delete(job.id);}
 }
 async cancel(jobId:string,auth?:ExecutionToken){
  const a=this.active.get(jobId);if(!a)return;a.abort.abort();
  if(!auth)return;try{assertToken(auth,jobId,this.descriptor.id);}catch{return;}
  try{await this.req('/interrupt',{method:'POST'});if(a.promptId)await this.req('/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delete:[a.promptId]})});}catch{/* best effort */}
 }
}
