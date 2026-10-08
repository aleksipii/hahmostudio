import {canonicalJson,sha256} from '../studio/hash.ts';
import {Blocked,type ComputePolicy,type ModelMode,type RenderJob,type RenderParams,type RenderState} from './types.ts';
import {own,validateCanonicalState,type CanonicalState,RULE_ENGINE_VERSION} from './canonical.ts';
import {buildAIContext} from './ai-context.ts';
import {AI_DIRECTOR_VERSION,RuleBasedDirector,type AIDirector} from './ai-suggestion.ts';
import {validateSuggestion} from './ai-validator.ts';
import {validateContinuity} from './continuity.ts';
import {compilePrompt,PROMPT_COMPILER_VERSION} from './prompt-compiler.ts';
import {lockMatches,lockScene,type SceneLock} from './scene-lock.ts';
import {ModelRouter,assessModel,type ModelRegistry} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {BackendRegistry} from './backends.ts';
import {ComputeCostGate,PaidComputeFirewall,assertPolicyInvariant,blockedMessage,costViolations,type ExecutionToken} from './compute.ts';
import {CharacterReferenceSystem} from './character-refs.ts';
import {AuditLog,type RenderRecord} from './audit.ts';
import type {Issue} from './continuity.ts';
import type {Check} from './ai-validator.ts';
import {validateOutput,type OutputInspector,type OutputStrictness} from './output-validation.ts';
import {LiveVerificationLedger} from './live-verification.ts';
import {getJson,putJson,type AssetRef,type StorageBackend} from './storage.ts';

