import {canonicalJson,sha256} from '../studio/hash.ts';
import {Blocked,type ComputePolicy,type ModelMode,type RenderJob,type RenderParams,type RenderState} from './types.ts';
import {own,validateCanonicalState,type CanonicalState,RULE_ENGINE_VERSION} from './canonical.ts';
import {buildAIContext} from './ai-context.ts';
import {AI_DIRECTOR_VERSION,RuleBasedDirector,type AIDirector} from './ai-suggestion.ts';
import {validateSuggestion} from './ai-validator.ts';
import {validateContinuity} from './continuity.ts';
import {compilePrompt,PROMPT_COMPILER_VERSION} from './prompt-compiler.ts';
import {lockMatches,lockScene,type SceneLock} from './scene-lock.ts';
import {ModelRouter,assessModel} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {BackendRegistry} from './backends.ts';
import {ComputeCostGate,PaidComputeFirewall,assertPolicyInvariant,blockedMessage,costViolations,type ExecutionToken} from './compute.ts';
import {CharacterReferenceSystem} from './character-refs.ts';
import {AuditLog,type RenderRecord} from './audit.ts';
import {validateOutput,type OutputInspector,type OutputStrictness} from './output-validation.ts';
import {getJson,putJson,type AssetRef,type StorageBackend} from './storage.ts';

