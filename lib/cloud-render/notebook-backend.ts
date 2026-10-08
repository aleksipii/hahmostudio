import {canonicalJson,sha256} from '../studio/hash.ts';
import {Blocked,type BackendCapabilities,type BackendValidation,type ComputePolicy,type CostEstimate,type ModelDefinition,type ModelMode,type RenderArtifact,type RenderJob,type RenderResult,type RuntimeEvidence} from './types.ts';
import type {BackendDescriptor,RenderBackend} from './backends.ts';
import {assertToken,type ExecutionToken} from './compute.ts';
import type {ModelRegistry} from './models.ts';
import type {ComfyGraph,WorkflowRegistry} from './workflows.ts';
import {buildProvisionManifest,type ProvisionManifest} from './provision.ts';
import {receiptMatches} from './live-verification.ts';
import {OUT_EXT} from './comfyui-backend.ts';
import {isModelWeightName} from './weights.ts';

export const MAX_IMPORT_BYTES=64*1024*1024;
const HEX64=/^[0-9a-f]{64}$/,NAME=/^[A-Za-z0-9._-]{1,120}$/,B64=/^[A-Za-z0-9+/]*={0,2}$/;
export type NotebookPackage={schema:1;kind:'hahmostudio-notebook-package';jobId:string;createdAt:string;workflowId:string;modelId:string;graph:ComfyGraph;inputs:Record<string,string>;manifest:ProvisionManifest;comfyCommit?:string;packageHash:string};
export type NotebookConfig={descriptor:BackendDescriptor;models:ModelRegistry;workflows:WorkflowRegistry;mode:ModelMode;policy:ComputePolicy;/** Python sources embedded in the notebook (read from cloud/runtime on the server). */runtimeSources:()=>Record<string,string>;timeoutMs?:number;comfyCommit?:string};
type Pending={hash:string;notebook:string;fileName:string;model:ModelDefinition;job:RenderJob;resolve:(r:RenderResult)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
const b64=(b:Uint8Array)=>Buffer.from(b).toString('base64');
const imageExt=(b:Uint8Array)=>b[0]===0xff&&b[1]===0xd8?'jpg':b[0]===0x52&&b[1]===0x49&&b[8]===0x57?'webp':'png';

/**
 * Manual notebook execution (e.g. a Kaggle notebook the user runs themselves). The server never contacts any runtime:
 * render() packages the exact graph, inputs and pinned model manifest into a notebook file and then waits until the user
 * imports the result file. The import is untrusted and must match this job's package hash, the server's own pin and the
 * output checksums before anything enters the normal output validation, storage and audit path.
 */
export class NotebookBackend implements RenderBackend{
 readonly descriptor:BackendDescriptor;private cfg:NotebookConfig;private pending=new Map<string,Pending>();
 constructor(cfg:NotebookConfig){this.cfg=cfg;this.descriptor=cfg.descriptor;}
 async getCapabilities():Promise<BackendCapabilities>{return{workflows:this.cfg.workflows.list().filter(w=>w.implemented).map(w=>w.id),outputFormats:['png','jpg','webp','mp4','webm']};}
 async estimateCost():Promise<CostEstimate>{return{estimatedCostEur:0,confidence:'exact',billingProvider:this.descriptor.billingProvider,note:'Operator-declared free notebook quota.'};}
 private graph(job:RenderJob){const wf=this.cfg.workflows.require(job.workflowId),model=this.cfg.models.get(job.modelId);if(!model)throw new Blocked('model-unknown','Model is not registered.');return{graph:wf.buildGraph!(job,model),model};}
 staticValidate(job:RenderJob):string[]{try{this.graph(job);return [];}catch(e){return [(e as Error).message];}}
 /** No runtime can be reached from the server; only the graph is checked here. The runtime check happens in the notebook. */
 async validate(job:RenderJob,auth:ExecutionToken):Promise<BackendValidation>{assertToken(auth,job.id,this.descriptor.id);const p=this.staticValidate(job);return{ok:!p.length,problems:p};}
 async render(job:RenderJob,auth:ExecutionToken,inputs?:ReadonlyMap<string,Uint8Array>):Promise<RenderResult>{
  assertToken(auth,job.id,this.descriptor.id);
  const {graph,model}=this.graph(job),files:Record<string,string>={};
  for(const [nodeId,n] of Object.entries(graph))if(n.class_type==='LoadImage'){
   const bytes=inputs?.get(String(n.inputs.image));if(!bytes)throw new Blocked('input-missing',`Input asset "${String(n.inputs.image)}" was not provided.`);
   const name=`${job.id}-${nodeId}.${imageExt(bytes)}`;files[name]=b64(bytes);n.inputs.image=name;
  }
  const body={schema:1 as const,kind:'hahmostudio-notebook-package' as const,jobId:job.id,createdAt:job.createdAt,workflowId:job.workflowId,modelId:model.id,graph,inputs:files,manifest:buildProvisionManifest(model,this.cfg.mode,this.cfg.policy),comfyCommit:this.cfg.comfyCommit};
  const pkg:NotebookPackage={...body,packageHash:await sha256(new TextEncoder().encode(canonicalJson(body)))};
  const notebook=buildKaggleNotebook(pkg,this.cfg.runtimeSources()),fileName=`hahmo-${job.id}.ipynb`;
  return new Promise<RenderResult>((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(job.id);reject(new Error('The notebook result was not imported in time.'));},this.cfg.timeoutMs??24*3600*1000);
   this.pending.set(job.id,{hash:pkg.packageHash,notebook,fileName,model,job,resolve,reject,timer});
  });
 }
 /** The notebook for a job that is waiting for its result, or undefined. */
 notebookFor(jobId:string){const p=this.pending.get(jobId);return p?{fileName:p.fileName,notebook:p.notebook}:undefined;}
 isPending(jobId:string){return this.pending.has(jobId);}
 /** Verifies an imported result file. Throws Blocked (job keeps waiting) on any mismatch; on success the render resumes. */
 async importResult(jobId:string,raw:unknown):Promise<{accepted:true;outputs:number}>{
  const no=(m:string)=>new Blocked('import-rejected',m);
  const p=this.pending.get(jobId);if(!p)throw no('This job is not waiting for a notebook result (it finished, was cancelled, timed out, or the server restarted). Start the render again.');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw no('The result file is not a JSON object.');
  const r=raw as Record<string,any>;
  if(r.schema!==1||r.kind!=='hahmostudio-notebook-result')throw no('This is not a Hahmostudio notebook result file.');
  if(r.jobId!==jobId)throw no('The result file belongs to a different job.');
  if(typeof r.packageHash!=='string'||r.packageHash!==p.hash)throw no('The result file was produced from a different package.');
  const rc=r.receipt;
  if(!rc||rc.schema!==1||typeof rc.repo!=='string'||typeof rc.revision!=='string'||!Array.isArray(rc.files)||!receiptMatches(p.model,rc))throw no('The provision receipt does not match the pinned model revision and checksums.');
  const rows=Array.isArray(r.checks)?r.checks.slice(0,50).filter((x:any)=>x&&typeof x.workflowId==='string'&&typeof x.modelId==='string'&&typeof x.ok==='boolean'&&Array.isArray(x.problems)).map((x:any)=>({workflowId:x.workflowId.slice(0,100),modelId:x.modelId.slice(0,100),ok:x.ok,problems:x.problems.slice(0,20).map((y:unknown)=>String(y).slice(0,500))})):[];
  if(!rows.some((x:{workflowId:string;modelId:string;ok:boolean})=>x.ok&&x.workflowId===p.job.workflowId&&x.modelId===p.job.modelId))throw no('The runtime check for this workflow and model did not pass.');
  if(!Array.isArray(r.outputs)||!r.outputs.length||r.outputs.length>16)throw no('The result file has no valid outputs.');
  const artifacts:RenderArtifact[]=[];let total=0;
  for(const o of r.outputs){
   if(!o||typeof o.name!=='string'||!NAME.test(o.name)||typeof o.sha256!=='string'||!HEX64.test(o.sha256)||typeof o.dataBase64!=='string'||!B64.test(o.dataBase64))throw no('An output entry is malformed.');
   const ext=o.name.split('.').pop()!.toLowerCase(),mime=OUT_EXT.get(ext);
   if(isModelWeightName(o.name)||!mime)throw no(`Output "${o.name}" has a disallowed type.`);
   total+=o.dataBase64.length*3/4;if(total>MAX_IMPORT_BYTES)throw no('The outputs exceed the size limit.');
   const bytes=new Uint8Array(Buffer.from(o.dataBase64,'base64'));
   if(await sha256(bytes)!==o.sha256)throw no(`Output "${o.name}" does not match its checksum.`);
   artifacts.push({name:o.name,mime,bytes});
  }
  const rt=r.runtime&&typeof r.runtime==='object'?r.runtime:{};
  const evidence:RuntimeEvidence={source:'runtime-reported',checkedAt:typeof rt.checkedAt==='string'?rt.checkedAt.slice(0,40):'',rows,receipt:{schema:1,repo:rc.repo,revision:rc.revision,files:rc.files.map((f:any)=>({path:String(f.path),sha256:String(f.sha256)}))},
   comfyCommit:typeof rt.comfyCommit==='string'&&/^[0-9a-f]{40}$/.test(rt.comfyCommit)?rt.comfyCommit:undefined,gpu:typeof rt.gpu==='string'?rt.gpu.slice(0,200):undefined};
  clearTimeout(p.timer);this.pending.delete(jobId);
  p.resolve({artifacts,backendJobId:'notebook:'+jobId,runtimeEvidence:evidence});
  return{accepted:true,outputs:artifacts.length};
 }
 async cancel(jobId:string){const p=this.pending.get(jobId);if(!p)return;clearTimeout(p.timer);this.pending.delete(jobId);p.reject(new Error('Render cancelled.'));}
}

