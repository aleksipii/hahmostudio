import {canonicalJson,sha256} from '../studio/hash.ts';
import type {ComputePolicy,ModelDefinition,ModelMode} from './types.ts';
import type {ModelRegistry} from './models.ts';
import {assessModel} from './models.ts';
import type {RenderRecord} from './audit.ts';
import type {StorageBackend} from './storage.ts';
import type {SmokeRow} from './smoke.ts';

/** Written by cloud/runtime/provision_models.py after every file's SHA-256 was verified inside the runtime. */
export type ProvisionReceipt={schema:1;repo:string;revision:string;files:{path:string;sha256:string}[]};
export type SmokeEvidence={backendId:string;workflowId:string;modelId:string;fingerprint:string;at:string};
export type Promotion={workflowId:string;modelId:string;backendId:string;fingerprint:string;jobId:string;at:string};
export type PromotionResult={promoted:boolean;missing:string[];source?:'runtime-reported'};
/** Notebook runs: the server never reaches the runtime, so its own smoke check cannot run. Evidence comes from the imported result instead. */
export const NOTEBOOK_PROVIDER='notebook';
export const SMOKE_MAX_AGE_MS=24*3600*1000;
/** Identity of exactly what was verified: revision + every pinned file hash. A changed pin invalidates old evidence. */
export async function modelFingerprint(m:ModelDefinition){return sha256(new TextEncoder().encode(canonicalJson({id:m.id,rev:m.revision,files:(m.files??[]).map(f=>[f.path,f.sha256]).sort()})));}
export function receiptMatches(m:ModelDefinition,r:ProvisionReceipt){
 if(!m.revision||!m.files?.length||!m.source.startsWith('huggingface:')||r.schema!==1)return false;
 if(r.repo!==m.source.slice('huggingface:'.length)||r.revision!==m.revision)return false;
 return m.files.every(f=>r.files.some(x=>x.path===f.path&&x.sha256===f.sha256));
}
/**
 * The only way a workflow becomes "liveVerified". There is no API or setter: promotion is evaluated by the server from evidence it
 * holds itself (its own smoke run, receipts from a server-side directory, and the completed render record). Mock backends never qualify.
 */
export class LiveVerificationLedger{
 private smoke:SmokeEvidence[]=[];private promotions:Promotion[]=[];
 private models:ModelRegistry;private policy:ComputePolicy;private mode:ModelMode;private storage:StorageBackend;private receipts:()=>ProvisionReceipt[];private now:()=>Date;
 constructor(o:{models:ModelRegistry;policy:ComputePolicy;mode:ModelMode;storage:StorageBackend;receipts:()=>ProvisionReceipt[];now?:()=>Date}){this.models=o.models;this.policy=o.policy;this.mode=o.mode;this.storage=o.storage;this.receipts=o.receipts;this.now=o.now??(()=>new Date());}
 async recordSmoke(backendId:string,provider:string,rows:SmokeRow[]){
  // A notebook backend's validate() never reaches the runtime, so a server-side smoke check proves nothing about it.
  if(provider==='mock'||provider===NOTEBOOK_PROVIDER)return 0;let n=0;
  for(const r of rows){if(!r.ok)continue;const m=this.models.get(r.modelId);if(!m)continue;
   this.smoke=this.smoke.filter(x=>!(x.backendId===backendId&&x.workflowId===r.workflowId&&x.modelId===r.modelId));
   this.smoke.push({backendId,workflowId:r.workflowId,modelId:r.modelId,fingerprint:await modelFingerprint(m),at:this.now().toISOString()});n++;}
  return n;
 }
 async evaluate(rec:RenderRecord,provider:string):Promise<PromotionResult>{
  const missing:string[]=[],job=rec.job,m=this.models.get(job.modelId);
  if(provider==='mock')missing.push('backend-not-live');
  if(!m)return{promoted:false,missing:[...missing,'model-unknown']};
  const fp=await modelFingerprint(m),at=Date.parse(job.createdAt);
  const s=this.smoke.find(x=>x.backendId===job.backendId&&x.workflowId===job.workflowId&&x.modelId===job.modelId&&x.fingerprint===fp);
  // Notebook runs: the check and receipt were made in the same runtime session, bound to this job's package (hash verified on import).
  const ev=provider===NOTEBOOK_PROVIDER?rec.runtimeEvidence:undefined;
  const smokeOk=ev?ev.rows.some(r=>r.ok&&r.workflowId===job.workflowId&&r.modelId===job.modelId):!!s&&Date.parse(s.at)<=at&&at-Date.parse(s.at)<=SMOKE_MAX_AGE_MS;
  if(!smokeOk)missing.push('smoke-not-passed');
  if(!m.revision||!/^[0-9a-f]{40}$/.test(m.revision))missing.push('revision-not-pinned');
  if(!this.receipts().some(r=>receiptMatches(m,r))&&!(ev&&receiptMatches(m,ev.receipt)))missing.push('checksums-not-verified');
  if(this.mode!=='PRODUCTION_SAFE'||!assessModel(m,'PRODUCTION_SAFE',this.policy).ok)missing.push('license-not-validated');
  if(rec.state!=='COMPLETED'||rec.model?.revision!==m.revision)missing.push('render-not-completed');
  if(!rec.outputs.length||!rec.outputValidation?.ok)missing.push('output-not-uploaded');
  try{const names=(await this.storage.listProjectAssets(job.projectId)).map(a=>`${a.folder}/${a.name}`);
   if(!rec.outputs.every(o=>names.includes(`${o.folder}/${o.name}`))&&rec.outputs.length)missing.push('output-not-uploaded');
   if(!names.includes(`metadata/${job.id}.record.json`)||!names.includes(`logs/${job.id}.audit.json`))missing.push('audit-not-written');}
  catch{missing.push('audit-not-written');}
  const uniq=[...new Set(missing)];
  if(!uniq.length&&smokeOk){this.promotions=this.promotions.filter(p=>!(p.workflowId===job.workflowId&&p.modelId===job.modelId&&p.backendId===job.backendId));this.promotions.push({workflowId:job.workflowId,modelId:job.modelId,backendId:job.backendId as string,fingerprint:fp,jobId:job.id,at:this.now().toISOString()});}
  return ev?{promoted:!uniq.length,missing:uniq,source:'runtime-reported'}:{promoted:!uniq.length,missing:uniq};
 }
 /** True only while the promoted evidence still matches the current pin. */
 async isVerified(workflowId:string,modelId?:string){
  for(const p of this.promotions){if(p.workflowId!==workflowId||modelId&&p.modelId!==modelId)continue;const m=this.models.get(p.modelId);if(m&&await modelFingerprint(m)===p.fingerprint)return true;}
  return false;
 }
 list(){return{smoke:[...this.smoke],promotions:[...this.promotions]};}
}