export type RenderRequest={projectId:string;sceneId:string;workflowId:string;modelId?:string;backendId?:string;useAI?:boolean;seed?:number;outputFormat?:string;params?:Partial<RenderParams>;requestedBy:string};
const POLICY_KEYS=/policy|cost|paid|fallback|budget|license|commercial|mode|canon|state|prompt|verify|lock/i;
/** Strict request parsing. Policy-like fields are rejected loudly, not ignored: the client cannot influence server policy. */
export function parseRenderRequest(raw:unknown,requestedBy:string):RenderRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Blocked('bad-request','Request must be an object.');
 const o=raw as Record<string,unknown>,allowed=['projectId','sceneId','workflowId','modelId','backendId','useAI','seed','outputFormat','params'];
 for(const k of Object.keys(o))if(!allowed.includes(k))throw new Blocked(POLICY_KEYS.test(k)?'client-policy-override':'bad-request',POLICY_KEYS.test(k)?`Field "${k}" is server-side policy and cannot be set by the client.`:`Unknown field "${k}".`);
 const id=(v:unknown,k:string,opt=false)=>{if(v===undefined&&opt)return undefined;if(typeof v!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(v))throw new Blocked('bad-request',`Invalid ${k}.`);return v;};
 const p=(o.params??{}) as Record<string,unknown>;if(typeof p!=='object'||Array.isArray(p))throw new Blocked('bad-request','Invalid params.');
 for(const k of Object.keys(p))if(!['width','height','steps','sampler','scheduler','cfg','frames','fps'].includes(k))throw new Blocked('bad-request',`Unknown parameter "${k}".`);
 const num=(k:string,lo:number,hi:number,int=false)=>{const v=p[k];if(v===undefined)return undefined;if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||int&&!Number.isInteger(v))throw new Blocked('bad-request',`Parameter ${k} out of range.`);return v;};
 const word=(k:string)=>{const v=p[k];if(v===undefined)return undefined;if(typeof v!=='string'||!/^[a-z0-9_]{1,40}$/.test(v))throw new Blocked('bad-request',`Invalid ${k}.`);return v;};
 const params:Partial<RenderParams>={width:num('width',64,2048,true),height:num('height',64,2048,true),steps:num('steps',1,100,true),cfg:num('cfg',0,30),frames:num('frames',1,241,true),fps:num('fps',1,60,true),sampler:word('sampler'),scheduler:word('scheduler')};
 for(const k of Object.keys(params) as (keyof RenderParams)[])if(params[k]===undefined)delete params[k];
 if(params.width!==undefined&&params.width%8||params.height!==undefined&&params.height%8)throw new Blocked('bad-request','Width and height must be multiples of 8.');
 if(o.seed!==undefined&&(!Number.isSafeInteger(o.seed)||(o.seed as number)<0))throw new Blocked('bad-request','Invalid seed.');
 if(o.useAI!==undefined&&typeof o.useAI!=='boolean')throw new Blocked('bad-request','Invalid useAI.');
 const fmt=o.outputFormat===undefined?undefined:String(o.outputFormat);if(fmt!==undefined&&!['png','jpg','webp','mp4','webm','image','video'].includes(fmt))throw new Blocked('bad-request','Invalid outputFormat.');
 return{projectId:id(o.projectId,'projectId') as string,sceneId:id(o.sceneId,'sceneId') as string,workflowId:id(o.workflowId,'workflowId') as string,modelId:id(o.modelId,'modelId',true),backendId:id(o.backendId,'backendId',true),useAI:o.useAI as boolean|undefined,seed:o.seed as number|undefined,outputFormat:fmt,params,requestedBy};
}
export class ProjectStore{
 private states=new Map<string,CanonicalState>();private locks=new Map<string,SceneLock>();
 private storage?:StorageBackend;
 constructor(storage?:StorageBackend){this.storage=storage;}
 /** Accepts a snapshot exported by the rule engine / studio. Validated; never produced by the AI path. */
 async put(raw:unknown){const s=validateCanonicalState(raw),old=this.states.get(s.projectId);if(old&&s.revision<old.revision)throw new Blocked('stale-revision','A newer canonical revision is already stored.');this.states.set(s.projectId,s);if(this.storage){await this.storage.createProject(s.projectId,{projectId:s.projectId,revision:s.revision});await putJson(this.storage,s.projectId,'metadata','canonical-state.json',s);}return s;}
 get(id:string){const s=this.states.get(id);return s&&structuredClone(s);}
 list(){return [...this.states.values()].map(s=>({projectId:s.projectId,revision:s.revision,scenes:Object.keys(s.scenes).length}));}
 async lock(projectId:string,sceneId:string,by:string){const s=this.states.get(projectId);if(!s)throw new Blocked('project-unknown','Unknown project.');const l=await lockScene(s,sceneId,by);this.locks.set(projectId+'\0'+sceneId,l);if(this.storage)await putJson(this.storage,projectId,'scenes',`${sceneId}.lock.json`,l);return l;}
 getLock(projectId:string,sceneId:string){return this.locks.get(projectId+'\0'+sceneId);}
 unlock(projectId:string,sceneId:string){return this.locks.delete(projectId+'\0'+sceneId);}
 async restore(projectId:string){if(!this.storage)return;const a=await this.storage.listProjectAssets(projectId,'metadata');const f=a.find(x=>x.name==='canonical-state.json');if(f)this.states.set(projectId,validateCanonicalState(await getJson(this.storage,f)));}
}
export type ServiceDeps={projects:ProjectStore;storage:StorageBackend;backends:BackendRegistry;router:ModelRouter;workflows:WorkflowRegistry;policy:ComputePolicy;modelMode:ModelMode;director?:AIDirector;refs:CharacterReferenceSystem;audit?:AuditLog;requireSceneLock?:boolean;inspector?:OutputInspector;strictness?:OutputStrictness;now?:()=>Date;maxActive?:number};
const HEX=(n:number)=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
export class RenderService{
 readonly audit:AuditLog;private records=new Map<string,RenderRecord>();private active=new Map<string,{cancelled:boolean;backendId?:string;token?:ExecutionToken}>();
 private gate=new ComputeCostGate();private firewall=new PaidComputeFirewall();
 private d:ServiceDeps;
 constructor(d:ServiceDeps){this.d=d;assertPolicyInvariant(d.policy);this.audit=d.audit??new AuditLog(d.now);}
 get(id:string){const r=this.records.get(id);return r&&structuredClone(r);}
 list(){return [...this.records.values()].map(r=>({id:r.job.id,state:r.state,projectId:r.job.projectId,sceneId:r.job.sceneId}));}
 /** Returns immediately with the QUEUED record; `done` settles when the job reaches a terminal state. */
 start(req:RenderRequest):{jobId:string;done:Promise<RenderRecord>}{
  if(this.active.size>=(this.d.maxActive??2))throw new Blocked('busy','Too many renders are running.');
  const now=(this.d.now??(()=>new Date()))().toISOString(),id='rj_'+HEX(10);
  const job:RenderJob={id,projectId:req.projectId,sceneId:req.sceneId,workflowId:req.workflowId,modelId:req.modelId??'',backendId:req.backendId,prompt:'',inputs:[],outputFormat:req.outputFormat??'image',requestedBy:req.requestedBy,createdAt:now,params:{width:1024,height:1024,steps:20,sampler:'euler',scheduler:'normal',cfg:5}};
  const rec:RenderRecord={job,state:'QUEUED',history:[{state:'QUEUED',at:now}],versions:{ruleEngine:RULE_ENGINE_VERSION,aiDirector:AI_DIRECTOR_VERSION,promptCompiler:PROMPT_COMPILER_VERSION,aiDirectorId:'none'},scene:{revision:0},outputs:[],errors:[],providerContacted:false};
  this.records.set(id,rec);this.active.set(id,{cancelled:false});
  const done=this.run(req,rec).finally(()=>this.active.delete(id));
  return{jobId:id,done};
 }
 async cancel(jobId:string){
  const a=this.active.get(jobId);if(!a)return false;a.cancelled=true;
  const b=a.backendId?this.d.backends.get(a.backendId):undefined;if(b)await b.cancel(jobId,a.token).catch(()=>{});return true;
 }
 private async set(rec:RenderRecord,state:RenderState){rec.state=state;rec.history.push({state,at:(this.d.now??(()=>new Date()))().toISOString()});await this.audit.append(rec.job.id,'state',{state});}
 private async block(rec:RenderRecord,e:Blocked,extra?:string[]){
  rec.blocked={code:e.code,banner:blockedMessage([...(extra??[]),e.message],rec.providerContacted)};rec.errors.push(e.message);await this.set(rec,'BLOCKED');
 }
 private async run(req:RenderRequest,rec:RenderRecord):Promise<RenderRecord>{
  const job=rec.job,ctl=this.active.get(job.id)!;
  try{
   await this.audit.append(job.id,'request',{...req});
   await this.set(rec,'VALIDATING');
   // 2-4 canonical state, scene, scene validation, scene lock
   const live=this.d.projects.get(req.projectId);if(!live)throw new Blocked('project-unknown',`Unknown project "${req.projectId}".`);
   if(!own(live.scenes,req.sceneId))throw new Blocked('scene-unknown',`Unknown scene "${req.sceneId}".`);
   const sceneIssues=validateContinuity(live,req.sceneId);if(sceneIssues.length)throw new Blocked('scene-invalid','Scene failed validation: '+sceneIssues.map(i=>i.message).join(' '));
   const lock=this.d.projects.getLock(req.projectId,req.sceneId);let canon=live;
   if(lock){if(!await lockMatches(lock,live))throw new Blocked('lock-stale','The approved scene lock no longer matches canon. Unlock and re-approve the scene.');canon=lock.snapshot;rec.scene={revision:live.revision,lockId:lock.id,lockHash:lock.hash};}
   else if(this.d.requireSceneLock!==false)throw new Blocked('lock-missing','The scene is not approved and locked.');
   else rec.scene={revision:live.revision};
   // 5-8 AI context, suggestion, deterministic validation
   const ctx=buildAIContext(canon,req.sceneId);
   let director:AIDirector;if(req.useAI){if(!this.d.director)throw new Blocked('director-unavailable','No AI Director is configured.');director=this.d.director;}else director=new RuleBasedDirector();
   rec.versions.aiDirector=director.version;rec.versions.aiDirectorId=director.id;
   let raw:unknown;try{raw=await director.suggest(ctx);}catch{throw new Blocked('director-failed','The AI Director failed; nothing was rendered.');}
   await this.audit.append(job.id,'ai-suggestion',{director:director.id,raw});
   const v=validateSuggestion(canon,req.sceneId,raw);rec.validation={status:v.status,issues:v.issues,checks:v.checks};
   await this.audit.append(job.id,'hallucination-checks',{status:v.status,issues:v.issues,checks:v.checks});
   if(v.status!=='APPROVED'||!v.approved)throw new Blocked('ai-rejected','AI suggestion rejected: '+v.issues.map(i=>i.message).join(' '));
   // 9 deterministic prompt
   const prompt=compilePrompt(v.approved,canon,lock);job.prompt=prompt.prompt;job.negativePrompt=prompt.negativePrompt;
   // 10-11 workflow, model, license
   const wf=this.d.workflows.require(req.workflowId);rec.workflow={id:wf.id,revision:wf.revision};
   const model=this.d.router.select({workflowId:req.workflowId,modelId:req.modelId,mode:this.d.modelMode,policy:this.d.policy});
   if(!model.capabilities.includes(wf.requiredCapability))throw new Blocked('model-capability',`Model "${model.id}" lacks capability "${wf.requiredCapability}".`);
   const m=assessModel(model,this.d.modelMode,this.d.policy);if(!m.ok)throw new Blocked('model-license',m.reasons.join(' '));
   job.modelId=model.id;rec.model={id:model.id,revision:model.revision,license:model.license,commercialUse:model.commercialUse,source:model.source};
   job.params={...job.params,...model.defaults,...req.params};
   job.seed=req.seed??parseInt(HEX(4),16);
   // inputs (storage only, no compute)
   await this.d.refs.load(req.projectId,canon.scenes[req.sceneId].characterIds);
   job.inputs=this.d.refs.resolve(req.projectId,canon.scenes[req.sceneId].characterIds,wf.requiresCharacterReference);
   if(wf.requiresSourceImage&&!job.inputs.length)throw new Blocked('input-missing',`Workflow "${wf.id}" needs an approved reference image as source.`);
   const bytes=new Map<string,Uint8Array>();for(const i of job.inputs){const ref=JSON.parse(i.storageRef??'null') as AssetRef|null;if(!ref)throw new Blocked('input-missing','Input has no storage reference.');bytes.set(i.assetId,await this.d.storage.downloadAsset(ref));}
   if(job.outputFormat==='image'&&wf.kind==='video')job.outputFormat='video';
   if(job.outputFormat==='image'&&wf.kind==='image')job.outputFormat='png';
   if(job.outputFormat==='video')job.outputFormat='mp4';
   // 12 backend
   const backend=this.d.backends.select(req.backendId,d=>d.enabled&&this.d.policy.allowedBackendClasses.includes(d.class));
   job.backendId=backend.descriptor.id;ctl.backendId=job.backendId;rec.backend={id:job.backendId,class:backend.descriptor.class,provider:backend.descriptor.provider};
   const caps=await backend.getCapabilities();if(!caps.workflows.includes(wf.id))throw new Blocked('backend-capability',`Backend "${job.backendId}" does not support workflow "${wf.id}".`);
   const sp=backend.staticValidate?.(job)??[];if(sp.length)throw new Blocked('backend-static',sp.join(' '));
   // 13-15 cost, gate, firewall
   await this.set(rec,'COST_CHECK');
   const auth=await this.gate.authorize(job,backend,this.d.policy);rec.cost=auth;await this.audit.append(job.id,'cost-authorization',auth);
   if(!auth.authorized)throw new Blocked('cost-blocked','Compute authorization failed.');
   await this.set(rec,'AUTHORIZED');
   const token=await this.firewall.clear(job,backend,auth,this.d.policy);ctl.token=token;
   rec.reproducibility=await this.repro(job,rec,model.revision);await this.audit.append(job.id,'reproducibility',rec.reproducibility);
   // 16-17 provider
   if(ctl.cancelled){await this.set(rec,'CANCELLED');return rec;}
   await this.set(rec,'SUBMITTING');rec.providerContacted=true;
   const val=await backend.validate(job,token);
   if(!val.ok)throw new Blocked('backend-unavailable',val.problems.join(' ')||'Backend unavailable.');
   await this.set(rec,'RENDERING');
   const result=await backend.render(job,token,bytes);
   if(ctl.cancelled){await this.set(rec,'CANCELLED');return rec;}
   // 18 output validation
   await this.set(rec,'VALIDATING_OUTPUT');
   const ov=await validateOutput(job,result.artifacts,this.d.strictness??'reject',this.d.inspector);rec.outputValidation=ov;await this.audit.append(job.id,'output-validation',ov);
   if(!ov.ok)throw new Error('Output rejected: '+ov.rejects.join(' '));
   // 19 upload
   await this.set(rec,'UPLOADING');
   for(const a of result.artifacts)rec.outputs.push(await this.d.storage.uploadRender(job.projectId,`${job.id}-${a.name}`,a.bytes,a.mime));
   // 20 audit
   await this.audit.append(job.id,'outputs',rec.outputs);
   await this.set(rec,'COMPLETED');
   await this.persist(rec);
   return rec;
  }catch(e){
   if(e instanceof Blocked&&!(ctl.cancelled)){
    // Blocked is a safe, intentional stop. If the provider was already contacted (validate said no), say so honestly.
    await this.block(rec,e,rec.providerContacted?undefined:rec.cost&&!rec.cost.authorized?rec.cost.reasons:undefined);
   }else if(ctl.cancelled)await this.set(rec,'CANCELLED');
   else{rec.errors.push((e as Error).message??'Render failed.');await this.set(rec,'FAILED');}
   await this.persist(rec).catch(()=>{});
   return rec;
  }
 }
 private async repro(job:RenderJob,rec:RenderRecord,revision?:string){
  const promptHash=await sha256(new TextEncoder().encode(job.prompt+'\0'+(job.negativePrompt??'')));
  return{modelId:job.modelId,modelRevision:revision,workflowId:job.workflowId,workflowRevision:rec.workflow?.revision,prompt:job.prompt,negativePrompt:job.negativePrompt,promptHash,seed:job.seed,resolution:`${job.params.width}x${job.params.height}`,params:job.params,inputAssetIds:job.inputs.map(i=>i.assetId),characterReferenceIds:job.inputs.filter(i=>i.kind==='character_reference').map(i=>i.assetId),sceneRevision:rec.scene.revision,sceneLockHash:rec.scene.lockHash,versions:rec.versions,timestamp:(this.d.now??(()=>new Date()))().toISOString()};
 }
 private async persist(rec:RenderRecord){
  try{await putJson(this.d.storage,rec.job.projectId,'metadata',`${rec.job.id}.record.json`,rec);await putJson(this.d.storage,rec.job.projectId,'logs',`${rec.job.id}.audit.json`,this.audit.entries(rec.job.id));}catch{rec.errors.push('Audit/record upload failed.');}
 }
}
export {costViolations,canonicalJson};
