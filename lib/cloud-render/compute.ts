import type {BackendClass,ComputePolicy,CostEstimate,RenderJob} from './types.ts';
import {Blocked} from './types.ts';
import type {RenderBackend,BackendDescriptor} from './backends.ts';

export const ZERO_COST_POLICY:ComputePolicy=Object.freeze({mode:'zero-cost',allowPaidCompute:false,maxCostEur:0,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:Object.freeze(['free'] as BackendClass[])});
const KNOWN_PROVIDERS_UNKNOWN=new Set(['','unknown']);
/** Policy is read from server environment only. Anything ambiguous collapses to zero-cost. */
export function loadComputePolicy(env:Record<string,string|undefined>):ComputePolicy{
 const allow=env.HAHMOSTUDIO_ALLOW_PAID_COMPUTE==='yes-i-accept-charges',max=Number(env.HAHMOSTUDIO_MAX_COST_EUR??0);
 if(env.HAHMOSTUDIO_ALLOW_PAID_FALLBACK||env.HAHMOSTUDIO_ALLOW_UNKNOWN_COST)throw new Error('Paid fallback and unknown cost cannot be enabled.');
 if(!allow)return ZERO_COST_POLICY;
 if(!Number.isFinite(max)||max<=0||max>1000)throw new Error('Paid compute needs HAHMOSTUDIO_MAX_COST_EUR between 0 and 1000.');
 return Object.freeze({mode:'paid-limited',allowPaidCompute:true,maxCostEur:max,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:Object.freeze(['free','owned','paid'] as BackendClass[])});
}
export function assertPolicyInvariant(p:ComputePolicy){
 if(p.allowPaidFallback!==false||p.allowUnknownCost!==false)throw new Blocked('policy-invalid','Paid fallback and unknown cost are never allowed.');
 if(!p.allowPaidCompute&&(p.maxCostEur!==0||p.allowedBackendClasses.some(c=>c!=='free')))throw new Blocked('policy-invalid','Zero-cost policy must allow only free backends at EUR 0.');
}
/** Single decision function shared by the gate and the firewall. Returns the reasons it must stop. */
export function costViolations(d:BackendDescriptor,est:CostEstimate,p:ComputePolicy):string[]{
 const out:string[]=[];
 try{assertPolicyInvariant(p);}catch(e){out.push((e as Error).message);}
 if(!d.enabled)out.push(`Backend "${d.id}" is disabled.`);
 if(!['free','owned','paid'].includes(d.class))out.push(`Backend "${d.id}" has an unknown backend class.`);
 if(d.class==='unknown')out.push(`Backend "${d.id}" has an unknown backend class.`);
 if(!p.allowedBackendClasses.includes(d.class))out.push(`Backend class "${d.class}" is not allowed by the compute policy.`);
 if(d.class==='paid'&&!p.allowPaidCompute)out.push('Paid compute is disabled.');
 if(KNOWN_PROVIDERS_UNKNOWN.has(d.billingProvider)||KNOWN_PROVIDERS_UNKNOWN.has(est.billingProvider))out.push('Billing provider is unknown.');
 if(est.confidence==='unknown'||est.estimatedCostEur===null||!Number.isFinite(est.estimatedCostEur)||est.estimatedCostEur<0)out.push('Compute cost is unknown.');
 else{
  if(est.estimatedCostEur>p.maxCostEur)out.push(`Estimated cost EUR ${est.estimatedCostEur} exceeds the maximum EUR ${p.maxCostEur}.`);
  if(!p.allowPaidCompute&&est.estimatedCostEur!==0)out.push('Zero-cost mode allows only EUR 0.00.');
 }
 if(!p.allowPaidCompute&&d.class==='paid')out.push('Paid backend in zero-cost mode.');
 return [...new Set(out)];
}
export type ComputeAuthorization={authorized:boolean;backendId:string;estimate:CostEstimate;reasons:string[];policyMode:string;maxCostEur:number;paidFallback:'DISABLED';paidCompute:'ENABLED'|'DISABLED'};
export class ComputeCostGate{
 async authorize(job:RenderJob,backend:RenderBackend,policy:ComputePolicy):Promise<ComputeAuthorization>{
  // estimateCost is declarative and must not contact a provider (enforced by the ExecutionToken for every networked method).
  let estimate:CostEstimate;try{estimate=await backend.estimateCost(job);}catch{estimate={estimatedCostEur:null,confidence:'unknown',billingProvider:'unknown'};}
  const reasons=costViolations(backend.descriptor,estimate,policy);
  return{authorized:!reasons.length,backendId:backend.descriptor.id,estimate,reasons,policyMode:policy.mode,maxCostEur:policy.maxCostEur,paidFallback:'DISABLED',paidCompute:policy.allowPaidCompute?'ENABLED':'DISABLED'};
 }
}
// ---- Execution token: the only way to call a networked backend method ----
const issued=new WeakMap<object,{jobId:string;backendId:string;cost:number}>();
export type ExecutionToken={readonly jobId:string;readonly backendId:string;readonly estimatedCostEur:number};
export function assertToken(t:ExecutionToken|undefined,jobId:string,backendId:string){
 const rec=t&&issued.get(t);
 if(!rec||rec.jobId!==jobId||rec.backendId!==backendId)throw new Blocked('no-token','Provider call attempted without a PaidComputeFirewall execution token.');
}
export class PaidComputeFirewall{
 /** Second, independent check immediately before provider execution. Re-evaluates everything from the backend itself. */
 async clear(job:RenderJob,backend:RenderBackend,gate:ComputeAuthorization,policy:ComputePolicy):Promise<ExecutionToken>{
  if(!gate.authorized)throw new Blocked('gate-not-authorized','ComputeCostGate did not authorize this job.');
  let est:CostEstimate;try{est=await backend.estimateCost(job);}catch{throw new Blocked('cost-unknown','Compute cost is unknown.');}
  const reasons=costViolations(backend.descriptor,est,policy);
  if(reasons.length)throw new Blocked('firewall',reasons.join(' '));
  if(est.estimatedCostEur!==gate.estimate.estimatedCostEur||backend.descriptor.id!==gate.backendId)throw new Blocked('firewall','Cost estimate changed between authorization and execution.');
  if(!policy.allowPaidCompute){
   if(backend.descriptor.class==='paid'||est.estimatedCostEur!==0||est.confidence==='unknown')throw new Blocked('firewall','Cost invariant violated.');
  }
  const token:ExecutionToken=Object.freeze({jobId:job.id,backendId:backend.descriptor.id,estimatedCostEur:est.estimatedCostEur as number});
  issued.set(token,{jobId:job.id,backendId:token.backendId,cost:token.estimatedCostEur});
  return token;
 }
}
export function blockedMessage(reasons:string[],runtimeContacted=false):string{
 return ['RENDER BLOCKED','',...reasons,'','Paid compute is disabled unless server policy enables it.','No paid fallback was attempted.',runtimeContacted?'The authorized runtime was contacted for validation only; no render was started.':'No provider API was contacted.'].join('\n');
}
