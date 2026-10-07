import {Blocked,type ComputePolicy,type ModelMode} from './types.ts';
import {validateSuggestion} from './ai-validator.ts';
import {buildAIContext} from './ai-context.ts';
import {RuleBasedDirector,type AIDirector,AI_DIRECTOR_VERSION} from './ai-suggestion.ts';
import {ComputeCostGate,costViolations} from './compute.ts';
import {assessModel,type ModelRegistry} from './models.ts';
import type {BackendRegistry} from './backends.ts';
import type {WorkflowRegistry} from './workflows.ts';
import {parseRenderRequest,type ProjectStore,type RenderService} from './pipeline.ts';
import {own,RuleViolation,RULE_ENGINE_VERSION} from './canonical.ts';
import type {RenderJob} from './types.ts';

export type ApiRequest={method:string;path:string;query?:URLSearchParams;body?:unknown;user:string};
export type ApiResponse={status:number;body:unknown};
export type ApiDeps={service:RenderService;projects:ProjectStore;models:ModelRegistry;workflows:WorkflowRegistry;backends:BackendRegistry;policy:ComputePolicy;modelMode:ModelMode;director?:AIDirector;storageId:string};
const ok=(body:unknown,status=200):ApiResponse=>({status,body});
const err=(status:number,code:string,message:string):ApiResponse=>({status,body:{error:message,code}});
const seg=(p:string)=>p.replace(/^\/api\//,'').split('/').map(decodeURIComponent);
/**
 * Framework-agnostic router. Policy, model mode and licensing are read-only here: there is deliberately no write route for them,
 * and request bodies are strictly parsed so a client cannot smuggle policy fields in.
 */
export function createCloudRenderApi(d:ApiDeps){
 const gate=new ComputeCostGate();
 return async function handle(r:ApiRequest):Promise<ApiResponse>{
  const s=seg(r.path),m=r.method.toUpperCase();
  try{
   if(s[0]==='health'&&m==='GET')return ok({ok:true,storage:d.storageId,modelMode:d.modelMode,policy:policyView(d.policy),versions:{ruleEngine:RULE_ENGINE_VERSION,aiDirector:AI_DIRECTOR_VERSION}});
   if(s[0]==='compute'){
    if(s[1]==='policy'){return m==='GET'?ok(policyView(d.policy)):err(405,'policy-readonly','Compute policy is configured on the server and cannot be changed through the API.');}
    if(s[1]==='estimate'&&m==='GET'){
     const id=r.query?.get('backendId')??d.backends.list().find(b=>b.descriptor.enabled)?.descriptor.id;const b=id?d.backends.get(id):undefined;if(!b)return err(404,'backend-unknown','Unknown backend.');
     const job={id:'estimate',projectId:'-',sceneId:'-',workflowId:r.query?.get('workflowId')??'text_to_image',modelId:'-',prompt:'',inputs:[],outputFormat:'png',requestedBy:r.user,createdAt:new Date().toISOString(),params:{width:1024,height:1024,steps:20,sampler:'euler',scheduler:'normal',cfg:5}} as RenderJob;
     const a=await gate.authorize(job,b,d.policy);return ok({backendId:id,estimate:a.estimate,authorized:a.authorized,reasons:a.reasons,maxCostEur:a.maxCostEur,paidCompute:a.paidCompute,paidFallback:a.paidFallback});
    }
    return err(404,'not-found','Not found.');
   }
   if(s[0]==='models'){
    if(m!=='GET')return err(405,'models-readonly','The model registry and license policy are server-side.');
    const view=(x:ReturnType<ModelRegistry['get']>&{})=>({...x,assessment:assessModel(x,d.modelMode,d.policy)});
    if(!s[1])return ok({mode:d.modelMode,models:d.models.list().map(view)});
    const x=d.models.get(s[1]);return x?ok(view(x)):err(404,'model-unknown','Unknown model.');
   }
   if(s[0]==='backends'&&m==='GET'){
    const out=[];for(const b of d.backends.list()){const e=await b.estimateCost({} as RenderJob).catch(()=>({estimatedCostEur:null,confidence:'unknown' as const,billingProvider:'unknown'}));out.push({...b.descriptor,declaredCost:e,eligibleUnderPolicy:costViolations(b.descriptor,e,d.policy).length===0,capabilities:await b.getCapabilities()});}
    return ok({backends:out,workflows:d.workflows.list().map(w=>({id:w.id,revision:w.revision,title:w.title,implemented:w.implemented,liveVerified:w.liveVerified}))});
   }
   if(s[0]==='projects'){
    if(!s[1]&&m==='GET')return ok({projects:d.projects.list()});
    if(s[1]&&!s[2]&&m==='PUT'){const b=r.body as {projectId?:string};if(b?.projectId!==s[1])return err(400,'bad-request','Body projectId must match the URL.');try{const st=await d.projects.put(r.body);return ok({projectId:st.projectId,revision:st.revision});}catch(e){return e instanceof RuleViolation?err(422,'canon-invalid',e.message):fail(e);}}
    const st=s[1]?d.projects.get(s[1]):undefined;
    if(s[1]&&!st)return err(404,'project-unknown','Unknown project.');
    if(st&&!s[2]&&m==='GET')return ok(st);
    if(st&&s[2]==='scenes'&&!s[3]&&m==='GET')return ok({scenes:Object.values(st.scenes).map(x=>({id:x.id,locationId:x.locationId,start:x.start,end:x.end,characterIds:x.characterIds,locked:!!d.projects.getLock(st.projectId,x.id)}))});
    if(st&&s[2]==='scenes'&&s[3]&&s[4]==='lock'&&m==='POST'){if(!own(st.scenes,s[3]))return err(404,'scene-unknown','Unknown scene.');const l=await d.projects.lock(st.projectId,s[3],r.user);return ok({id:l.id,hash:l.hash,lockedAt:l.lockedAt});}
    if(st&&s[2]==='scenes'&&s[3]&&s[4]==='lock'&&m==='DELETE'){return ok({unlocked:d.projects.unlock(st.projectId,s[3])});}
    return err(404,'not-found','Not found.');
   }
   if(s[0]==='ai'&&m==='POST'){
    const b=r.body as {projectId?:string;sceneId?:string;suggestion?:unknown;useAI?:boolean};
    const st=typeof b?.projectId==='string'?d.projects.get(b.projectId):undefined;if(!st||typeof b.sceneId!=='string'||!own(st.scenes,b.sceneId))return err(404,'scene-unknown','Unknown project or scene.');
    const lock=d.projects.getLock(st.projectId,b.sceneId),canon=lock?.snapshot??st;
    if(s[1]==='validate'){const v=validateSuggestion(canon,b.sceneId,b.suggestion);return ok({status:v.status,issues:v.issues,checks:v.checks});}
    if(s[1]==='direct'){
     const dir:AIDirector=b.useAI?(d.director??(()=>{throw new Blocked('director-unavailable','No AI Director is configured.');})()):new RuleBasedDirector();
     const raw=await dir.suggest(buildAIContext(canon,b.sceneId)).catch(()=>{throw new Blocked('director-failed','The AI Director failed.');});
     const v=validateSuggestion(canon,b.sceneId,raw);return ok({director:dir.id,version:dir.version,suggestion:raw,status:v.status,issues:v.issues,checks:v.checks,note:'Suggestion only. Nothing is rendered or committed.'});
    }
    return err(404,'not-found','Not found.');
   }
   if(s[0]==='render'){
    if(!s[1]&&m==='POST'){const q=parseRenderRequest(r.body,r.user);const {jobId,done}=d.service.start(q);done.catch(()=>{});return ok({jobId,record:d.service.get(jobId)},202);}
    if(!s[1]&&m==='GET')return ok({jobs:d.service.list()});
    if(s[1]&&!s[2]&&m==='GET'){const x=d.service.get(s[1]);return x?ok(x):err(404,'job-unknown','Unknown job.');}
    if(s[1]&&s[2]==='cancel'&&m==='POST'){return d.service.get(s[1])?ok({cancelled:await d.service.cancel(s[1])}):err(404,'job-unknown','Unknown job.');}
   }
   return err(404,'not-found','Not found.');
  }catch(e){return fail(e);}
 };
 function fail(e:unknown):ApiResponse{
  if(e instanceof Blocked)return err(e.code==='busy'?429:e.code==='client-policy-override'?400:e.code.endsWith('unknown')||e.code==='not-found'?404:400,e.code,e.message);
  return err(500,'internal','Internal error.');
 }
}
const policyView=(p:ComputePolicy)=>({mode:p.mode,allowPaidCompute:p.allowPaidCompute,maxCostEur:p.maxCostEur,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:[...p.allowedBackendClasses],guarantee:'In zero-cost mode the application will not intentionally invoke a paid compute backend. A free GPU is not guaranteed to be available; if none is, rendering is blocked.'});