export type RenderRequest={projectId:string;sceneId:string;workflowId:string;modelId?:string;backendId?:string;useAI?:boolean;seed?:number;outputFormat?:string;params?:Partial<RenderParams>;requestedBy:string;/** Fingerprint from /api/render/preflight; binds the render to the authorization the user saw. */authorizationFingerprint?:string;/** Internal only (never parsed from a client): one clip of a character_animation. */focus?:{eventId:string;actorId:string}};
const POLICY_KEYS=/policy|cost|paid|fallback|budget|license|commercial|mode|canon|state|prompt|verify|lock/i;
/** Strict request parsing. Policy-like fields are rejected loudly, not ignored: the client cannot influence server policy. */
export function parseRenderRequest(raw:unknown,requestedBy:string):RenderRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Blocked('bad-request','Request must be an object.');
 const o=raw as Record<string,unknown>,allowed=['projectId','sceneId','workflowId','modelId','backendId','useAI','seed','outputFormat','params','authorizationFingerprint'];
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
 if(o.authorizationFingerprint!==undefined&&!(typeof o.authorizationFingerprint==='string'&&/^[0-9a-f]{64}$/.test(o.authorizationFingerprint)))throw new Blocked('bad-request','Invalid authorizationFingerprint.');
 return{authorizationFingerprint:o.authorizationFingerprint as string|undefined,projectId:id(o.projectId,'projectId') as string,sceneId:id(o.sceneId,'sceneId') as string,workflowId:id(o.workflowId,'workflowId') as string,modelId:id(o.modelId,'modelId',true),backendId:id(o.backendId,'backendId',true),useAI:o.useAI as boolean|undefined,seed:o.seed as number|undefined,outputFormat:fmt,params,requestedBy};
}
export type ClipPlan={eventId:string;at:number;actor:string;action:string;target?:string};
export type AuthorizationCard={clips?:ClipPlan[];status:'AUTHORIZED'|'BLOCKED';stage:string;reasons:string[];fingerprint?:string;workflowId:string;workflowRevision?:number;backend:{id:string;class:string;provider:string;enabled:boolean}|null;estimate:{estimatedCostEur:number|null;confidence:string;billingProvider:string}|null;maxCostEur:number;paidCompute:'ENABLED'|'DISABLED';paidFallback:'DISABLED';model:{id:string;revision?:string;license:string;commercialUse:string;checksumsPinned:boolean}|null;validation?:{status:string;issues:Issue[];checks:Check[]}};
/** Hash of everything the user is shown. Computed only on the server; a client cannot forge a different policy by sending it. */
export async function authorizationFingerprint(c:Pick<AuthorizationCard,'backend'|'estimate'|'maxCostEur'|'paidCompute'|'model'|'workflowId'|'workflowRevision'>&{policyMode:string;files:string[];projectId:string;sceneId:string}){
 return sha256(new TextEncoder().encode(canonicalJson({b:c.backend,e:c.estimate,m:c.maxCostEur,p:c.paidCompute,model:c.model,f:c.files,w:c.workflowId,r:c.workflowRevision,pm:c.policyMode,proj:c.projectId,scene:c.sceneId})));
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
export type ServiceDeps={projects:ProjectStore;storage:StorageBackend;backends:BackendRegistry;router:ModelRouter;workflows:WorkflowRegistry;policy:ComputePolicy;modelMode:ModelMode;director?:AIDirector;refs:CharacterReferenceSystem;audit?:AuditLog;requireSceneLock?:boolean;inspector?:OutputInspector;strictness?:OutputStrictness;now?:()=>Date;maxActive?:number;/** Server config: a render must carry the fingerprint of a preflight that was AUTHORIZED. */requireAuthorizationFingerprint?:boolean;ledger?:LiveVerificationLedger};
const MAX_CLIPS=12;
const HEX=(n:number)=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
export class RenderService{
 readonly audit:AuditLog;private records=new Map<string,RenderRecord>();private animations=new Map<string,{cancelled:boolean;child?:string}>();private active=new Map<string,{cancelled:boolean;backendId?:string;token?:ExecutionToken}>();
 private gate=new ComputeCostGate();private firewall=new PaidComputeFirewall();
 private d:ServiceDeps;
 constructor(d:ServiceDeps){this.d=d;assertPolicyInvariant(d.policy);this.audit=d.audit??new AuditLog(d.now);}
 get(id:string){const r=this.records.get(id);return r&&structuredClone(r);}
 list(){return [...this.records.values()].map(r=>({id:r.job.id,state:r.state,projectId:r.job.projectId,sceneId:r.job.sceneId}));}
 /** Returns immediately with the QUEUED record; `done` settles when the job reaches a terminal state. */
 start(req:RenderRequest):{jobId:string;done:Promise<RenderRecord>}{
  return req.workflowId==='character_animation'?this.startAnimation(req):this.startJob(req);
 }
 private startJob(req:RenderRequest):{jobId:string;done:Promise<RenderRecord>}{
  if(this.active.size>=(this.d.maxActive??2))throw new Blocked('busy','Too many renders are running.');
  const now=(this.d.now??(()=>new Date()))().toISOString(),id='rj_'+HEX(10);
  const job:RenderJob={id,projectId:req.projectId,sceneId:req.sceneId,workflowId:req.workflowId,modelId:req.modelId??'',backendId:req.backendId,prompt:'',inputs:[],outputFormat:req.outputFormat??'image',requestedBy:req.requestedBy,createdAt:now,params:{width:1024,height:1024,steps:20,sampler:'euler',scheduler:'normal',cfg:5}};
  const rec:RenderRecord={job,state:'QUEUED',history:[{state:'QUEUED',at:now}],versions:{ruleEngine:RULE_ENGINE_VERSION,aiDirector:AI_DIRECTOR_VERSION,promptCompiler:PROMPT_COMPILER_VERSION,aiDirectorId:'none'},scene:{revision:0},outputs:[],errors:[],providerContacted:false};
  this.records.set(id,rec);this.active.set(id,{cancelled:false});
  const done=this.run(req,rec).finally(()=>this.active.delete(id));
  return{jobId:id,done};
 }
 async cancel(jobId:string){
  const an=this.animations.get(jobId);if(an){an.cancelled=true;if(an.child)await this.cancel(an.child);return true;}
  const a=this.active.get(jobId);if(!a)return false;a.cancelled=true;
  const b=a.backendId?this.d.backends.get(a.backendId):undefined;if(b)await b.cancel(jobId,a.token).catch(()=>{});return true;
 }

 /**
  * Read-only authorization preview shown BEFORE execution. Runs the same planning and gate as a render, but contacts no provider,
  * mints no execution token, writes nothing and downloads nothing.
  */
 async preflight(req:RenderRequest):Promise<AuthorizationCard>{
  return req.workflowId==='character_animation'?this.preflightAnimation(req):this.preflightJob(req);
 }
 private async preflightJob(req:RenderRequest):Promise<AuthorizationCard>{
  const now=(this.d.now??(()=>new Date()))().toISOString();
  const job:RenderJob={id:'preflight',projectId:req.projectId,sceneId:req.sceneId,workflowId:req.workflowId,modelId:req.modelId??'',backendId:req.backendId,prompt:'',inputs:[],outputFormat:req.outputFormat??'image',requestedBy:req.requestedBy,createdAt:now,params:{width:1024,height:1024,steps:20,sampler:'euler',scheduler:'normal',cfg:5}};
  const rec:RenderRecord={job,state:'QUEUED',history:[],versions:{ruleEngine:RULE_ENGINE_VERSION,aiDirector:AI_DIRECTOR_VERSION,promptCompiler:PROMPT_COMPILER_VERSION,aiDirectorId:'none'},scene:{revision:0},outputs:[],errors:[],providerContacted:false};
  const policy=this.d.policy,base={workflowId:req.workflowId,maxCostEur:policy.maxCostEur,paidCompute:(policy.allowPaidCompute?'ENABLED':'DISABLED') as 'ENABLED'|'DISABLED',paidFallback:'DISABLED' as const};
  const view=(m?:ReturnType<ModelRegistry['get']>)=>m?{id:m.id,revision:m.revision,license:m.license,commercialUse:m.commercialUse,checksumsPinned:!!m.files?.length}:null;
  let stage='plan',model=req.modelId?this.d.router.registry.get(req.modelId):undefined,backendView:AuthorizationCard['backend']=null,estimate:AuthorizationCard['estimate']=null,wfRev:number|undefined=this.d.workflows.get(req.workflowId)?.revision;
  const card=(status:'AUTHORIZED'|'BLOCKED',reasons:string[],extra:Partial<AuthorizationCard>={}):AuthorizationCard=>({status,stage,reasons,...base,workflowRevision:wfRev,backend:backendView,estimate,model:view(model),validation:rec.validation,...extra});
  try{
   const p=await this.plan(req,rec,true);model=p.model;wfRev=p.wf.revision;
   backendView={id:p.backend.descriptor.id,class:p.backend.descriptor.class,provider:p.backend.descriptor.provider,enabled:p.backend.descriptor.enabled};
   stage='cost';const auth=await this.gate.authorize(rec.job,p.backend,policy);estimate={estimatedCostEur:auth.estimate.estimatedCostEur,confidence:auth.estimate.confidence,billingProvider:auth.estimate.billingProvider};
   if(!auth.authorized)return card('BLOCKED',auth.reasons);
   const fp=await authorizationFingerprint({backend:backendView,estimate,maxCostEur:policy.maxCostEur,paidCompute:base.paidCompute,model:view(model),workflowId:p.wf.id,workflowRevision:p.wf.revision,policyMode:policy.mode,files:(p.model.files??[]).map(f=>f.sha256),projectId:req.projectId,sceneId:req.sceneId});
   stage='authorized';return card('AUTHORIZED',[],{fingerprint:fp});
  }catch(e){
   if(e instanceof Blocked){const b=this.d.backends.get(req.backendId??'');if(b&&!backendView){backendView={id:b.descriptor.id,class:b.descriptor.class,provider:b.descriptor.provider,enabled:b.descriptor.enabled};}return card('BLOCKED',[e.message],{});}
   return card('BLOCKED',['Preflight failed.']);
  }
 }
 private async set(rec:RenderRecord,state:RenderState){rec.state=state;rec.history.push({state,at:(this.d.now??(()=>new Date()))().toISOString()});await this.audit.append(rec.job.id,'state',{state});}
 private async block(rec:RenderRecord,e:Blocked,extra?:string[]){
  rec.blocked={code:e.code,banner:blockedMessage([...(extra??[]),e.message],rec.providerContacted)};rec.errors.push(e.message);await this.set(rec,'BLOCKED');
 }
 private async run(req:RenderRequest,rec:RenderRecord):Promise<RenderRecord>{
  const job=rec.job,ctl=this.active.get(job.id)!;
  try{
   await this.audit.append(job.id,'request',{...req});
   if(this.d.requireAuthorizationFingerprint&&!req.authorizationFingerprint)throw new Blocked('authorization-required','A render must be started from an AUTHORIZED preflight (authorizationFingerprint is missing).');
   await this.set(rec,'VALIDATING');
   const {model,backend,bytes}=await this.plan(req,rec,false);
   // 13-15 cost, gate, firewall
   await this.set(rec,'COST_CHECK');
   const auth=await this.gate.authorize(job,backend,this.d.policy);rec.cost=auth;await this.audit.append(job.id,'cost-authorization',auth);
   if(!auth.authorized)throw new Blocked('cost-blocked','Compute authorization failed.');
   if(req.authorizationFingerprint){const live=await authorizationFingerprint({backend:{id:backend.descriptor.id,class:backend.descriptor.class,provider:backend.descriptor.provider,enabled:backend.descriptor.enabled},estimate:{estimatedCostEur:auth.estimate.estimatedCostEur,confidence:auth.estimate.confidence,billingProvider:auth.estimate.billingProvider},maxCostEur:this.d.policy.maxCostEur,paidCompute:this.d.policy.allowPaidCompute?'ENABLED':'DISABLED',model:{id:model.id,revision:model.revision,license:model.license,commercialUse:model.commercialUse,checksumsPinned:!!model.files?.length},workflowId:rec.workflow!.id,workflowRevision:rec.workflow!.revision,policyMode:this.d.policy.mode,files:(model.files??[]).map(f=>f.sha256),projectId:job.projectId,sceneId:job.sceneId});if(live!==req.authorizationFingerprint)throw new Blocked('authorization-changed','What was authorized no longer matches (backend, cost, model, workflow or policy changed). Run the preflight again.');}
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
   if(result.runtimeEvidence){rec.runtimeEvidence=result.runtimeEvidence;await this.audit.append(job.id,'runtime-evidence',result.runtimeEvidence);}
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
   if(this.d.ledger){
    // liveVerified can only follow a fully completed, uploaded and audited render; the ledger re-checks all of it itself.
    const r=await this.d.ledger.evaluate(rec,backend.descriptor.provider);rec.liveVerification=r;
    await this.audit.append(job.id,'live-verification',r);await this.persist(rec);
   }
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
 /** Steps 2-12 (no provider contact, no gate). With dry=true nothing is audited or downloaded. */
 private async plan(req:RenderRequest,rec:RenderRecord,dry:boolean){
  const job=rec.job,ctl=this.active.get(job.id),note=async(t:string,d:unknown)=>{if(!dry)await this.audit.append(job.id,t,d);};
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
   await note('ai-suggestion',{director:director.id,raw});
   const v=validateSuggestion(canon,req.sceneId,raw);rec.validation={status:v.status,issues:v.issues,checks:v.checks};
   await note('hallucination-checks',{status:v.status,issues:v.issues,checks:v.checks});
   if(v.status!=='APPROVED'||!v.approved)throw new Blocked('ai-rejected','AI suggestion rejected: '+v.issues.map(i=>i.message).join(' '));
   // 9 deterministic prompt
   const prompt=compilePrompt(v.approved,canon,lock,req.focus?{eventId:req.focus.eventId}:undefined);job.prompt=prompt.prompt;job.negativePrompt=prompt.negativePrompt;
   // 10-11 workflow, model, license
   const wf=this.d.workflows.require(req.workflowId);rec.workflow={id:wf.id,revision:wf.revision};
   const model=this.d.router.select({workflowId:req.workflowId,modelId:req.modelId,mode:this.d.modelMode,policy:this.d.policy});
   if(!model.capabilities.includes(wf.requiredCapability))throw new Blocked('model-capability',`Model "${model.id}" lacks capability "${wf.requiredCapability}".`);
   const m=assessModel(model,this.d.modelMode,this.d.policy);if(!m.ok)throw new Blocked('model-license',m.reasons.join(' '));
   job.modelId=model.id;rec.model={id:model.id,revision:model.revision,license:model.license,commercialUse:model.commercialUse,source:model.source};
   job.params={...job.params,...model.defaults,...req.params};
   job.seed=req.seed??parseInt(HEX(4),16);
   // inputs (storage only, no compute)
   const refChars=req.focus?[req.focus.actorId]:canon.scenes[req.sceneId].characterIds;
   await this.d.refs.load(req.projectId,refChars);
   job.inputs=this.d.refs.resolve(req.projectId,refChars,wf.requiresCharacterReference||!!req.focus);
   if(wf.requiresSourceImage&&!job.inputs.length)throw new Blocked('input-missing',`Workflow "${wf.id}" needs an approved reference image as source.`);
   const bytes=new Map<string,Uint8Array>();if(!dry)for(const i of job.inputs){const ref=JSON.parse(i.storageRef??'null') as AssetRef|null;if(!ref)throw new Blocked('input-missing','Input has no storage reference.');bytes.set(i.assetId,await this.d.storage.downloadAsset(ref));}
   if(job.outputFormat==='image'&&wf.kind==='video')job.outputFormat='video';
   if(job.outputFormat==='image'&&wf.kind==='image')job.outputFormat='png';
   if(job.outputFormat==='video')job.outputFormat='mp4';
   // 12 backend
   const backend=this.d.backends.select(req.backendId,d=>d.enabled&&this.d.policy.allowedBackendClasses.includes(d.class));
   job.backendId=backend.descriptor.id;if(ctl)ctl.backendId=job.backendId;rec.backend={id:job.backendId,class:backend.descriptor.class,provider:backend.descriptor.provider};
   const caps=await backend.getCapabilities();if(!caps.workflows.includes(wf.id))throw new Blocked('backend-capability',`Backend "${job.backendId}" does not support workflow "${wf.id}".`);
   const sp=backend.staticValidate?.(job)??[];if(sp.length)throw new Blocked('backend-static',sp.join(' '));
   return{canon,lock,model,wf,backend,bytes};
 }

 // ---- character_animation: an ordered set of image_to_video clips, one per approved scene event ----
 /** Clip requests derived ONLY from the approved (locked) scene events; capped so cost stays bounded. */
 private async clipRequests(req:RenderRequest):Promise<{clips:ClipPlan[];reqs:RenderRequest[]}>{
  const live=this.d.projects.get(req.projectId);if(!live)throw new Blocked('project-unknown',`Unknown project "${req.projectId}".`);
  const sc=own(live.scenes,req.sceneId);if(!sc)throw new Blocked('scene-unknown',`Unknown scene "${req.sceneId}".`);
  const lock=this.d.projects.getLock(req.projectId,req.sceneId);
  if(lock){if(!await lockMatches(lock,live))throw new Blocked('lock-stale','The approved scene lock no longer matches canon. Unlock and re-approve the scene.');}
  else if(this.d.requireSceneLock!==false)throw new Blocked('lock-missing','The scene is not approved and locked.');
  const events=[...(lock?lock.snapshot.scenes[req.sceneId]:sc).events].sort((a,b)=>a.at-b.at);
  if(!events.length)throw new Blocked('no-events','The scene has no approved events to animate.');
  if(events.length>MAX_CLIPS)throw new Blocked('too-many-clips',`character_animation is limited to ${MAX_CLIPS} clips per run (scene has ${events.length}).`);
  const clips=events.map(e=>({eventId:e.id,at:e.at,actor:e.actor,action:e.action,...(e.target?{target:e.target}:{})}));
  return{clips,reqs:events.map(e=>({...req,workflowId:'image_to_video',focus:{eventId:e.id,actorId:e.actor},authorizationFingerprint:undefined}))};
 }
 private async preflightAnimation(req:RenderRequest):Promise<AuthorizationCard>{
  const policy=this.d.policy,paid=(policy.allowPaidCompute?'ENABLED':'DISABLED') as 'ENABLED'|'DISABLED';
  const blocked=(reason:string,extra:Partial<AuthorizationCard>={}):AuthorizationCard=>({status:'BLOCKED',stage:'plan',reasons:[reason],workflowId:'character_animation',backend:null,estimate:null,maxCostEur:policy.maxCostEur,paidCompute:paid,paidFallback:'DISABLED',model:null,...extra});
  let plan;try{plan=await this.clipRequests(req);}catch(e){return blocked(e instanceof Blocked?e.message:'Preflight failed.');}
  const cards:AuthorizationCard[]=[];for(const r of plan.reqs)cards.push(await this.preflightJob(r));
  const bad=cards.find(c=>c.status!=='AUTHORIZED'),first=cards[0],total=cards.every(c=>c.estimate?.estimatedCostEur!=null)?cards.reduce((s,c)=>s+(c.estimate!.estimatedCostEur as number),0):null;
  const base:Partial<AuthorizationCard>={clips:plan.clips,backend:first.backend,model:first.model,workflowRevision:this.d.workflows.get('character_animation')?.revision,estimate:first.estimate&&{...first.estimate,estimatedCostEur:total},validation:first.validation};
  if(bad)return blocked(`Clip ${cards.indexOf(bad)+1}/${cards.length}: ${bad.reasons.join(' ')}`,{...base,stage:bad.stage});
  if(total===null||total>policy.maxCostEur||!policy.allowPaidCompute&&total!==0)return blocked('Total compute cost is unknown or exceeds the policy maximum.',base);
  const fp=await sha256(new TextEncoder().encode(canonicalJson({clips:cards.map(c=>c.fingerprint),n:cards.length,projectId:req.projectId,sceneId:req.sceneId})));
  return{status:'AUTHORIZED',stage:'authorized',reasons:[],fingerprint:fp,workflowId:'character_animation',...base,maxCostEur:policy.maxCostEur,paidCompute:paid,paidFallback:'DISABLED'} as AuthorizationCard;
 }
 /** Clips run strictly one after another through the normal single-job path (own gate, firewall, audit, output checks). A failure ends the run. */
 private startAnimation(req:RenderRequest):{jobId:string;done:Promise<RenderRecord>}{
  if(this.animations.size>=1)throw new Blocked('busy','An animation run is already in progress.');
  const now=()=>(this.d.now??(()=>new Date()))().toISOString(),id='ra_'+HEX(10);
  const job:RenderJob={id,projectId:req.projectId,sceneId:req.sceneId,workflowId:'character_animation',modelId:req.modelId??'',backendId:req.backendId,prompt:'',inputs:[],outputFormat:'video',requestedBy:req.requestedBy,createdAt:now(),params:{width:1024,height:1024,steps:20,sampler:'euler',scheduler:'normal',cfg:5}};
  const rec:RenderRecord={job,state:'QUEUED',history:[{state:'QUEUED',at:now()}],versions:{ruleEngine:RULE_ENGINE_VERSION,aiDirector:AI_DIRECTOR_VERSION,promptCompiler:PROMPT_COMPILER_VERSION,aiDirectorId:'none'},scene:{revision:0},outputs:[],errors:[],providerContacted:false,children:[]};
  this.records.set(id,rec);const ctl={cancelled:false,child:undefined as string|undefined};this.animations.set(id,ctl);
  const stop=async(e:unknown)=>{if(e instanceof Blocked){rec.blocked={code:e.code,banner:blockedMessage([e.message],rec.providerContacted)};rec.errors.push(e.message);await this.set(rec,'BLOCKED');}else{rec.errors.push((e as Error).message??'Animation failed.');await this.set(rec,'FAILED');}};
  const done=(async()=>{
   try{
    await this.audit.append(id,'request',{...req});await this.set(rec,'VALIDATING');
    if(this.d.requireAuthorizationFingerprint&&!req.authorizationFingerprint)throw new Blocked('authorization-required','A render must be started from an AUTHORIZED preflight (authorizationFingerprint is missing).');
    const plan=await this.clipRequests(req);await this.set(rec,'COST_CHECK');
    const cards:AuthorizationCard[]=[];for(const r of plan.reqs)cards.push(await this.preflightJob(r));
    const bad=cards.find(c=>c.status!=='AUTHORIZED');if(bad)throw new Blocked('cost-blocked',`Clip ${cards.indexOf(bad)+1}/${cards.length}: ${bad.reasons.join(' ')}`);
    const parent=await this.preflightAnimation(req);if(parent.status!=='AUTHORIZED')throw new Blocked('cost-blocked',parent.reasons.join(' '));
    if(req.authorizationFingerprint&&parent.fingerprint!==req.authorizationFingerprint)throw new Blocked('authorization-changed','What was authorized no longer matches (backend, cost, model, workflow, clips or policy changed). Run the preflight again.');
    await this.audit.append(id,'clip-plan',plan.clips);await this.set(rec,'AUTHORIZED');await this.set(rec,'SUBMITTING');await this.set(rec,'RENDERING');
    const clipFiles:{eventId:string;jobId:string;file:string}[]=[];
    for(let i=0;i<plan.reqs.length;i++){
     if(ctl.cancelled){await this.set(rec,'CANCELLED');return rec;}
     const child=this.startJob({...plan.reqs[i],authorizationFingerprint:cards[i].fingerprint});ctl.child=child.jobId;
     rec.children!.push({jobId:child.jobId,eventId:plan.clips[i].eventId,state:'QUEUED'});
     const cr=await child.done;ctl.child=undefined;rec.children![i].state=cr.state;if(cr.providerContacted)rec.providerContacted=true;
     if(ctl.cancelled){await this.set(rec,'CANCELLED');return rec;}
     if(cr.state!=='COMPLETED'){throw cr.state==='BLOCKED'&&cr.blocked?new Blocked(cr.blocked.code,`Clip ${i+1}/${plan.reqs.length} blocked: ${cr.errors.join(' ')}`):new Error(`Clip ${i+1}/${plan.reqs.length} ${cr.state}: ${cr.errors.join(' ')}`);}
     rec.outputs.push(...cr.outputs);for(const o of cr.outputs)clipFiles.push({eventId:plan.clips[i].eventId,jobId:cr.job.id,file:o.name});
     if(i===0){rec.model=cr.model;rec.backend=cr.backend;rec.cost=cr.cost;rec.workflow={id:'character_animation',revision:this.d.workflows.get('character_animation')?.revision??1};rec.scene=cr.scene;}
    }
    await this.set(rec,'UPLOADING');
    // The server does not join video (no ffmpeg dependency). The ordered manifest lets the studio assemble the clips.
    const manifest={schema:1,parentJobId:id,projectId:req.projectId,sceneId:req.sceneId,workflow:'character_animation',composedOf:'image_to_video',clips:plan.clips.map(c=>({...c,files:clipFiles.filter(f=>f.eventId===c.eventId)}))};
    rec.sequence=await putJson(this.d.storage,req.projectId,'renders',`${id}-sequence.json`,manifest);
    await this.audit.append(id,'outputs',{clips:clipFiles.length,sequence:rec.sequence});await this.set(rec,'COMPLETED');await this.persist(rec);return rec;
   }catch(e){await stop(e);await this.persist(rec).catch(()=>{});return rec;}
  })().finally(()=>this.animations.delete(id));
  return{jobId:id,done};
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