/** One self-contained .ipynb: instructions + a single code cell that unpacks the runtime scripts and the package and runs them. */
export function buildKaggleNotebook(pkg:NotebookPackage,sources:Record<string,string>):string{
 const enc=(s:string)=>Buffer.from(s,'utf8').toString('base64');
 const files=Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,enc(v)]));
 const md=['# Hahmostudio · renderöinti '+pkg.jobId,'','1. Oikea paneeli → **Session options**: **Accelerator** = GPU T4 x2 tai GPU P100, **Internet** = On.','2. Valitse **Run All**. Ensimmäinen ajo lataa noin 18 Gt mallitiedostoja; edistymispalkkia ei näy.','3. Kun solun lopussa lukee **VALMIS**, lataa tiedosto: oikea paneeli → **Output** → tiedosto → **Download**.','4. Tuo tiedosto Hahmostudiossa painikkeella **Tuo tulos**.','5. Sammuta istunto (**Stop session**).','','ComfyUI käynnistyy vain tämän istunnon sisälle (127.0.0.1): ei tunnelia, ei julkista osoitetta. Käytä vain Kagglen viikkokiintiötä, äläkä jaa muistikirjaa tai tuloksia palveluna muille.'];
 const code=['# Hahmostudio: älä muokkaa tätä solua. Paketti, työnkulku ja mallien tarkistussummat ovat alla.','import base64, json, os, sys','FILES = '+JSON.stringify(files),'PACKAGE = '+JSON.stringify(enc(JSON.stringify(pkg))),'d = "/tmp/hahmo-src"','os.makedirs(d, exist_ok=True)','for name, data in FILES.items():','    open(os.path.join(d, name), "wb").write(base64.b64decode(data))','sys.path.insert(0, d)','import hahmo_notebook','hahmo_notebook.run(json.loads(base64.b64decode(PACKAGE)))'];
 const lines=(a:string[])=>a.map((l,i)=>i<a.length-1?l+'\n':l);
 return JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{kernelspec:{name:'python3',display_name:'Python 3',language:'python'},language_info:{name:'python'},kaggle:{accelerator:'gpu',isInternetEnabled:true,isGpuEnabled:true,language:'python',sourceType:'notebook'}},
  cells:[{cell_type:'markdown',id:'hahmo-info',metadata:{},source:lines(md)},{cell_type:'code',id:'hahmo-run',metadata:{},execution_count:null,outputs:[],source:lines(code)}]});
}
